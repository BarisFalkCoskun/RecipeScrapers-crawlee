import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import https from "node:https";
import { Server as ProxyChainServer } from "proxy-chain";
import { SocksProxyAgent } from "socks-proxy-agent";

const MULLVAD_RELAYS_URL = "https://api-www.mullvad.net/www/relays/all/";
const DEFAULT_VERIFY_TIMEOUT_MS = 10_000;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1_000;

export interface MullvadRelay {
  hostname: string;
  country_code: string;
  country_name?: string;
  city_name?: string;
  active: boolean;
  type: string;
  socks_name: string;
  socks_port: number;
  provider?: string;
}

export interface RelayBridge {
  proxyUrl: string;
  close(): Promise<void>;
}

export interface MullvadRelayLease {
  relayLabel: string;
  country: string;
  proxyUrl: string;
}

export interface MullvadVerificationResult {
  mullvadExitIp: boolean;
  countryCode?: string;
  country?: string;
  hostname?: string;
}

export interface MullvadRelayDiagnostic {
  event: string;
  data: Record<string, unknown>;
}

interface ActiveLease extends MullvadRelayLease {
  relay: MullvadRelay;
  bridge: RelayBridge;
}

export interface MullvadRelayProviderOptions {
  country?: string;
  cooldownMs?: number;
  now?: () => number;
  fetchRelays: () => Promise<unknown>;
  readCache: () => Promise<unknown>;
  writeCache: (relays: unknown) => Promise<void>;
  verifyRelay: (relay: MullvadRelay) => Promise<MullvadVerificationResult>;
  openBridge: (relay: MullvadRelay) => Promise<RelayBridge>;
  diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
}

export class MullvadRelayProvider {
  private readonly country?: string;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly options: MullvadRelayProviderOptions;
  private readonly activeBySession = new Map<string, ActiveLease>();
  private readonly activeRelayLabels = new Set<string>();
  private readonly reservedRelayLabels = new Set<string>();
  private readonly sessionOperations = new Map<string, Promise<void>>();
  private readonly cooldownUntil = new Map<string, number>();
  private readonly scopedCooldownUntil = new Map<string, Map<string, number>>();
  private readonly usedBySession = new Map<string, Set<string>>();
  private relays: MullvadRelay[] = [];
  private closing = false;

  constructor(options: MullvadRelayProviderOptions) {
    this.options = options;
    this.country = normalizeCountry(options.country);
    this.cooldownMs = positiveInteger(options.cooldownMs, DEFAULT_COOLDOWN_MS);
    this.now = options.now ?? Date.now;
  }

  async initialize(): Promise<void> {
    this.closing = false;
    let document: unknown;
    try {
      document = await this.options.fetchRelays();
      await this.options.writeCache(document);
    } catch (fetchError) {
      try {
        document = await this.options.readCache();
      } catch (cacheError) {
        throw new Error("Unable to load Mullvad relays from the API or cache", {
          cause: cacheError ?? fetchError,
        });
      }
    }

    this.relays = parseRelays(document).filter((relay) =>
      relay.active &&
      relay.type.toLowerCase() === "wireguard" &&
      relay.socks_name.length > 0 &&
      relay.socks_port > 0 &&
      (!this.country || relay.country_code.toLowerCase() === this.country)
    );
    this.emit("vpn-relays-loaded", {
      country: this.country ?? "any",
      eligibleRelayCount: this.relays.length,
    });
  }

  async acquire(sessionId: string, targetScope?: string): Promise<MullvadRelayLease | null> {
    return this.runSessionOperation(sessionId, async () => {
      const existing = this.activeBySession.get(sessionId);
      if (existing) return publicLease(existing);
      return this.acquireFresh(sessionId, targetScope);
    });
  }

  async rebind(
    fromSessionId: string,
    toSessionId: string,
    targetScope?: string
  ): Promise<MullvadRelayLease | null> {
    if (fromSessionId === toSessionId) return this.acquire(toSessionId, targetScope);
    return this.runSessionOperation(toSessionId, async () => {
      const existing = this.activeBySession.get(toSessionId);
      if (existing) return publicLease(existing);
      const lease = this.activeBySession.get(fromSessionId);
      if (!lease) return this.acquireFresh(toSessionId, targetScope);
      this.activeBySession.delete(fromSessionId);
      this.activeBySession.set(toSessionId, lease);
      const used = this.usedBySession.get(fromSessionId) ??
        new Set([lease.relayLabel]);
      this.usedBySession.delete(fromSessionId);
      this.usedBySession.set(toSessionId, used);
      return publicLease(lease);
    });
  }

  async rotate(
    sessionId: string,
    targetScope?: string,
    cooldownMode: "global" | "scope" = "global"
  ): Promise<MullvadRelayLease | null> {
    return this.runSessionOperation(sessionId, async () => {
      const current = this.activeBySession.get(sessionId);
      if (current) {
        this.activeBySession.delete(sessionId);
        this.activeRelayLabels.delete(current.relayLabel);
        if (cooldownMode === "scope" && targetScope) {
          const scoped = this.scopedCooldownUntil.get(targetScope) ?? new Map<string, number>();
          scoped.set(current.relayLabel, this.now() + this.cooldownMs);
          this.scopedCooldownUntil.set(targetScope, scoped);
        } else {
          this.cooldownUntil.set(current.relayLabel, this.now() + this.cooldownMs);
        }
        await this.closeBridge(current);
      }
      return this.acquireFresh(sessionId, targetScope);
    });
  }

  async release(sessionId: string): Promise<void> {
    await this.runSessionOperation(sessionId, async () => {
      const current = this.activeBySession.get(sessionId);
      this.usedBySession.delete(sessionId);
      if (!current) return;
      this.activeBySession.delete(sessionId);
      this.activeRelayLabels.delete(current.relayLabel);
      await this.closeBridge(current);
      this.emit("vpn-relay-released", {
        relayLabel: current.relayLabel,
        country: current.country,
      });
    });
  }

  async invalidate(
    sessionId: string,
    targetScope?: string,
    cooldownMode: "global" | "scope" = "global"
  ): Promise<void> {
    await this.runSessionOperation(sessionId, async () => {
      const current = this.activeBySession.get(sessionId);
      if (!current) return;
      this.activeBySession.delete(sessionId);
      this.activeRelayLabels.delete(current.relayLabel);
      if (cooldownMode === "scope" && targetScope) {
        const scoped = this.scopedCooldownUntil.get(targetScope) ?? new Map<string, number>();
        scoped.set(current.relayLabel, this.now() + this.cooldownMs);
        this.scopedCooldownUntil.set(targetScope, scoped);
      } else {
        this.cooldownUntil.set(current.relayLabel, this.now() + this.cooldownMs);
      }
      await this.closeBridge(current);
    });
  }

  async cleanup(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.sessionOperations.values()]);
    const leases = [...this.activeBySession.values()];
    this.activeBySession.clear();
    this.activeRelayLabels.clear();
    this.reservedRelayLabels.clear();
    await Promise.allSettled(leases.map((lease) => this.closeBridge(lease)));
    this.sessionOperations.clear();
    this.cooldownUntil.clear();
    this.scopedCooldownUntil.clear();
    this.usedBySession.clear();
    this.relays = [];
  }

  private async acquireFresh(
    sessionId: string,
    targetScope?: string
  ): Promise<MullvadRelayLease | null> {
    const used = this.usedBySession.get(sessionId) ?? new Set<string>();
    this.usedBySession.set(sessionId, used);

    while (true) {
      const relay = this.nextCandidate(used, targetScope);
      if (!relay) {
        this.emitPoolExhausted(targetScope, used);
        return null;
      }
      const relayLabel = boundedRelayLabel(relay);
      used.add(relayLabel);
      this.reservedRelayLabels.add(relayLabel);

      let verification: MullvadVerificationResult = { mullvadExitIp: false };
      try {
        verification = await this.options.verifyRelay(relay);
      } catch {
        verification = { mullvadExitIp: false };
      }
      const verified = verificationMatchesRelay(
        verification,
        relay,
        this.country
      );
      if (!verified) {
        this.reservedRelayLabels.delete(relayLabel);
        this.cooldownUntil.set(relayLabel, this.now() + this.cooldownMs);
        this.emit("vpn-relay-verification-failed", {
          relayLabel,
          country: relay.country_code.toLowerCase(),
          reason: verification.mullvadExitIp
            ? "exit-identity-mismatch"
            : "not-mullvad-exit",
          verifiedCountry: boundedValue(
            verification.countryCode ?? verification.country
          ),
          verifiedRelayLabel: boundedValue(verification.hostname),
        });
        continue;
      }

      try {
        const bridge = await this.options.openBridge(relay);
        const lease: ActiveLease = {
          relay,
          relayLabel,
          country: relay.country_code.toLowerCase(),
          proxyUrl: bridge.proxyUrl,
          bridge,
        };
        this.activeBySession.set(sessionId, lease);
        this.activeRelayLabels.add(relayLabel);
        this.reservedRelayLabels.delete(relayLabel);
        this.emit("vpn-relay-leased", {
          relayLabel,
          country: lease.country,
        });
        return publicLease(lease);
      } catch {
        this.reservedRelayLabels.delete(relayLabel);
        this.cooldownUntil.set(relayLabel, this.now() + this.cooldownMs);
        this.emit("vpn-relay-bridge-failed", {
          relayLabel,
          country: relay.country_code.toLowerCase(),
        });
      }
    }
  }

  private nextCandidate(
    used: Set<string>,
    targetScope?: string
  ): MullvadRelay | undefined {
    const now = this.now();
    const scopedCooldown = targetScope
      ? this.scopedCooldownUntil.get(targetScope)
      : undefined;
    return this.relays.find((relay) => {
      const label = boundedRelayLabel(relay);
      const cooldown = this.cooldownUntil.get(label);
      if (cooldown !== undefined && cooldown <= now) {
        this.cooldownUntil.delete(label);
      }
      const scopedUntil = scopedCooldown?.get(label);
      if (scopedUntil !== undefined && scopedUntil <= now) {
        scopedCooldown?.delete(label);
      }
      return !used.has(label) &&
        !this.activeRelayLabels.has(label) &&
        !this.reservedRelayLabels.has(label) &&
        !this.cooldownUntil.has(label) &&
        !scopedCooldown?.has(label);
    });
  }

  private emitPoolExhausted(
    targetScope: string | undefined,
    used: Set<string>
  ): void {
    const scoped = targetScope
      ? this.scopedCooldownUntil.get(targetScope)
      : undefined;
    this.emit("vpn-relay-pool-exhausted", {
      targetScope: targetScope ?? "global",
      eligibleRelayCount: this.relays.length,
      activeRelayCount: this.activeRelayLabels.size,
      reservedRelayCount: this.reservedRelayLabels.size,
      globalCoolingRelayCount: this.cooldownUntil.size,
      scopedCoolingRelayCount: scoped?.size ?? 0,
      requestUsedRelayCount: used.size,
    });
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.options.diagnosticSink?.({ event, data });
  }

  private async closeBridge(lease: ActiveLease): Promise<void> {
    try {
      await lease.bridge.close();
    } catch {
      this.emit("vpn-relay-bridge-close-failed", {
        relayLabel: lease.relayLabel,
        country: lease.country,
      });
    }
  }

  private runSessionOperation<T>(
    sessionId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.closing) {
      return Promise.reject(new Error("Mullvad relay provider is closing"));
    }
    const previous = this.sessionOperations.get(sessionId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.sessionOperations.set(sessionId, tail);
    void tail.then(() => {
      if (this.sessionOperations.get(sessionId) === tail) {
        this.sessionOperations.delete(sessionId);
      }
    });
    return result;
  }
}

export function createDefaultMullvadRelayProvider(options: {
  country?: string;
  cachePath: string;
  cooldownMs?: number;
  verifyTimeoutMs?: number;
  diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
}): MullvadRelayProvider {
  const verifyTimeoutMs = positiveInteger(
    options.verifyTimeoutMs,
    DEFAULT_VERIFY_TIMEOUT_MS
  );
  return new MullvadRelayProvider({
    country: options.country,
    cooldownMs: options.cooldownMs,
    fetchRelays: async () => {
      const response = await fetch(MULLVAD_RELAYS_URL, {
        signal: AbortSignal.timeout(verifyTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Mullvad relay API returned HTTP ${response.status}`);
      }
      return response.json();
    },
    readCache: async () =>
      JSON.parse(await readFile(options.cachePath, "utf8")),
    writeCache: async (relays) => {
      await mkdir(dirname(options.cachePath), { recursive: true });
      await writeFile(
        options.cachePath,
        `${JSON.stringify(relays, null, 2)}\n`,
        "utf8"
      );
    },
    verifyRelay: (relay) => verifyMullvadRelay(relay, verifyTimeoutMs),
    openBridge: openHttpToSocksBridge,
    diagnosticSink: options.diagnosticSink,
  });
}

async function verifyMullvadRelay(
  relay: MullvadRelay,
  timeoutMs: number
): Promise<MullvadVerificationResult> {
  const agent = new SocksProxyAgent(socksUrl(relay), { timeout: timeoutMs });
  try {
    return await new Promise<MullvadVerificationResult>((resolve) => {
      const request = https.request(
        {
          hostname: "am.i.mullvad.net",
          path: "/json",
          method: "GET",
          agent,
          timeout: timeoutMs,
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            body += chunk;
          });
          response.on("end", () => {
            try {
              const parsed = JSON.parse(body) as Record<string, unknown>;
              const verification = parseMullvadVerification(parsed);
              resolve({
                ...verification,
                mullvadExitIp:
                  response.statusCode === 200 &&
                  verification.mullvadExitIp,
              });
            } catch {
              resolve({ mullvadExitIp: false });
            }
          });
        }
      );
      request.on("error", () => resolve({ mullvadExitIp: false }));
      request.on("timeout", () => {
        request.destroy();
        resolve({ mullvadExitIp: false });
      });
      request.end();
    });
  } finally {
    agent.destroy();
  }
}

async function openHttpToSocksBridge(
  relay: MullvadRelay
): Promise<RelayBridge> {
  const upstreamProxyUrl = socksUrl(relay);
  const server = new ProxyChainServer({
    host: "127.0.0.1",
    port: 0,
    verbose: false,
    prepareRequestFunction: () => ({ upstreamProxyUrl }),
  });
  await server.listen();
  return {
    proxyUrl: `http://127.0.0.1:${server.port}`,
    close: () => server.close(true),
  };
}

function parseRelays(document: unknown): MullvadRelay[] {
  if (!Array.isArray(document)) return [];
  return document.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== "object") return [];
    const relay = candidate as Record<string, unknown>;
    if (
      typeof relay["hostname"] !== "string" ||
      typeof relay["country_code"] !== "string" ||
      typeof relay["active"] !== "boolean" ||
      typeof relay["type"] !== "string" ||
      typeof relay["socks_name"] !== "string" ||
      typeof relay["socks_port"] !== "number"
    ) return [];
    return [{
      hostname: relay["hostname"],
      country_code: relay["country_code"],
      country_name:
        typeof relay["country_name"] === "string"
          ? relay["country_name"]
          : undefined,
      city_name:
        typeof relay["city_name"] === "string" ? relay["city_name"] : undefined,
      active: relay["active"],
      type: relay["type"],
      socks_name: relay["socks_name"],
      socks_port: relay["socks_port"],
      provider:
        typeof relay["provider"] === "string" ? relay["provider"] : undefined,
    }];
  });
}

export function parseMullvadVerification(
  document: Record<string, unknown>
): MullvadVerificationResult {
  return {
    mullvadExitIp:
      document["mullvad_exit_ip"] === true ||
      document["mullvadExitIp"] === true,
    countryCode: firstString(document, [
      "country_code",
      "countryCode",
      "exit_country_code",
      "exitCountryCode",
    ]),
    country: firstString(document, ["country", "exit_country", "exitCountry"]),
    hostname: firstString(document, [
      "mullvad_exit_ip_hostname",
      "mullvadExitIpHostname",
      "exit_hostname",
      "exitHostname",
      "hostname",
    ]),
  };
}

function verificationMatchesRelay(
  verification: MullvadVerificationResult,
  relay: MullvadRelay,
  requestedCountry: string | undefined
): boolean {
  if (!verification.mullvadExitIp) return false;
  if (!requestedCountry) return true;

  const signals: boolean[] = [];
  const countryCode = verification.countryCode?.trim().toLowerCase();
  if (countryCode) signals.push(countryCode === requestedCountry);
  const country = normalizeIdentity(verification.country);
  if (country) {
    const expectedCountry = normalizeIdentity(relay.country_name);
    signals.push(
      /^[a-z]{2}$/u.test(country)
        ? country === requestedCountry
        : Boolean(expectedCountry && country === expectedCountry)
    );
  }
  const hostname = normalizeRelayHostname(verification.hostname);
  if (hostname) {
    const expectedHostnames = [relay.hostname, relay.socks_name]
      .map(normalizeRelayHostname)
      .filter((value): value is string => Boolean(value));
    signals.push(
      expectedHostnames.includes(hostname) &&
      hostname.startsWith(`${requestedCountry}-`)
    );
  }
  return signals.length > 0 && signals.every(Boolean);
}

function normalizeIdentity(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeRelayHostname(value: string | undefined): string | undefined {
  return normalizeIdentity(value)
    ?.replace(/\.$/u, "")
    .replace(/\.relays\.mullvad\.net$/u, "");
}

function firstString(
  document: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = document[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function publicLease(lease: ActiveLease): MullvadRelayLease {
  return {
    relayLabel: lease.relayLabel,
    country: lease.country,
    proxyUrl: lease.proxyUrl,
  };
}

function boundedRelayLabel(relay: MullvadRelay): string {
  const normalized = relay.hostname
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return (normalized || "mullvad-relay").slice(0, 64);
}

function boundedValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._ -]+/gu, "-")
    .slice(0, 64);
}

function normalizeCountry(country: string | undefined): string | undefined {
  const normalized = country?.trim().toLowerCase();
  return normalized || undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0
    ? value as number
    : fallback;
}

function socksUrl(relay: MullvadRelay): string {
  const host = relay.socks_name.includes(":")
    ? `[${relay.socks_name}]`
    : relay.socks_name;
  return `socks5://${host}:${relay.socks_port}`;
}
