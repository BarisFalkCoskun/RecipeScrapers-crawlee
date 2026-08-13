import { describe, expect, it, vi } from "vitest";
import { executeDanishJsonLdCli } from "../../src/danish-jsonld/cli.js";
import type { DanishJsonLdRunSummary } from "../../src/types.js";

describe("crawl:danish-jsonld CLI", () => {
  it("connects, executes selected sources, writes run evidence, and closes the store", async () => {
    const connect = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const store = { connect, close };
    const summary: DanishJsonLdRunSummary = {
      robotsEnforced: false,
      sourceOutcomes: [
        {
          sourceId: "arla",
          outcome: "succeeded",
          outcomeReasons: ["recipes-persisted"],
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

  it("rejects VPN controls until Task 4 and does not create a store", async () => {
    const createStore = vi.fn();
    await expect(
      executeDanishJsonLdCli(["--sources", "arla", "--vpn"], {
        env: {},
        createStore,
        output: () => undefined,
      })
    ).rejects.toThrow("--vpn is unsupported until Task 4");
    expect(createStore).not.toHaveBeenCalled();
  });

  it("makes forced runs use fresh queue attempt identity when CRAWL_RUN_ID is reused", async () => {
    const runInputs: Array<{ crawlRunId: string }> = [];
    const store = {
      connect: async () => undefined,
      close: async () => undefined,
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
