import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { parseWooCommerceCsv, sanitizeWooDescriptionHtml } from "./woocommerceImport.js";
import {
  buildDescriptionBlockFromCandidate,
  sanitizeDescriptionText,
} from "./productDescriptionMedia.js";

export const WORDPRESS_DESCRIPTION_IMPORT_VERSION = "edio-wordpress-description-import.v1";
export const DEFAULT_DESCRIPTION_IMPORT_THRESHOLD = 0.9;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const DEFAULT_MAX_IMAGE_BYTES = 18 * 1024 * 1024;
const SAFE_MATCH_TYPES = new Set(["sku", "legacy_id", "slug", "title_brand"]);

const FIELD_ALIASES = {
  legacyId: ["ID", "id"],
  sku: ["SKU", "sku"],
  name: ["Name", "post_title", "title"],
  brand: ["Brands", "Brand", "brand"],
  description: ["Description", "post_content", "long_description"],
  shortDescription: ["Short description", "short_description", "post_excerpt"],
};

export async function createWordPressDescriptionImportPlan(csvText, db, options = {}) {
  const parsed = parseWooCommerceCsv(csvText);
  const rows = parsed.rows.map((row, index) => normalizeImportRow(row, index));
  const products = Array.isArray(db?.products) ? db.products : [];
  const productIndex = buildProductIndex(products);
  const rowDuplicateKeys = findDuplicateRowKeys(rows);
  const firstPassItems = rows.map((row) => buildPlanItem(row, productIndex, rowDuplicateKeys, options));
  const productMatchCounts = countBy(
    firstPassItems.filter((item) => item.productId && item.safeToImport),
    (item) => item.productId,
  );
  const items = firstPassItems.map((item) => {
    if (!item.productId || productMatchCounts.get(item.productId) <= 1) return item;
    return {
      ...item,
      safeToImport: false,
      proposedAction: "review",
      warnings: [...item.warnings, "duplicate_product_match"],
      skipReason: "duplicate_product_match",
    };
  });

  const summary = summarizePlan(items);
  return {
    version: WORDPRESS_DESCRIPTION_IMPORT_VERSION,
    mode: "dry_run",
    threshold: options.threshold ?? DEFAULT_DESCRIPTION_IMPORT_THRESHOLD,
    sourceFile: options.sourceFile || "",
    rows: rows.length,
    summary,
    items,
    preview: items.slice(0, options.previewLimit || 30),
  };
}

export async function applyWordPressDescriptionImport(csvText, db, options = {}) {
  const now = options.now || new Date().toISOString();
  const importJobId = options.importJobId || `wp_desc_${crypto.randomUUID()}`;
  const plan = await createWordPressDescriptionImportPlan(csvText, db, options);
  const productsById = new Map((db.products || []).map((product) => [String(product.id), product]));
  const imageValidator = options.imageValidator || validateRemoteDescriptionImage;
  const imageValidationResults = await validatePlanImages(plan, imageValidator, options);
  const auditLogs = [];
  const report = {
    importJobId,
    sourceFile: options.sourceFile || "",
    matchedProducts: 0,
    skippedProducts: 0,
    textBlocksAdded: 0,
    descriptionImagesAdded: 0,
    specImagesAdded: 0,
    boxImagesAdded: 0,
    boxContentsAdded: 0,
    duplicateBlocksSkipped: 0,
    brokenImagesSkipped: 0,
    unsafeImagesSkipped: 0,
    productsNeedingReview: [],
    skippedReasons: {},
    priceStockCategoryModified: false,
  };

  auditLogs.push(makeAuditLog({
    action: "wordpress_description_import_started",
    importJobId,
    afterState: { sourceFile: options.sourceFile || "", threshold: plan.threshold, rows: plan.rows },
    now,
  }));

  for (const item of plan.items) {
    if (!item.safeToImport) {
      report.skippedProducts += 1;
      increment(report.skippedReasons, item.skipReason || "not_safe_to_import");
      continue;
    }

    const product = productsById.get(String(item.productId));
    if (!product) {
      report.skippedProducts += 1;
      increment(report.skippedReasons, "matched_product_missing");
      continue;
    }

    const existingBlocks = Array.isArray(product.descriptionBlocks) ? product.descriptionBlocks : [];
    const existingKeys = buildExistingBlockKeys(existingBlocks);
    const blocksToAdd = [];

    for (const block of item.blocks) {
      const blockKey = descriptionBlockKey(block);
      if (!blockKey || existingKeys.has(blockKey)) {
        report.duplicateBlocksSkipped += 1;
        auditLogs.push(makeAuditLog({
          action: "description_image_skipped_duplicate",
          importJobId,
          targetId: product.id,
          afterState: { sourceUrl: block.sourceUrl || block.media?.url || "", blockType: block.type },
          now,
        }));
        continue;
      }

      if (block.media?.url) {
        const validation = imageValidationResults.get(normalizeImageUrl(block.media.url)) || { ok: false, reason: "image_not_validated" };
        if (!validation.ok) {
          if (validation.reason === "broken_url") report.brokenImagesSkipped += 1;
          else report.unsafeImagesSkipped += 1;
          auditLogs.push(makeAuditLog({
            action: validation.reason === "broken_url"
              ? "description_image_skipped_broken_url"
              : "description_image_skipped_unsafe_url",
            importJobId,
            targetId: product.id,
            afterState: { sourceUrl: block.media.url, reason: validation.reason },
            now,
          }));
          continue;
        }
      }

      const enriched = {
        ...block,
        id: block.id || `wp_desc_${shortHash(`${product.id}:${blockKey}:${importJobId}`)}`,
        source: "wordpress",
        importJobId,
        importedAt: now,
        matchType: item.matchType,
        matchConfidence: item.matchConfidence,
      };
      blocksToAdd.push(enriched);
      existingKeys.add(blockKey);
    }

    if (!blocksToAdd.length) {
      report.skippedProducts += 1;
      increment(report.skippedReasons, "no_new_safe_blocks");
      continue;
    }

    const beforeCount = existingBlocks.length;
    product.descriptionBlocks = [...existingBlocks, ...blocksToAdd].map((block, index) => ({
      ...block,
      sortOrder: Number.isFinite(Number(block.sortOrder ?? block.sort_order)) ? Number(block.sortOrder ?? block.sort_order) : index,
    }));
    product.updatedAt = now;

    report.matchedProducts += 1;
    report.textBlocksAdded += blocksToAdd.filter((block) => block.type === "text" || block.type === "callout").length;
    report.descriptionImagesAdded += blocksToAdd.filter((block) => block.type === "image" && block.media?.role !== "box_image").length;
    report.specImagesAdded += blocksToAdd.filter((block) => block.type === "spec_image").length;
    report.boxImagesAdded += blocksToAdd.filter((block) => block.media?.role === "box_image").length;

    auditLogs.push(makeAuditLog({
      action: "description_block_added",
      importJobId,
      targetId: product.id,
      beforeState: { descriptionBlocks: beforeCount },
      afterState: {
        descriptionBlocks: product.descriptionBlocks.length,
        added: blocksToAdd.length,
        matchType: item.matchType,
        matchConfidence: item.matchConfidence,
      },
      now,
    }));
    for (const block of blocksToAdd) {
      auditLogs.push(makeAuditLog({
        action: block.type === "spec_image"
          ? "spec_image_added"
          : block.media?.role === "box_image"
            ? "box_image_added"
          : block.media?.url
            ? "description_image_added"
            : "description_text_added",
        importJobId,
        targetId: product.id,
        afterState: { blockId: block.id, sourceUrl: block.sourceUrl || block.media?.url || "", type: block.type },
        now,
      }));
    }
  }

  auditLogs.push(makeAuditLog({
    action: "wordpress_description_import_completed",
    importJobId,
    afterState: report,
    now,
  }));

  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.push(...auditLogs);
  db.importJobLogs = Array.isArray(db.importJobLogs) ? db.importJobLogs : [];
  upsertImportJobLog(db, {
    id: importJobId,
    type: "wordpress_description_import",
    status: "completed",
    sourceFile: options.sourceFile || "",
    startedAt: now,
    completedAt: now,
    summary: report,
    planSummary: plan.summary,
  });
  db.meta = { ...(db.meta || {}), updatedAt: now };

  return { plan, report };
}

async function validatePlanImages(plan, imageValidator, options = {}) {
  const urls = Array.from(
    new Set(
      plan.items
        .filter((item) => item.safeToImport)
        .flatMap((item) => item.blocks || [])
        .map((block) => block.media?.url)
        .filter(Boolean)
        .map(normalizeImageUrl),
    ),
  );
  const results = new Map();
  const concurrency = Math.max(1, Math.min(24, Number(options.imageValidationConcurrency || 12)));
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      const url = urls[index];
      try {
        results.set(url, await imageValidator(url, options));
      } catch (error) {
        results.set(url, { ok: false, reason: "broken_url", error: error?.name || "validation_failed" });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return results;
}

export function rollbackWordPressDescriptionImport(db, importJobId, options = {}) {
  const now = options.now || new Date().toISOString();
  const targetJobId = String(importJobId || "").trim();
  if (!targetJobId) throw new Error("importJobId is required for rollback");

  const report = {
    importJobId: targetJobId,
    productsTouched: 0,
    blocksRemoved: 0,
    mediaRemoved: 0,
  };

  for (const product of db.products || []) {
    const blocks = Array.isArray(product.descriptionBlocks) ? product.descriptionBlocks : [];
    const kept = blocks.filter((block) => block.importJobId !== targetJobId || block.source !== "wordpress");
    const removed = blocks.length - kept.length;
    if (!removed) continue;
    product.descriptionBlocks = kept;
    product.updatedAt = now;
    report.productsTouched += 1;
    report.blocksRemoved += removed;
  }

  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.push(makeAuditLog({
    action: "wordpress_description_import_rollback_completed",
    importJobId: targetJobId,
    afterState: report,
    now,
  }));
  db.importJobLogs = Array.isArray(db.importJobLogs) ? db.importJobLogs : [];
  upsertImportJobLog(db, {
    id: `rollback_${targetJobId}_${shortHash(now)}`,
    type: "wordpress_description_import_rollback",
    status: "completed",
    sourceImportJobId: targetJobId,
    completedAt: now,
    summary: report,
  });
  db.meta = { ...(db.meta || {}), updatedAt: now };

  return report;
}

export function buildWordPressDescriptionBlocks(row, context = {}) {
  const shortDescription = value(row.raw || row, FIELD_ALIASES.shortDescription);
  const description = value(row.raw || row, FIELD_ALIASES.description);
  const sourceUrl = context.sourceUrl || "";
  const blocks = [];
  let sortOrder = 0;

  const shortText = htmlToPlainText(shortDescription);
  if (shortText) {
    blocks.push(makeTextBlock(shortText, { sourceUrl, sortOrder: sortOrder++ }));
  }

  for (const part of tokenizeDescriptionHtml(description, context)) {
    if (part.type === "text") {
      const text = htmlToPlainText(part.html);
      if (!text) continue;
      blocks.push(makeTextBlock(text, { sourceUrl, sortOrder: sortOrder++ }));
      continue;
    }

    const block = buildDescriptionBlockFromCandidate(
      { ...part.candidate, sort_order: sortOrder },
      { sourceUrl, sourceType: "imported", productName: context.productName || row.name || "Product" },
    );
    if (block) {
      blocks.push(block);
      sortOrder += 1;
    }
  }

  const seen = new Set();
  return blocks.filter((block) => {
    const key = descriptionBlockKey(block);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function validateRemoteDescriptionImage(url, options = {}) {
  const safe = await validatePublicImageUrl(url);
  if (!safe.ok) return safe;
  if (options.skipNetworkImageValidation) return { ok: true, reason: "network_validation_skipped" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 6000);
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    const finalSafe = await validatePublicImageUrl(response.url || url);
    if (!finalSafe.ok) return finalSafe;
    if (!response.ok) return { ok: false, reason: "broken_url", status: response.status };
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength && contentLength > (options.maxImageBytes || DEFAULT_MAX_IMAGE_BYTES)) {
      return { ok: false, reason: "image_too_large", contentLength };
    }
    if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return { ok: false, reason: "invalid_image_type", contentType };
    }
    if (!contentType && !hasAllowedImageExtension(response.url || url)) {
      return { ok: false, reason: "missing_image_content_type" };
    }
    return { ok: true, reason: "validated" };
  } catch (error) {
    return { ok: false, reason: "broken_url", error: error?.name || "fetch_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function validatePublicImageUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || "").trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, reason: "blocked_protocol" };
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local")) {
    return { ok: false, reason: "private_or_local_host" };
  }
  if (isPrivateIp(host)) return { ok: false, reason: "private_or_local_host" };
  if (!hasAllowedImageExtension(parsed.href)) return { ok: false, reason: "invalid_image_type" };

  try {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    if (addresses.some((entry) => isPrivateIp(entry.address))) {
      return { ok: false, reason: "private_or_local_host" };
    }
  } catch {
    if (net.isIP(host)) return { ok: false, reason: "dns_lookup_failed" };
  }
  return { ok: true, reason: "safe_public_url" };
}

function buildPlanItem(row, productIndex, duplicateRows, options) {
  const match = matchSafeProduct(row, productIndex);
  const blocks = buildWordPressDescriptionBlocks(row, {
    sourceUrl: row.sourceUrl,
    productName: row.name,
  });
  const threshold = options.threshold ?? DEFAULT_DESCRIPTION_IMPORT_THRESHOLD;
  const duplicateRow = duplicateRows.has(row.duplicateKey);
  const warnings = [];
  if (duplicateRow) warnings.push("duplicate_in_file");
  if (!match.product) warnings.push(match.reason || "no_exact_match");
  if (match.confidence < threshold) warnings.push("low_confidence_match");
  if (!SAFE_MATCH_TYPES.has(match.matchType)) warnings.push("unsupported_match_type");
  if (!blocks.length) warnings.push("no_description_blocks");

  const safeToImport =
    !duplicateRow &&
    Boolean(match.product) &&
    SAFE_MATCH_TYPES.has(match.matchType) &&
    match.confidence >= threshold &&
    blocks.length > 0;

  return {
    rowNumber: row.rowNumber,
    legacyId: row.legacyId,
    sku: row.sku,
    productName: row.name,
    productId: match.product?.id || null,
    currentProductName: match.product ? productTitle(match.product) : "",
    matchType: match.matchType || "none",
    matchConfidence: match.confidence,
    safeToImport,
    proposedAction: safeToImport ? "import_description_blocks" : "review",
    skipReason: safeToImport ? "" : warnings[0] || "not_safe_to_import",
    textBlockCount: blocks.filter((block) => block.type === "text" || block.type === "callout").length,
    descriptionImageCount: blocks.filter((block) => block.type === "image" && block.media?.role !== "box_image").length,
    specImageCount: blocks.filter((block) => block.type === "spec_image").length,
    boxImageCount: blocks.filter((block) => block.media?.role === "box_image").length,
    imageUrls: blocks.filter((block) => block.media?.url).map((block) => block.media.url),
    proposedBlockOrder: blocks.map((block) => ({
      type: block.type,
      sortOrder: block.sortOrder,
      sourceUrl: block.sourceUrl || block.media?.url || "",
      alt: block.altText || block.media?.alt || "",
    })),
    warnings,
    needsReview: !safeToImport,
    blocks,
  };
}

function normalizeImportRow(raw, index) {
  const name = htmlToPlainText(value(raw, FIELD_ALIASES.name));
  const images = splitImageList(value(raw, ["Images", "images"]));
  return {
    rowNumber: index + 2,
    raw,
    legacyId: value(raw, FIELD_ALIASES.legacyId),
    sku: value(raw, FIELD_ALIASES.sku),
    name,
    brand: value(raw, FIELD_ALIASES.brand) || inferBrandFromTitle(name),
    slug: slugify(`${name}${value(raw, FIELD_ALIASES.legacyId) ? `-${value(raw, FIELD_ALIASES.legacyId)}` : ""}`),
    sourceUrl: images[0] || "",
    duplicateKey: value(raw, FIELD_ALIASES.sku)
      ? `sku:${normalizeKey(value(raw, FIELD_ALIASES.sku))}`
      : value(raw, FIELD_ALIASES.legacyId)
        ? `legacy:${value(raw, FIELD_ALIASES.legacyId)}`
        : `title:${normalizeTitle(name)}:${normalizeKey(value(raw, FIELD_ALIASES.brand) || inferBrandFromTitle(name))}`,
  };
}

function buildProductIndex(products) {
  const index = {
    bySku: new Map(),
    byLegacyId: new Map(),
    bySlug: new Map(),
    byTitleBrand: new Map(),
  };
  for (const product of products) {
    if (product.sku) index.bySku.set(normalizeKey(product.sku), product);
    if (product.sourcePayload?.SKU) index.bySku.set(normalizeKey(product.sourcePayload.SKU), product);
    for (const value of [product.legacyId, product.id, product.sourcePayload?.ID]) {
      if (value) index.byLegacyId.set(String(value), product);
    }
    if (String(product.externalReference || "").startsWith("woocommerce:")) {
      index.byLegacyId.set(String(product.externalReference).replace(/^woocommerce:/, ""), product);
    }
    if (product.slug) index.bySlug.set(normalizeKey(product.slug), product);
    const title = productTitle(product);
    if (title && product.brand) {
      index.byTitleBrand.set(`${normalizeTitle(title)}:${normalizeKey(product.brand)}`, product);
    }
  }
  return index;
}

function matchSafeProduct(row, index) {
  if (row.sku && index.bySku.has(normalizeKey(row.sku))) {
    return { product: index.bySku.get(normalizeKey(row.sku)), matchType: "sku", confidence: 1 };
  }
  if (row.legacyId && index.byLegacyId.has(String(row.legacyId))) {
    return { product: index.byLegacyId.get(String(row.legacyId)), matchType: "legacy_id", confidence: 1 };
  }
  if (row.slug && index.bySlug.has(normalizeKey(row.slug))) {
    return { product: index.bySlug.get(normalizeKey(row.slug)), matchType: "slug", confidence: 0.98 };
  }
  const titleBrandKey = `${normalizeTitle(row.name)}:${normalizeKey(row.brand)}`;
  if (row.name && row.brand && index.byTitleBrand.has(titleBrandKey)) {
    return { product: index.byTitleBrand.get(titleBrandKey), matchType: "title_brand", confidence: 0.96 };
  }
  return { product: null, matchType: "", confidence: 0, reason: "no_exact_safe_match" };
}

function tokenizeDescriptionHtml(html, context = {}) {
  const clean = sanitizeWooDescriptionHtml(html);
  const tokens = [];
  const imagePattern = /<img\b[^>]*>/gi;
  let lastIndex = 0;
  let match;
  while ((match = imagePattern.exec(clean))) {
    const textHtml = clean.slice(lastIndex, match.index);
    if (textHtml.trim()) tokens.push({ type: "text", html: textHtml });
    const tag = match[0];
    const url =
      readHtmlAttribute(tag, "src") ||
      readHtmlAttribute(tag, "data-src") ||
      readHtmlAttribute(tag, "data-original") ||
      readFirstSrcsetUrl(readHtmlAttribute(tag, "srcset") || readHtmlAttribute(tag, "data-srcset"));
    tokens.push({
      type: "image",
      candidate: {
        url,
        alt: readHtmlAttribute(tag, "alt") || readHtmlAttribute(tag, "title") || "",
        caption: readNearbyCaption(clean, match.index + tag.length),
        width: numberOrNull(readHtmlAttribute(tag, "width")),
        height: numberOrNull(readHtmlAttribute(tag, "height")),
        role: "description",
        source_type: "imported",
        source_url: context.sourceUrl || "",
        section_text: clean.slice(Math.max(0, match.index - 240), match.index + tag.length),
      },
    });
    lastIndex = match.index + tag.length;
  }
  const tail = clean.slice(lastIndex);
  if (tail.trim()) tokens.push({ type: "text", html: tail });
  return tokens;
}

function makeTextBlock(text, { sourceUrl = "", sortOrder = 0 } = {}) {
  return {
    id: `desc_text_${shortHash(`${text}:${sortOrder}`)}`,
    type: "text",
    content: { text },
    sortOrder,
    sourceUrl,
    sourceType: "imported",
    needsReview: false,
    confidence: 1,
  };
}

function htmlToPlainText(value) {
  return decodeHtmlEntities(
    sanitizeDescriptionText(String(value || "").replace(/\\r\\n|\\n|\\r/g, "\n"), { max: 30000 })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|section|article|h[1-6]|li|ul|ol|table|tr)>/gi, "\n")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r\n|\r/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function readHtmlAttribute(tag, attr) {
  const pattern = new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function readFirstSrcsetUrl(value) {
  const first = String(value || "").split(",")[0]?.trim() || "";
  return first.split(/\s+/)[0] || "";
}

function readNearbyCaption(html, startIndex) {
  const nearby = String(html || "").slice(startIndex, startIndex + 500);
  const figcaption = nearby.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  if (figcaption) return htmlToPlainText(figcaption[1]).slice(0, 240);
  return "";
}

function buildExistingBlockKeys(blocks) {
  return new Set((Array.isArray(blocks) ? blocks : []).map(descriptionBlockKey).filter(Boolean));
}

function descriptionBlockKey(block) {
  const url = normalizeImageUrl(block?.media?.url || "");
  if (url) return `image:${url}`;
  const text = normalizeTextKey(block?.content?.text || block?.content?.markdown || block?.text || "");
  if (text) return `text:${shortHash(text)}`;
  return "";
}

function normalizeImageUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.href.toLowerCase().replace(/\/+$/, "");
  } catch {
    return String(value || "").trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
  }
}

function normalizeTextKey(value) {
  return htmlToPlainText(value).toLowerCase().replace(/\s+/g, " ").slice(0, 1000);
}

function summarizePlan(items) {
  return {
    totalRows: items.length,
    safeMatches: items.filter((item) => item.safeToImport).length,
    skipped: items.filter((item) => !item.safeToImport).length,
    textBlocks: items.filter((item) => item.safeToImport).reduce((sum, item) => sum + item.textBlockCount, 0),
    descriptionImages: items.filter((item) => item.safeToImport).reduce((sum, item) => sum + item.descriptionImageCount, 0),
    specImages: items.filter((item) => item.safeToImport).reduce((sum, item) => sum + item.specImageCount, 0),
    boxImages: items.filter((item) => item.safeToImport).reduce((sum, item) => sum + item.boxImageCount, 0),
    warnings: countWarnings(items),
  };
}

function countWarnings(items) {
  const counts = {};
  for (const item of items) {
    for (const warning of item.warnings) increment(counts, warning);
  }
  return counts;
}

function countBy(items, callback) {
  const counts = new Map();
  for (const item of items) {
    const key = callback(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function findDuplicateRowKeys(rows) {
  const counts = countBy(rows.filter((row) => row.duplicateKey), (row) => row.duplicateKey);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function makeAuditLog({ action, importJobId, targetId = null, beforeState = null, afterState = null, now }) {
  return {
    id: `aud_${crypto.randomUUID()}`,
    actorUserId: "system",
    action,
    targetType: targetId ? "product" : "import_job",
    targetId,
    beforeState,
    afterState: {
      import_job_id: importJobId,
      ...(afterState || {}),
    },
    requestId: importJobId,
    ipHash: "",
    createdAt: now || new Date().toISOString(),
  };
}

function upsertImportJobLog(db, job) {
  db.importJobLogs = Array.isArray(db.importJobLogs) ? db.importJobLogs : [];
  const existingIndex = db.importJobLogs.findIndex((item) => item.id === job.id);
  if (existingIndex >= 0) db.importJobLogs.splice(existingIndex, 1);
  db.importJobLogs.unshift(job);
  db.importJobLogs = db.importJobLogs.slice(0, 200);
}

function value(row, aliases) {
  for (const alias of aliases) {
    if (row?.[alias] !== undefined && String(row[alias]).trim() !== "") return String(row[alias]).trim();
  }
  return "";
}

function splitImageList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function productTitle(product) {
  return String(product?.name?.en || product?.name || product?.title || "").trim();
}

function inferBrandFromTitle(title) {
  const words = String(title || "").trim().split(/\s+/);
  return words[0] || "";
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeTitle(value).replace(/\s+/g, "-");
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function hasAllowedImageExtension(value) {
  try {
    const parsed = new URL(value);
    return /\.(?:png|jpe?g|webp|avif)$/i.test(parsed.pathname);
  } catch {
    return /\.(?:png|jpe?g|webp|avif)(?:$|[?#])/i.test(String(value || ""));
  }
}

function isPrivateIp(value) {
  const ipVersion = net.isIP(value);
  if (!ipVersion) return false;
  const ip = String(value || "").toLowerCase();
  if (ipVersion === 6) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:") || ip === "::";
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function increment(object, key) {
  object[key] = (object[key] || 0) + 1;
}
