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
  verifyRelay: (relay: MullvadRelay) => Promise<boolean>;
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
  private readonly pendingBySession = new Map<
    string,
    Promise<MullvadRelayLease | null>
  >();
  private readonly cooldownUntil = new Map<string, number>();
  private readonly usedBySession = new Map<string, Set<string>>();
  private relays: MullvadRelay[] = [];

  constructor(options: MullvadRelayProviderOptions) {
    this.options = options;
    this.country = normalizeCountry(options.country);
    this.cooldownMs = positiveInteger(options.cooldownMs, DEFAULT_COOLDOWN_MS);
    this.now = options.now ?? Date.now;
  }

  async initialize(): Promise<void> {
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

  async acquire(sessionId: string): Promise<MullvadRelayLease | null> {
    const existing = this.activeBySession.get(sessionId);
    if (existing) return publicLease(existing);
    const pending = this.pendingBySession.get(sessionId);
    if (pending) return pending;
    const acquisition = this.acquireFresh(sessionId).finally(() => {
      this.pendingBySession.delete(sessionId);
    });
    this.pendingBySession.set(sessionId, acquisition);
    return acquisition;
  }

  async rebind(
    fromSessionId: string,
    toSessionId: string
  ): Promise<MullvadRelayLease | null> {
    if (fromSessionId === toSessionId) return this.acquire(toSessionId);
    const existing = this.activeBySession.get(toSessionId);
    if (existing) return publicLease(existing);
    const lease = this.activeBySession.get(fromSessionId);
    if (!lease) return this.acquire(toSessionId);
    this.activeBySession.delete(fromSessionId);
    this.activeBySession.set(toSessionId, lease);
    const used = this.usedBySession.get(fromSessionId) ??
      new Set([lease.relayLabel]);
    this.usedBySession.delete(fromSessionId);
    this.usedBySession.set(toSessionId, used);
    return publicLease(lease);
  }

  async rotate(sessionId: string): Promise<MullvadRelayLease | null> {
    const current = this.activeBySession.get(sessionId);
    if (current) {
      this.activeBySession.delete(sessionId);
      this.activeRelayLabels.delete(current.relayLabel);
      this.cooldownUntil.set(current.relayLabel, this.now() + this.cooldownMs);
      try {
        await current.bridge.close();
      } catch {
        this.emit("vpn-relay-bridge-close-failed", {
          relayLabel: current.relayLabel,
          country: current.country,
        });
      }
    }
    return this.acquireFresh(sessionId);
  }

  async cleanup(): Promise<void> {
    await Promise.allSettled(this.pendingBySession.values());
    const leases = [...this.activeBySession.values()];
    this.activeBySession.clear();
    this.activeRelayLabels.clear();
    this.reservedRelayLabels.clear();
    await Promise.allSettled(leases.map((lease) => lease.bridge.close()));
    this.pendingBySession.clear();
    this.cooldownUntil.clear();
    this.usedBySession.clear();
    this.relays = [];
  }

  private async acquireFresh(sessionId: string): Promise<MullvadRelayLease | null> {
    const used = this.usedBySession.get(sessionId) ?? new Set<string>();
    this.usedBySession.set(sessionId, used);

    while (true) {
      const relay = this.nextCandidate(used);
      if (!relay) return null;
      const relayLabel = boundedRelayLabel(relay);
      used.add(relayLabel);
      this.reservedRelayLabels.add(relayLabel);

      let verified = false;
      try {
        verified = await this.options.verifyRelay(relay);
      } catch {
        verified = false;
      }
      if (!verified) {
        this.reservedRelayLabels.delete(relayLabel);
        this.cooldownUntil.set(relayLabel, this.now() + this.cooldownMs);
        this.emit("vpn-relay-verification-failed", {
          relayLabel,
          country: relay.country_code.toLowerCase(),
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

  private nextCandidate(used: Set<string>): MullvadRelay | undefined {
    const now = this.now();
    return this.relays.find((relay) => {
      const label = boundedRelayLabel(relay);
      const cooldown = this.cooldownUntil.get(label);
      if (cooldown !== undefined && cooldown <= now) {
        this.cooldownUntil.delete(label);
      }
      return !used.has(label) &&
        !this.activeRelayLabels.has(label) &&
        !this.reservedRelayLabels.has(label) &&
        !this.cooldownUntil.has(label);
    });
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.options.diagnosticSink?.({ event, data });
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
): Promise<boolean> {
  const agent = new SocksProxyAgent(socksUrl(relay), { timeout: timeoutMs });
  try {
    return await new Promise<boolean>((resolve) => {
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
              const parsed = JSON.parse(body) as { mullvad_exit_ip?: unknown };
              resolve(
                response.statusCode === 200 && parsed.mullvad_exit_ip === true
              );
            } catch {
              resolve(false);
            }
          });
        }
      );
      request.on("error", () => resolve(false));
      request.on("timeout", () => {
        request.destroy();
        resolve(false);
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
