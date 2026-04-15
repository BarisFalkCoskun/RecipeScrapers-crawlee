import { describe, expect, it } from "vitest";
import { evaluateAdmission } from "../../src/discovery/admission.js";
import { LinkFilter } from "../../src/discovery/link-filter.js";

describe("admission policy", () => {
  const trustedSeedDomains = new Set(["trusted.example"]);

  it("allows same-domain candidates from trusted seeds", () => {
    const decision = evaluateAdmission(
      {
        url: "https://trusted.example/collections/dinner",
        canonicalUrl: "https://trusted.example/collections/dinner",
        domain: "trusted.example",
        anchorText: "Dinner ideas",
      },
      {
        sourceDomain: "trusted.example",
        sourceIsTrusted: true,
        sourceIsRecipePage: false,
        sourceDiscoverySource: "seed-root",
        sourceHasRecipeSignals: false,
        trustedSeedDomains,
        linkFilter: new LinkFilter(),
      }
    );

    expect(decision.allowed).toBe(true);
    expect(decision.crossDomain).toBe(false);
    expect(decision.reasons).toContain("same-domain-trusted-seed");
  });

  it("allows trusted off-domain candidates with strong recipe evidence", () => {
    const decision = evaluateAdmission(
      {
        url: "https://remote.example/recipes/cake",
        canonicalUrl: "https://remote.example/recipes/cake",
        domain: "remote.example",
        anchorText: "Cake recipe",
      },
      {
        sourceDomain: "trusted.example",
        sourceIsTrusted: true,
        sourceIsRecipePage: false,
        sourceDiscoverySource: "discovered",
        sourceHasRecipeSignals: false,
        trustedSeedDomains,
        linkFilter: new LinkFilter(),
      }
    );

    expect(decision.allowed).toBe(true);
    expect(decision.crossDomain).toBe(true);
    expect(decision.reasons).toContain("trusted-cross-domain-admission");
  });

  it("rejects low-signal off-domain candidates from trusted sources", () => {
    const decision = evaluateAdmission(
      {
        url: "https://remote.example/about",
        canonicalUrl: "https://remote.example/about",
        domain: "remote.example",
        anchorText: "About us",
      },
      {
        sourceDomain: "trusted.example",
        sourceIsTrusted: true,
        sourceIsRecipePage: false,
        sourceDiscoverySource: "discovered",
        sourceHasRecipeSignals: false,
        trustedSeedDomains,
        linkFilter: new LinkFilter(),
      }
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("insufficient-cross-domain-score");
  });

  it("rejects candidates blocked by queue limits before scoring", () => {
    const filter = new LinkFilter(0);
    const decision = evaluateAdmission(
      {
        url: "https://trusted.example/recipes/cake",
        canonicalUrl: "https://trusted.example/recipes/cake",
        domain: "trusted.example",
        anchorText: "Cake recipe",
      },
      {
        sourceDomain: "trusted.example",
        sourceIsTrusted: true,
        sourceIsRecipePage: true,
        sourceDiscoverySource: "discovered",
        sourceHasRecipeSignals: true,
        trustedSeedDomains,
        linkFilter: filter,
      }
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("domain-page-cap");
  });
});
