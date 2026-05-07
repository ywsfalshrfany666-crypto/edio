import crypto from "node:crypto";
import {
  buildDescriptionBlockFromCandidate,
  sanitizeDescriptionText,
} from "./productDescriptionMedia.js";

export const PRODUCT_WEB_ENRICHMENT_VERSION = "edio.product-web-enrichment.v1";
export const PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD = 0.9;

const TRUSTED_RETAILER_DOMAINS = [
  "linsoul.com",
  "hifigo.com",
  "shenzhenaudio.com",
  "headphones.com",
  "sweetwater.com",
  "thomannmusic.com",
  "thomann.de",
  "apos.audio",
  "bloomaudio.com",
  "musicteck.com",
];

const POLICY_CONTEXT_RE =
  /\b(?:shipping|free shipping|return|returns|refund|warranty|payment|paypal|visa|mastercard|support|newsletter|subscribe|footer|header|breadcrumb|review|reviews|related products?|you may also like|recently viewed|blog|social|share|authentic products?|customer service|terms|privacy|policy)\b/i;
const BOX_CONTEXT_RE = /\b(?:inside the box|what(?:'|’)s in the box|in the box|package contents?|included|contents|محتويات|داخل الصندوق|العلبة)\b/i;
const SPEC_CONTEXT_RE =
  /\b(?:technical details?|specifications?|specs?|parameters?|frequency response|measurements?|impedance|sensitivity|driver|thd|graph|chart|جدول|مواصفات)\b/i;
const COMPARISON_CONTEXT_RE = /\b(?:comparison|compare|versus|\bvs\b|chart)\b/i;
const DIAGRAM_CONTEXT_RE = /\b(?:diagram|schematic|structure|exploded|circuit|layout)\b/i;
const FEATURE_CONTEXT_RE = /\b(?:feature|features|design|technology|highlight|benefit|acoustic|driver|tuning)\b/i;
const VERSION_TOKEN_RE = /\b(?:zero|mk|mark|v|ii|iii|iv|2|3|4|pro|plus|lite|se|wireless|bluetooth|mic|no mic)\b/gi;

export function createProductWebEnrichmentDryRun(db, options = {}, context = {}) {
  const now = context.now || new Date().toISOString();
  const jobId = options.jobId || options.job_id || `web_enrich_${crypto.randomUUID()}`;
  const products = selectProductsForEnrichment(db.products || [], options);
  const sourceDocuments = normalizeSourceDocuments(options.sourceDocuments || options.sources || options.source_documents || []);
  const items = products.map((product) => buildDryRunItem(product, sourceDocuments));
  const summary = summarizeDryRun(items);
  const job = {
    id: jobId,
    version: PRODUCT_WEB_ENRICHMENT_VERSION,
    mode: "product_web_enrichment_dry_run",
    status: "dry_run_completed",
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    summary,
  };

  if (options.recordJob !== false) {
    pushJobLog(db, {
      id: `import_log_${crypto.randomUUID()}`,
      jobId,
      action: "product_enrichment_dry_run_completed",
      message: "Product web enrichment dry-run completed without mutating product records.",
      data: summary,
      createdAt: now,
    });
    pushAuditLog(db, {
      id: `audit_${crypto.randomUUID()}`,
      actorUserId: context.actorUserId || null,
      action: "product_enrichment_dry_run_completed",
      targetType: "enrichment_job",
      targetId: jobId,
      beforeState: null,
      afterState: summary,
      createdAt: now,
    });
  }

  return {
    version: PRODUCT_WEB_ENRICHMENT_VERSION,
    mode: "dry_run",
    job,
    summary,
    items,
    preview: items.slice(0, 30),
    applyPlan: {
      safeToApply: summary.products_safe_to_enrich > 0,
      confidenceThreshold: PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD,
      supportedModes: ["apply_safe_only", "apply_selected", "import_text_only", "import_images_only", "import_specs_only", "import_box_contents_only"],
      blockedReasons: summary.products_safe_to_enrich ? [] : ["No reliable source matched at confidence >= 0.90."],
    },
  };
}

export function applyProductWebEnrichment(db, body = {}, context = {}) {
  const now = context.now || new Date().toISOString();
  const plan = body.plan || body.report || createProductWebEnrichmentDryRun(db, { ...body, recordJob: false }, context);
  const jobId = body.jobId || body.job_id || plan.job?.id || `web_enrich_apply_${crypto.randomUUID()}`;
  const selectedIds = new Set((body.product_ids || body.productIds || body.selectedProductIds || []).map(String));
  const applyAllSafe = selectedIds.size === 0 || body.mode === "apply_safe_only";
  const items = Array.isArray(plan.items) ? plan.items : Array.isArray(plan.preview) ? plan.preview : [];
  const result = {
    jobId,
    applied_products: 0,
    skipped_products: 0,
    description_text_blocks_added: 0,
    description_images_added: 0,
    spec_images_added: 0,
    box_images_added: 0,
    box_contents_added: 0,
    duplicate_images_skipped: 0,
    warnings: [],
  };

  pushAuditLog(db, {
    id: `audit_${crypto.randomUUID()}`,
    actorUserId: context.actorUserId || null,
    action: "product_enrichment_started",
    targetType: "enrichment_job",
    targetId: jobId,
    beforeState: null,
    afterState: { selectedCount: selectedIds.size, mode: body.mode || "apply_safe_only" },
    createdAt: now,
  });

  for (const item of items) {
    const productId = String(item.product_id || item.productId || "");
    if (!productId || (!applyAllSafe && !selectedIds.has(productId))) continue;
    const product = (db.products || []).find((entry) => String(entry.id) === productId);
    if (!product) {
      result.skipped_products += 1;
      result.warnings.push(`Missing product for enrichment item ${productId}.`);
      continue;
    }
    if (!isSafeDryRunItem(item)) {
      result.skipped_products += 1;
      pushAuditLog(db, buildSkipAudit(context, jobId, product, item, "enrichment_skipped_low_confidence", now));
      continue;
    }

    const before = snapshotProtectedFields(product);
    const blocks = Array.isArray(product.descriptionBlocks) ? [...product.descriptionBlocks] : [];
    const existingKeys = new Set(blocks.map((block) => stableBlockKey(block)).filter(Boolean));
    let added = 0;

    for (const block of item.proposed_blocks || []) {
      if (block.needsReview || Number(block.confidence || item.match_confidence || 0) < PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD) continue;
      const normalized = normalizeAppliedBlock(block, { jobId, now, product, item });
      const key = stableBlockKey(normalized);
      if (!key || existingKeys.has(key)) {
        if (normalized.media?.url) result.duplicate_images_skipped += 1;
        continue;
      }
      existingKeys.add(key);
      blocks.push(normalized);
      added += 1;
      if (normalized.type === "text" && normalized.section === "box_contents") result.box_contents_added += 1;
      else if (normalized.type === "text" || normalized.type === "callout") result.description_text_blocks_added += 1;
      else if (normalized.media?.role === "box_image") result.box_images_added += 1;
      else if (normalized.type === "spec_image" || ["spec_image", "comparison", "diagram", "frequency_graph"].includes(normalized.media?.role)) {
        result.spec_images_added += 1;
      } else {
        result.description_images_added += 1;
      }
    }

    if (!added) {
      result.skipped_products += 1;
      continue;
    }

    product.descriptionBlocks = blocks
      .sort((left, right) => Number(left.sortOrder ?? left.sort_order ?? 0) - Number(right.sortOrder ?? right.sort_order ?? 0))
      .map((block, index) => ({ ...block, sortOrder: Number(block.sortOrder ?? block.sort_order ?? index) }));
    product.updatedAt = now;
    product.qualityScore = Math.max(Number(product.qualityScore || 0), Number(item.quality_preview?.score || 0));
    result.applied_products += 1;

    pushAuditLog(db, {
      id: `audit_${crypto.randomUUID()}`,
      actorUserId: context.actorUserId || null,
      action: "enrichment_applied",
      targetType: "product",
      targetId: product.id,
      beforeState: before,
      afterState: {
        productId: product.id,
        productTitle: product.name?.en || product.name || product.slug,
        sourceUrl: item.source_url,
        confidence: item.match_confidence,
        blocksAdded: added,
        protectedFieldsAfter: snapshotProtectedFields(product),
      },
      createdAt: now,
    });
  }

  pushJobLog(db, {
    id: `import_log_${crypto.randomUUID()}`,
    jobId,
    action: "product_enrichment_completed",
    message: "Product web enrichment apply completed for reviewed safe rows.",
    data: result,
    createdAt: now,
  });

  return result;
}

export function matchSourceToProduct(product = {}, sourceDocument = {}) {
  const productTitle = getProductTitle(product);
  const brand = normalizeText(product.brand || product.brandName || product.manufacturer);
  const model = normalizeText(product.model || deriveModelFromTitle(productTitle, brand));
  const sourceTitle = normalizeText(sourceDocument.title || sourceDocument.productTitle || "");
  const sourceText = normalizeText([sourceDocument.title, sourceDocument.url, stripHtml(sourceDocument.html || sourceDocument.text || "")].join(" "));
  const warnings = [];

  if (!productTitle || !sourceText) {
    return { confidence: 0, matchType: "missing_source", warnings: ["Missing source text for matching."], matchedBrand: "", matchedModel: "" };
  }

  const sku = normalizeText(product.sku || product.SKU || "");
  if (sku && sourceText.includes(sku)) {
    return { confidence: 1, matchType: "sku_exact", warnings, matchedBrand: brand, matchedModel: model };
  }

  const brandMatch = !brand || sourceText.includes(brand);
  const titleTokens = significantTokens(productTitle);
  const modelTokens = significantTokens(model);
  const titleCoverage = tokenCoverage(titleTokens, sourceText);
  const modelCoverage = tokenCoverage(modelTokens.length ? modelTokens : titleTokens, sourceText);
  const titleExact = sourceText.includes(normalizeText(productTitle)) || sourceTitle.includes(normalizeText(productTitle));

  const versionMismatch = hasVersionMismatch(productTitle, sourceText);
  if (versionMismatch) warnings.push("Possible model/version mismatch.");

  let confidence = 0.42;
  let matchType = "weak";
  if (titleExact && brandMatch) {
    confidence = 0.97;
    matchType = "title_brand_exact";
  } else if (brandMatch && modelCoverage >= 0.9 && titleCoverage >= 0.72) {
    confidence = 0.93;
    matchType = "brand_model_exact";
  } else if (modelCoverage >= 0.92 && sourceReliability(sourceDocument) >= 0.85) {
    confidence = 0.9;
    matchType = "official_model_match";
  } else if (brandMatch && titleCoverage >= 0.65) {
    confidence = 0.78;
    matchType = "possible_match";
  }

  if (!brandMatch && brand) {
    confidence -= 0.18;
    warnings.push("Brand not confirmed by source.");
  }
  if (versionMismatch) confidence = Math.min(confidence, 0.72);

  return {
    confidence: clamp01(confidence),
    matchType,
    warnings,
    matchedBrand: brandMatch ? brand : "",
    matchedModel: modelCoverage >= 0.8 ? model : "",
  };
}

export function extractProductEnrichmentFromHtml(html = "", sourceDocument = {}) {
  const clean = sanitizeIncomingHtml(html);
  const title = readFirstTagText(clean, "h1") || readMetaContent(clean, "og:title") || sourceDocument.title || "";
  const textBlocks = extractTextBlocks(clean, sourceDocument).slice(0, 4);
  const images = extractImageCandidates(clean, sourceDocument);
  const specs = extractSpecs(clean);
  const boxContents = extractBoxContents(clean);

  return {
    title,
    textBlocks,
    images,
    specs,
    boxContents,
    warnings: images.filter((image) => image.role.endsWith("_rejected")).map((image) => image.reason),
  };
}

function buildDryRunItem(product, sourceDocuments) {
  const sourceCandidates = buildSourceCandidates(product);
  const relevantSources = sourceDocuments.filter((source) => !source.productId || String(source.productId) === String(product.id));
  const evaluated = relevantSources
    .map((source) => {
      const match = matchSourceToProduct(product, source);
      const extraction = extractProductEnrichmentFromHtml(source.html || source.text || "", source);
      return { source, match, extraction };
    })
    .sort((left, right) => right.match.confidence - left.match.confidence);
  const best = evaluated[0] || null;
  const productTitle = getProductTitle(product);

  if (!best) {
    return {
      product_id: product.id,
      product_title: productTitle,
      matched_source: null,
      source_url: "",
      source_type: "unknown",
      match_confidence: 0,
      match_type: "no_source_document",
      source_candidates: sourceCandidates,
      proposed_blocks_count: 0,
      proposed_description_images_count: 0,
      proposed_spec_images_count: 0,
      proposed_box_contents_count: 0,
      proposed_blocks: [],
      warnings: ["No source document supplied. Admin can paste a product source URL/HTML or run a background source collector."],
      recommended_action: "needs_review",
      quality_preview: buildQualityPreview(product, []),
    };
  }

  const proposedBlocks = buildProposedBlocks(product, best.source, best.extraction, best.match);
  const safe = best.match.confidence >= PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD && proposedBlocks.some((block) => !block.needsReview);
  const roleCounts = countProposedRoles(proposedBlocks);

  return {
    product_id: product.id,
    product_title: productTitle,
    matched_source: best.source.title || best.source.url || "",
    source_url: best.source.url || "",
    source_type: normalizeSourceType(best.source.sourceType || best.source.source_type || inferSourceTypeFromUrl(best.source.url)),
    match_confidence: best.match.confidence,
    match_type: best.match.matchType,
    match_reason: buildMatchReason(best.match),
    source_candidates: sourceCandidates,
    proposed_blocks_count: proposedBlocks.length,
    proposed_description_images_count: roleCounts.description,
    proposed_spec_images_count: roleCounts.spec,
    proposed_box_contents_count: roleCounts.boxContents,
    proposed_box_images_count: roleCounts.boxImages,
    proposed_blocks: proposedBlocks,
    warnings: [...best.match.warnings, ...best.extraction.warnings].filter(Boolean),
    recommended_action: safe ? "apply_safe" : "needs_review",
    quality_preview: buildQualityPreview(product, proposedBlocks),
  };
}

function buildProposedBlocks(product, source, extraction, match) {
  const blocks = [];
  let sortOrder = 1000;
  for (const text of extraction.textBlocks || []) {
    blocks.push({
      id: `web_text_${shortHash(`${product.id}:${source.url}:${sortOrder}`)}`,
      type: "text",
      section: "description",
      content: { text: text.content },
      sortOrder,
      source: "web_enrichment",
      sourceUrl: source.url || "",
      sourceType: normalizeSourceType(source.sourceType || source.source_type || inferSourceTypeFromUrl(source.url)),
      confidence: Math.min(match.confidence, text.confidence || 0.9),
      needsReview: match.confidence < PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD,
    });
    sortOrder += 1;
  }
  for (const item of extraction.images || []) {
    if (item.role.endsWith("_rejected")) continue;
    const block = buildDescriptionBlockFromCandidate(
      {
        ...item,
        role: item.role,
        source_url: source.url || item.source_url,
        source_type: source.sourceType || item.source_type,
        sort_order: sortOrder,
      },
      { productName: getProductTitle(product), sourceUrl: source.url, sourceType: source.sourceType },
    );
    if (!block) continue;
    blocks.push({
      ...block,
      id: `web_img_${shortHash(`${product.id}:${item.url}:${sortOrder}`)}`,
      source: "web_enrichment",
      confidence: Math.min(match.confidence, item.confidence || block.confidence || 0.72),
      needsReview: item.needs_review || match.confidence < PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD || (item.confidence || 0) < 0.85,
      sortOrder,
    });
    sortOrder += 1;
  }
  for (const spec of extraction.specs || []) {
    blocks.push({
      id: `web_spec_${shortHash(`${product.id}:${spec.label}:${spec.value}`)}`,
      type: "callout",
      section: "technical_specs",
      content: { text: `${spec.label}: ${spec.value}` },
      sortOrder,
      source: "web_enrichment",
      sourceUrl: source.url || "",
      sourceType: normalizeSourceType(source.sourceType || source.source_type || inferSourceTypeFromUrl(source.url)),
      confidence: Math.min(match.confidence, spec.confidence || 0.9),
      needsReview: match.confidence < PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD,
    });
    sortOrder += 1;
  }
  if (Array.isArray(extraction.boxContents) && extraction.boxContents.length) {
    blocks.push({
      id: `web_box_${shortHash(`${product.id}:${source.url}:${extraction.boxContents.join("|")}`)}`,
      type: "text",
      section: "box_contents",
      content: { text: `Inside the Box:\n${extraction.boxContents.map((item) => `- ${item}`).join("\n")}` },
      sortOrder,
      source: "web_enrichment",
      sourceUrl: source.url || "",
      sourceType: normalizeSourceType(source.sourceType || source.source_type || inferSourceTypeFromUrl(source.url)),
      confidence: match.confidence,
      needsReview: match.confidence < PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD,
    });
  }
  return dedupeBlocks(blocks);
}

function extractImageCandidates(html, sourceDocument) {
  const candidates = [];
  const imgRe = /<img\b[^>]*>/gi;
  let match;
  let index = 0;
  while ((match = imgRe.exec(html))) {
    const tag = match[0];
    const rawUrl = readAttr(tag, "src") || readAttr(tag, "data-src") || readAttr(tag, "data-original") || readSrcset(readAttr(tag, "srcset") || readAttr(tag, "data-srcset"));
    const url = absolutizeUrl(rawUrl, sourceDocument.url);
    if (!isSafePublicImageUrl(url)) continue;
    const context = html.slice(Math.max(0, match.index - 420), Math.min(html.length, match.index + tag.length + 90));
    const nearbyHeading = extractNearbyHeading(html.slice(Math.max(0, match.index - 1600), match.index));
    const alt = readAttr(tag, "alt") || readAttr(tag, "title") || "";
    const classified = classifyExtractedImage({
      url,
      alt,
      caption: extractNearbyCaption(context),
      nearbyText: stripHtml(context),
      nearbyHeading,
    });
    candidates.push({
      url,
      alt,
      caption: extractNearbyCaption(context),
      nearby_heading: nearbyHeading,
      nearby_text: stripHtml(context).slice(0, 700),
      role: classified.role,
      confidence: classified.confidence,
      reason: classified.reason,
      needs_review: classified.needsReview,
      width: numberOrUndefined(readAttr(tag, "width")),
      height: numberOrUndefined(readAttr(tag, "height")),
      source_url: sourceDocument.url || "",
      source_type: sourceDocument.sourceType || inferSourceTypeFromUrl(sourceDocument.url),
      sort_order: index,
    });
    index += 1;
  }
  return candidates;
}

function classifyExtractedImage({ url, alt, caption, nearbyText, nearbyHeading }) {
  const text = [url, alt, caption, nearbyText, nearbyHeading].join(" ");
  if (POLICY_CONTEXT_RE.test(nearbyHeading)) {
    return { role: "policy_image_rejected", confidence: 0.98, reason: "Rejected policy/footer/review/shipping context.", needsReview: true };
  }
  if (BOX_CONTEXT_RE.test(nearbyHeading)) return { role: "box_image", confidence: 0.94, reason: "Nearest heading indicates package contents.", needsReview: false };
  if (SPEC_CONTEXT_RE.test(nearbyHeading)) return { role: "spec_image", confidence: 0.94, reason: "Nearest heading indicates technical specifications.", needsReview: false };
  if (FEATURE_CONTEXT_RE.test(nearbyHeading)) return { role: "feature", confidence: 0.9, reason: "Nearest heading indicates product feature media.", needsReview: false };
  const hasProductContext =
    BOX_CONTEXT_RE.test(text) ||
    SPEC_CONTEXT_RE.test(text) ||
    COMPARISON_CONTEXT_RE.test(text) ||
    DIAGRAM_CONTEXT_RE.test(text) ||
    FEATURE_CONTEXT_RE.test(text);
  if (POLICY_CONTEXT_RE.test(text) && !hasProductContext) {
    return { role: "policy_image_rejected", confidence: 0.98, reason: "Rejected policy/footer/review/shipping context.", needsReview: true };
  }
  if (BOX_CONTEXT_RE.test(text)) return { role: "box_image", confidence: 0.92, reason: "Nearby text indicates package contents.", needsReview: false };
  if (SPEC_CONTEXT_RE.test(text)) return { role: "spec_image", confidence: 0.92, reason: "Nearby text indicates technical specifications.", needsReview: false };
  if (COMPARISON_CONTEXT_RE.test(text)) return { role: "comparison", confidence: 0.88, reason: "Nearby text indicates comparison media.", needsReview: false };
  if (DIAGRAM_CONTEXT_RE.test(text)) return { role: "diagram", confidence: 0.88, reason: "Nearby text indicates diagram media.", needsReview: false };
  if (FEATURE_CONTEXT_RE.test(text)) return { role: "feature", confidence: 0.86, reason: "Nearby text indicates product feature media.", needsReview: false };
  return { role: "description", confidence: 0.84, reason: "Inline image inside product description context.", needsReview: true };
}

function extractTextBlocks(html, sourceDocument) {
  const sectionHtml = isolateProductDescriptionHtml(html);
  const paragraphs = [];
  const paragraphRe = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = paragraphRe.exec(sectionHtml))) {
    const text = cleanText(stripHtml(match[2]));
    if (!isUsefulProductText(text)) continue;
    paragraphs.push(text);
  }
  const unique = [...new Set(paragraphs)].slice(0, 4);
  return unique.map((content) => ({
    content: content.slice(0, 420),
    sourceUrl: sourceDocument.url || "",
    confidence: 0.88,
  }));
}

function extractSpecs(html) {
  const specs = [];
  const clean = sanitizeDescriptionText(html, { max: 120000 });
  const rowRe = /<tr\b[^>]*>\s*<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi;
  let row;
  while ((row = rowRe.exec(clean))) {
    const label = cleanText(stripHtml(row[1])).slice(0, 80);
    const value = cleanText(stripHtml(row[2])).slice(0, 160);
    if (!label || !value || POLICY_CONTEXT_RE.test(`${label} ${value}`)) continue;
    if (!SPEC_CONTEXT_RE.test(label) && specs.length > 18) continue;
    specs.push({ label, value, confidence: 0.9 });
  }
  return dedupeBy(specs, (spec) => `${spec.label.toLowerCase()}:${spec.value.toLowerCase()}`).slice(0, 24);
}

function extractBoxContents(html) {
  const text = cleanText(stripHtml(html));
  const match = text.match(/(?:inside the box|what(?:'|’)s in the box|package contents?|included|contents)[:：\s-]+(.{10,500})/i);
  if (!match) return [];
  return match[1]
    .split(/\s*(?:,|;|\n|•|\|| - )\s*/)
    .map((item) => cleanText(item).replace(/^\d+\s*x\s*/i, ""))
    .filter((item) => item && item.length <= 90 && !POLICY_CONTEXT_RE.test(item))
    .slice(0, 12);
}

function sanitizeIncomingHtml(html) {
  return sanitizeDescriptionText(html, { max: 220000 })
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");
}

function isolateProductDescriptionHtml(html) {
  const lower = html.toLowerCase();
  const startMarkers = ["product-description", "description", "product details", "technical details", "features"];
  const starts = startMarkers.map((marker) => lower.indexOf(marker)).filter((index) => index >= 0);
  if (!starts.length) return html;
  return html.slice(Math.max(0, Math.min(...starts) - 500));
}

function isUsefulProductText(text) {
  if (!text || text.length < 35 || text.length > 900) return false;
  if (POLICY_CONTEXT_RE.test(text)) return false;
  if (/\b(?:copyright|all rights reserved|add to cart|buy now|write a review)\b/i.test(text)) return false;
  return true;
}

function selectProductsForEnrichment(products, options) {
  const ids = new Set((options.product_ids || options.productIds || options.selectedProductIds || []).map(String));
  const limit = Math.max(1, Math.min(200, Number(options.limit || 30)));
  const candidates = ids.size ? products.filter((product) => ids.has(String(product.id))) : products.filter((product) => isPublishedProduct(product));
  return candidates
    .sort((left, right) => productEnrichmentPriority(right) - productEnrichmentPriority(left))
    .slice(0, limit);
}

function productEnrichmentPriority(product) {
  let score = 0;
  if (!getDescriptionBlocks(product).length) score += 6;
  if (!product.description && !product.longDescription && !product.description?.en) score += 4;
  if (!product.specs && !product.technicalSpecs && !product.specifications?.length) score += 3;
  score += Math.max(0, 85 - Number(product.qualityScore || 0)) / 20;
  return score;
}

function isPublishedProduct(product) {
  const status = String(product.status || product.publishStatus || "").toLowerCase();
  return !["hidden", "archived", "deleted"].includes(status);
}

function buildSourceCandidates(product) {
  const title = getProductTitle(product);
  const brand = product.brand || product.brandName || "";
  const model = product.model || deriveModelFromTitle(title, brand);
  const query = [brand, model || title, product.category, product.subcategory].filter(Boolean).join(" ").trim();
  return [
    { query, preferredSourceType: "official" },
    { query: `${query} official product specifications`, preferredSourceType: "official" },
    { query: `${query} Linsoul HiFiGo ShenzhenAudio product description`, preferredSourceType: "authorized_retailer" },
  ].filter((item) => item.query);
}

function normalizeSourceDocuments(sources) {
  return sources
    .map((source) => ({
      productId: source.product_id || source.productId || null,
      url: String(source.url || source.source_url || "").trim(),
      title: String(source.title || source.product_title || "").trim(),
      html: String(source.html || source.body || source.content || source.text || "").trim(),
      text: String(source.text || "").trim(),
      sourceType: normalizeSourceType(source.source_type || source.sourceType || inferSourceTypeFromUrl(source.url || source.source_url)),
    }))
    .filter((source) => source.html || source.text || source.url || source.title);
}

function isSafeDryRunItem(item) {
  return (
    item.recommended_action === "apply_safe" &&
    Number(item.match_confidence || 0) >= PRODUCT_WEB_ENRICHMENT_CONFIDENCE_THRESHOLD &&
    Array.isArray(item.proposed_blocks) &&
    item.proposed_blocks.some((block) => !block.needsReview)
  );
}

function normalizeAppliedBlock(block, { jobId, now, product, item }) {
  const sourceUrl = block.sourceUrl || block.source_url || item.source_url || "";
  return {
    ...block,
    id: block.id || `web_block_${crypto.randomUUID()}`,
    section: block.section || block.content?.section || "description",
    source: "web_enrichment",
    sourceUrl,
    sourceType: block.sourceType || item.source_type || "unknown",
    importJobId: jobId,
    createdAt: now,
    updatedAt: now,
    confidence: Number(block.confidence || item.match_confidence || 0),
    needsReview: Boolean(block.needsReview),
    altText: block.altText || block.alt_text || block.media?.alt || `${getProductTitle(product)} detail image`,
  };
}

function buildQualityPreview(product, blocks) {
  let score = Number(product.qualityScore || 0);
  if (blocks.some((block) => block.type === "text" && block.section !== "box_contents")) score += 4;
  if (blocks.some((block) => block.media?.url && ["description", "feature", "comparison", "diagram"].includes(block.media.role))) score += 5;
  if (blocks.some((block) => block.type === "spec_image" || block.section === "technical_specs" || block.media?.role === "spec_image")) score += 4;
  if (blocks.some((block) => block.section === "box_contents" || block.media?.role === "box_image")) score += 2;
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: ["web_enrichment_preview_only"] };
}

function countProposedRoles(blocks) {
  return blocks.reduce(
    (counts, block) => {
      if (block.section === "box_contents") counts.boxContents += 1;
      else if (block.media?.role === "box_image") counts.boxImages += 1;
      else if (block.type === "spec_image" || ["spec_image", "comparison", "diagram", "frequency_graph"].includes(block.media?.role)) counts.spec += 1;
      else if (block.media?.url) counts.description += 1;
      return counts;
    },
    { description: 0, spec: 0, boxImages: 0, boxContents: 0 },
  );
}

function summarizeDryRun(items) {
  return {
    total_products_checked: items.length,
    products_with_sources_found: items.filter((item) => item.matched_source).length,
    products_safe_to_enrich: items.filter((item) => item.recommended_action === "apply_safe").length,
    products_needing_review: items.filter((item) => item.recommended_action !== "apply_safe").length,
    description_images_found: items.reduce((sum, item) => sum + Number(item.proposed_description_images_count || 0), 0),
    spec_images_found: items.reduce((sum, item) => sum + Number(item.proposed_spec_images_count || 0), 0),
    box_images_found: items.reduce((sum, item) => sum + Number(item.proposed_box_images_count || 0), 0),
    technical_specs_found: items.reduce((sum, item) => sum + (item.proposed_blocks || []).filter((block) => block.section === "technical_specs").length, 0),
    box_contents_found: items.reduce((sum, item) => sum + Number(item.proposed_box_contents_count || 0), 0),
    products_skipped: items.filter((item) => item.recommended_action !== "apply_safe").length,
    warnings: [...new Set(items.flatMap((item) => item.warnings || []))].slice(0, 20),
  };
}

function snapshotProtectedFields(product) {
  return {
    id: product.id,
    price: product.price,
    salePrice: product.salePrice,
    stock: product.stock,
    inStock: product.inStock,
    category: product.category,
    subcategory: product.subcategory,
    image: product.image,
    gallery: product.gallery,
  };
}

function stableBlockKey(block) {
  if (block.media?.url) return `media:${normalizeUrlKey(block.media.url)}`;
  const text = block.content?.text || block.content?.markdown || "";
  return text ? `text:${shortHash(`${block.section || ""}:${text}`)}` : "";
}

function dedupeBlocks(blocks) {
  return dedupeBy(blocks, stableBlockKey);
}

function dedupeBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrlKey(value) {
  return String(value || "").trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
}

function buildMatchReason(match) {
  return `${match.matchType}; confidence=${match.confidence}`;
}

function buildSkipAudit(context, jobId, product, item, action, now) {
  return {
    id: `audit_${crypto.randomUUID()}`,
    actorUserId: context.actorUserId || null,
    action,
    targetType: "product",
    targetId: product.id,
    beforeState: null,
    afterState: {
      productId: product.id,
      sourceUrl: item.source_url,
      confidence: item.match_confidence,
      warnings: item.warnings || [],
    },
    createdAt: now,
  };
}

function pushAuditLog(db, entry) {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  db.auditLogs.push(entry);
}

function pushJobLog(db, entry) {
  if (!Array.isArray(db.importJobLogs)) db.importJobLogs = [];
  db.importJobLogs.push(entry);
}

function getDescriptionBlocks(product) {
  return Array.isArray(product.descriptionBlocks) ? product.descriptionBlocks : [];
}

function getProductTitle(product) {
  return String(product.name?.en || product.name || product.title || product.slug || "").trim();
}

function deriveModelFromTitle(title, brand) {
  const normalizedBrand = normalizeText(brand);
  return cleanText(String(title || "").replace(new RegExp(`\\b${escapeRegExp(normalizedBrand)}\\b`, "i"), ""));
}

function significantTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !["and", "the", "with", "for", "audio", "edition"].includes(token));
}

function tokenCoverage(tokens, text) {
  if (!tokens.length) return 0;
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits / tokens.length;
}

function hasVersionMismatch(productTitle, sourceText) {
  const productVersions = (normalizeText(productTitle).match(VERSION_TOKEN_RE) || []).map(normalizeText);
  if (!productVersions.length) return false;
  const productPhrase = normalizeText(productTitle);
  if (sourceText.includes(productPhrase)) return false;
  if (productPhrase.includes("zero 2") && /\bzero\b/i.test(sourceText) && !/\bzero\s*:?\s*2\b/i.test(sourceText)) return true;
  if (productPhrase.includes("ii") && !/\bii\b|\b2\b/i.test(sourceText)) return true;
  if (productPhrase.includes("pro") && !/\bpro\b/i.test(sourceText)) return true;
  return false;
}

function sourceReliability(sourceDocument) {
  const type = normalizeSourceType(sourceDocument.sourceType || sourceDocument.source_type || inferSourceTypeFromUrl(sourceDocument.url));
  if (type === "official" || type === "manual") return 1;
  if (type === "authorized_retailer") return 0.92;
  if (type === "retailer") return 0.82;
  return 0.6;
}

function normalizeSourceType(value) {
  const sourceType = String(value || "unknown").trim().toLowerCase();
  if (["official", "manual", "authorized_retailer", "retailer", "wordpress", "review", "unknown"].includes(sourceType)) return sourceType;
  return "unknown";
}

function inferSourceTypeFromUrl(value) {
  try {
    const host = new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
    if (TRUSTED_RETAILER_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "authorized_retailer";
  } catch {
    return "unknown";
  }
  return "retailer";
}

function readAttr(tag, attr) {
  const pattern = new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function readSrcset(value) {
  return String(value || "").split(",")[0]?.trim().split(/\s+/)[0] || "";
}

function readFirstTagText(html, tag) {
  const match = String(html || "").match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(stripHtml(match[1])) : "";
}

function readMetaContent(html, property) {
  const pattern = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escapeRegExp(property)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  return cleanText(html.match(pattern)?.[1] || "");
}

function extractNearbyHeading(context) {
  const matches = [...String(context || "").matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  return cleanText(stripHtml(matches.at(-1)?.[1] || ""));
}

function extractNearbyCaption(context) {
  const match = String(context || "").match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  return cleanText(stripHtml(match?.[1] || ""));
}

function absolutizeUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (!baseUrl) return raw;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function isSafePublicImageUrl(value) {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host.endsWith(".local")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return false;
    if (host === "169.254.169.254") return false;
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith(".svg")) return false;
    return /\.(?:png|jpe?g|webp|avif)(?:$|\?)/i.test(pathname) || !/\.[a-z0-9]{2,6}$/i.test(pathname);
  } catch {
    return false;
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}
