const REQUIRED_PLATFORM_ARRAYS = [
  "productVariants",
  "variantPrices",
  "inventoryLevels",
  "productChannelListings",
  "productMedia",
  "searchIndexDocuments",
  "outboxEvents",
  "auditLogs",
];

const STOREFRONT_HIDDEN_STATUSES = new Set(["draft", "needs_review", "hidden", "archived"]);
const STOREFRONT_HIDDEN_LIFECYCLES = new Set(["draft", "review", "scheduled", "archived"]);

export function isStorefrontVisibleProduct(product) {
  if (!product) return false;
  const status = String(product.status || "").toLowerCase();
  const lifecycle = String(product.lifecycleStatus || status || "").toLowerCase();
  const availability = String(product.availabilityStatus || "").toLowerCase();
  if (product.needsReview || product.categoryAssignment?.needsReview) return false;
  if (STOREFRONT_HIDDEN_STATUSES.has(status)) return false;
  if (STOREFRONT_HIDDEN_LIFECYCLES.has(lifecycle)) return false;
  if (availability === "hidden") return false;
  return true;
}

export function buildProductionReadinessReport(db, options = {}) {
  const now = options.now || new Date().toISOString();
  const products = safeArray(db.products);
  const variants = safeArray(db.productVariants);
  const prices = safeArray(db.variantPrices);
  const inventoryLevels = safeArray(db.inventoryLevels);
  const listings = safeArray(db.productChannelListings);
  const media = safeArray(db.productMedia);
  const searchDocs = safeArray(db.searchIndexDocuments);
  const auditLogs = safeArray(db.auditLogs);
  const outboxEvents = safeArray(db.outboxEvents);
  const importJobs = safeArray(db.importJobs).concat(safeArray(db.importJobLogs));
  const reviewTasks = safeArray(db.reviewTasks).concat(safeArray(db.approvalRequests));

  const variantsByProduct = groupBy(variants, "productId");
  const mediaByProduct = groupBy(media, "productId");
  const searchByProduct = new Map(searchDocs.map((doc) => [doc.productId, doc]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const variantIds = new Set(variants.map((variant) => variant.id));
  const pricedVariantIds = new Set(prices.map((price) => price.variantId));
  const inventoriedVariantIds = new Set(inventoryLevels.map((level) => level.variantId));
  const indexedVisibleProductIds = new Set(
    searchDocs
      .filter((doc) => doc.lifecycleStatus === "published")
      .map((doc) => doc.productId)
      .filter(Boolean),
  );
  const visibleProducts = products.filter(isStorefrontVisibleProduct);
  const hiddenProducts = products.filter((product) => !isStorefrontVisibleProduct(product));

  const productsWithoutBaseVariant = products.filter((product) => !(variantsByProduct.get(product.id) || []).some((variant) => variant.isBase));
  const variantsWithoutPrice = variants.filter((variant) => !pricedVariantIds.has(variant.id));
  const variantsWithoutInventory = variants.filter((variant) => !inventoriedVariantIds.has(variant.id));
  const visibleWithoutSearchDoc = visibleProducts.filter((product) => !indexedVisibleProductIds.has(product.id));
  const indexedHiddenProducts = searchDocs.filter((doc) => {
    const product = productById.get(doc.productId);
    return product && !isStorefrontVisibleProduct(product) && doc.lifecycleStatus === "published";
  });
  const visibleWithoutHeroImage = visibleProducts.filter((product) => !hasUsableHeroImage(product, mediaByProduct.get(product.id)));
  const lowQualityProducts = products.filter((product) => qualityScore(product) < 0.7 || product.needsReview);
  const inventoryDrift = products.filter((product) => {
    const productVariants = variantsByProduct.get(product.id) || [];
    const ids = new Set(productVariants.map((variant) => variant.id));
    if (!ids.size) return false;
    const platformAvailable = inventoryLevels
      .filter((level) => ids.has(level.variantId))
      .reduce((sum, level) => sum + quantity(level.available), 0);
    return quantity(product.stock) !== platformAvailable;
  });
  const listingDrift = products.filter((product) => {
    const listing = listings.find((item) => item.productId === product.id && item.channel === "storefront");
    if (!listing) return true;
    return Boolean(listing.visible) !== isStorefrontVisibleProduct(product);
  });
  const pendingOutbox = outboxEvents.filter((event) => !event.processedAt && event.status !== "processed");
  const failedImports = importJobs.filter((job) => String(job.status || "").includes("fail") || job.error);

  const checks = {
    schemaArraysPresent: REQUIRED_PLATFORM_ARRAYS.every((key) => Array.isArray(db[key])),
    allProductsHaveBaseVariant: productsWithoutBaseVariant.length === 0,
    allVariantsHavePrice: variantsWithoutPrice.length === 0,
    allVariantsHaveInventory: variantsWithoutInventory.length === 0,
    visibleProductsIndexed: visibleWithoutSearchDoc.length === 0,
    hiddenProductsNotPublishedInIndex: indexedHiddenProducts.length === 0,
    visibleProductsHaveHeroImage: visibleWithoutHeroImage.length === 0,
    listingVisibilityMatchesLifecycle: listingDrift.length === 0,
    inventoryMatchesLegacyStock: inventoryDrift.length === 0,
    auditLogsExist: auditLogs.length > 0,
    outboxBacklogUnder50: pendingOutbox.length < 50,
  };

  const failedCheckCount = Object.values(checks).filter((ok) => !ok).length;
  const score = Math.max(0, Math.round(((Object.keys(checks).length - failedCheckCount) / Object.keys(checks).length) * 100));

  return {
    generatedAt: now,
    score,
    status: score >= 95 ? "ready" : score >= 80 ? "watch" : "needs_attention",
    summary: {
      products: products.length,
      visibleProducts: visibleProducts.length,
      hiddenProducts: hiddenProducts.length,
      variants: variants.length,
      prices: prices.length,
      inventoryLevels: inventoryLevels.length,
      mediaRows: media.length,
      searchDocuments: searchDocs.length,
      auditLogs: auditLogs.length,
      pendingOutbox: pendingOutbox.length,
      reviewTasks: reviewTasks.filter((task) => !["completed", "approved", "rejected", "cancelled"].includes(String(task.status || ""))).length,
      failedImports: failedImports.length,
    },
    checks,
    risks: {
      productsWithoutBaseVariant: compactProducts(productsWithoutBaseVariant),
      variantsWithoutPrice: compactVariants(variantsWithoutPrice),
      variantsWithoutInventory: compactVariants(variantsWithoutInventory),
      visibleWithoutSearchDoc: compactProducts(visibleWithoutSearchDoc),
      indexedHiddenProducts: indexedHiddenProducts.map((doc) => ({ productId: doc.productId, documentId: doc.id })),
      visibleWithoutHeroImage: compactProducts(visibleWithoutHeroImage),
      inventoryDrift: compactProducts(inventoryDrift),
      listingDrift: compactProducts(listingDrift),
      pendingOutbox: pendingOutbox.slice(0, 20).map((event) => ({
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        createdAt: event.createdAt,
        attempts: event.attempts || 0,
      })),
      failedImports: failedImports.slice(0, 20).map((job) => ({
        id: job.id,
        status: job.status,
        input: job.input || job.sourceUrl || job.sourceType || null,
        error: job.error || null,
      })),
    },
    recommendations: buildRecommendations({
      productsWithoutBaseVariant,
      variantsWithoutPrice,
      variantsWithoutInventory,
      visibleWithoutSearchDoc,
      indexedHiddenProducts,
      visibleWithoutHeroImage,
      inventoryDrift,
      listingDrift,
      pendingOutbox,
      failedImports,
      auditLogs,
    }),
  };
}

function buildRecommendations(context) {
  const recommendations = [];
  if (context.productsWithoutBaseVariant.length) recommendations.push("Run product platform backfill before publishing more products.");
  if (context.variantsWithoutPrice.length) recommendations.push("Backfill variant prices; storefront pricing must not depend only on legacy product.price.");
  if (context.variantsWithoutInventory.length) recommendations.push("Backfill inventory levels for every sellable variant and location.");
  if (context.visibleWithoutSearchDoc.length || context.indexedHiddenProducts.length) recommendations.push("Rebuild search read model from outbox before enabling external search.");
  if (context.visibleWithoutHeroImage.length) recommendations.push("Fix missing hero images before featuring affected products.");
  if (context.inventoryDrift.length) recommendations.push("Reconcile legacy stock with inventory_levels before checkout inventory reservations.");
  if (context.listingDrift.length) recommendations.push("Regenerate product_channel_listings to match lifecycle visibility.");
  if (context.pendingOutbox.length >= 50) recommendations.push("Drain outbox backlog before relying on async indexing or publishing.");
  if (context.failedImports.length) recommendations.push("Review failed imports and preserve source evidence for retry.");
  if (!context.auditLogs.length) recommendations.push("Exercise admin write paths in staging and confirm audit coverage before launch.");
  return recommendations;
}

function hasUsableHeroImage(product, mediaRows = []) {
  if (product.normalizedImageUrl || product.image) return true;
  return safeArray(mediaRows).some((row) => ["main", "hero", "cover"].includes(String(row.role || "").toLowerCase()) && (row.cdnUrl || row.url));
}

function compactProducts(products) {
  return products.slice(0, 30).map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name?.en || product.nameEn || product.title || product.slug || product.id,
    status: product.status || null,
    lifecycleStatus: product.lifecycleStatus || null,
    qualityScore: qualityScore(product),
    needsReview: Boolean(product.needsReview),
  }));
}

function compactVariants(variants) {
  return variants.slice(0, 30).map((variant) => ({
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku || null,
    isBase: Boolean(variant.isBase),
  }));
}

function qualityScore(product) {
  const raw = Number(product.qualityScore ?? product.quality_score ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return raw > 1 ? Math.max(0, Math.min(1, raw / 100)) : Math.max(0, Math.min(1, raw));
}

function quantity(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupBy(items, field) {
  return items.reduce((groups, item) => {
    const key = item?.[field];
    if (!key) return groups;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}
