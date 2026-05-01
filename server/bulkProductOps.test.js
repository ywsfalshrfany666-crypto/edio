import { describe, expect, it } from "vitest";
import {
  applyPreviewChangesToProduct,
  buildBulkPreview,
  classifyProductForBulk,
  resolveBulkCategoryTerm,
} from "./bulkProductOps.js";

const existingCategories = ["headphones", "iems", "dap", "dac", "audio-interface", "mic", "accessories"];

function makeProduct(overrides = {}) {
  return {
    id: "prd_test",
    slug: "rode-podmic-usb",
    name: { en: "Rode PodMic USB Dynamic Microphone", ar: "" },
    brand: "Rode",
    category: "mic",
    subCategories: ["dynamic"],
    tagline: { en: "USB and XLR dynamic microphone for podcasting.", ar: "" },
    image: "/media/imports/rode-podmic.png",
    price: 120000,
    specs: [{ label: "Transducer", value: "Dynamic" }],
    features: ["USB-C and XLR output"],
    inStock: true,
    stock: 4,
    tags: [],
    ...overrides,
  };
}

describe("bulk product classification", () => {
  it("uses existing taxonomy only and resolves a child category", () => {
    const result = classifyProductForBulk(makeProduct(), { existingCategories });

    expect(result.category).toBe("mic");
    expect(result.subCategories).toContain("dynamic");
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.75);
    expect(resolveBulkCategoryTerm("mic", "dynamic")?.slug).toBe("dynamic");
  });

  it("marks unclear products for review instead of inventing a category", () => {
    const result = classifyProductForBulk(
      makeProduct({
        name: { en: "Unclear Model 123", ar: "" },
        slug: "unclear-model-123",
        brand: "",
        category: "",
        subCategories: [],
        tagline: { en: "", ar: "" },
        specs: [],
        features: [],
      }),
      { existingCategories },
    );

    expect(result.needs_review).toBe(true);
    expect(result.confidence_score).toBeLessThan(0.75);
  });
});

describe("bulk previews and safety gates", () => {
  it("builds safe availability previews", () => {
    const preview = buildBulkPreview([makeProduct()], {
      action: "update_availability",
      options: { availability: "out_of_stock", confidence_threshold: 0.75 },
    }, { existingCategories });

    expect(preview.safe_count).toBe(1);
    expect(preview.preview[0].changes).toMatchObject({ inStock: false, stock: 0, availabilityStatus: "out_of_stock" });
  });

  it("skips low confidence reclassification rows", () => {
    const preview = buildBulkPreview([
      makeProduct({
        name: { en: "Unclear Model 123", ar: "" },
        slug: "unclear-model-123",
        category: "",
        subCategories: [],
        specs: [],
        tagline: { en: "", ar: "" },
        features: [],
      }),
    ], {
      action: "reclassify",
      options: { confidence_threshold: 0.75 },
    }, { existingCategories });

    expect(preview.preview[0].safe).toBe(false);
    expect(preview.blocked_count).toBe(1);
  });

  it("previews transparent PNG normalization on pure white", () => {
    const preview = buildBulkPreview([makeProduct()], {
      action: "normalize_images",
      options: { confidence_threshold: 0.75 },
    }, { existingCategories });

    expect(preview.preview[0].safe).toBe(true);
    expect(preview.preview[0].changes.imageProcessing).toMatchObject({
      background: "#FFFFFF",
      objectFit: "contain",
      shadow: false,
      gradient: false,
    });
  });

  it("applies only safe preview changes to a product", () => {
    const product = makeProduct();
    const preview = buildBulkPreview([product], {
      action: "assign_subcategory",
      options: { subcategory: "condenser", confidence_threshold: 0.75 },
    }, { existingCategories });

    const changed = applyPreviewChangesToProduct(product, preview.preview[0], "2026-04-25T00:00:00.000Z");

    expect(changed).toBe(true);
    expect(product.subCategories).toContain("condenser");
    expect(product.lastBulkActionAt).toBe("2026-04-25T00:00:00.000Z");
  });
});
