import { describe, expect, it, vi } from "vitest";
import {
  MullvadRelayProvider,
  type MullvadRelay,
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
  verifyRelay?: (relay: MullvadRelay) => Promise<boolean>;
}) {
  let bridgeSequence = 0;
  const closed: string[] = [];
  const verifyRelay = vi.fn(
    options.verifyRelay ?? (async () => true)
  );
  const provider = new MullvadRelayProvider({
    country: options.country,
    cooldownMs: 60_000,
    now: options.now ?? (() => 1_000),
    fetchRelays: async () => options.relays ?? RELAYS,
    readCache: async () => [],
    writeCache: async () => undefined,
    verifyRelay,
    openBridge: async (relay) => {
      bridgeSequence += 1;
      const id = `${relay.hostname}:${bridgeSequence}`;
      return {
        proxyUrl: `http://127.0.0.1:${4100 + bridgeSequence}`,
        close: async () => { closed.push(id); },
      };
    },
  });
  return { provider, verifyRelay, closed };
}

describe("Mullvad relay provider", () => {
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
      verifyRelay: async () => false,
    });
    await provider.initialize();

    await expect(provider.acquire("request-a")).resolves.toBeNull();
    expect(verifyRelay).toHaveBeenCalledTimes(3);
  });

  it("falls back to the cached relay document when the API fetch fails", async () => {
    const writeCache = vi.fn(async () => undefined);
    const provider = new MullvadRelayProvider({
      country: "se",
      fetchRelays: async () => { throw new Error("fixture API unavailable"); },
      readCache: async () => RELAYS,
      writeCache,
      verifyRelay: async () => true,
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
