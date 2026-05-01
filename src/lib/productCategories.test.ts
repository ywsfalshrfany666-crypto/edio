import { describe, expect, it } from "vitest";
import { normalizeProductCategory, productCategorySlugs } from "./productCategories";
import {
  countProductsForCategoryTerm,
  getCategoryPath,
  productMatchesCategoryTerm,
  resolveCategoryTerm,
} from "./categoryTaxonomy";

describe("product category normalization", () => {
  it("keeps the storefront categories limited to the existing EDIO sections", () => {
    expect([...productCategorySlugs]).toEqual([
      "headphones",
      "iems",
      "dap",
      "dac",
      "audio-interface",
      "mic",
      "accessories",
    ]);
  });

  it("classifies common audio product names into existing sections", () => {
    expect(normalizeProductCategory({ name: "Rode PodMic USB dynamic microphone" })).toBe("mic");
    expect(normalizeProductCategory({ name: "Focusrite Scarlett 2i2 4th Gen USB Audio Interface" })).toBe("audio-interface");
    expect(normalizeProductCategory({ name: "HiFiMAN Ananda Planar Magnetic Headphones" })).toBe("headphones");
    expect(normalizeProductCategory({ name: "Kiwi Ears Canta IEM 2-pin cable" })).toBe("iems");
  });

  it("keeps unclear products out of Accessories until reviewed", () => {
    expect(normalizeProductCategory({ name: "Unclear Model 123" })).toBe("unknown");
  });
});

describe("existing category terms", () => {
  const closedHeadphone = {
    category: "headphones",
    name: "AKG K371 Closed Back Headphones",
    subCategories: ["closed-back", "type-back", "dynamic-driver-driver-configuration-headphone"],
  };
  const openHeadphone = {
    category: "headphones",
    name: "Hifiman Ananda Planar Magnetic Headphones",
    subCategories: ["open-back", "type-back", "planar-driver-driver-configuration-headphone"],
  };
  const parentOnlyHeadphone = {
    category: "headphones",
    name: "Unsorted Headphone",
    subCategories: [],
  };
  const accessories = [
    { category: "accessories", name: "MOGAMI Cable", subCategories: ["audio-cables"] },
    { category: "accessories", name: "SpinFit Tips", subCategories: ["eartips"] },
  ];

  it("lets the parent route include parent-only and child products", () => {
    expect(productMatchesCategoryTerm(closedHeadphone, "headphones")).toBe(true);
    expect(productMatchesCategoryTerm(openHeadphone, "headphones")).toBe(true);
    expect(productMatchesCategoryTerm(parentOnlyHeadphone, "headphones")).toBe(true);
  });

  it("keeps child routes scoped to their own term", () => {
    expect(productMatchesCategoryTerm(closedHeadphone, "headphones", "closed-back")).toBe(true);
    expect(productMatchesCategoryTerm(closedHeadphone, "headphones", "open-back")).toBe(false);
    expect(productMatchesCategoryTerm(parentOnlyHeadphone, "headphones", "closed-back")).toBe(false);
  });

  it("honors explicit category assignments even when legacy subCategories are empty", () => {
    const assignmentOnlyHeadphone = {
      category: "headphones",
      name: "Assignment-only closed headphone",
      subCategories: [],
      categoryAssignment: {
        secondaryCategorySlugs: ["closed-back", "dynamic-driver"],
      },
    };

    expect(productMatchesCategoryTerm(assignmentOnlyHeadphone, "headphones", "closed-back")).toBe(true);
    expect(productMatchesCategoryTerm(assignmentOnlyHeadphone, "headphones", "open-back")).toBe(false);
  });

  it("supports existing grouped terms without inventing new taxonomy", () => {
    expect(productMatchesCategoryTerm(closedHeadphone, "headphones", "type-back")).toBe(true);
    expect(productMatchesCategoryTerm(openHeadphone, "headphones", "type-back")).toBe(true);
    expect(resolveCategoryTerm("accessories", "cables")?.slug).toBe("audio-cables");
    expect(getCategoryPath("accessories", "cables")).toBe("/category/accessories/audio-cables");
  });

  it("keeps empty child categories empty instead of falling back to the parent", () => {
    expect(countProductsForCategoryTerm(accessories, "accessories", "cases")).toBe(0);
    expect(countProductsForCategoryTerm(accessories, "accessories")).toBe(2);
  });
});
