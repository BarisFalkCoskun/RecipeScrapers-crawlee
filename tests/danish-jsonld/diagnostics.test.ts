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

  it("removes complete embedded proxy endpoints while preserving public URLs", () => {
    const serialized = JSON.stringify(
      createBoundedDiagnostic("request-failed", {
        error:
          "failed through http://alice:secret@proxy.example:8080/proxy-path?token=abc " +
          "while fetching https://public.example/visible?safe=1",
      })
    );

    expect(serialized).toContain("[proxy-url-redacted]");
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("proxy.example");
    expect(serialized).not.toContain("proxy-path");
    expect(serialized).toContain("https://public.example/visible?safe=1");
  });

  it("whole-redacts neutral-host URLs in proxy and refused-connect context", () => {
    const serialized = JSON.stringify(
      createBoundedDiagnostic("request-failed", {
        error:
          "proxy http://gateway.example:8080/proxy-path failed; " +
          "connect ECONNREFUSED http://edge.vendor.example:3128/; " +
          "response https://public.example/visible?safe=1",
      })
    );

    expect(serialized.match(/\[proxy-url-redacted\]/gu)).toHaveLength(2);
    expect(serialized).not.toContain("gateway.example");
    expect(serialized).not.toContain("edge.vendor.example");
    expect(serialized).not.toContain("proxy-path");
    expect(serialized).toContain("https://public.example/visible?safe=1");
  });

  it("whole-redacts structured records declared as proxy provenance", () => {
    const diagnostic = createBoundedDiagnostic("request-failed", {
      transport: {
        provenance: "proxy",
        endpoint: "http://gateway.example:8080/proxy-path",
        provider: "vendor-name",
      },
      responseUrl: "https://public.example/visible?safe=1",
    });
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.data.transport).toBe("[proxy-url-redacted]");
    expect(serialized).not.toContain("gateway.example");
    expect(serialized).not.toContain("vendor-name");
    expect(diagnostic.data.responseUrl).toBe(
      "https://public.example/visible?safe=1"
    );
  });

  it.each(["socks://", "socks4://", "socks5://"])(
    "redacts the full %s URL in arbitrary proxy context and provenance",
    (scheme) => {
      const proxyUrl = `${scheme}relay-user:relay-pass@10.64.0.7:1080/path?token=secret`;
      const diagnostic = createBoundedDiagnostic("proxy-failure", {
        message: `transport failed through ${proxyUrl} while dialing`,
        provenance: {
          transport: "mullvad-wireguard-socks",
          endpoint: proxyUrl,
        },
      });
      const serialized = JSON.stringify(diagnostic);

      expect(serialized).not.toContain("relay-user");
      expect(serialized).not.toContain("relay-pass");
      expect(serialized).not.toContain("10.64.0.7");
      expect(serialized).not.toContain("token=secret");
      expect(serialized).toContain("[proxy-url-redacted]");
    }
  );

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
