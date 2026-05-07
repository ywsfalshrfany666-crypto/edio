import { describe, expect, it } from "vitest";
import {
  applyProductWebEnrichment,
  createProductWebEnrichmentDryRun,
  extractProductEnrichmentFromHtml,
  matchSourceToProduct,
} from "./productWebEnrichment.js";

const product = {
  id: "p_zero_2",
  slug: "7hz-x-crinacle-zero-2",
  name: { en: "7HZ x Crinacle Zero: 2" },
  brand: "7HZ",
  model: "Zero 2",
  category: "iems",
  subcategory: "dynamic-driver",
  price: 39000,
  stock: 8,
  inStock: true,
  image: "/assets/zero2.jpg",
  gallery: ["/assets/zero2.jpg"],
  status: "published",
  qualityScore: 50,
  descriptionBlocks: [],
};

const safeHtml = `
  <main class="product">
    <h1>7HZ x Crinacle Zero: 2</h1>
    <section class="product-description">
      <p>The 7HZ x Crinacle Zero: 2 is an in-ear monitor with a 10mm dynamic driver and a detachable cable.</p>
      <h2>Features</h2>
      <img src="https://cdn.linsoul.com/products/zero-2-feature.jpg" alt="Zero 2 tuning feature">
      <h2>Technical Details</h2>
      <table><tr><td>Driver</td><td>10mm dynamic driver</td></tr><tr><td>Impedance</td><td>32 ohms</td></tr></table>
      <img src="https://cdn.linsoul.com/products/zero-2-spec-chart.webp" alt="Zero 2 specifications chart">
      <h2>Inside the Box</h2>
      <p>Included: 7HZ Zero 2 earphones, detachable cable, ear tips, user manual.</p>
      <img src="https://cdn.linsoul.com/products/zero-2-box.png" alt="Package contents">
    </section>
    <footer>
      <h2>Worldwide Free Shipping</h2>
      <img src="https://cdn.linsoul.com/policies/shipping.jpg" alt="Shipping policy">
    </footer>
  </main>
`;

describe("product web enrichment", () => {
  it("accepts exact source matches and rejects version mismatches", () => {
    const accepted = matchSourceToProduct(product, {
      url: "https://www.linsoul.com/products/7hz-x-crinacle-zero-2",
      title: "7HZ x Crinacle Zero: 2",
      html: safeHtml,
      sourceType: "authorized_retailer",
    });
    expect(accepted.confidence).toBeGreaterThanOrEqual(0.9);

    const rejected = matchSourceToProduct(product, {
      url: "https://www.linsoul.com/products/7hz-x-crinacle-zero",
      title: "7HZ x Crinacle Zero",
      html: "<h1>7HZ x Crinacle Zero</h1><p>Original Zero in-ear monitor.</p>",
      sourceType: "authorized_retailer",
    });
    expect(rejected.confidence).toBeLessThan(0.9);
    expect(rejected.warnings.join(" ")).toMatch(/version mismatch/i);
  });

  it("extracts inline product media while rejecting policy/footer media", () => {
    const extracted = extractProductEnrichmentFromHtml(safeHtml, {
      url: "https://www.linsoul.com/products/7hz-x-crinacle-zero-2",
      sourceType: "authorized_retailer",
    });
    expect(extracted.images.map((image) => image.role)).toEqual(
      expect.arrayContaining(["feature", "spec_image", "box_image", "policy_image_rejected"]),
    );
    expect(extracted.specs).toEqual(expect.arrayContaining([{ label: "Driver", value: "10mm dynamic driver", confidence: 0.9 }]));
    expect(extracted.boxContents.join(" ")).toMatch(/ear tips/i);
  });

  it("dry-run proposes safe blocks without mutating products", () => {
    const db = { products: [{ ...product }] };
    const before = JSON.stringify(db.products[0]);
    const report = createProductWebEnrichmentDryRun(db, {
      productIds: [product.id],
      sourceDocuments: [
        {
          productId: product.id,
          url: "https://www.linsoul.com/products/7hz-x-crinacle-zero-2",
          title: "7HZ x Crinacle Zero: 2",
          html: safeHtml,
          sourceType: "authorized_retailer",
        },
      ],
      recordJob: false,
    });

    expect(JSON.stringify(db.products[0])).toBe(before);
    expect(report.summary.products_safe_to_enrich).toBe(1);
    expect(report.items[0].proposed_spec_images_count).toBeGreaterThan(0);
    expect(report.items[0].proposed_box_images_count).toBeGreaterThan(0);
  });

  it("apply appends safe blocks and preserves price, stock, category, main image, and gallery", () => {
    const db = { products: [{ ...product, descriptionBlocks: [] }], auditLogs: [], importJobLogs: [] };
    const report = createProductWebEnrichmentDryRun(db, {
      productIds: [product.id],
      sourceDocuments: [
        {
          productId: product.id,
          url: "https://www.linsoul.com/products/7hz-x-crinacle-zero-2",
          title: "7HZ x Crinacle Zero: 2",
          html: safeHtml,
          sourceType: "authorized_retailer",
        },
      ],
      recordJob: false,
    });
    const before = {
      price: db.products[0].price,
      stock: db.products[0].stock,
      category: db.products[0].category,
      image: db.products[0].image,
      gallery: db.products[0].gallery,
    };

    const result = applyProductWebEnrichment(db, { plan: report, mode: "apply_safe_only" }, { actorUserId: "admin_1" });

    expect(result.applied_products).toBe(1);
    expect(db.products[0]).toMatchObject(before);
    expect(db.products[0].descriptionBlocks.length).toBeGreaterThan(0);
    expect(db.products[0].descriptionBlocks.some((block) => block.section === "box_contents")).toBe(true);
    expect(db.auditLogs.some((entry) => entry.action === "enrichment_applied")).toBe(true);
  });
});
