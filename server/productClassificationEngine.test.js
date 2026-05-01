import { describe, expect, it } from "vitest";
import {
  applyClassificationToProduct,
  classifyProductForCatalog,
  normalizeCategoryAssignment,
} from "./productClassificationEngine.js";

const baseProduct = {
  id: "p1",
  slug: "akg-k371",
  name: { en: "AKG K371", ar: "AKG K371" },
  brand: "AKG",
  category: "headphones",
  subCategories: ["closed-back", "type-back", "dynamic-driver-driver-configuration-headphone"],
  tagline: { en: "Closed-back dynamic studio headphones", ar: "" },
  features: [],
  specs: [],
  tags: [],
  inStock: true,
  price: 140000,
  createdAt: "2026-04-20T00:00:00.000Z",
};

describe("product classification engine", () => {
  it("preserves existing WordPress category terms when they map to current taxonomy", () => {
    const result = classifyProductForCatalog(baseProduct, { now: "2026-04-25T00:00:00.000Z" });

    expect(result.primary_category_slug).toBe("headphones");
    expect(result.secondary_category_slugs).toContain("closed-back");
    expect(result.secondary_category_slugs).toContain("dynamic-driver");
    expect(result.dynamic_collection_slugs).toContain("in-stock");
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.75);
    expect(result.evidence.some((item) => item.source_type === "internal")).toBe(true);
  });

  it("uses official evidence for open-back classification", () => {
    const result = classifyProductForCatalog(
      {
        ...baseProduct,
        id: "p2",
        slug: "hifiman-edition-xs",
        name: { en: "HiFiMAN Edition XS", ar: "HiFiMAN Edition XS" },
        brand: "HiFiMAN",
        subCategories: [],
        tagline: { en: "", ar: "" },
      },
      {
        source_snippets: [
          {
            source_type: "official",
            source_url: "https://store.hifiman.com/index.php/edition-xs.html",
            facts: ["Edition XS is an open-back planar magnetic headphone."],
          },
        ],
      },
    );

    expect(result.primary_category_slug).toBe("headphones");
    expect(result.secondary_category_slugs).toEqual(expect.arrayContaining(["open-back", "planar-driver"]));
    expect(result.needs_review).toBe(false);
  });

  it("queues conflicting secondary evidence for review", () => {
    const result = classifyProductForCatalog(
      {
        ...baseProduct,
        id: "p3",
        subCategories: [],
        tagline: { en: "", ar: "" },
      },
      {
        source_snippets: [
          { source_type: "official", source_url: "https://brand.example/p3", facts: ["Open-back headphone"] },
          { source_type: "retailer", source_url: "https://retailer.example/p3", facts: ["Closed-back headphone"] },
        ],
      },
    );

    expect(result.primary_category_slug).toBe("headphones");
    expect(result.needs_review).toBe(true);
    expect(result.classification_reason).toContain("open_back_vs_closed_back");
  });

  it("does not invent a category for unclear products", () => {
    const result = classifyProductForCatalog({
      ...baseProduct,
      id: "p4",
      slug: "mystery-device",
      name: { en: "Mystery Device", ar: "Mystery Device" },
      brand: "",
      category: "",
      subCategories: [],
      tagline: { en: "No reliable product type", ar: "" },
    });

    expect(result.primary_category_slug).toBe("");
    expect(result.needs_review).toBe(true);
    expect(result.confidence_score).toBeLessThan(0.75);
  });

  it("stores an explicit assignment relation when applied", () => {
    const product = JSON.parse(JSON.stringify(baseProduct));
    const result = classifyProductForCatalog(product, { now: "2026-04-25T00:00:00.000Z" });
    const assignment = applyClassificationToProduct(product, result, "2026-04-25T00:00:00.000Z");

    expect(assignment.productId).toBe(product.id);
    expect(product.categoryAssignment).toEqual(assignment);
    expect(product.category).toBe(result.primary_category_slug);
    expect(product.subCategories).toEqual(result.secondary_category_slugs);
  });

  it("normalizes assignment output contract into relation fields", () => {
    const assignment = normalizeCategoryAssignment("p5", {
      primary_category_slug: "mic",
      secondary_category_slugs: ["dynamic"],
      dynamic_collection_slugs: ["in-stock"],
      confidence_score: 0.94,
      needs_review: false,
      classification_reason: "official dynamic mic evidence",
      evidence: [{ source_type: "official", source_url: "https://shure.com", facts: ["dynamic microphone"] }],
    });

    expect(assignment.primaryCategorySlug).toBe("mic");
    expect(assignment.secondaryCategorySlugs).toEqual(["dynamic"]);
    expect(assignment.confidenceScore).toBe(0.94);
  });
});
