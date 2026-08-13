import { describe, expect, it, vi } from "vitest";
import {
  MullvadRelayProvider,
  parseMullvadVerification,
  type MullvadRelay,
  type MullvadVerificationResult,
} from "../../src/danish-jsonld/mullvad-relay-provider.js";

const RELAYS: MullvadRelay[] = [
  {
    hostname: "dk-cph-wg-001",
    country_code: "dk",
    city_name: "Copenhagen",
    active: true,
    type: "wireguard",
    socks_name: "10.64.0.1",
    socks_port: 1080,
    provider: "fixture",
  },
  {
    hostname: "dk-cph-wg-002",
    country_code: "dk",
    city_name: "Copenhagen",
    active: true,
    type: "wireguard",
    socks_name: "10.64.0.2",
    socks_port: 1080,
    provider: "fixture",
  },
  {
    hostname: "dk-cph-wg-003",
    country_code: "dk",
    city_name: "Copenhagen",
    active: true,
    type: "wireguard",
    socks_name: "10.64.0.3",
    socks_port: 1080,
    provider: "fixture",
  },
  {
    hostname: "se-sto-wg-001",
    country_code: "se",
    city_name: "Stockholm",
    active: true,
    type: "wireguard",
    socks_name: "10.64.1.1",
    socks_port: 1080,
    provider: "fixture",
  },
  {
    hostname: "dk-cph-wg-inactive",
    country_code: "dk",
    city_name: "Copenhagen",
    active: false,
    type: "wireguard",
    socks_name: "10.64.0.9",
    socks_port: 1080,
    provider: "fixture",
  },
];

function createProvider(options: {
  relays?: MullvadRelay[];
  country?: string;
  now?: () => number;
  verifyRelay?: (relay: MullvadRelay) => Promise<MullvadVerificationResult>;
  openBridge?: (relay: MullvadRelay) => Promise<{
    proxyUrl: string;
    close(): Promise<void>;
  }>;
}) {
  let bridgeSequence = 0;
  const closed: string[] = [];
  const verifyRelay = vi.fn(
    options.verifyRelay ?? (async (relay) => ({
      mullvadExitIp: true,
      countryCode: relay.country_code,
      hostname: relay.hostname,
    }))
  );
  const provider = new MullvadRelayProvider({
    country: options.country,
    cooldownMs: 60_000,
    now: options.now ?? (() => 1_000),
    fetchRelays: async () => options.relays ?? RELAYS,
    readCache: async () => [],
    writeCache: async () => undefined,
    verifyRelay,
    openBridge: options.openBridge ?? (async (relay) => {
      bridgeSequence += 1;
      const id = `${relay.hostname}:${bridgeSequence}`;
      return {
        proxyUrl: `http://127.0.0.1:${4100 + bridgeSequence}`,
        close: async () => { closed.push(id); },
      };
    }),
  });
  return { provider, verifyRelay, closed };
}

describe("Mullvad relay provider", () => {
  it("models authoritative Mullvad exit fields in snake_case and camelCase", () => {
    expect(parseMullvadVerification({
      mullvad_exit_ip: true,
      country_code: "dk",
      mullvad_exit_ip_hostname: "dk-cph-wg-001",
    })).toMatchObject({
      mullvadExitIp: true,
      countryCode: "dk",
      hostname: "dk-cph-wg-001",
    });
    expect(parseMullvadVerification({
      mullvadExitIp: true,
      exitCountryCode: "se",
      exitHostname: "se-sto-wg-001",
    })).toMatchObject({
      mullvadExitIp: true,
      countryCode: "se",
      hostname: "se-sto-wg-001",
    });
  });

  it("filters to active WireGuard SOCKS relays in the requested country and verifies the lease", async () => {
    const { provider, verifyRelay } = createProvider({ country: "DK" });

    await provider.initialize();
    const lease = await provider.acquire("request-a");

    expect(lease).toMatchObject({
      relayLabel: "dk-cph-wg-001",
      country: "dk",
      proxyUrl: "http://127.0.0.1:4101",
    });
    expect(verifyRelay.mock.calls.map(([relay]) => relay.hostname)).toEqual([
      "dk-cph-wg-001",
    ]);
  });

  it("accepts the live Mullvad country name and SOCKS5 exit hostname for the selected relay", async () => {
    const { provider } = createProvider({
      country: "dk",
      relays: [{
        ...RELAYS[0],
        country_name: "Denmark",
        socks_name: "dk-cph-wg-socks5-001.relays.mullvad.net",
      }],
      verifyRelay: async () => ({
        mullvadExitIp: true,
        country: "Denmark",
        hostname: "dk-cph-wg-socks5-001",
      }),
    });
    await provider.initialize();

    await expect(provider.acquire("request-a")).resolves.toMatchObject({
      relayLabel: "dk-cph-wg-001",
      country: "dk",
    });
  });

  it.each([
    {
      label: "country",
      verification: {
        mullvadExitIp: true,
        country: "Sweden",
        hostname: "dk-cph-wg-socks5-001",
      },
    },
    {
      label: "SOCKS5 hostname",
      verification: {
        mullvadExitIp: true,
        country: "Denmark",
        hostname: "dk-cph-wg-socks5-102",
      },
    },
  ])("rejects a live-shaped identity with a mismatched $label", async ({ verification }) => {
    const { provider } = createProvider({
      country: "dk",
      relays: [{
        ...RELAYS[0],
        country_name: "Denmark",
        socks_name: "dk-cph-wg-socks5-001.relays.mullvad.net",
      }],
      verifyRelay: async () => verification,
    });
    await provider.initialize();

    await expect(provider.acquire("request-a")).resolves.toBeNull();
  });

  it("keeps one verified relay bound to the same request session", async () => {
    const { provider, verifyRelay } = createProvider({ country: "dk" });
    await provider.initialize();

    const first = await provider.acquire("request-a");
    const again = await provider.acquire("request-a");

    expect(again).toEqual(first);
    expect(verifyRelay).toHaveBeenCalledOnce();
  });

  it("does not lease the same relay to concurrent request sessions", async () => {
    const { provider } = createProvider({ country: "dk" });
    await provider.initialize();

    const [first, second] = await Promise.all([
      provider.acquire("request-a"),
      provider.acquire("request-b"),
    ]);

    expect([first?.relayLabel, second?.relayLabel].sort()).toEqual([
      "dk-cph-wg-001",
      "dk-cph-wg-002",
    ]);
  });

  it("cools a failed relay and rotates a session to a unique relay", async () => {
    let now = 1_000;
    const { provider, closed } = createProvider({
      country: "dk",
      now: () => now,
    });
    await provider.initialize();
    const first = await provider.acquire("request-a");

    const rotated = await provider.rotate("request-a");
    const otherSession = await provider.acquire("request-b");

    expect(first?.relayLabel).toBe("dk-cph-wg-001");
    expect(rotated?.relayLabel).toBe("dk-cph-wg-002");
    expect(otherSession?.relayLabel).toBe("dk-cph-wg-003");
    expect(closed).toEqual(["dk-cph-wg-001:1"]);

    now += 60_001;
    const recycled = await provider.rotate("request-b");
    expect(recycled?.relayLabel).toBe("dk-cph-wg-001");
  });

  it("returns no lease when every eligible relay fails verification", async () => {
    const { provider, verifyRelay } = createProvider({
      country: "dk",
      verifyRelay: async () => ({ mullvadExitIp: false }),
    });
    await provider.initialize();

    await expect(provider.acquire("request-a")).resolves.toBeNull();
    expect(verifyRelay).toHaveBeenCalledTimes(3);
  });

  it("rejects and cools a relay when authoritative exit country and hostname mismatch", async () => {
    const { provider, verifyRelay } = createProvider({
      country: "dk",
      relays: RELAYS.slice(0, 1),
      verifyRelay: async () => ({
        mullvadExitIp: true,
        countryCode: "se",
        hostname: "se-sto-wg-001",
      }),
    });
    await provider.initialize();

    await expect(provider.acquire("request-a")).resolves.toBeNull();
    await expect(provider.acquire("request-b")).resolves.toBeNull();
    expect(verifyRelay).toHaveBeenCalledOnce();
  });

  it("releases a healthy relay without cooldown for sustained sequential reuse", async () => {
    const { provider, closed } = createProvider({
      country: "dk",
      relays: RELAYS.slice(0, 1),
    });
    await provider.initialize();

    for (let index = 0; index < 6; index += 1) {
      const lease = await provider.acquire(`request-${index}`);
      expect(lease?.relayLabel).toBe("dk-cph-wg-001");
      await provider.release(`request-${index}`);
    }

    expect(closed).toHaveLength(6);
    expect(new Set(closed).size).toBe(6);
  });

  it("serializes concurrent rotations without orphaning either replaced bridge", async () => {
    const opened: string[] = [];
    const closed: string[] = [];
    const { provider } = createProvider({
      country: "dk",
      openBridge: async (relay) => {
        const id = `${relay.hostname}:${opened.length + 1}`;
        opened.push(id);
        await Promise.resolve();
        return {
          proxyUrl: `http://127.0.0.1:${4400 + opened.length}`,
          close: async () => { closed.push(id); },
        };
      },
    });
    await provider.initialize();
    await provider.acquire("request-a");

    const rotations = await Promise.all([
      provider.rotate("request-a"),
      provider.rotate("request-a"),
    ]);
    await provider.cleanup();

    expect(rotations.map((lease) => lease?.relayLabel)).toEqual([
      "dk-cph-wg-002",
      "dk-cph-wg-003",
    ]);
    expect(opened).toHaveLength(3);
    expect(closed.sort()).toEqual(opened.sort());
  });

  it("waits for an in-flight rotation before cleanup closes its new bridge", async () => {
    let releaseSecondBridge!: () => void;
    const secondBridgeGate = new Promise<void>((resolve) => {
      releaseSecondBridge = resolve;
    });
    const opened: string[] = [];
    const closed: string[] = [];
    const { provider } = createProvider({
      country: "dk",
      relays: RELAYS.slice(0, 2),
      openBridge: async (relay) => {
        const id = relay.hostname;
        opened.push(id);
        if (opened.length === 2) await secondBridgeGate;
        return {
          proxyUrl: `http://127.0.0.1:${4500 + opened.length}`,
          close: async () => { closed.push(id); },
        };
      },
    });
    await provider.initialize();
    await provider.acquire("request-a");

    const rotation = provider.rotate("request-a");
    await Promise.resolve();
    const cleanup = provider.cleanup();
    let cleanupFinished = false;
    void cleanup.then(() => { cleanupFinished = true; });
    await Promise.resolve();
    expect(cleanupFinished).toBe(false);

    releaseSecondBridge();
    await Promise.all([rotation, cleanup]);
    expect(closed.sort()).toEqual(opened.sort());
  });

  it("falls back to the cached relay document when the API fetch fails", async () => {
    const writeCache = vi.fn(async () => undefined);
    const provider = new MullvadRelayProvider({
      country: "se",
      fetchRelays: async () => { throw new Error("fixture API unavailable"); },
      readCache: async () => RELAYS,
      writeCache,
      verifyRelay: async (relay) => ({
        mullvadExitIp: true,
        countryCode: relay.country_code,
        hostname: relay.hostname,
      }),
      openBridge: async () => ({
        proxyUrl: "http://127.0.0.1:4200",
        close: async () => undefined,
      }),
    });

    await provider.initialize();
    const lease = await provider.acquire("request-a");

    expect(lease?.relayLabel).toBe("se-sto-wg-001");
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("closes every active bridge during cleanup", async () => {
    const { provider, closed } = createProvider({ country: "dk" });
    await provider.initialize();
    await provider.acquire("request-a");
    await provider.acquire("request-b");

    await provider.cleanup();

    expect(closed.sort()).toEqual([
      "dk-cph-wg-001:1",
      "dk-cph-wg-002:2",
    ]);
  });
});
