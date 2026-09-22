import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { ProxyConfiguration, type Request } from "crawlee";
import {
  createDefaultMullvadRelayProvider,
  MULLVAD_DEFAULT_COOLDOWN_MS,
  type MullvadRelayDiagnostic,
  type MullvadRelayLease,
  type MullvadRelayProvider,
} from "./mullvad-relay-provider.js";

const PREFLIGHT_SESSION_ID = "vpn-preflight";
const MAX_ROTATIONS_PER_REQUEST = 3;
const REPEATED_TRANSPORT_FAILURES = 2;
const EXPLICIT_BLOCK_PATTERN =
  /captcha|access denied|checking your browser|cloudflare challenge|temporarily blocked|request (?:was )?blocked|security incident detected|security verification|unusual traffic/iu;
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
  readonly requestHandlerTimeoutSecs?: number;
  initialize(): Promise<void>;
  handleResponse(input: {
    sessionId: string;
    requestId?: string;
    statusCode: number;
    body: string;
  }): Promise<VpnRotationDecision>;
  handleFailure(input: {
    sessionId: string;
    requestId?: string;
    error: unknown;
  }): Promise<VpnRotationDecision>;
  completeRequest?(sessionId: string, requestId?: string): Promise<void>;
  release(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export class MullvadVpnTransport implements DanishJsonLdVpnTransport {
  readonly proxyConfiguration: ProxyConfiguration;
  readonly requestHandlerTimeoutSecs: number;
  private readonly provider: MullvadRelayProvider;
  private readonly diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
  private readonly requestStates = new Map<string, Map<string, {
    rotations: number;
    transportFailures: number;
  }>>();
  private readonly sessionOperations = new Map<string, Promise<void>>();
  private readonly targetScopeBySession = new Map<string, string>();
  private readonly leasedSessionIds = new Set<string>();
  private initialized = false;
  private preflightAvailable = false;
  private closing = false;

  constructor(options: {
    provider: MullvadRelayProvider;
    requestHandlerTimeoutSecs?: number;
    diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
  }) {
    this.provider = options.provider;
    this.requestHandlerTimeoutSecs = options.requestHandlerTimeoutSecs ?? 7 * 60;
    this.diagnosticSink = options.diagnosticSink;
    this.proxyConfiguration = new ProxyConfiguration({
      newUrlFunction: async (_crawleeSessionId, options) => {
        if (!this.initialized) {
          throw new Error("Mullvad VPN transport has not been initialized");
        }
        const sessionId = readRequestSessionId(options?.request);
        const targetScope = requestTargetScope(options?.request);
        this.targetScopeBySession.set(sessionId, targetScope);
        return this.runSessionOperation(sessionId, async () => {
          let lease: MullvadRelayLease | null;
          if (this.preflightAvailable) {
            this.preflightAvailable = false;
            lease = await this.provider.rebind(PREFLIGHT_SESSION_ID, sessionId, targetScope);
          } else {
            lease = await this.provider.acquire(sessionId, targetScope);
          }
          if (!lease) {
            throw new VpnRelayPoolExhaustedError(targetScope);
          }
          this.leasedSessionIds.add(sessionId);
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
    requestId?: string;
    statusCode: number;
    body: string;
  }): Promise<VpnRotationDecision> {
    return this.runSessionOperation(input.sessionId, async () => {
      const state = this.requestState(input.sessionId, input.requestId);
      state.transportFailures = 0;
      const explicitBlock =
        input.statusCode !== 404 &&
        EXPLICIT_BLOCK_PATTERN.test(input.body.slice(0, 20_000));
      const reason = [403, 429, 526].includes(input.statusCode)
        ? `http-${input.statusCode}`
        : explicitBlock
          ? "explicit-block"
          : undefined;
      return reason
        ? this.rotateLocked(input.sessionId, reason, state)
        : noRotation();
    });
  }

  async handleFailure(input: {
    sessionId: string;
    requestId?: string;
    error: unknown;
  }): Promise<VpnRotationDecision> {
    if (input.error instanceof VpnRotationRetryError) return noRotation();
    return this.runSessionOperation(input.sessionId, async () => {
      if (isApplicationFailure(input.error)) return noRotation();
      const state = this.requestState(input.sessionId, input.requestId);
      if (isProxyFailure(input.error)) {
        state.transportFailures = 0;
        return this.rotateLocked(input.sessionId, "proxy-failure", state);
      }
      if (!isTransportFailure(input.error)) return noRotation();

      state.transportFailures += 1;
      if (state.transportFailures < REPEATED_TRANSPORT_FAILURES) return noRotation();
      state.transportFailures = 0;
      return this.rotateLocked(input.sessionId, "repeated-transport-failure", state);
    });
  }

  async completeRequest(sessionId: string, requestId?: string): Promise<void> {
    await this.runSessionOperation(sessionId, async () => {
      const states = this.requestStates.get(sessionId);
      states?.delete(requestId ?? sessionId);
      if (states?.size === 0) this.requestStates.delete(sessionId);
      await this.provider.completeRequest(sessionId);
      this.emit("vpn-request-completed", {
        leaseRetained: this.leasedSessionIds.has(sessionId),
      });
    });
  }

  async release(sessionId: string): Promise<void> {
    await this.runSessionOperation(sessionId, async () => {
      const hadLease = this.leasedSessionIds.delete(sessionId);
      this.targetScopeBySession.delete(sessionId);
      await this.provider.release(sessionId);
      this.requestStates.delete(sessionId);
      if (!hadLease) return;
      this.emit("vpn-site-lease-released", { reason: "source-terminal" });
    });
  }

  async cleanup(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.sessionOperations.values()]);
    this.initialized = false;
    this.preflightAvailable = false;
    this.requestStates.clear();
    this.targetScopeBySession.clear();
    this.leasedSessionIds.clear();
    await this.provider.cleanup();
    this.sessionOperations.clear();
  }

  private async rotateLocked(
    sessionId: string,
    reason: string,
    state: { rotations: number }
  ): Promise<VpnRotationDecision> {
    const count = state.rotations;
    if (count >= MAX_ROTATIONS_PER_REQUEST) {
      const targetScope = this.targetScopeBySession.get(sessionId);
      const scopedAccessCooldown = ["http-403", "http-429", "http-526", "explicit-block"]
        .includes(reason);
      await this.provider.invalidate(
        sessionId,
        targetScope,
        scopedAccessCooldown ? "scope" : "global"
      );
      this.leasedSessionIds.delete(sessionId);
      this.emit("vpn-rotation-exhausted", { reason, rotationCount: count });
      return { rotated: false, eligible: true, exhausted: true, reason };
    }
    const targetScope = this.targetScopeBySession.get(sessionId);
    const scopedAccessCooldown = ["http-403", "http-429", "http-526", "explicit-block"]
      .includes(reason);
    const lease = await this.provider.rotate(
      sessionId,
      targetScope,
      scopedAccessCooldown ? "scope" : "global"
    );
    if (!lease) {
      this.leasedSessionIds.delete(sessionId);
      this.emit("vpn-rotation-exhausted", { reason, rotationCount: count });
      return { rotated: false, eligible: true, exhausted: true, reason };
    }
    this.leasedSessionIds.add(sessionId);
    const rotationCount = count + 1;
    state.rotations = rotationCount;
    this.emit("vpn-relay-rotated", {
      relayLabel: lease.relayLabel,
      country: lease.country,
      reason,
      rotationCount,
    });
    return { rotated: true, eligible: true, exhausted: false, reason };
  }

  private requestState(sessionId: string, requestId = sessionId): {
    rotations: number;
    transportFailures: number;
  } {
    let states = this.requestStates.get(sessionId);
    if (!states) {
      states = new Map();
      this.requestStates.set(sessionId, states);
    }
    let state = states.get(requestId);
    if (!state) {
      state = { rotations: 0, transportFailures: 0 };
      states.set(requestId, state);
    }
    return state;
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

export class VpnRelayPoolExhaustedError extends Error {
  readonly targetScope: string;

  constructor(targetScope: string) {
    super(`No verified Mullvad relay is available for ${targetScope}`);
    this.name = "VpnRelayPoolExhaustedError";
    this.targetScope = targetScope;
  }
}

export function isVpnRelayPoolExhaustedError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof VpnRelayPoolExhaustedError) return true;
    if (current instanceof Error && (
      current.name === "VpnRelayPoolExhaustedError" ||
      current.message.startsWith("No verified Mullvad relay is available for ")
    )) return true;
    current = current instanceof Error
      ? (current as Error & { cause?: unknown }).cause
      : undefined;
  }
  return false;
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

/** Relay identity spans all URLs and fetch modes within one source attempt. */
export function siteVpnSessionId(sourceId: string, crawlAttemptId: string): string {
  return requestVpnSessionId(sourceId, "site-attempt", crawlAttemptId);
}

function requestTargetScope(request: Request | undefined): string {
  try {
    return new URL(request?.url ?? "").hostname.toLowerCase() || "unknown-target";
  } catch {
    return "unknown-target";
  }
}

export function createDefaultMullvadVpnTransport(options: {
  country?: string;
  env?: NodeJS.ProcessEnv;
  diagnosticSink?: (event: MullvadRelayDiagnostic) => void;
} = {}): MullvadVpnTransport {
  const env = options.env ?? process.env;
  const cachePath = env["MULLVAD_RELAY_CACHE"] ??
    resolve(process.cwd(), "vpn", "mullvad.json");
  const cooldownMs = readPositiveInteger(env["MULLVAD_RELAY_COOLDOWN_MS"]) ??
    MULLVAD_DEFAULT_COOLDOWN_MS;
  const provider = createDefaultMullvadRelayProvider({
    country: options.country,
    cachePath,
    cooldownMs,
    verifyTimeoutMs: readPositiveInteger(env["MULLVAD_VERIFY_TIMEOUT_MS"]),
    diagnosticSink: options.diagnosticSink,
  });
  return new MullvadVpnTransport({
    provider,
    requestHandlerTimeoutSecs: Math.ceil(cooldownMs / 1_000) + 120,
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
