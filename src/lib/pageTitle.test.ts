import { describe, expect, it } from "vitest";
import { buildPageTitle, titleFromSlug } from "./pageTitle";

describe("buildPageTitle", () => {
  it("keeps the homepage title as edio only", () => {
    expect(buildPageTitle({ isHome: true })).toBe("edio");
  });

  it("builds product titles from the real product name", () => {
    expect(buildPageTitle({ type: "product", title: "AKG K371" })).toBe("AKG K371 | edio");
  });

  it("builds category titles", () => {
    expect(buildPageTitle({ type: "category", title: "Headphones" })).toBe("Headphones | edio");
  });

  it("builds subcategory titles with parent context", () => {
    expect(buildPageTitle({ type: "subcategory", title: "Open Back", parentTitle: "Headphones" })).toBe(
      "Open Back · Headphones | edio",
    );
  });

  it("builds empty and query search titles", () => {
    expect(buildPageTitle({ type: "search" })).toBe("Search | edio");
    expect(buildPageTitle({ type: "search", title: "AKG" })).toBe("Search: AKG | edio");
  });

  it("builds admin titles without storefront wording", () => {
    expect(buildPageTitle({ type: "admin", title: "Products" })).toBe("Products · Admin | edio");
    expect(buildPageTitle({ type: "admin", title: "Dashboard" })).toBe("Admin | edio");
  });

  it("prevents duplicate edio and placeholder titles", () => {
    expect(buildPageTitle({ title: "edio | edio" })).toBe("edio");
    expect(buildPageTitle({ title: "Product | edio | edio" })).toBe("Product | edio");
    expect(buildPageTitle({ title: undefined, type: "product" })).toBe("Product | edio");
    expect(buildPageTitle({ title: "META_TITLE", type: "product" })).toBe("Product | edio");
    expect(buildPageTitle({ title: "PageSpeed Insights", type: "category" })).toBe("Category | edio");
    expect(buildPageTitle({ title: "[object Object]", type: "category" })).toBe("Category | edio");
  });

  it("trims long titles safely", () => {
    expect(
      buildPageTitle({
        type: "product",
        title: "A very long limited edition headphone name with excessive marketing copy and bundle notes",
      }),
    ).toBe("A very long limited edition headphone name... | edio");
  });

  it("can humanize slug fallbacks when needed", () => {
    expect(titleFromSlug("open-back")).toBe("Open Back");
    expect(titleFromSlug("dac-amp")).toBe("DAC & AMP");
  });
});
