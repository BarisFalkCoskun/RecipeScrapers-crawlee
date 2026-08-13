import { describe, expect, it } from "vitest";
import { Configuration } from "crawlee";
import { configureDanishJsonLdRuntimeResources } from "../../src/danish-jsonld/runtime-resources.js";

describe("Danish JSON-LD runtime resources", () => {
  it("uses 75% of host memory by default and reports the effective budget", () => {
    const configuration = new Configuration();
    const diagnostic = configureDanishJsonLdRuntimeResources({
      env: {},
      configuration,
      hostMemoryMbytes: 8_192,
    });

    expect(configuration.get("availableMemoryRatio")).toBe(0.75);
    expect(diagnostic).toMatchObject({
      event: "runtime-resource-budget",
      data: {
        budgetSource: "danish-jsonld-default",
        hostMemoryMbytes: 8_192,
        availableMemoryRatio: 0.75,
        effectiveMemoryMbytes: 6_144,
      },
    });
  });

  it("does not override Crawlee's explicit memory environment settings", () => {
    const configuration = new Configuration();
    const diagnostic = configureDanishJsonLdRuntimeResources({
      env: { CRAWLEE_MEMORY_MBYTES: "4096" },
      configuration,
      hostMemoryMbytes: 8_192,
    });

    expect(configuration.get("availableMemoryRatio")).not.toBe(0.75);
    expect(diagnostic.data).toMatchObject({
      budgetSource: "CRAWLEE_MEMORY_MBYTES",
      effectiveMemoryMbytes: 4_096,
    });
  });
});
