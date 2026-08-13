import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { ProxyConfiguration, type Request } from "crawlee";
import {
  createDefaultMullvadRelayProvider,
  type MullvadRelayDiagnostic,
  type MullvadRelayLease,
  type MullvadRelayProvider,
} from "./mullvad-relay-provider.js";

const PREFLIGHT_SESSION_ID = "vpn-preflight";
const MAX_ROTATIONS_PER_REQUEST = 3;
const REPEATED_TRANSPORT_FAILURES = 2;
const EXPLICIT_BLOCK_PATTERN =
  /captcha|access denied|checking your browser|cloudflare challenge|temporarily blocked|request (?:was )?blocked|security incident detected|unusual traffic/iu;
const TRANSPORT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "ERR_NETWORK_CHANGED",
]);

export interface VpnRotationDecision {
  rotated: boolean;
  eligible: boolean;
  exhausted: boolean;
  reason?: string;
}

export interface DanishJsonLdVpnTransport {
  readonly proxyConfiguration: ProxyConfiguration;
  initialize(): Promise<void>;
  handleResponse(input: {
    sessionId: string;
    statusCode: number;
    body: string;
  }): Promise<VpnRotationDecision>;
  handleFailure(input: {
    sessionId: string;
    error: unknown;
  }): Promise<VpnRotationDecision>;
  release(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export class MullvadVpnTransport implements DanishJsonLdVpnTransport {
  readonly proxyConfiguration: ProxyConfiguration;
  private readonly provider: MullvadRelayProvider;
  private readonly diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
  private readonly rotations = new Map<string, number>();
  private readonly consecutiveTransportFailures = new Map<string, number>();
  private readonly sessionOperations = new Map<string, Promise<void>>();
  private initialized = false;
  private preflightAvailable = false;
  private closing = false;

  constructor(options: {
    provider: MullvadRelayProvider;
    diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
  }) {
    this.provider = options.provider;
    this.diagnosticSink = options.diagnosticSink;
    this.proxyConfiguration = new ProxyConfiguration({
      newUrlFunction: async (_crawleeSessionId, options) => {
        if (!this.initialized) {
          throw new Error("Mullvad VPN transport has not been initialized");
        }
        const sessionId = readRequestSessionId(options?.request);
        return this.runSessionOperation(sessionId, async () => {
          let lease: MullvadRelayLease | null;
          if (this.preflightAvailable) {
            this.preflightAvailable = false;
            lease = await this.provider.rebind(PREFLIGHT_SESSION_ID, sessionId);
          } else {
            lease = await this.provider.acquire(sessionId);
          }
          if (!lease) {
            throw new Error(
              "No verified Mullvad relay is available for the request"
            );
          }
          return lease.proxyUrl;
        });
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      this.closing = false;
      await this.provider.initialize();
      const preflight = await this.provider.acquire(PREFLIGHT_SESSION_ID);
      if (!preflight) throw new Error("No verified Mullvad relay is available");
      this.initialized = true;
      this.preflightAvailable = true;
      this.emit("vpn-ready", {
        relayLabel: preflight.relayLabel,
        country: preflight.country,
      });
    } catch (error) {
      await this.provider.cleanup();
      throw error;
    }
  }

  async handleResponse(input: {
    sessionId: string;
    statusCode: number;
    body: string;
  }): Promise<VpnRotationDecision> {
    return this.runSessionOperation(input.sessionId, async () => {
      this.consecutiveTransportFailures.delete(input.sessionId);
      const explicitBlock =
        ![401, 404].includes(input.statusCode) &&
        EXPLICIT_BLOCK_PATTERN.test(input.body.slice(0, 20_000));
      const reason = [403, 429, 526].includes(input.statusCode)
        ? `http-${input.statusCode}`
        : explicitBlock
          ? "explicit-block"
          : undefined;
      return reason
        ? this.rotateLocked(input.sessionId, reason)
        : noRotation();
    });
  }

  async handleFailure(input: {
    sessionId: string;
    error: unknown;
  }): Promise<VpnRotationDecision> {
    if (input.error instanceof VpnRotationRetryError) return noRotation();
    return this.runSessionOperation(input.sessionId, async () => {
      if (isApplicationFailure(input.error)) return noRotation();
      if (isProxyFailure(input.error)) {
        this.consecutiveTransportFailures.delete(input.sessionId);
        return this.rotateLocked(input.sessionId, "proxy-failure");
      }
      if (!isTransportFailure(input.error)) return noRotation();

      const failures =
        (this.consecutiveTransportFailures.get(input.sessionId) ?? 0) + 1;
      this.consecutiveTransportFailures.set(input.sessionId, failures);
      if (failures < REPEATED_TRANSPORT_FAILURES) return noRotation();
      this.consecutiveTransportFailures.delete(input.sessionId);
      return this.rotateLocked(input.sessionId, "repeated-transport-failure");
    });
  }

  async release(sessionId: string): Promise<void> {
    await this.runSessionOperation(sessionId, async () => {
      await this.provider.release(sessionId);
      this.rotations.delete(sessionId);
      this.consecutiveTransportFailures.delete(sessionId);
      this.emit("vpn-request-lease-released", { reason: "request-terminal" });
    });
  }

  async cleanup(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.sessionOperations.values()]);
    this.initialized = false;
    this.preflightAvailable = false;
    this.rotations.clear();
    this.consecutiveTransportFailures.clear();
    await this.provider.cleanup();
    this.sessionOperations.clear();
  }

  private async rotateLocked(
    sessionId: string,
    reason: string
  ): Promise<VpnRotationDecision> {
    const count = this.rotations.get(sessionId) ?? 0;
    if (count >= MAX_ROTATIONS_PER_REQUEST) {
      this.emit("vpn-rotation-exhausted", { reason, rotationCount: count });
      return { rotated: false, eligible: true, exhausted: true, reason };
    }
    const lease = await this.provider.rotate(sessionId);
    if (!lease) {
      this.emit("vpn-rotation-exhausted", { reason, rotationCount: count });
      return { rotated: false, eligible: true, exhausted: true, reason };
    }
    const rotationCount = count + 1;
    this.rotations.set(sessionId, rotationCount);
    this.emit("vpn-relay-rotated", {
      relayLabel: lease.relayLabel,
      country: lease.country,
      reason,
      rotationCount,
    });
    return { rotated: true, eligible: true, exhausted: false, reason };
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.diagnosticSink?.({ event, data });
  }

  private runSessionOperation<T>(
    sessionId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.closing) {
      return Promise.reject(new Error("Mullvad VPN transport is closing"));
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

export class VpnRotationRetryError extends Error {
  constructor(reason: string) {
    super(`Retrying request after Mullvad relay rotation (${reason})`);
    this.name = "VpnRotationRetryError";
  }
}

export function requestVpnSessionId(
  sourceId: string,
  kind: string,
  url: string
): string {
  const digest = createHash("sha256")
    .update(`${sourceId}\0${kind}\0${url}`)
    .digest("hex")
    .slice(0, 24);
  return `vpn-${digest}`;
}

export function createDefaultMullvadVpnTransport(options: {
  country?: string;
  env?: NodeJS.ProcessEnv;
  diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
} = {}): MullvadVpnTransport {
  const env = options.env ?? process.env;
  const cachePath = env["MULLVAD_RELAY_CACHE"] ??
    resolve(process.cwd(), "vpn", "mullvad.json");
  const provider = createDefaultMullvadRelayProvider({
    country: options.country,
    cachePath,
    cooldownMs: readPositiveInteger(env["MULLVAD_RELAY_COOLDOWN_MS"]),
    verifyTimeoutMs: readPositiveInteger(env["MULLVAD_VERIFY_TIMEOUT_MS"]),
    diagnosticSink: options.diagnosticSink,
  });
  return new MullvadVpnTransport({
    provider,
    diagnosticSink: options.diagnosticSink,
  });
}

function readRequestSessionId(request: Request | undefined): string {
  const value = request?.userData?.["vpnSessionId"];
  if (
    typeof value !== "string" ||
    !/^vpn-[a-zA-Z0-9._~-]{1,46}$/u.test(value)
  ) {
    throw new Error("VPN request is missing a valid explicit session identity");
  }
  return value;
}

function noRotation(): VpnRotationDecision {
  return { rotated: false, eligible: false, exhausted: false };
}

function isApplicationFailure(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  const name = errorName(error);
  const message = errorMessage(error);
  return /mongo|bson/iu.test(name) ||
    /mongo(?:db)?|json-ld|validation|parser/iu.test(message);
}

function isProxyFailure(error: unknown): boolean {
  const text = `${errorName(error)} ${errorMessage(error)}`;
  return /proxy|socks|tunnel|407/iu.test(text);
}

function isTransportFailure(error: unknown): boolean {
  const code = errorCode(error);
  if (code && TRANSPORT_ERROR_CODES.has(code)) return true;
  return /fetch failed|socket hang up|network error|navigation timeout|request timed out/iu
    .test(errorMessage(error));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}
