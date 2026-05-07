import { describe, expect, it } from "vitest";
import {
  applyInventoryWebhookUpdate,
  applyProductLifecycle,
  backfillProductPlatform,
  createImportProductJob,
  serializeProductPlatformProduct,
  verifyInventoryWebhookSignature,
} from "./productManagementPlatform.js";
import crypto from "node:crypto";

function createDb() {
  return {
    meta: {},
    products: [
      {
        id: "prd_1",
        slug: "hifiman-ananda",
        name: { en: "HiFiMAN Ananda" },
        brand: "HiFiMAN",
        category: "headphones",
        subCategories: ["open-back"],
        price: 499000,
        compareAt: 600000,
        currency: "IQD",
        image: "/src/assets/products/hifiman-ananda.webp",
        gallery: ["/src/assets/products/hifiman-ananda.webp"],
        stock: 4,
        inStock: true,
        status: "draft",
        specs: [{ name: "Driver", value: "Planar" }],
        seo: { metaTitle: "HiFiMAN Ananda" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    productVariants: [],
    variantPrices: [],
    inventoryLocations: [],
    inventoryLevels: [],
    productChannelListings: [],
    productRevisions: [],
    approvalRequests: [],
    importJobs: [],
    importJobItems: [],
    outboxEvents: [],
    productMedia: [],
    searchIndexDocuments: [],
    inventoryMovements: [],
  };
}

describe("product management platform compatibility layer", () => {
  it("backfills every legacy product into a base variant, price, inventory and listing", () => {
    const db = createDb();
    backfillProductPlatform(db, { now: "2026-02-01T00:00:00.000Z" });

    expect(db.productVariants).toHaveLength(1);
    expect(db.productVariants[0]).toMatchObject({
      productId: "prd_1",
      isBase: true,
      immutableSku: true,
    });
    expect(db.variantPrices[0]).toMatchObject({ variantId: db.productVariants[0].id, amount: 499000 });
    expect(db.inventoryLevels[0]).toMatchObject({ variantId: db.productVariants[0].id, available: 4 });
    expect(db.productChannelListings[0]).toMatchObject({ productId: "prd_1", lifecycleStatus: "draft" });
    expect(db.searchIndexDocuments[0]).toMatchObject({ productId: "prd_1", category: "headphones" });
  });

  it("publishes through lifecycle state without replacing the old product record", () => {
    const db = createDb();
    const result = applyProductLifecycle(db, "prd_1", "publish", {
      actorUserId: "usr_admin",
      requestId: "req_1",
      now: "2026-02-01T00:00:00.000Z",
    });

    expect(result.product.status).toBe("published");
    expect(result.product.lifecycleStatus).toBe("published");
    expect(result.revision.action).toBe("product.lifecycle.publish");
    expect(result.outboxEvent).toMatchObject({
      type: "product.publish",
      aggregateType: "product",
      aggregateId: "prd_1",
      correlationId: "req_1",
    });
    expect(serializeProductPlatformProduct(db, "prd_1").platform.lifecycle).toBe("published");
  });

  it("updates inventory from a webhook and mirrors stock to the legacy product", () => {
    const db = createDb();
    backfillProductPlatform(db);
    const variantId = db.productVariants[0].id;

    const result = applyInventoryWebhookUpdate(
      db,
      { variantId, available: 0, reserved: 1, incoming: 3, committed: 0 },
      { signatureVerified: true, requestId: "req_inventory" },
    );

    expect(result.level).toMatchObject({ available: 0, reserved: 1, incoming: 3 });
    expect(db.products[0]).toMatchObject({ stock: 0, inStock: false, availabilityStatus: "out_of_stock" });
    expect(db.inventoryMovements[0]).toMatchObject({ variantId, type: "webhook_adjustment" });
    expect(db.outboxEvents[0]).toMatchObject({ type: "inventory.updated" });
  });

  it("creates import previews and approval requests without mutating products", () => {
    const db = createDb();
    const beforeCount = db.products.length;
    const result = createImportProductJob(db, {
      dryRun: true,
      products: [{ name: "Focusrite Scarlett Solo", brand: "Focusrite", category: "audio-interface", price: 149000 }],
    }, { actorUserId: "usr_admin", requestId: "req_import" });

    expect(db.products).toHaveLength(beforeCount);
    expect(result.job.status).toBe("preview_ready");
    expect(result.items).toHaveLength(1);
    expect(db.approvalRequests).toHaveLength(1);
    expect(db.outboxEvents[0]).toMatchObject({ type: "import.products.previewed" });
  });

  it("verifies inventory webhook HMAC signatures", () => {
    const rawBody = JSON.stringify({ sku: "ABC", available: 2 });
    const secret = "test-secret";
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    expect(verifyInventoryWebhookSignature({ rawBody, secret, signature })).toMatchObject({ ok: true });
    expect(verifyInventoryWebhookSignature({ rawBody, secret, signature: "sha256=bad" })).toMatchObject({ ok: false });
  });
});
