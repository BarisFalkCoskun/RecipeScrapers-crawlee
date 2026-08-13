import { describe, expect, it } from "vitest";
import type { Request } from "crawlee";
import { MullvadRelayProvider, type MullvadRelay } from "../../src/danish-jsonld/mullvad-relay-provider.js";
import {
  MullvadVpnTransport,
  requestVpnSessionId,
} from "../../src/danish-jsonld/vpn-transport.js";

const RELAYS: MullvadRelay[] = Array.from({ length: 5 }, (_, index) => ({
  hostname: `dk-cph-wg-00${index + 1}`,
  country_code: "dk",
  city_name: "Copenhagen",
  active: true,
  type: "wireguard",
  socks_name: `10.64.0.${index + 1}`,
  socks_port: 1080,
}));

function createTransport() {
  let port = 4300;
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const provider = new MullvadRelayProvider({
    country: "dk",
    fetchRelays: async () => RELAYS,
    readCache: async () => [],
    writeCache: async () => undefined,
    verifyRelay: async (relay) => ({
      mullvadExitIp: true,
      countryCode: relay.country_code,
      hostname: relay.hostname,
    }),
    openBridge: async () => ({
      proxyUrl: `http://127.0.0.1:${++port}`,
      close: async () => undefined,
    }),
  });
  return {
    transport: new MullvadVpnTransport({ provider, diagnosticSink: (event) => events.push(event) }),
    events,
  };
}

function requestWithSession(vpnSessionId: string): Request {
  return { userData: { vpnSessionId } } as Request;
}

describe("Mullvad VPN transport", () => {
  it("fails closed during startup when no verified relay exists", async () => {
    const provider = new MullvadRelayProvider({
      fetchRelays: async () => RELAYS.slice(0, 1),
      readCache: async () => [],
      writeCache: async () => undefined,
      verifyRelay: async () => ({ mullvadExitIp: false }),
      openBridge: async () => { throw new Error("bridge must not open"); },
    });
    const transport = new MullvadVpnTransport({ provider });

    await expect(transport.initialize()).rejects.toThrow(
      "No verified Mullvad relay is available"
    );
  });

  it("uses explicit request identity for stable ProxyConfiguration affinity", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    const sessionId = requestVpnSessionId("arla", "recipe", "https://arla.dk/opskrifter/a");

    const first = await transport.proxyConfiguration.newUrl("random-a", {
      request: requestWithSession(sessionId),
    });
    const again = await transport.proxyConfiguration.newUrl("random-b", {
      request: requestWithSession(sessionId),
    });

    expect(first).toBe("http://127.0.0.1:4301");
    expect(again).toBe(first);
    expect(sessionId).toMatch(/^vpn-[a-f0-9]{24}$/u);
  });

  it.each([403, 429, 526])("rotates immediately for HTTP %i", async (statusCode) => {
    const { transport } = createTransport();
    await transport.initialize();
    const sessionId = "vpn-status";
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession(sessionId),
    });

    const decision = await transport.handleResponse({ sessionId, statusCode, body: "blocked" });

    expect(decision).toMatchObject({ rotated: true, reason: `http-${statusCode}` });
  });

  it("rotates for an explicit block page and an immediate proxy failure", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-block"),
    });
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-proxy"),
    });

    const blocked = await transport.handleResponse({
      sessionId: "vpn-block",
      statusCode: 200,
      body: "Checking your browser before accessing this site",
    });
    const proxyFailure = await transport.handleFailure({
      sessionId: "vpn-proxy",
      error: Object.assign(new Error("SOCKS connection refused"), { code: "ECONNREFUSED" }),
    });

    expect(blocked).toMatchObject({ rotated: true, reason: "explicit-block" });
    expect(proxyFailure).toMatchObject({ rotated: true, reason: "proxy-failure" });
  });

  it("rotates for an explicit Cloudflare block signature on HTTP 503", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-503-block"),
    });

    await expect(transport.handleResponse({
      sessionId: "vpn-503-block",
      statusCode: 503,
      body: "Cloudflare challenge: checking your browser",
    })).resolves.toMatchObject({
      rotated: true,
      reason: "explicit-block",
    });
  });

  it("rotates for a nonstandard HTTP 455 WAF denial", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-455-block"),
    });

    await expect(transport.handleResponse({
      sessionId: "vpn-455-block",
      statusCode: 455,
      body: "455 Security Incident Detected. Your request was blocked. Do not retry.",
    })).resolves.toMatchObject({
      rotated: true,
      reason: "explicit-block",
    });
  });

  it("rotates only after a repeated generic transport failure", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-timeout"),
    });
    const timeout = Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" });

    const first = await transport.handleFailure({ sessionId: "vpn-timeout", error: timeout });
    const second = await transport.handleFailure({ sessionId: "vpn-timeout", error: timeout });

    expect(first).toMatchObject({ rotated: false, eligible: false });
    expect(second).toMatchObject({ rotated: true, reason: "repeated-transport-failure" });
  });

  it.each([
    { name: "401", input: { statusCode: 401, body: "unauthorized" } },
    { name: "404", input: { statusCode: 404, body: "not found" } },
    { name: "JSON-LD validation", input: { statusCode: 200, body: "invalid recipe data" } },
  ])("does not rotate for $name responses", async ({ input }) => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-no-rotate"),
    });

    await expect(transport.handleResponse({ sessionId: "vpn-no-rotate", ...input }))
      .resolves.toMatchObject({ rotated: false, eligible: false });
  });

  it.each([
    new SyntaxError("JSON parse failed"),
    Object.assign(new Error("MongoServerSelectionError"), { name: "MongoServerError" }),
  ])("does not rotate for parser or Mongo failures", async (error) => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-app-error"),
    });

    await expect(transport.handleFailure({ sessionId: "vpn-app-error", error }))
      .resolves.toMatchObject({ rotated: false, eligible: false });
  });

  it("allows at most three unique rotations for one request", async () => {
    const { transport } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-capped"),
    });

    const decisions = [];
    for (let index = 0; index < 4; index += 1) {
      decisions.push(await transport.handleResponse({
        sessionId: "vpn-capped",
        statusCode: 429,
        body: "rate limited",
      }));
    }

    expect(decisions.slice(0, 3).every((decision) => decision.rotated)).toBe(true);
    expect(decisions[3]).toMatchObject({
      rotated: false,
      eligible: true,
      exhausted: true,
      reason: "http-429",
    });
  });

  it("serializes concurrent rotation accounting at the three-rotation cap", async () => {
    const { transport, events } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-race-cap"),
    });

    const decisions = await Promise.all(Array.from({ length: 4 }, () =>
      transport.handleResponse({
        sessionId: "vpn-race-cap",
        statusCode: 429,
        body: "rate limited",
      })
    ));

    expect(decisions.filter((decision) => decision.rotated)).toHaveLength(3);
    expect(decisions.filter((decision) => decision.exhausted)).toHaveLength(1);
    expect(events.filter((event) => event.event === "vpn-relay-rotated")
      .map((event) => event.data.rotationCount)).toEqual([1, 2, 3]);
  });

  it("releases one-relay leases between sustained sequential requests", async () => {
    let port = 4600;
    const closed: number[] = [];
    const provider = new MullvadRelayProvider({
      country: "dk",
      fetchRelays: async () => RELAYS.slice(0, 1),
      readCache: async () => [],
      writeCache: async () => undefined,
      verifyRelay: async (relay) => ({
        mullvadExitIp: true,
        countryCode: relay.country_code,
        hostname: relay.hostname,
      }),
      openBridge: async () => {
        const bridgePort = ++port;
        return {
          proxyUrl: `http://127.0.0.1:${bridgePort}`,
          close: async () => { closed.push(bridgePort); },
        };
      },
    });
    const transport = new MullvadVpnTransport({ provider });
    await transport.initialize();

    for (let index = 0; index < 5; index += 1) {
      const sessionId = `vpn-sequential-${index}`;
      await expect(transport.proxyConfiguration.newUrl("ignored", {
        request: requestWithSession(sessionId),
      })).resolves.toMatch(/^http:\/\/127\.0\.0\.1:/u);
      await transport.release(sessionId);
    }
    await transport.cleanup();

    expect(closed).toHaveLength(5);
    expect(new Set(closed).size).toBe(5);
  });

  it("waits for an in-flight transport rotation before cleanup returns", async () => {
    let releaseRotatedBridge!: () => void;
    const rotatedBridgeGate = new Promise<void>((resolve) => {
      releaseRotatedBridge = resolve;
    });
    const opened: number[] = [];
    const closed: number[] = [];
    const provider = new MullvadRelayProvider({
      country: "dk",
      fetchRelays: async () => RELAYS.slice(0, 2),
      readCache: async () => [],
      writeCache: async () => undefined,
      verifyRelay: async (relay) => ({
        mullvadExitIp: true,
        countryCode: relay.country_code,
        hostname: relay.hostname,
      }),
      openBridge: async () => {
        const id = opened.length + 1;
        opened.push(id);
        if (id === 2) await rotatedBridgeGate;
        return {
          proxyUrl: `http://127.0.0.1:${4700 + id}`,
          close: async () => { closed.push(id); },
        };
      },
    });
    const transport = new MullvadVpnTransport({ provider });
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-cleanup-race"),
    });

    const rotation = transport.handleResponse({
      sessionId: "vpn-cleanup-race",
      statusCode: 429,
      body: "rate limited",
    });
    await Promise.resolve();
    const cleanup = transport.cleanup();
    let cleanupFinished = false;
    void cleanup.then(() => { cleanupFinished = true; });
    await Promise.resolve();
    expect(cleanupFinished).toBe(false);

    releaseRotatedBridge();
    await Promise.all([rotation, cleanup]);
    expect(closed.sort()).toEqual(opened.sort());
  });

  it("emits bounded relay metadata without proxy endpoints", async () => {
    const { transport, events } = createTransport();
    await transport.initialize();
    await transport.proxyConfiguration.newUrl("ignored", {
      request: requestWithSession("vpn-redaction"),
    });
    await transport.handleResponse({ sessionId: "vpn-redaction", statusCode: 429, body: "blocked" });

    const serialized = JSON.stringify(events);
    expect(serialized).toContain("dk-cph-wg-002");
    expect(serialized).toContain('"country":"dk"');
    expect(serialized).not.toContain("socks5://");
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("10.64.0.");
  });
});
