import { describe, expect, it } from "vitest";
import {
  analyzeWooCommerceCsv,
  extractWooDescriptionImages,
  mapWooCommerceRowToEdio,
  parseWooCommerceCsv,
  sanitizeWooDescriptionHtml,
} from "./woocommerceImport.js";

const sampleCsv = [
  [
    "ID",
    "Type",
    "SKU",
    "Name",
    "Published",
    "Short description",
    "Description",
    "In stock?",
    "Stock",
    "Sale price",
    "Regular price",
    "Categories",
    "Tags",
    "Images",
    "Brands",
    "Attribute 1 name",
    "Attribute 1 value(s)",
  ].join(","),
  [
    "30256",
    "simple",
    "CHU-II",
    "\"Moondrop Chu II\"",
    "1",
    "\"Compact IEM\"",
    "\"<p>Good IEM</p><img src=\"\"https://brand.example.com/chu-spec-table.jpg\"\" alt=\"\"Chu II specs\"\" width=\"\"1200\"\" height=\"\"1600\"\" /><script>alert(1)</script>\"",
    "1",
    "6",
    "",
    "29000",
    "\"IEM > Dynamic Driver\"",
    "\"iem, portable\"",
    "\"https://cdn.example.com/chu-main.jpg, https://cdn.example.com/chu-side.webp\"",
    "Moondrop",
    "Connector",
    "0.78mm 2-pin",
  ].join(","),
  [
    "30257",
    "simple",
    "CHU-II",
    "\"Moondrop Chu II duplicate\"",
    "1",
    "",
    "",
    "0",
    "",
    "",
    "29000",
    "IEM",
    "",
    "https://cdn.example.com/chu-main.jpg",
    "Moondrop",
    "",
    "",
  ].join(","),
].join("\n");

describe("WooCommerce import dry-run", () => {
  it("parses WooCommerce CSV and maps core fields without writing", () => {
    const parsed = parseWooCommerceCsv(sampleCsv);
    const mapped = mapWooCommerceRowToEdio(parsed.rows[0], { existingCategories: ["iems", "accessories"] });

    expect(parsed.rows).toHaveLength(2);
    expect(mapped.name.en).toBe("Moondrop Chu II");
    expect(mapped.category).toBe("iems");
    expect(mapped.price).toBe(29000);
    expect(mapped.gallery).toHaveLength(2);
    expect(mapped.descriptionBlocks[0].type).toBe("spec_image");
    expect(mapped.specs).toEqual(expect.arrayContaining([{ label: "Connector", value: "0.78mm 2-pin" }]));
  });

  it("builds dry-run matching, duplicate, and review summaries", () => {
    const existingProducts = [
      {
        id: "p1",
        slug: "moondrop-chu-ii-30256",
        sku: "CHU-II",
        name: { en: "Moondrop Chu II", ar: "Moondrop Chu II" },
        brand: "Moondrop",
        category: "iems",
        price: 29000,
        inStock: true,
      },
    ];

    const report = analyzeWooCommerceCsv(sampleCsv, existingProducts, { existingCategories: ["iems", "accessories"] });

    expect(report.summary.total_rows).toBe(2);
    expect(report.summary.products_to_update).toBe(0);
    expect(report.summary.products_needing_review).toBeGreaterThan(0);
    expect(report.preview[0].currentProductMatch.matchBy).toBe("sku");
    expect(report.preview[1].match.status).toBe("duplicate_in_file");
    expect(report.applyPlan.defaultMode).toBe("dry_run_only");
  });

  it("extracts description media and sanitizes unsafe HTML", () => {
    const unsafe = `<div onclick="x()"><script>alert(1)</script><img src="http://127.0.0.1/private.png"><img src="https://brand.example.com/feature.webp" alt="Feature"></div>`;
    const clean = sanitizeWooDescriptionHtml(unsafe);
    const images = extractWooDescriptionImages(unsafe);

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe("https://brand.example.com/feature.webp");
  });
});
