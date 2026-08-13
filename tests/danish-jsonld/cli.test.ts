import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { executeDanishJsonLdCli } from "../../src/danish-jsonld/cli.js";
import type { DanishJsonLdRunSummary } from "../../src/types.js";

describe("crawl:danish-jsonld CLI", () => {
  it("creates missing parent directories before writing JSON evidence", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "danish-jsonld-cli-"));
    const jsonOut = join(temporaryRoot, "nested", "logs", "run.json");
    const store = {
      connect: async () => undefined,
      close: async () => undefined,
      insertDanishJsonLdRun: async () => undefined,
    };

    try {
      await executeDanishJsonLdCli(
        ["--sources", "arla", "--json-out", jsonOut],
        {
          env: {},
          now: () => new Date("2026-08-13T10:00:00.000Z"),
          createStore: () => store as never,
          runCrawl: async () => ({
            summary: { robotsEnforced: false, sourceOutcomes: [] },
            observations: [],
          }),
          output: () => undefined,
        }
      );

      expect(JSON.parse(await readFile(jsonOut, "utf8"))).toMatchObject({
        selectedSources: ["arla"],
        summary: { robotsEnforced: false, sourceOutcomes: [] },
      });
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("connects, executes selected sources, writes run evidence, and closes the store", async () => {
    const connect = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const insertDanishJsonLdRun = vi.fn(async () => undefined);
    const store = { connect, close, insertDanishJsonLdRun };
    const summary: DanishJsonLdRunSummary = {
      robotsEnforced: false,
      sourceOutcomes: [
        {
          sourceId: "arla",
          outcome: "succeeded",
          outcomeReasons: [],
        },
      ],
    };
    const runCrawl = vi.fn(async () => ({ summary, observations: [] }));
    const writeFile = vi.fn(async () => undefined);
    const output: string[] = [];

    const result = await executeDanishJsonLdCli(
      ["--sources", "arla", "--max-pages", "2", "--database", "fixture", "--json-out", "run.json"],
      {
        env: { MONGODB_URI: "mongodb://fixture" },
        now: () => new Date("2026-08-13T10:00:00.000Z"),
        createStore: (uri, database) => {
          expect(uri).toBe("mongodb://fixture");
          expect(database).toBe("fixture");
          return store as never;
        },
        runCrawl,
        writeFile,
        output: (line) => output.push(line),
      }
    );

    expect(connect).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(runCrawl).toHaveBeenCalledOnce();
    expect(insertDanishJsonLdRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "danish-jsonld-v2",
        schemaVersion: 2,
        crawlRunId: "2026-08-13T10-00-00.000Z",
        sourceIds: ["arla"],
        summary,
      })
    );
    expect(runCrawl.mock.calls[0][0]).toMatchObject({
      crawlRunId: "2026-08-13T10-00-00.000Z",
      selection: { sourceIds: ["arla"], maxPages: 2 },
    });
    expect(writeFile).toHaveBeenCalledWith(
      "run.json",
      expect.stringContaining('"sourceId": "arla"'),
      "utf8"
    );
    expect(JSON.parse(output[0])).toMatchObject({
      crawlRunId: "2026-08-13T10-00-00.000Z",
      selectedSources: ["arla"],
      summary,
    });
    expect(result.summary).toEqual(summary);
  });

  it("fails visibly and still closes the store when dedicated run persistence fails", async () => {
    const close = vi.fn(async () => undefined);
    const store = {
      connect: vi.fn(async () => undefined),
      close,
      insertDanishJsonLdRun: vi.fn(async () => {
        throw new Error("run persistence failed");
      }),
    };

    await expect(
      executeDanishJsonLdCli(["--sources", "arla"], {
        env: {},
        createStore: () => store as never,
        runCrawl: async () => ({
          summary: {
            robotsEnforced: false as const,
            sourceOutcomes: [{
              sourceId: "arla",
              outcome: "partial" as const,
              outcomeReasons: ["max-pages-cap-reached" as const],
            }],
          },
          observations: [{ sourceId: "arla", discoveryComplete: false }],
        }),
        output: () => undefined,
      })
    ).rejects.toThrow("run persistence failed");

    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the store when source execution fails", async () => {
    const close = vi.fn(async () => undefined);
    const store = {
      connect: vi.fn(async () => undefined),
      close,
    };

    await expect(
      executeDanishJsonLdCli(["--sources", "arla"], {
        env: {},
        now: () => new Date("2026-08-13T10:00:00.000Z"),
        createStore: () => store as never,
        runCrawl: async () => { throw new Error("fixture failure"); },
        writeFile: async () => undefined,
        output: () => undefined,
      })
    ).rejects.toThrow("fixture failure");
    expect(close).toHaveBeenCalledOnce();
  });

  it("attempts cleanup when connect partially initializes and then rejects", async () => {
    const close = vi.fn(async () => undefined);
    const store = {
      connect: vi.fn(async () => { throw new Error("partial connect"); }),
      close,
    };

    await expect(
      executeDanishJsonLdCli(["--sources", "arla"], {
        env: {},
        createStore: () => store as never,
        output: () => undefined,
      })
    ).rejects.toThrow("partial connect");
    expect(close).toHaveBeenCalledOnce();
  });

  it("fails closed before store creation when VPN startup has no verified relay", async () => {
    const createStore = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    await expect(
      executeDanishJsonLdCli(["--sources", "arla", "--vpn"], {
        env: {},
        createStore,
        createVpnTransport: () => ({
          cleanup,
          initialize: async () => { throw new Error("No verified Mullvad relay is available"); },
        }) as never,
        output: () => undefined,
      })
    ).rejects.toThrow("No verified Mullvad relay is available");
    expect(createStore).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("keeps direct mode as the default and never constructs VPN transport", async () => {
    const createVpnTransport = vi.fn();
    const store = {
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      insertDanishJsonLdRun: vi.fn(async () => undefined),
    };

    await executeDanishJsonLdCli(["--sources", "arla"], {
      env: {},
      createStore: () => store as never,
      createVpnTransport,
      runCrawl: async () => ({
        summary: { robotsEnforced: false, sourceOutcomes: [] },
        observations: [],
      }),
      output: () => undefined,
    });

    expect(createVpnTransport).not.toHaveBeenCalled();
  });

  it("initializes VPN before the store, passes it to the crawl, and cleans it up", async () => {
    const order: string[] = [];
    const vpnTransport = {
      initialize: vi.fn(async () => { order.push("vpn-initialize"); }),
      cleanup: vi.fn(async () => { order.push("vpn-cleanup"); }),
    };
    const store = {
      connect: vi.fn(async () => { order.push("store-connect"); }),
      close: vi.fn(async () => { order.push("store-close"); }),
      insertDanishJsonLdRun: vi.fn(async () => undefined),
    };
    const runCrawl = vi.fn(async () => ({
      summary: { robotsEnforced: false as const, sourceOutcomes: [] },
      observations: [],
    }));

    await executeDanishJsonLdCli(["--sources", "arla", "--vpn", "--vpn-country", "dk"], {
      env: {},
      createStore: () => store as never,
      createVpnTransport: (country) => {
        expect(country).toBe("dk");
        return vpnTransport as never;
      },
      runCrawl,
      output: () => undefined,
    });

    expect(order).toEqual([
      "vpn-initialize",
      "store-connect",
      "store-close",
      "vpn-cleanup",
    ]);
    expect(runCrawl.mock.calls[0][0]).toMatchObject({ vpnTransport });
  });

  it("cleans up VPN even when store cleanup rejects", async () => {
    const vpnCleanup = vi.fn(async () => undefined);
    const insertDanishJsonLdRun = vi.fn(async () => undefined);
    const store = {
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => { throw new Error("store close failed"); }),
      insertDanishJsonLdRun,
    };

    await expect(executeDanishJsonLdCli(["--vpn"], {
      env: {},
      createStore: () => store as never,
      createVpnTransport: () => ({
        initialize: async () => undefined,
        cleanup: vpnCleanup,
      }) as never,
      runCrawl: async () => ({
        summary: { robotsEnforced: false, sourceOutcomes: [] },
        observations: [],
      }),
      output: () => undefined,
    })).rejects.toThrow("store close failed");

    expect(insertDanishJsonLdRun).toHaveBeenCalledOnce();
    expect(vpnCleanup).toHaveBeenCalledOnce();
  });

  it("makes forced runs use fresh queue attempt identity when CRAWL_RUN_ID is reused", async () => {
    const runInputs: Array<{ crawlRunId: string }> = [];
    const store = {
      connect: async () => undefined,
      close: async () => undefined,
      insertDanishJsonLdRun: async () => undefined,
    };
    const dependencies = {
      env: { CRAWL_RUN_ID: "fixed-run" },
      now: () => new Date("2026-08-13T10:00:00.000Z"),
      createStore: () => store as never,
      runCrawl: async (input: { crawlRunId: string }) => {
        runInputs.push(input);
        return {
          summary: { robotsEnforced: false as const, sourceOutcomes: [] },
          observations: [],
        };
      },
      writeFile: async () => undefined,
      output: () => undefined,
    };

    await executeDanishJsonLdCli(["--sources", "arla", "--force"], dependencies);
    await executeDanishJsonLdCli(["--sources", "arla", "--force"], dependencies);

    expect(runInputs).toHaveLength(2);
    expect(runInputs[0].crawlRunId).not.toBe("fixed-run");
    expect(runInputs[1].crawlRunId).not.toBe(runInputs[0].crawlRunId);
  });
});
