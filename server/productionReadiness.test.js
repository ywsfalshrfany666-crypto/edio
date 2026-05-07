import { describe, expect, it } from "vitest";
import {
  buildProductionReadinessReport,
  isStorefrontVisibleProduct,
} from "./productionReadiness.js";

function createDb() {
  return {
    products: [
      {
        id: "prd_visible",
        slug: "visible-product",
        name: { en: "Visible Product" },
        brand: "Edio",
        status: "published",
        lifecycleStatus: "published",
        availabilityStatus: "in_stock",
        image: "/src/assets/products/visible.webp",
        stock: 3,
        qualityScore: 0.95,
      },
      {
        id: "prd_hidden",
        slug: "hidden-product",
        name: { en: "Hidden Product" },
        brand: "Edio",
        status: "hidden",
        lifecycleStatus: "archived",
        availabilityStatus: "hidden",
        image: "/src/assets/products/hidden.webp",
        stock: 1,
        qualityScore: 0.9,
      },
      {
        id: "prd_draft",
        slug: "draft-product",
        name: { en: "Draft Product" },
        brand: "Edio",
        status: "draft",
        lifecycleStatus: "draft",
        availabilityStatus: "in_stock",
        stock: 0,
        needsReview: true,
        qualityScore: 0.4,
      },
    ],
    productVariants: [
      { id: "var_visible", productId: "prd_visible", sku: "VISIBLE", isBase: true },
      { id: "var_hidden", productId: "prd_hidden", sku: "HIDDEN", isBase: true },
    ],
    variantPrices: [{ id: "price_visible", variantId: "var_visible", amount: 99000, currency: "IQD" }],
    inventoryLevels: [
      { id: "inv_visible", variantId: "var_visible", available: 3 },
      { id: "inv_hidden", variantId: "var_hidden", available: 1 },
    ],
    productChannelListings: [
      { id: "listing_visible", productId: "prd_visible", channel: "storefront", visible: true },
      { id: "listing_hidden", productId: "prd_hidden", channel: "storefront", visible: false },
    ],
    productMedia: [{ id: "media_visible", productId: "prd_visible", role: "main", url: "/src/assets/products/visible.webp" }],
    searchIndexDocuments: [
      { id: "search_visible", productId: "prd_visible", lifecycleStatus: "published" },
      { id: "search_hidden", productId: "prd_hidden", lifecycleStatus: "published" },
    ],
    outboxEvents: [{ id: "outbox_1", type: "product.publish", aggregateId: "prd_visible", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }],
    auditLogs: [{ id: "aud_1", action: "product.lifecycle.publish", createdAt: "2026-01-01T00:00:00.000Z" }],
    importJobs: [{ id: "imp_1", status: "failed", error: "Network timeout" }],
    importJobLogs: [],
    reviewTasks: [{ id: "review_1", productId: "prd_draft", status: "open" }],
    approvalRequests: [],
  };
}

describe("production readiness report", () => {
  it("treats only published storefront products as visible", () => {
    expect(isStorefrontVisibleProduct({ status: "published", lifecycleStatus: "published", availabilityStatus: "in_stock" })).toBe(true);
    expect(isStorefrontVisibleProduct({ status: "hidden", lifecycleStatus: "published", availabilityStatus: "in_stock" })).toBe(false);
    expect(isStorefrontVisibleProduct({ status: "published", lifecycleStatus: "draft", availabilityStatus: "in_stock" })).toBe(false);
    expect(isStorefrontVisibleProduct({ status: "published", lifecycleStatus: "published", availabilityStatus: "hidden" })).toBe(false);
  });

  it("surfaces launch blockers without mutating data", () => {
    const db = createDb();
    const before = JSON.stringify(db);
    const report = buildProductionReadinessReport(db, { now: "2026-05-03T00:00:00.000Z" });

    expect(JSON.stringify(db)).toBe(before);
    expect(report.status).toBe("needs_attention");
    expect(report.summary.products).toBe(3);
    expect(report.summary.visibleProducts).toBe(1);
    expect(report.summary.hiddenProducts).toBe(2);
    expect(report.checks.allProductsHaveBaseVariant).toBe(false);
    expect(report.checks.allVariantsHavePrice).toBe(false);
    expect(report.checks.hiddenProductsNotPublishedInIndex).toBe(false);
    expect(report.risks.productsWithoutBaseVariant).toHaveLength(1);
    expect(report.risks.variantsWithoutPrice).toEqual([
      { id: "var_hidden", productId: "prd_hidden", sku: "HIDDEN", isBase: true },
    ]);
    expect(report.risks.indexedHiddenProducts).toEqual([{ productId: "prd_hidden", documentId: "search_hidden" }]);
    expect(report.recommendations).toContain("Backfill variant prices; storefront pricing must not depend only on legacy product.price.");
  });
});
