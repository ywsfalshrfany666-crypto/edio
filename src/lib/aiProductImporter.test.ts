import { describe, expect, it } from "vitest";
import type { ApiProduct } from "@/lib/api";
import {
  classifyResearchSource,
  createResearchDraftFromImported,
  dedupeImageCandidates,
  dedupeSpecs,
  findProductDuplicateCandidate,
  isUnsafeResearchUrl,
  mapResearchDraftToProductPage,
  normalizeImageCandidateUrl,
  normalizeResearchInput,
  normalizeSpecName,
  normalizeSpecValue,
  rankSources,
  validateResearchDraft,
} from "@/lib/aiProductImporter";

function product(overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    id: "p1",
    slug: "hifiman-he6se-v2",
    sourceUrl: "https://hifiman.com/products/detail/315",
    name: { en: "HiFiMAN HE6se V2", ar: "HiFiMAN HE6se V2" },
    brand: "HiFiMAN",
    category: "headphones",
    subCategories: [],
    tagline: { en: "", ar: "" },
    price: 1,
    currency: "IQD",
    image: "/media/imports/he6se.png",
    gallery: [],
    compareAt: null,
    badge: null,
    features: [],
    specs: [],
    inStock: true,
    sales: 0,
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("aiProductImporter", () => {
  it("classifies product name and URL import inputs", () => {
    expect(normalizeResearchInput(" HiFiMAN HE6se V2 ").inputType).toBe("query");
    expect(normalizeResearchInput("https://hifiman.com/products/he6se-v2").inputType).toBe("url");
  });

  it("ranks official sources before reviews and general web pages", () => {
    const ranked = rankSources([
      { title: "Random blog", url: "https://example.com/he6se" },
      { title: "HiFiMAN official manual PDF", url: "https://hifiman.com/manuals/he6se.pdf" },
      { title: "Head-Fi impressions", url: "https://www.head-fi.org/threads/he6se" },
    ]);

    expect(ranked[0].sourceType).toBe("official_manual");
    expect(ranked[0].confidence).toBe("high");
    expect(classifyResearchSource(ranked[2]).confidence).toBe("low");
  });

  it("normalizes image URLs and removes duplicate image candidates", () => {
    expect(normalizeImageCandidateUrl("https://cdn.brand.com/he6se.jpg?width=600&height=600#hero")).toBe(
      "https://cdn.brand.com/he6se.jpg",
    );

    const result = dedupeImageCandidates([
      {
        url: "https://cdn.brand.com/he6se.jpg?width=600",
        width: 600,
        height: 600,
        licenseStatus: "official_manufacturer",
        sourceType: "official_manufacturer",
      },
      {
        url: "https://cdn.brand.com/he6se.jpg?height=300",
        width: 300,
        height: 300,
        licenseStatus: "unknown",
      },
      {
        url: "https://cdn.brand.com/he6se-side.webp",
        width: 900,
        height: 700,
        licenseStatus: "official_manufacturer",
      },
    ]);

    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(result.accepted[0].duplicateGroupId).toBe("image_dup_1");
  });

  it("dedupes equivalent specs and detects unresolved official conflicts", () => {
    expect(normalizeSpecName("مقاومة")).toBe("impedance");
    expect(normalizeSpecValue("50 ohm")).toBe("50Ω");

    const deduped = dedupeSpecs([
      { name: "Impedance", value: "50 ohm", confidence: "high", sourceType: "official_manual" },
      { name: "impedance", value: "50 Ω", confidence: "medium", sourceType: "expert_review" },
      { name: "Impedance", value: "64 ohm", confidence: "high", sourceType: "official_manufacturer" },
    ]);

    expect(deduped.accepted).toHaveLength(0);
    expect(deduped.duplicates).toHaveLength(0);
    expect(deduped.conflicts).toHaveLength(1);
    expect(deduped.conflicts[0].preferred).toBeUndefined();
  });

  it("detects existing products by source, slug, brand, and model", () => {
    expect(
      findProductDuplicateCandidate([product()], {
        brand: "HiFiMAN",
        nameEn: "HiFiMAN HE6se V2",
        sourceUrl: "https://hifiman.com/products/detail/315?utm_source=test",
      }),
    ).toMatchObject({ slug: "hifiman-he6se-v2" });
  });

  it("rejects unsafe, private, credentialed, and tokenized research URLs", () => {
    expect(isUnsafeResearchUrl("http://127.0.0.1:4173/admin/products")).toBe(true);
    expect(isUnsafeResearchUrl("https://user:pass@example.com/product")).toBe(true);
    expect(isUnsafeResearchUrl("https://example.com/product?token=secret")).toBe(true);
    expect(isUnsafeResearchUrl("https://brand.com/product")).toBe(false);
  });

  it("maps a reviewed research draft into Product Page Builder content", () => {
    const draft = createResearchDraftFromImported({
      query: "HiFiMAN HE6se V2",
      imported: {
        sourceUrl: "https://hifiman.com/products/he6se-v2",
        nameEn: "HiFiMAN HE6se V2",
        brand: "HiFiMAN",
        category: "headphones",
        taglineEn: "Planar magnetic headphone.",
        image: "https://hifiman.com/media/he6se-v2.jpg",
        gallery: ["https://hifiman.com/media/he6se-v2.jpg", "https://hifiman.com/media/he6se-v2-side.jpg"],
        features: ["Open-back planar magnetic design"],
        specs: [{ label: { en: "Impedance" }, value: "50 ohm" }],
      },
      products: [],
    });
    const page = mapResearchDraftToProductPage(draft, {
      nameEn: "HiFiMAN HE6se V2",
      brand: "HiFiMAN",
      category: "headphones",
      taglineEn: "Planar magnetic headphone.",
      image: "https://hifiman.com/media/he6se-v2.jpg",
    });

    expect(page.contentStatus).toBe("needs_research");
    expect(page.description?.blocks[0].sourceRefIds?.length).toBe(1);
    expect(page.media?.[0].licenseStatus).toBe("official_manufacturer");
    expect(page.specs?.groups[0].title).toBe("Audio");
    expect(page.seoWarnings?.some((warning) => warning.includes("Research draft only"))).toBe(true);
  });

  it("validates draft errors and warnings before apply or publish", () => {
    const validation = validateResearchDraft({
      query: "http://localhost/product",
      normalizedInput: "http://localhost/product",
      inputType: "url",
      sources: [],
      images: [],
      duplicateImages: [{ url: "https://brand.com/a.jpg" }],
      specs: [],
      duplicateSpecs: [],
      specConflicts: [{ name: "impedance", candidates: [{ name: "impedance", value: "50Ω" }] }],
      warnings: [],
      errors: [],
    });

    expect(validation.errors).toContain("Product URL is unsafe or private.");
    expect(validation.errors).toContain("Unresolved spec conflict.");
    expect(validation.warnings).toContain("No source references found.");
    expect(validation.warnings).toContain("1 duplicate image candidate(s) kept out of final gallery.");
  });
});
