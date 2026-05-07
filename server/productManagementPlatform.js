import crypto from "node:crypto";

export const PRODUCT_PLATFORM_SCHEMA_VERSION = 2;

export const PRODUCT_PLATFORM_FEATURE_FLAGS = Object.freeze({
  modularProductPlatform: true,
  variantFirstCatalog: true,
  lifecyclePublishing: true,
  inventoryWebhookCompatibility: true,
  outboxIndexing: true,
  approvalWorkflow: true,
});

export const PRODUCT_LIFECYCLES = Object.freeze(["draft", "review", "scheduled", "published", "archived"]);

const DEFAULT_LOCATION_ID = "loc_edio_mosul";
const DEFAULT_CHANNEL = "storefront";
const DEFAULT_CURRENCY = "IQD";

const PLATFORM_ARRAYS = [
  "productVariants",
  "variantPrices",
  "inventoryLocations",
  "inventoryLevels",
  "productChannelListings",
  "productRevisions",
  "approvalRequests",
  "outboxEvents",
  "searchIndexDocuments",
  "inventoryMovements",
];

export function ensureProductPlatformCollections(db, options = {}) {
  const now = options.now || new Date().toISOString();
  db.meta = db.meta && typeof db.meta === "object" ? db.meta : {};
  db.meta.productPlatformSchemaVersion = PRODUCT_PLATFORM_SCHEMA_VERSION;
  db.meta.productPlatformUpdatedAt = now;

  for (const key of PLATFORM_ARRAYS) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }

  if (!db.inventoryLocations.some((location) => location.id === DEFAULT_LOCATION_ID)) {
    db.inventoryLocations.push({
      id: DEFAULT_LOCATION_ID,
      code: "MOSUL",
      name: "Edio Mosul",
      type: "store",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return db;
}

export function backfillProductPlatform(db, options = {}) {
  const now = options.now || new Date().toISOString();
  ensureProductPlatformCollections(db, { now });
  const productIds = Array.isArray(options.productIds) && options.productIds.length
    ? new Set(options.productIds)
    : null;
  const products = Array.isArray(db.products) ? db.products : [];

  for (const product of products) {
    if (!product?.id || (productIds && !productIds.has(product.id))) continue;
    product.legacyId = product.legacyId || product.id;
    product.externalReference = product.externalReference || product.sourceUrl || null;
    product.sourcePayload = product.sourcePayload || null;
    product.version = Number.isFinite(Number(product.version)) ? Number(product.version) : 1;
    product.lifecycleStatus = normalizeLifecycle(product.lifecycleStatus || product.status);
    product.qualityScore = computeProductQualityScore(product, {
      media: getProductMediaRows(db, product.id),
      variants: getProductVariants(db, product.id),
    });
    if (product.lifecycleStatus === "published" && !product.publishedAt) {
      product.publishedAt = product.createdAt || now;
    }
    if (product.lifecycleStatus !== "archived") {
      product.archivedAt = product.archivedAt || null;
    }

    const variant = upsertBaseVariant(db, product, now);
    upsertVariantPrice(db, product, variant, now);
    upsertInventoryLevel(db, product, variant, now);
    upsertChannelListing(db, product, now);
    upsertProductMediaRows(db, product, variant, now);
    upsertSearchDocument(db, product, now);
    product.qualityScore = computeProductQualityScore(product, {
      media: getProductMediaRows(db, product.id),
      variants: getProductVariants(db, product.id),
    });
  }

  return db;
}

export function serializeProductPlatformProduct(db, productOrId) {
  const product = typeof productOrId === "string"
    ? (db.products || []).find((item) => item.id === productOrId || item.slug === productOrId)
    : productOrId;
  if (!product) return null;
  backfillProductPlatform(db, { productIds: [product.id], now: product.updatedAt || new Date().toISOString() });
  const variants = getProductVariants(db, product.id);
  const variantIds = new Set(variants.map((variant) => variant.id));
  const prices = (db.variantPrices || []).filter((price) => variantIds.has(price.variantId));
  const inventory = (db.inventoryLevels || []).filter((level) => variantIds.has(level.variantId));
  const media = getProductMediaRows(db, product.id);
  const listings = (db.productChannelListings || []).filter((listing) => listing.productId === product.id);
  const revisions = (db.productRevisions || []).filter((revision) => revision.productId === product.id);
  const approvalRequests = (db.approvalRequests || []).filter((request) => request.productId === product.id);
  const searchDocument = (db.searchIndexDocuments || []).find((document) => document.productId === product.id) || null;

  return {
    product,
    platform: {
      schemaVersion: PRODUCT_PLATFORM_SCHEMA_VERSION,
      featureFlags: PRODUCT_PLATFORM_FEATURE_FLAGS,
      lifecycle: product.lifecycleStatus || normalizeLifecycle(product.status),
      qualityScore: computeProductQualityScore(product, { media, variants }),
    },
    variants,
    prices,
    inventory,
    media,
    listings,
    revisions,
    approvalRequests,
    searchDocument,
  };
}

export function applyProductLifecycle(db, productIdOrSlug, action, options = {}) {
  const now = options.now || new Date().toISOString();
  ensureProductPlatformCollections(db, { now });
  const product = (db.products || []).find((item) => item.id === productIdOrSlug || item.slug === productIdOrSlug);
  if (!product) {
    const error = new Error("Product not found");
    error.status = 404;
    error.code = "not_found";
    throw error;
  }

  backfillProductPlatform(db, { productIds: [product.id], now });
  const before = cloneForAudit(product);
  const previousLifecycle = product.lifecycleStatus || normalizeLifecycle(product.status);
  const nextLifecycle = lifecycleForAction(action, options);
  product.lifecycleStatus = nextLifecycle;
  product.version = Number(product.version || 1) + 1;
  product.updatedAt = now;

  if (action === "publish") {
    product.status = "published";
    product.publishedAt = now;
    product.archivedAt = null;
    product.scheduledAt = null;
  } else if (action === "unpublish") {
    product.status = "draft";
    product.unpublishedAt = now;
    product.scheduledAt = null;
  } else if (action === "schedule") {
    product.status = product.status === "published" ? "published" : "draft";
    product.scheduledAt = options.scheduledAt || options.scheduleAt;
  }

  upsertChannelListing(db, product, now);
  upsertSearchDocument(db, product, now);
  const revision = recordProductRevision(db, product, {
    actorUserId: options.actorUserId || null,
    action: `product.lifecycle.${action}`,
    beforeState: before,
    afterState: cloneForAudit(product),
    requestId: options.requestId || null,
    now,
  });
  const event = enqueueOutboxEvent(db, {
    type: `product.${action}`,
    aggregateType: "product",
    aggregateId: product.id,
    payload: {
      productId: product.id,
      previousLifecycle,
      lifecycle: nextLifecycle,
      scheduledAt: product.scheduledAt || null,
      qualityScore: product.qualityScore,
    },
    correlationId: options.requestId || null,
    now,
  });

  return {
    product,
    lifecycle: nextLifecycle,
    revision,
    outboxEvent: event,
    platform: serializeProductPlatformProduct(db, product),
  };
}

export function createImportProductJob(db, body = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  ensureProductPlatformCollections(db, { now });
  const inputItems = normalizeImportItems(body);
  const dryRun = body.dryRun !== false && body.dry_run !== false && body.commit !== true;
  const job = {
    id: `imp_${crypto.randomUUID()}`,
    type: "product_import",
    status: dryRun ? "preview_ready" : "waiting_approval",
    dryRun,
    sourceType: String(body.sourceType || body.source_type || "manual"),
    sourceUrl: body.sourceUrl || body.source_url || null,
    itemCount: inputItems.length,
    actorUserId: options.actorUserId || null,
    requestId: options.requestId || null,
    createdAt: now,
    updatedAt: now,
    sourcePayload: sanitizePayloadForStorage(body),
  };
  db.importJobs.unshift(job);

  const items = inputItems.map((item, index) => {
    const current = findExistingImportTarget(db, item);
    const proposed = normalizeImportProposal(item);
    const diff = buildDiffPreview(current, proposed);
    const jobItem = {
      id: `imp_item_${crypto.randomUUID()}`,
      jobId: job.id,
      productId: current?.id || null,
      status: current ? "matched_existing" : "new_candidate",
      index,
      confidenceScore: proposed.confidenceScore,
      needsReview: proposed.confidenceScore < 0.85 || !proposed.category,
      proposed,
      current: current ? compactProductForDiff(current) : null,
      diff,
      createdAt: now,
      updatedAt: now,
    };
    db.importJobItems.push(jobItem);

    const approval = {
      id: `approval_${crypto.randomUUID()}`,
      productId: current?.id || null,
      importJobId: job.id,
      importJobItemId: jobItem.id,
      requestedAction: current ? "update_product_from_import" : "create_product_from_import",
      status: "pending",
      confidenceScore: proposed.confidenceScore,
      diffPreview: diff,
      requestedByUserId: options.actorUserId || null,
      createdAt: now,
      updatedAt: now,
    };
    db.approvalRequests.unshift(approval);
    jobItem.approvalRequestId = approval.id;
    return jobItem;
  });

  const event = enqueueOutboxEvent(db, {
    type: "import.products.previewed",
    aggregateType: "import_job",
    aggregateId: job.id,
    payload: { jobId: job.id, itemCount: items.length, dryRun },
    correlationId: options.requestId || null,
    now,
  });

  return { job, items, approvalRequests: items.map((item) => item.approvalRequestId), outboxEvent: event };
}

export function verifyInventoryWebhookSignature({ rawBody = "", signature = "", secret = "" }) {
  if (!secret) return { ok: false, reason: "secret_not_configured" };
  if (!signature) return { ok: false, reason: "missing_signature" };
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = String(signature).replace(/^sha256=/i, "").trim();
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  if (expectedBuffer.length !== suppliedBuffer.length) return { ok: false, reason: "signature_length_mismatch" };
  return {
    ok: crypto.timingSafeEqual(expectedBuffer, suppliedBuffer),
    reason: crypto.timingSafeEqual(expectedBuffer, suppliedBuffer) ? "verified" : "signature_mismatch",
  };
}

export function applyInventoryWebhookUpdate(db, body = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  ensureProductPlatformCollections(db, { now });
  const variant = findVariantForInventoryUpdate(db, body);
  if (!variant) {
    const error = new Error("Variant not found");
    error.status = 404;
    error.code = "variant_not_found";
    throw error;
  }

  const locationId = String(body.locationId || body.location_id || DEFAULT_LOCATION_ID);
  let level = (db.inventoryLevels || []).find((item) => item.variantId === variant.id && item.locationId === locationId);
  if (!level) {
    level = {
      id: inventoryLevelId(variant.id, locationId),
      variantId: variant.id,
      locationId,
      available: 0,
      reserved: 0,
      incoming: 0,
      committed: 0,
      safetyStock: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.inventoryLevels.push(level);
  }

  const before = cloneForAudit(level);
  for (const key of ["available", "reserved", "incoming", "committed"]) {
    if (body[key] !== undefined || body[`${key}_quantity`] !== undefined) {
      level[key] = safeQuantity(body[key] ?? body[`${key}_quantity`]);
    }
  }
  level.updatedAt = now;
  level.externalReference = body.externalReference || body.external_reference || level.externalReference || null;

  const product = (db.products || []).find((item) => item.id === variant.productId);
  if (product) {
    const productBefore = cloneForAudit(product);
    product.stock = level.available;
    product.inStock = level.available > 0;
    if (!["hidden", "discontinued"].includes(product.availabilityStatus)) {
      product.availabilityStatus = level.available > 0 ? "in_stock" : "out_of_stock";
    }
    product.updatedAt = now;
    backfillProductPlatform(db, { productIds: [product.id], now });
    db.inventoryMovements.unshift({
      id: `inv_move_${crypto.randomUUID()}`,
      variantId: variant.id,
      productId: product.id,
      locationId,
      type: "webhook_adjustment",
      beforeState: before,
      afterState: cloneForAudit(level),
      productBeforeState: productBefore,
      productAfterState: cloneForAudit(product),
      signatureVerified: Boolean(options.signatureVerified),
      requestId: options.requestId || null,
      createdAt: now,
    });
  }

  const event = enqueueOutboxEvent(db, {
    type: "inventory.updated",
    aggregateType: "inventory_level",
    aggregateId: level.id,
    payload: { variantId: variant.id, productId: variant.productId, locationId, level },
    correlationId: options.requestId || null,
    now,
  });

  return { variant, level, product: product || null, outboxEvent: event };
}

export function buildInternalRevalidationResponse(db, body = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  ensureProductPlatformCollections(db, { now });
  const paths = Array.isArray(body.paths) && body.paths.length ? body.paths : ["/", "/shop"];
  const event = enqueueOutboxEvent(db, {
    type: "internal.revalidate.requested",
    aggregateType: "site",
    aggregateId: "storefront",
    payload: { paths, reason: body.reason || "manual" },
    correlationId: options.requestId || null,
    now,
  });
  return {
    status: "queued",
    paths,
    outboxEvent: event,
    note: "Static hosting cannot revalidate server-rendered pages; this records a cache/build refresh request.",
  };
}

function upsertBaseVariant(db, product, now) {
  const existing = (db.productVariants || []).find((variant) => variant.productId === product.id && variant.isBase);
  const variant = existing || {
    id: baseVariantId(product.id),
    productId: product.id,
    isBase: true,
    sku: product.sku || product.skuLocal || createStableSku(product),
    createdAt: now,
  };
  variant.title = product.name?.en || product.nameEn || product.slug || product.id;
  variant.status = product.status || "draft";
  variant.optionValues = variant.optionValues || {};
  variant.legacyId = variant.legacyId || product.legacyId || product.id;
  variant.externalReference = variant.externalReference || product.externalReference || product.sourceUrl || null;
  variant.sourcePayload = variant.sourcePayload || null;
  variant.version = Number.isFinite(Number(variant.version)) ? Number(variant.version) : 1;
  variant.immutableSku = true;
  variant.updatedAt = now;
  if (!existing) db.productVariants.push(variant);
  return variant;
}

function upsertVariantPrice(db, product, variant, now) {
  const id = variantPriceId(variant.id, product.currency || DEFAULT_CURRENCY);
  const existing = (db.variantPrices || []).find((price) => price.id === id);
  const price = existing || {
    id,
    variantId: variant.id,
    currency: product.currency || DEFAULT_CURRENCY,
    channel: DEFAULT_CHANNEL,
    createdAt: now,
  };
  price.amount = safeMoney(product.price);
  price.compareAtAmount = safeMoney(product.compareAt ?? product.officialPrice);
  price.saleStart = product.saleStart || null;
  price.saleEnd = product.saleEnd || null;
  price.source = "legacy_product_compat";
  price.version = Number.isFinite(Number(price.version)) ? Number(price.version) : 1;
  price.updatedAt = now;
  if (!existing) db.variantPrices.push(price);
  return price;
}

function upsertInventoryLevel(db, product, variant, now) {
  const id = inventoryLevelId(variant.id, DEFAULT_LOCATION_ID);
  const existing = (db.inventoryLevels || []).find((level) => level.id === id);
  const level = existing || {
    id,
    variantId: variant.id,
    locationId: DEFAULT_LOCATION_ID,
    reserved: 0,
    incoming: 0,
    committed: 0,
    safetyStock: 0,
    createdAt: now,
  };
  level.available = safeQuantity(product.stock ?? (product.inStock ? 1 : 0));
  level.updatedAt = now;
  if (!existing) db.inventoryLevels.push(level);
  return level;
}

function upsertChannelListing(db, product, now) {
  const id = `listing_${product.id}_${DEFAULT_CHANNEL}`;
  const existing = (db.productChannelListings || []).find((listing) => listing.id === id);
  const lifecycle = product.lifecycleStatus || normalizeLifecycle(product.status);
  const listing = existing || {
    id,
    productId: product.id,
    channel: DEFAULT_CHANNEL,
    createdAt: now,
  };
  listing.lifecycleStatus = lifecycle;
  listing.visible = lifecycle === "published" && product.status !== "hidden";
  listing.publishedAt = product.publishedAt || (listing.visible ? now : null);
  listing.scheduledAt = product.scheduledAt || null;
  listing.archivedAt = product.archivedAt || null;
  listing.updatedAt = now;
  if (!existing) db.productChannelListings.push(listing);
  return listing;
}

function upsertProductMediaRows(db, product, variant, now) {
  const urls = [
    product.normalizedImageUrl || product.image || null,
    ...(Array.isArray(product.gallery) ? product.gallery : []),
  ].filter(Boolean);
  const seen = new Set();
  urls.forEach((url, index) => {
    if (seen.has(url)) return;
    seen.add(url);
    const existing = (db.productMedia || []).find((media) => media.productId === product.id && media.url === url);
    if (existing) {
      existing.sortOrder = Number.isFinite(Number(existing.sortOrder)) ? Number(existing.sortOrder) : index;
      existing.updatedAt = now;
      return;
    }
    db.productMedia.push({
      id: `pm_${stableHash(`${product.id}:${url}`).slice(0, 20)}`,
      productId: product.id,
      mediaAssetId: null,
      variantIds: variant?.id ? [variant.id] : [],
      url,
      cdnUrl: url,
      role: index === 0 ? "main" : "gallery",
      altText: buildAltText(product, index === 0 ? "main image" : "gallery image"),
      title: product.name?.en || product.slug || product.id,
      sortOrder: index,
      source: "legacy_product_compat",
      createdAt: now,
      updatedAt: now,
    });
  });
}

function upsertSearchDocument(db, product, now) {
  const id = `search_${product.id}_${DEFAULT_CHANNEL}`;
  const existing = (db.searchIndexDocuments || []).find((document) => document.id === id);
  const variants = getProductVariants(db, product.id);
  const variantIds = new Set(variants.map((variant) => variant.id));
  const prices = (db.variantPrices || []).filter((price) => variantIds.has(price.variantId));
  const inventory = (db.inventoryLevels || []).filter((level) => variantIds.has(level.variantId));
  const document = existing || { id, productId: product.id, channel: DEFAULT_CHANNEL, createdAt: now };
  document.title = product.name?.en || product.slug || product.id;
  document.brand = product.brand || "";
  document.category = product.category || "unknown";
  document.subCategories = Array.isArray(product.subCategories) ? product.subCategories : [];
  document.collections = deriveDynamicCollections(product);
  document.priceMin = prices.length ? Math.min(...prices.map((price) => safeMoney(price.amount))) : safeMoney(product.price);
  document.priceMax = prices.length ? Math.max(...prices.map((price) => safeMoney(price.amount))) : safeMoney(product.price);
  document.available = inventory.reduce((sum, level) => sum + safeQuantity(level.available), 0) > 0;
  document.lifecycleStatus = product.lifecycleStatus || normalizeLifecycle(product.status);
  document.needsReview = Boolean(product.needsReview);
  document.qualityScore = computeProductQualityScore(product, {
    media: getProductMediaRows(db, product.id),
    variants,
  });
  document.synonyms = buildSearchSynonyms(product);
  document.typoToleranceDisabledFor = variants.map((variant) => variant.sku).filter(Boolean);
  document.indexingMode = "outbox";
  document.updatedAt = now;
  if (!existing) db.searchIndexDocuments.push(document);
  return document;
}

function recordProductRevision(db, product, data) {
  const revision = {
    id: `rev_${crypto.randomUUID()}`,
    productId: product.id,
    version: product.version || 1,
    action: data.action,
    actorUserId: data.actorUserId || null,
    beforeState: data.beforeState || null,
    afterState: data.afterState || null,
    requestId: data.requestId || null,
    createdAt: data.now || new Date().toISOString(),
  };
  db.productRevisions.unshift(revision);
  return revision;
}

function enqueueOutboxEvent(db, data) {
  const event = {
    id: `outbox_${crypto.randomUUID()}`,
    type: data.type,
    aggregateType: data.aggregateType,
    aggregateId: data.aggregateId,
    status: "pending",
    attempts: 0,
    payload: data.payload || {},
    correlationId: data.correlationId || null,
    createdAt: data.now || new Date().toISOString(),
    nextAttemptAt: data.now || new Date().toISOString(),
    processedAt: null,
    error: null,
  };
  db.outboxEvents.unshift(event);
  return event;
}

function normalizeLifecycle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (PRODUCT_LIFECYCLES.includes(normalized)) return normalized;
  if (normalized === "published") return "published";
  if (normalized === "needs_review" || normalized === "review") return "review";
  if (normalized === "scheduled") return "scheduled";
  if (normalized === "archived" || normalized === "hidden" || normalized === "discontinued") return "archived";
  return "draft";
}

function lifecycleForAction(action, options = {}) {
  if (action === "publish") return "published";
  if (action === "unpublish") return "draft";
  if (action === "schedule") {
    if (!options.scheduledAt && !options.scheduleAt) {
      const error = new Error("scheduledAt is required");
      error.status = 400;
      error.code = "validation_error";
      throw error;
    }
    return "scheduled";
  }
  const error = new Error("Unsupported lifecycle action");
  error.status = 400;
  error.code = "validation_error";
  throw error;
}

function getProductVariants(db, productId) {
  return (db.productVariants || []).filter((variant) => variant.productId === productId);
}

function getProductMediaRows(db, productId) {
  return (db.productMedia || []).filter((media) => media.productId === productId);
}

function baseVariantId(productId) {
  return `variant_${productId}_base`;
}

function variantPriceId(variantId, currency) {
  return `price_${variantId}_${String(currency || DEFAULT_CURRENCY).toLowerCase()}`;
}

function inventoryLevelId(variantId, locationId) {
  return `inv_${variantId}_${locationId}`;
}

function safeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function createStableSku(product) {
  const slug = String(product.slug || product.name?.en || product.id || "product")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || product.id;
}

function stableHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex");
}

function cloneForAudit(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function computeProductQualityScore(product, context = {}) {
  const media = Array.isArray(context.media) ? context.media : [];
  const variants = Array.isArray(context.variants) ? context.variants : [];
  const specs = Array.isArray(product.specs) ? product.specs : [];
  const score =
    (product.name?.en || product.nameEn ? 0.16 : 0) +
    (product.brand ? 0.12 : 0) +
    (product.category && product.category !== "unknown" ? 0.12 : 0) +
    (media.length || product.image || product.normalizedImageUrl ? 0.16 : 0) +
    (safeMoney(product.price) > 0 ? 0.12 : 0) +
    (product.tagline?.en || product.seo?.metaDescription ? 0.1 : 0) +
    (specs.length >= 3 ? 0.1 : specs.length ? 0.05 : 0) +
    (variants.length ? 0.08 : 0) +
    (product.slug ? 0.07 : 0) +
    (product.seo && Object.keys(product.seo).length ? 0.07 : 0);
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function buildAltText(product, role) {
  const brand = product.brand ? `${product.brand} ` : "";
  const name = product.name?.en || product.nameEn || product.slug || "audio product";
  return `${brand}${name} ${role}`.replace(/\s+/g, " ").trim();
}

function deriveDynamicCollections(product) {
  const collections = new Set();
  if (product.badge === "new" || product.storedBadge === "new") collections.add("new");
  if (product.badge === "preowned" || product.storedBadge === "preowned") collections.add("preowned");
  if (product.compareAt && safeMoney(product.compareAt) > safeMoney(product.price)) collections.add("offers");
  if (product.inStock || product.availabilityStatus === "in_stock") collections.add("available-now");
  if (product.availabilityStatus === "out_of_stock") collections.add("out-of-stock");
  return [...collections];
}

function buildSearchSynonyms(product) {
  const values = new Set();
  const category = String(product.category || "").toLowerCase();
  if (category === "iems") {
    values.add("in-ear monitors");
    values.add("iem");
    values.add("سماعات داخل الأذن");
  }
  if (category === "headphones") values.add("سماعات رأس");
  if (category === "dac") {
    values.add("dac amp");
    values.add("dac & amp");
    values.add("داك");
  }
  if (category === "mic") {
    values.add("microphones");
    values.add("ميكروفون");
  }
  if (product.brand) values.add(String(product.brand).toLowerCase());
  return [...values];
}

function normalizeImportItems(body) {
  if (Array.isArray(body.products)) return body.products;
  if (Array.isArray(body.items)) return body.items;
  if (body.product && typeof body.product === "object") return [body.product];
  return [body].filter((item) => Object.keys(item || {}).length);
}

function normalizeImportProposal(item) {
  const name = item.name?.en || item.nameEn || item.name || item.title || "";
  const brand = item.brand || "";
  const category = item.category || item.primaryCategorySlug || item.primary_category_slug || "";
  const image = item.image || item.normalizedImageUrl || (Array.isArray(item.gallery) ? item.gallery[0] : "");
  const confidenceScore = Number.isFinite(Number(item.confidenceScore ?? item.confidence_score))
    ? Number(item.confidenceScore ?? item.confidence_score)
    : (name && brand && category ? 0.82 : 0.55);
  return {
    name,
    brand,
    category,
    subCategories: Array.isArray(item.subCategories) ? item.subCategories : Array.isArray(item.secondaryCategorySlugs) ? item.secondaryCategorySlugs : [],
    price: safeMoney(item.price),
    currency: item.currency || DEFAULT_CURRENCY,
    image,
    gallery: Array.isArray(item.gallery) ? item.gallery : image ? [image] : [],
    sourceUrl: item.sourceUrl || item.source_url || null,
    externalReference: item.externalReference || item.external_reference || null,
    confidenceScore,
    sourcePayload: sanitizePayloadForStorage(item),
  };
}

function findExistingImportTarget(db, item) {
  const sourceUrl = item.sourceUrl || item.source_url;
  const externalReference = item.externalReference || item.external_reference || item.legacyId || item.legacy_id;
  const slug = item.slug;
  const name = String(item.name?.en || item.nameEn || item.name || item.title || "").toLowerCase();
  const brand = String(item.brand || "").toLowerCase();
  return (db.products || []).find((product) => {
    if (externalReference && [product.externalReference, product.legacyId, product.id].includes(externalReference)) return true;
    if (sourceUrl && product.sourceUrl === sourceUrl) return true;
    if (slug && product.slug === slug) return true;
    const productName = String(product.name?.en || product.nameEn || "").toLowerCase();
    return Boolean(name && brand && productName === name && String(product.brand || "").toLowerCase() === brand);
  }) || null;
}

function buildDiffPreview(current, proposed) {
  const currentCompact = current ? compactProductForDiff(current) : {};
  const fields = ["name", "brand", "category", "subCategories", "price", "currency", "image", "sourceUrl"];
  return fields.map((field) => ({
    field,
    currentValue: currentCompact[field] ?? null,
    proposedValue: proposed[field] ?? null,
    changed: JSON.stringify(currentCompact[field] ?? null) !== JSON.stringify(proposed[field] ?? null),
  }));
}

function compactProductForDiff(product) {
  return {
    id: product.id,
    name: product.name?.en || product.nameEn || "",
    brand: product.brand || "",
    category: product.category || "",
    subCategories: product.subCategories || [],
    price: product.price || 0,
    currency: product.currency || DEFAULT_CURRENCY,
    image: product.image || product.normalizedImageUrl || "",
    sourceUrl: product.sourceUrl || "",
  };
}

function sanitizePayloadForStorage(payload) {
  const clone = cloneForAudit(payload);
  for (const key of ["password", "token", "secret", "authorization", "cookie"]) {
    if (clone && Object.prototype.hasOwnProperty.call(clone, key)) clone[key] = "[redacted]";
  }
  return clone;
}

function findVariantForInventoryUpdate(db, body) {
  const variantId = body.variantId || body.variant_id;
  const sku = body.sku || body.SKU;
  const productId = body.productId || body.product_id;
  if (variantId) return (db.productVariants || []).find((variant) => variant.id === variantId) || null;
  if (sku) return (db.productVariants || []).find((variant) => variant.sku === sku) || null;
  if (productId) return (db.productVariants || []).find((variant) => variant.productId === productId && variant.isBase) || null;
  return null;
}
