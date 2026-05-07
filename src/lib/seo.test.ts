import { describe, expect, it } from "vitest";
import { products } from "@/data/catalog";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildCategorySeo,
  buildProductJsonLd,
  buildProductSeo,
  productSeoIssues,
} from "./seo";

describe("seo helpers", () => {
  const product = products[0];

  it("builds canonical product metadata without localhost", () => {
    const seo = buildProductSeo(product, "en");

    expect(seo.canonicalPath).toBe(`/product/${product.slug}`);
    expect(seo.title).toContain(product.brand);
    expect(seo.description.length).toBeGreaterThan(40);
    expect(absoluteUrl(seo.canonicalPath)).toBe(`https://edio-iq.com/product/${product.slug}`);
  });

  it("builds product schema with real offer data and no fake ratings", () => {
    const schema = buildProductJsonLd(product, "en");

    expect(schema["@type"]).toBe("Product");
    expect(schema.offers.price).toBe(String(product.price));
    expect(schema.offers.priceCurrency).toBe("IQD");
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(schema).not.toHaveProperty("review");
  });

  it("builds category metadata and breadcrumb JSON-LD", () => {
    const seo = buildCategorySeo("iems", "en", "dynamic-driver");
    const breadcrumb = buildBreadcrumbJsonLd([
      { name: "Shop", path: "/shop" },
      { name: "IEMs", path: "/category/iems" },
    ]);

    expect(seo.canonicalPath).toBe("/category/iems/dynamic-driver");
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(breadcrumb.itemListElement).toHaveLength(2);
  });

  it("reports missing SEO fields without changing products", () => {
    expect(productSeoIssues({ ...product, image: "", specs: [] })).toEqual(
      expect.arrayContaining(["missing image", "missing specs"]),
    );
  });
});
