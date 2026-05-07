import { describe, expect, it } from "vitest";
import { normalizeProductDescriptionBlocks, splitProductDescriptionSections } from "./productDescriptionBlocks";
import type { Product } from "@/data/catalog";

const product = {
  id: "p1",
  slug: "test-product",
  name: { en: "Test Product", ar: "Test Product" },
  brand: "EDIO",
  category: "iems",
  subCategories: [],
  tagline: { en: "", ar: "" },
  price: 1,
  compareAt: null,
  currency: "IQD",
  image: "/image.jpg",
  gallery: [],
  badge: null,
  features: [],
  specs: [],
  inStock: true,
  descriptionBlocks: [
    { type: "text", content: { text: "Inside the Box: 1x cable\n1x carrying case" }, sortOrder: 0 },
    { type: "image", media: { url: "https://brand.example.com/feature.webp", role: "feature" }, sortOrder: 1 },
    { type: "spec_image", media: { url: "https://brand.example.com/spec.webp", role: "spec_image" }, sortOrder: 2 },
    { type: "image", media: { url: "https://brand.example.com/box.webp", role: "box_image" }, sortOrder: 3 },
  ],
} satisfies Product;

describe("product description block sections", () => {
  it("splits text, description images, spec images, and box content without empty placeholders", () => {
    const blocks = normalizeProductDescriptionBlocks(product, "en");
    const sections = splitProductDescriptionSections(blocks);

    expect(sections.textBlocks).toHaveLength(1);
    expect(sections.descriptionImageBlocks.map((block) => block.mediaUrl)).toEqual(["https://brand.example.com/feature.webp"]);
    expect(sections.specImageBlocks.map((block) => block.mediaUrl)).toEqual(["https://brand.example.com/spec.webp"]);
    expect(sections.boxImageBlocks.map((block) => block.mediaUrl)).toEqual(["https://brand.example.com/box.webp"]);
    expect(sections.boxContents).toEqual(["1x cable", "1x carrying case"]);
  });
});
