import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { RetryRequestError } from "crawlee";
import { hashHtml } from "../utils/hash.js";
import { responseHeader } from "./website-cooldowns.js";
import type { DanishJsonLdRequest, DanishJsonLdResponse } from "./crawler.js";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_FULL_FETCH_AGE_MS = 7 * 24 * 3600_000;
const SAVED_HEADERS = ["content-type", "etag", "last-modified", "cache-control", "vary", "age"];
export interface CachedRecipeResponse {
  version: 1;
  url: string;
  loadedUrl: string;
  body: string;
  headers: Record<string, string>;
  fetchedAt: number;
  validatedAt: number;
}
export class CacheMissRetryError extends RetryRequestError {
  constructor() { super("Cached response unavailable; retrying an unconditional request"); }
}

/** Recipe GET responses only: discovery always runs against the live website.
 * Replaying a validated body through extraction preserves run provenance and
 * verifies database writes even when a server returns an empty 304 response.
 */
export class IncrementalRecipeCache {
  private readonly now: () => number;
  constructor(private readonly options: {
    directory?: string;
    identity: string;
    fullRefresh?: boolean;
    refreshHours?: number;
    now?: () => number;
    diagnostic?: (data: Record<string, unknown>) => void;
  }) { this.now = options.now ?? Date.now; }

  eligible(request: DanishJsonLdRequest): boolean {
    return !!this.options.directory && request.kind === "recipe" && (request.method ?? "GET") === "GET"
      && !request.payload && !new URL(request.url).username && !new URL(request.url).password
      && !Object.keys(request.requestHeaders ?? {}).some((name) => /^(authorization|cookie|range|if-.*)$/iu.test(name));
  }
  private path(url: string): string {
    return join(this.options.directory!, "incremental", `${hashHtml(`${this.options.identity}\n${url}`)}.json.gz`);
  }
  async read(request: DanishJsonLdRequest): Promise<CachedRecipeResponse | undefined> {
    if (this.options.fullRefresh || !this.eligible(request)) return undefined;
    try {
      const data = gunzipSync(await readFile(this.path(request.url)), { maxOutputLength: MAX_BODY_BYTES + 64 * 1024 }).toString();
      const entry = JSON.parse(data) as CachedRecipeResponse;
      if (entry.version !== 1 || entry.url !== request.url || typeof entry.loadedUrl !== "string" || typeof entry.body !== "string"
        || !entry.headers || typeof entry.headers !== "object" || Object.values(entry.headers).some((value) => typeof value !== "string")
        || !Number.isFinite(entry.fetchedAt) || !Number.isFinite(entry.validatedAt)
        || entry.fetchedAt > this.now() || entry.validatedAt > this.now()
        || this.now() - entry.fetchedAt >= MAX_FULL_FETCH_AGE_MS) return undefined;
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.options.diagnostic?.({ reason: "cache-unreadable", url: request.url });
      return undefined; // An absent, old, or damaged cache always causes a full fetch.
    }
  }
  fresh(entry: CachedRecipeResponse): boolean {
    const control = entry.headers["cache-control"] ?? "";
    if (/\b(no-cache|must-revalidate)\b/iu.test(control)) return false;
    let lifetime = (this.options.refreshHours ?? 0) * 3600_000;
    const maxAge = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/iu.exec(control);
    if (maxAge) lifetime = Math.min(lifetime, Math.max(0, Number(maxAge[1]) - Number(entry.headers["age"] ?? 0)) * 1000);
    return lifetime > 0 && this.now() - entry.validatedAt < lifetime;
  }
  validators(entry: CachedRecipeResponse): Record<string, string> {
    if (entry.headers["etag"]) return { "If-None-Match": entry.headers["etag"] };
    if (entry.headers["last-modified"] && Number.isFinite(Date.parse(entry.headers["last-modified"]))) {
      return { "If-Modified-Since": entry.headers["last-modified"] };
    }
    return {};
  }
  response(entry: CachedRecipeResponse): Pick<DanishJsonLdResponse, "body" | "headers" | "loadedUrl" | "statusCode"> {
    return { body: entry.body, headers: entry.headers, loadedUrl: entry.loadedUrl, statusCode: 200 };
  }
  async remove(request: DanishJsonLdRequest): Promise<void> {
    if (!this.eligible(request)) return;
    await unlink(this.path(request.url)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
  async save(request: DanishJsonLdRequest, response: DanishJsonLdResponse, previous?: CachedRecipeResponse): Promise<void> {
    if (!this.eligible(request) || response.statusCode !== 200 || Buffer.byteLength(response.body) > MAX_BODY_BYTES) return;
    const headers: Record<string, string> = {};
    for (const name of SAVED_HEADERS) {
      const value = responseHeader(response.headers, name);
      if (value !== undefined) headers[name] = value;
    }
    // Personalized variants and session-setting responses are not reusable.
    const vary = (headers["vary"] ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (/\b(no-store|private)\b/iu.test(headers["cache-control"] ?? "")
      || responseHeader(response.headers, "set-cookie") !== undefined
      || vary.some((name) => !["accept", "accept-language", "accept-encoding", "user-agent"].includes(name))) {
      await this.remove(request);
      return;
    }
    const entry: CachedRecipeResponse = { version: 1, url: request.url, loadedUrl: response.loadedUrl ?? request.url,
      body: response.body, headers, fetchedAt: previous?.fetchedAt ?? this.now(), validatedAt: this.now() };
    const directory = join(this.options.directory!, "incremental");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = this.path(request.url);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, gzipSync(JSON.stringify(entry)), { flag: "wx", mode: 0o600 });
      await rename(temporary, path);
    } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }
}
