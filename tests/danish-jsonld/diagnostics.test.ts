import { describe, expect, it } from "vitest";
import {
  createBoundedDiagnostic,
  inspectJsonLdShape,
} from "../../src/danish-jsonld/diagnostics.js";

describe("Danish JSON-LD diagnostics", () => {
  it("bounds nested values and redacts credentials, secrets, and proxy URLs", () => {
    const diagnostic = createBoundedDiagnostic("http-response", {
      sourceId: "fixture",
      authorization: "Bearer secret",
      proxyUrl: "http://user:pass@proxy.example:8080/path?token=secret",
      responseUrl: "https://user:pass@example.dk/path?token=secret&safe=1",
      snippet: "x".repeat(2_000),
      values: Array.from({ length: 100 }, (_, index) => index),
      deeply: { one: { two: { three: { four: { five: "hidden" } } } } },
    });
    const serialized = JSON.stringify(diagnostic);

    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("token=secret");
    expect(serialized.length).toBeLessThan(4_000);
    expect(diagnostic.data.authorization).toBe("[redacted]");
    expect(diagnostic.data.proxyUrl).toBe("[redacted]");
    expect(String(diagnostic.data.snippet).length).toBeLessThanOrEqual(512);
    expect(diagnostic.data.values).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      "[90 more items]",
    ]);
  });

  it("redacts embedded proxy credentials, query secrets, cookies, and authorization text", () => {
    const serialized = JSON.stringify(
      createBoundedDiagnostic("request-failed", {
        error:
          "proxy http://alice:s3cr3t@proxy.example/path?token=abc failed; " +
          "Authorization: Bearer top-secret Cookie: session=private-value; theme=dark",
        snippet:
          "retry https://example.dk/path?api_key=hidden&safe=1 with cookie: sid=secret-cookie",
        detail: "raw token=loose-secret",
      })
    );

    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("s3cr3t");
    expect(serialized).not.toContain("token=abc");
    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("private-value");
    expect(serialized).not.toContain("api_key=hidden");
    expect(serialized).not.toContain("secret-cookie");
    expect(serialized).not.toContain("loose-secret");
    expect(serialized).toContain("[redacted]");
  });

  it("summarizes JSON-LD wrappers, node types, fields, and leaves without payload values", () => {
    expect(
      inspectJsonLdShape({
        "@graph": [
          {
            "@type": "Recipe",
            name: "Secret title",
            recipeIngredient: ["one", "two"],
            recipeInstructions: [{ "@type": "HowToStep", text: "Do it" }],
          },
        ],
      })
    ).toEqual({
      wrapperKinds: ["@graph"],
      nodeTypes: ["HowToStep", "Recipe"],
      fieldNames: [
        "@graph",
        "@type",
        "name",
        "recipeIngredient",
        "recipeInstructions",
        "text",
      ],
      leafShapes: { array: 3, object: 3, string: 6 },
      nodeCount: 3,
    });
  });
});
