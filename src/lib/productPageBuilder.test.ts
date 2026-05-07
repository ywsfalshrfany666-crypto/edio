import { describe, expect, it } from "vitest";
import {
  buildProductPageDraft,
  normalizeProductPageContent,
  parseProductPageJson,
  productPageToDetailContent,
  validateProductPageContent,
} from "./productPageBuilder";

const product = {
  id: "p1",
  slug: "akg-k371",
  name: { en: "AKG K371", ar: "AKG K371" },
  brand: "AKG",
  category: "headphones",
  subCategories: ["closed-back"],
  tagline: { en: "Closed-back studio headphones", ar: "" },
  price: 139000,
  currency: "IQD" as const,
  image: "/assets/akg.jpg",
  gallery: ["/assets/akg.jpg"],
  specs: [{ label: "Impedance", value: "32 Ohms" }],
};

describe("productPageBuilder", () => {
  it("builds a backward-compatible productPage draft from existing product data", () => {
    const draft = buildProductPageDraft(product);

    expect(draft.contentStatus).toBe("draft");
    expect(draft.description?.blocks[0].title).toBe("AKG K371");
    expect(draft.specs?.groups[0].specs[0]).toMatchObject({ name: "Impedance", value: "32 Ohms" });
    expect(draft.media?.[0]).toMatchObject({ licenseStatus: "unknown", placement: "gallery" });
  });

  it("normalizes unsafe strings and invalid URLs without preserving scripts", () => {
    const normalized = normalizeProductPageContent({
      contentStatus: "published",
      description: {
        blocks: [
          {
            id: "x",
            type: "feature",
            title: "<script>alert(1)</script>Clean",
            body: "\"><img src=x onerror=alert(1)>Body",
            media: { id: "m", url: "javascript:alert(1)", alt: "bad", licenseStatus: "owned", placement: "description", order: 0 },
            order: 0,
            visible: true,
          },
        ],
      },
    });

    expect(normalized?.description?.blocks[0].title).toBe("Clean");
    expect(normalized?.description?.blocks[0].body).not.toContain("onerror");
    expect(normalized?.description?.blocks[0].media).toBeUndefined();
  });

  it("flags missing required page data and do-not-use media", () => {
    const draft = parseProductPageJson(JSON.stringify({
      contentStatus: "draft",
      media: [{ id: "m1", url: "/bad.jpg", alt: "", licenseStatus: "do_not_use", placement: "description", order: 0 }],
      description: { blocks: [] },
    }));

    const validation = validateProductPageContent(product, draft);

    expect(validation.errors).toContain("Media m1 is marked do not use.");
    expect(validation.warnings).toContain("No product page description blocks.");
    expect(validation.score).toBeLessThan(100);
  });

  it("maps productPage sound and specs to product detail content", () => {
    const detail = productPageToDetailContent({
      contentStatus: "reviewed",
      description: { blocks: [] },
      sound: { signature: "neutral", bass: "Controlled bass", genreMatch: ["studio"] },
      specs: { groups: [{ id: "audio", title: "Audio", order: 0, specs: [{ name: "Driver", value: "Dynamic" }] }] },
    });

    expect(detail?.sound?.signature).toBe("neutral");
    expect(detail?.sound?.strengths?.[0]).toContain("Bass");
    expect(detail?.specGroups?.[0].specs[0]).toMatchObject({ name: "Driver", value: "Dynamic" });
  });
});
