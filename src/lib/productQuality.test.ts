import { describe, expect, it } from "vitest";
import { calculateProductQuality } from "./productQuality";

describe("product quality score", () => {
  it("flags incomplete products for admin review", () => {
    const result = calculateProductQuality({
      brand: "AKG",
      category: "headphones",
      price: 0,
      gallery: [],
      specs: [],
      tagline: { en: "", ar: "" },
    });

    expect(result.score).toBeLessThan(70);
    expect(result.needsReview).toBe(true);
    expect(result.missing).toContain("Price");
  });

  it("rewards complete storefront data", () => {
    const result = calculateProductQuality({
      image: "/product.png",
      normalizedImageUrl: "/product.png",
      gallery: ["/1.png", "/2.png", "/3.png"],
      price: 99000,
      inStock: true,
      stock: 8,
      brand: "AKG",
      category: "headphones",
      subCategories: ["closed-back"],
      tagline: { en: "Closed-back monitoring headphone", ar: "سماعة مراقبة مغلقة" },
      specs: [
        { label: "Driver", value: "Dynamic" },
        { label: "Impedance", value: "32 Ohms" },
        { label: "Connection", value: "3.5mm" },
      ],
      seo: { metaTitle: "AKG headphones", metaDescription: "Closed-back AKG headphones." },
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.needsReview).toBe(false);
  });
});
