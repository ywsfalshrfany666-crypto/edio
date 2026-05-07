import crypto from "node:crypto";
import {
  buildDescriptionBlocksFromImportDraft,
  extractDescriptionImageCandidatesFromHtml,
  sanitizeDescriptionText,
} from "./productDescriptionMedia.js";

export const WOOCOMMERCE_IMPORT_VERSION = "edio-woocommerce-import.v1";

const PRODUCT_TYPES_TO_IMPORT = new Set(["", "simple", "external", "variable"]);
const PUBLISH_VALUES = new Set(["1", "publish", "published", "true", "yes"]);
const PRIVATE_URL_PATTERN = /^(?:localhost|0\.0\.0\.0|127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i;
const IMAGE_EXT_PATTERN = /\.(?:png|jpe?g|webp|avif)(?:$|[?#])/i;

const FIELD_ALIASES = {
  legacyId: ["ID", "id"],
  type: ["Type", "type"],
  sku: ["SKU", "sku"],
  gtin: ["GTIN, UPC, EAN, or ISBN", "GTIN", "UPC", "EAN", "ISBN"],
  name: ["Name", "post_title", "title"],
  published: ["Published", "Status", "post_status"],
  shortDescription: ["Short description", "short_description", "post_excerpt"],
  description: ["Description", "post_content", "long_description"],
  inStock: ["In stock?", "Stock status", "stock_status"],
  stockQuantity: ["Stock", "stock_quantity"],
  salePrice: ["Sale price", "sale_price"],
  regularPrice: ["Regular price", "regular_price", "Price"],
  categories: ["Categories", "categories"],
  tags: ["Tags", "tags"],
  images: ["Images", "images"],
  brand: ["Brands", "Brand", "brand"],
  seoScore: ["Meta: rank_math_seo_score"],
  primaryCategory: ["Meta: rank_math_primary_product_cat"],
};

const CATEGORY_MAP = [
  { category: "headphones", hints: ["headphone", "headphones", "open-back", "closed-back", "over-ear", "on-ear"] },
  { category: "iems", hints: ["iem", "iems", "in-ear", "earphone", "earphones", "in ear", "hybrid driver"] },
  { category: "dap", hints: ["dap", "digital audio player", "player"] },
  { category: "dac", hints: ["dac", "amp", "amplifier", "dongle", "audio adapter"] },
  { category: "microphones", hints: ["microphone", "microphones", "mic", "xlr", "usb microphone"] },
  { category: "audio-interface", hints: ["audio interface", "interface", "sound card", "كرت صوت"] },
  { category: "accessories", hints: ["accessories", "accessory", "cable", "eartip", "ear tip", "tips", "case", "stand"] },
];

export function analyzeWooCommerceCsv(csvText, existingProducts = [], options = {}) {
  const parsed = parseWooCommerceCsv(csvText);
  const rows = parsed.rows.map((row, index) => normalizeWooRow(row, index));
  const existingIndex = buildExistingProductIndex(existingProducts);
  const fileDuplicateKeys = findDuplicateKeys(rows);
  const typeCounts = countBy(rows, (row) => row.type || "unknown");
  const mappedRows = rows.map((row) => buildDryRunItem(row, existingIndex, fileDuplicateKeys, options));
  const validItems = mappedRows.filter((item) => item.validProduct);
  const productsWithDescriptionImages = mappedRows.filter((item) => item.descriptionImagesCount > 0).length;
  const productsWithSpecs = mappedRows.filter((item) => item.specsCount > 0).length;
  const brokenImageUrls = mappedRows.reduce((sum, item) => sum + item.brokenImageUrls.length, 0);
  const unmappedFields = detectUnmappedFields(parsed.headers);
  const warnings = buildFileWarnings(mappedRows, unmappedFields, typeCounts);

  return {
    version: WOOCOMMERCE_IMPORT_VERSION,
    source: {
      type: "csv",
      format: "woocommerce",
      detectedAt: new Date().toISOString(),
      headers: parsed.headers,
      typeCounts,
    },
    mapping: buildFieldMapping(parsed.headers),
    summary: {
      total_rows: rows.length,
      valid_products: validItems.length,
      new_products: mappedRows.filter((item) => item.action === "create").length,
      products_to_update: mappedRows.filter((item) => item.action === "update").length,
      possible_duplicates: mappedRows.filter((item) => item.match.status === "existing_possible_match").length,
      conflicts: mappedRows.filter((item) => item.action === "review" && item.warnings.some((warning) => warning.includes("conflict"))).length,
      missing_images: mappedRows.filter((item) => item.validProduct && item.imageCount === 0).length,
      broken_image_urls: brokenImageUrls,
      products_with_description_images: productsWithDescriptionImages,
      products_with_specs: productsWithSpecs,
      products_needing_review: mappedRows.filter((item) => item.needsReview).length,
      products_published_in_file: rows.filter((row) => row.published).length,
      products_unpublished_in_file: rows.filter((row) => !row.published).length,
      products_with_sku: rows.filter((row) => row.sku).length,
      products_with_gallery: rows.filter((row) => row.galleryImages.length > 1).length,
      products_with_price: rows.filter((row) => row.regularPrice !== null || row.salePrice !== null).length,
      products_with_sale_price: rows.filter((row) => row.salePrice !== null).length,
      products_in_stock: rows.filter((row) => row.availability === "in_stock").length,
      products_out_of_stock: rows.filter((row) => row.availability === "out_of_stock").length,
      unmapped_fields: unmappedFields,
      warnings,
    },
    preview: mappedRows,
    applyPlan: buildApplyPlan(mappedRows),
  };
}

export function parseWooCommerceCsv(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rawRows = parseCsvRows(text);
  if (!rawRows.length) return { headers: [], rows: [] };
  const headers = rawRows[0].map((header) => String(header || "").trim());
  const rows = rawRows
    .slice(1)
    .filter((row) => row.some((value) => String(value || "").trim()))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])),
    );
  return { headers, rows };
}

export function mapWooCommerceRowToEdio(row, options = {}) {
  const normalized = row.normalized ? row : normalizeWooRow(row, Number(row.rowNumber || 0));
  const title = stripHtml(normalized.name);
  const descriptionHtml = sanitizedWooHtml(normalized.description);
  const shortDescription = stripHtml(normalized.shortDescription);
  const descriptionBlocks = buildDescriptionBlocksFromImportDraft(
    {
      nameEn: title,
      descriptionHtml,
      shortDescriptionHtml: sanitizedWooHtml(normalized.shortDescription),
    },
    {
      sourceUrl: normalized.sourceUrl,
      sourceType: "imported",
      productName: title,
    },
  );
  const specs = extractSpecsFromWooRow(normalized.raw);
  const category = mapWooCategory(normalized.categories, options.existingCategories || []);

  return {
    id: normalized.legacyId || `woo_${shortHash(title)}`,
    legacyId: normalized.legacyId,
    externalReference: normalized.legacyId ? `woocommerce:${normalized.legacyId}` : "",
    sourcePayload: normalized.raw,
    sourceUrl: normalized.sourceUrl,
    slug: `${slugify(title)}${normalized.legacyId ? `-${normalized.legacyId}` : ""}`,
    name: { en: title, ar: title },
    brand: normalized.brand || inferBrand(title),
    model: inferModel(title, normalized.brand),
    category: category.category,
    subCategories: category.subCategories,
    tagline: { en: shortDescription || stripHtml(normalized.description).slice(0, 180), ar: shortDescription || "" },
    price: normalized.salePrice ?? normalized.regularPrice ?? 0,
    salePrice: normalized.salePrice,
    regularPrice: normalized.regularPrice,
    compareAt: normalized.salePrice && normalized.regularPrice ? normalized.regularPrice : null,
    currency: "IQD",
    availabilityStatus: normalized.availability,
    stock: normalized.stockQuantity,
    inStock: normalized.availability === "in_stock",
    image: normalized.galleryImages[0] || "",
    gallery: normalized.galleryImages,
    descriptionBlocks,
    features: extractFeatureBullets(normalized.description, normalized.shortDescription),
    specs,
    tags: splitList(normalized.tags),
    seo: buildSeoFromWooRow(normalized),
    needsReview: false,
    importMeta: {
      source: "woocommerce_csv",
      importVersion: WOOCOMMERCE_IMPORT_VERSION,
      rowNumber: normalized.rowNumber,
      confidence: normalized.confidence,
    },
  };
}

export function sanitizeWooDescriptionHtml(html) {
  return sanitizedWooHtml(html);
}

export function extractWooDescriptionImages(html, context = {}) {
  return extractDescriptionImageCandidatesFromHtml(sanitizedWooHtml(html), context);
}

function buildDryRunItem(row, existingIndex, fileDuplicateKeys, options) {
  const mapped = mapWooCommerceRowToEdio(row, options);
  const validProduct = PRODUCT_TYPES_TO_IMPORT.has(row.type) && Boolean(mapped.name.en);
  const duplicateKey = row.sku ? `sku:${normalizeKey(row.sku)}` : `title:${normalizeTitle(row.name)}`;
  const duplicateInFile = fileDuplicateKeys.has(duplicateKey);
  const match = matchExistingProduct(row, mapped, existingIndex);
  const imageWarnings = row.galleryImages.filter((url) => !isSafeHttpImageUrl(url)).map((url) => `unsafe_or_invalid_image:${url}`);
  const requiredWarnings = [];
  if (!validProduct) requiredWarnings.push(`unsupported_or_empty_product_type:${row.type || "empty"}`);
  if (!mapped.category) requiredWarnings.push("category_needs_review");
  if (!mapped.price) requiredWarnings.push("price_missing");
  if (!mapped.image) requiredWarnings.push("main_image_missing");
  if (!row.availability) requiredWarnings.push("availability_needs_review");
  if (duplicateInFile) requiredWarnings.push("duplicate_in_file");

  const current = match.product || null;
  const priceChange = current
    ? {
        current: numberOrNull(current.price),
        incoming: mapped.price || null,
        changed: Number(current.price || 0) !== Number(mapped.price || 0),
      }
    : { current: null, incoming: mapped.price || null, changed: false };
  const availabilityChange = current
    ? {
        current: current.availabilityStatus || (current.inStock ? "in_stock" : "out_of_stock"),
        incoming: mapped.availabilityStatus,
        changed: (current.availabilityStatus || (current.inStock ? "in_stock" : "out_of_stock")) !== mapped.availabilityStatus,
      }
    : { current: null, incoming: mapped.availabilityStatus, changed: false };
  const categoryChange = current
    ? {
        current: current.category || "",
        incoming: mapped.category || "",
        changed: Boolean(mapped.category && current.category && current.category !== mapped.category),
      }
    : { current: null, incoming: mapped.category || "", changed: false };

  const conflictWarnings = [];
  if (match.status === "existing_possible_match") conflictWarnings.push("possible_match_requires_review");
  if (priceChange.changed && match.status === "existing_possible_match") conflictWarnings.push("price_conflict_possible_match");
  if (categoryChange.changed && match.status === "existing_possible_match") conflictWarnings.push("category_conflict_possible_match");

  const warnings = [...requiredWarnings, ...imageWarnings, ...conflictWarnings];
  const needsReview = warnings.length > 0 || match.status === "existing_possible_match" || mapped.importMeta.confidence < 0.85;
  const action = chooseDryRunAction({ validProduct, duplicateInFile, match, needsReview });

  return {
    rowNumber: row.rowNumber,
    legacyId: row.legacyId,
    sku: row.sku,
    productName: mapped.name.en,
    currentProductMatch: match.product
      ? {
          id: match.product.id,
          slug: match.product.slug,
          title: productTitle(match.product),
          matchBy: match.matchBy,
          confidence: match.confidence,
        }
      : null,
    match: {
      status: duplicateInFile ? "duplicate_in_file" : match.status,
      matchBy: match.matchBy,
      confidence: match.confidence,
    },
    action,
    validProduct,
    price: priceChange,
    availability: availabilityChange,
    category: categoryChange,
    incoming: {
      title: mapped.name.en,
      brand: mapped.brand,
      category: mapped.category,
      subCategories: mapped.subCategories,
      price: mapped.price || null,
      salePrice: mapped.salePrice,
      regularPrice: mapped.regularPrice,
      availability: mapped.availabilityStatus,
      stockStatus: row.raw[field(row.raw, FIELD_ALIASES.inStock)] || "",
      stockQuantityKnown: row.stockQuantity !== null,
    },
    imageCount: mapped.gallery.length,
    descriptionImagesCount: mapped.descriptionBlocks.filter((block) => block.media?.url).length,
    specsCount: mapped.specs.length,
    brokenImageUrls: row.galleryImages.filter((url) => !isSafeHttpImageUrl(url)),
    qualityScore: calculateImportQualityScore(mapped, warnings),
    needsReview,
    confidence: mapped.importMeta.confidence,
    warnings,
  };
}

function normalizeWooRow(raw, index) {
  const name = value(raw, FIELD_ALIASES.name);
  const description = value(raw, FIELD_ALIASES.description);
  const shortDescription = value(raw, FIELD_ALIASES.shortDescription);
  const galleryImages = extractImageUrls(value(raw, FIELD_ALIASES.images));
  const descriptionImages = extractDescriptionImageCandidatesFromHtml([description, shortDescription].join("\n"), {
    sourceType: "imported",
  });
  const availability = mapAvailability(value(raw, FIELD_ALIASES.inStock));
  const regularPrice = numberOrNull(value(raw, FIELD_ALIASES.regularPrice));
  const salePrice = numberOrNull(value(raw, FIELD_ALIASES.salePrice));
  const categories = value(raw, FIELD_ALIASES.categories);
  const sku = value(raw, FIELD_ALIASES.sku);
  const brand = value(raw, FIELD_ALIASES.brand) || inferBrand(name);
  const confidence = calculateRowConfidence({
    name,
    galleryImages,
    description,
    categories,
    price: salePrice ?? regularPrice,
    availability,
    brand,
  });

  return {
    normalized: true,
    rowNumber: index + 2,
    raw,
    legacyId: value(raw, FIELD_ALIASES.legacyId),
    type: value(raw, FIELD_ALIASES.type).toLowerCase(),
    sku,
    gtin: value(raw, FIELD_ALIASES.gtin),
    name,
    published: PUBLISH_VALUES.has(value(raw, FIELD_ALIASES.published).toLowerCase()),
    shortDescription,
    description,
    descriptionImages,
    inStockRaw: value(raw, FIELD_ALIASES.inStock),
    availability,
    stockQuantity: numberOrNull(value(raw, FIELD_ALIASES.stockQuantity)),
    salePrice,
    regularPrice,
    categories,
    tags: value(raw, FIELD_ALIASES.tags),
    galleryImages,
    brand,
    sourceUrl: inferSourceUrl(raw, galleryImages),
    confidence,
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let fieldValue = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        fieldValue += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        fieldValue += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(fieldValue);
      fieldValue = "";
    } else if (char === "\n") {
      row.push(fieldValue);
      rows.push(row);
      row = [];
      fieldValue = "";
    } else if (char !== "\r") {
      fieldValue += char;
    }
  }
  if (fieldValue || row.length) {
    row.push(fieldValue);
    rows.push(row);
  }
  return rows;
}

function buildFieldMapping(headers) {
  const mapping = {};
  for (const [edioField, aliases] of Object.entries(FIELD_ALIASES)) {
    const header = aliases.find((alias) => headers.includes(alias));
    mapping[edioField] = header || null;
  }
  mapping.descriptionBlocks = "Description <img> extraction";
  mapping.technicalSpecs = "Attribute columns + sanitized Description text";
  mapping.legacyUrl = "Image/source URL domain when available";
  mapping.needsReview = "Computed from confidence, conflicts, missing required fields";
  mapping.qualityScore = "Computed dry-run quality score";
  return mapping;
}

function detectUnmappedFields(headers) {
  const mapped = new Set(Object.values(FIELD_ALIASES).flat());
  return headers.filter((header) => {
    if (mapped.has(header)) return false;
    if (/^Attribute \d+ (name|value\(s\)|visible|global)$/i.test(header)) return false;
    if (/^Meta: (rank_math|_wp_|_woodmart|woodmart|_elementor|rs_)/i.test(header)) return false;
    return true;
  });
}

function buildExistingProductIndex(products) {
  const bySku = new Map();
  const byLegacyId = new Map();
  const bySlug = new Map();
  const byTitle = new Map();
  const byTitleBrand = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const title = productTitle(product);
    if (product.sku) bySku.set(normalizeKey(product.sku), product);
    if (product.legacyId) byLegacyId.set(String(product.legacyId), product);
    if (product.externalReference) byLegacyId.set(String(product.externalReference).replace(/^woocommerce:/, ""), product);
    if (product.id) byLegacyId.set(String(product.id), product);
    if (product.slug) bySlug.set(normalizeKey(product.slug), product);
    if (title) byTitle.set(normalizeTitle(title), product);
    if (title && product.brand) byTitleBrand.set(`${normalizeTitle(title)}:${normalizeKey(product.brand)}`, product);
  }
  return { products: Array.isArray(products) ? products : [], bySku, byLegacyId, bySlug, byTitle, byTitleBrand };
}

function matchExistingProduct(row, mapped, index) {
  if (row.sku && index.bySku.has(normalizeKey(row.sku))) {
    return exactMatch(index.bySku.get(normalizeKey(row.sku)), "sku", 1);
  }
  if (row.legacyId && index.byLegacyId.has(String(row.legacyId))) {
    return exactMatch(index.byLegacyId.get(String(row.legacyId)), "legacy_id", 1);
  }
  if (mapped.slug && index.bySlug.has(normalizeKey(mapped.slug))) {
    return exactMatch(index.bySlug.get(normalizeKey(mapped.slug)), "slug", 0.98);
  }
  const titleKey = normalizeTitle(mapped.name?.en || row.name);
  if (titleKey && index.byTitle.has(titleKey)) {
    return exactMatch(index.byTitle.get(titleKey), "exact_title", 0.95);
  }
  const titleBrandKey = `${titleKey}:${normalizeKey(mapped.brand)}`;
  if (titleKey && mapped.brand && index.byTitleBrand.has(titleBrandKey)) {
    return exactMatch(index.byTitleBrand.get(titleBrandKey), "title_brand", 0.96);
  }
  const possible = index.products
    .map((product) => ({
      product,
      score: fuzzyTitleScore(mapped.name?.en || row.name, productTitle(product), mapped.brand, product.brand),
    }))
    .sort((left, right) => right.score - left.score)[0];
  if (possible?.score >= 0.82) {
    return { status: "existing_possible_match", product: possible.product, matchBy: "fuzzy_title_brand", confidence: round2(possible.score) };
  }
  return { status: "new_product", product: null, matchBy: null, confidence: 0 };
}

function exactMatch(product, matchBy, confidence) {
  return { status: "existing_exact_match", product, matchBy, confidence };
}

function findDuplicateKeys(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = row.sku ? `sku:${normalizeKey(row.sku)}` : `title:${normalizeTitle(row.name)}`;
    if (!key.endsWith(":")) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function chooseDryRunAction({ validProduct, duplicateInFile, match, needsReview }) {
  if (!validProduct || duplicateInFile) return "review";
  if (match.status === "existing_possible_match") return "review";
  if (match.status === "existing_exact_match") return needsReview ? "review" : "update";
  if (match.status === "new_product") return needsReview ? "review" : "create";
  return "review";
}

function buildApplyPlan(items) {
  return {
    defaultMode: "dry_run_only",
    supportedModes: [
      "apply_all_safe_changes",
      "apply_selected_rows",
      "update_existing_only",
      "create_new_only",
      "import_images_only",
      "import_description_media_only",
      "import_prices_availability_only",
    ],
    safeRowCount: items.filter((item) => ["create", "update"].includes(item.action) && !item.needsReview).length,
    blockedRowCount: items.filter((item) => item.needsReview || item.action === "review").length,
    requiresExplicitConfirmation: true,
    rollbackStrategy: "Every future apply must write import_job_id and before/after snapshots before mutating products.",
  };
}

function buildFileWarnings(items, unmappedFields, typeCounts) {
  const warnings = [];
  if (unmappedFields.length) warnings.push(`unmapped_fields:${unmappedFields.join(",")}`);
  if (typeCounts.variation) warnings.push(`variation_rows_detected:${typeCounts.variation}`);
  const reviewCount = items.filter((item) => item.needsReview).length;
  if (reviewCount) warnings.push(`rows_need_review:${reviewCount}`);
  return warnings;
}

function extractSpecsFromWooRow(row) {
  const specs = [];
  for (let index = 1; index <= 12; index += 1) {
    const name = stripHtml(row[`Attribute ${index} name`] || "");
    const values = splitList(row[`Attribute ${index} value(s)`] || "");
    if (name && values.length) {
      specs.push({ label: name, value: values.join(", ") });
    }
  }
  const textSpecs = extractSpecsFromText(row[field(row, FIELD_ALIASES.description)] || "");
  return uniqueSpecs([...specs, ...textSpecs]).slice(0, 24);
}

function extractSpecsFromText(html) {
  const text = stripHtml(html);
  const specs = [];
  const patterns = [
    ["Driver", /\b(?:driver|driver type|driver configuration)\s*:?\s*([^.;\n]{2,90})/i],
    ["Impedance", /\bimpedance\s*:?\s*([^.;\n]{2,50})/i],
    ["Sensitivity", /\bsensitivity\s*:?\s*([^.;\n]{2,60})/i],
    ["Frequency Response", /\bfrequency (?:response|range)\s*:?\s*([^.;\n]{2,70})/i],
    ["Connector", /\b(?:connector|connection|interface)\s*:?\s*([^.;\n]{2,70})/i],
  ];
  for (const [label, pattern] of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) specs.push({ label, value: cleanText(match[1]).slice(0, 120) });
  }
  return specs;
}

function uniqueSpecs(specs) {
  const seen = new Set();
  return specs.filter((spec) => {
    const key = normalizeKey(`${spec.label}:${spec.value}`);
    if (!spec.label || !spec.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractFeatureBullets(description, shortDescription) {
  const text = stripHtml([shortDescription, description].filter(Boolean).join("\n"));
  return text
    .split(/(?:\n|•|·|\. )/)
    .map((item) => cleanText(item))
    .filter((item) => item.length >= 24 && item.length <= 220)
    .slice(0, 8);
}

function buildSeoFromWooRow(row) {
  const title = stripHtml(row.name).slice(0, 70);
  const description = stripHtml(row.shortDescription || row.description).slice(0, 160);
  return {
    title,
    description,
    legacySeoScore: value(row.raw, FIELD_ALIASES.seoScore) || null,
  };
}

function mapWooCategory(rawCategories, existingCategories = []) {
  const raw = String(rawCategories || "");
  const lower = raw.toLowerCase();
  const existing = new Set(Array.isArray(existingCategories) ? existingCategories : []);
  let category = "";
  for (const entry of CATEGORY_MAP) {
    if (entry.hints.some((hint) => lower.includes(hint))) {
      category = entry.category;
      break;
    }
  }
  if (existing.size && category && !existing.has(category)) {
    const fallback = [...existing].find((item) => normalizeKey(item) === normalizeKey(category));
    category = fallback || "";
  }
  const subCategories = splitList(raw)
    .map((item) => item.split(">").pop() || item)
    .map(slugify)
    .filter((item) => item && item !== category && !["shop", "uncategorized", "products", "product"].includes(item))
    .slice(0, 8);
  return { category, subCategories: [...new Set(subCategories)] };
}

function mapAvailability(value) {
  const stock = String(value || "").trim().toLowerCase();
  if (["1", "yes", "true", "instock", "in stock"].includes(stock)) return "in_stock";
  if (["0", "no", "false", "outofstock", "out of stock"].includes(stock)) return "out_of_stock";
  if (stock.includes("backorder") || stock.includes("pre")) return "pre_order";
  return "";
}

function extractImageUrls(value) {
  const text = String(value || "");
  const urls = text.match(/https?:\/\/[^\s,"<>]+/gi) || [];
  const fallback = text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
  return [...new Set([...urls, ...fallback].map((url) => url.replace(/&amp;/g, "&")).filter(Boolean))];
}

function isSafeHttpImageUrl(value) {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (PRIVATE_URL_PATTERN.test(parsed.hostname) || parsed.hostname.endsWith(".local")) return false;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.pathname && !IMAGE_EXT_PATTERN.test(parsed.pathname) && /\.[a-z0-9]{2,6}$/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizedWooHtml(html) {
  return sanitizeDescriptionText(html, { max: 120000 })
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<img\b([^>]*?)\bsrc\s*=\s*(["'])\s*javascript:[\s\S]*?\2([^>]*)>/gi, "")
    .replace(/<img\b([^>]*?)\bsrc\s*=\s*(["'])\s*data:[\s\S]*?\2([^>]*)>/gi, "");
}

function stripHtml(value) {
  return cleanText(
    String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|div|li|h[1-6]|tr|table)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "-")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function inferBrand(name) {
  const clean = stripHtml(name);
  const known = [
    "7Hz",
    "AFUL",
    "AKG",
    "BLON",
    "DUNU",
    "FiiO",
    "Fosi Audio",
    "HiFiMAN",
    "Hiby",
    "JCALLY",
    "Kefine",
    "Kiwi Ears",
    "Moondrop",
    "Philips",
    "SIMGOT",
    "SpinFit",
    "TANCHJIM",
    "TANGZU",
    "TRN",
    "TRUTHEAR",
    "Tripowin",
    "ZiiGaat",
  ];
  return known.find((brand) => clean.toLowerCase().startsWith(brand.toLowerCase())) || "";
}

function inferModel(name, brand) {
  const clean = stripHtml(name);
  if (!brand) return clean;
  return clean.replace(new RegExp(`^${escapeRegExp(brand)}\\s+`, "i"), "").trim() || clean;
}

function inferSourceUrl(row, images) {
  const url = images.find(Boolean) || "";
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

function value(row, aliases) {
  const key = field(row, aliases);
  return key ? String(row[key] || "").trim() : "";
}

function field(row, aliases) {
  return aliases.find((alias) => Object.prototype.hasOwnProperty.call(row, alias)) || "";
}

function productTitle(product) {
  return String(product?.name?.en || product?.nameEn || product?.title || product?.name || "").trim();
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeTitle(value) {
  return stripHtml(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return stripHtml(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product";
}

function fuzzyTitleScore(incomingTitle, currentTitle, incomingBrand = "", currentBrand = "") {
  const incoming = new Set(normalizeTitle(incomingTitle).split(" ").filter(Boolean));
  const current = new Set(normalizeTitle(currentTitle).split(" ").filter(Boolean));
  if (!incoming.size || !current.size) return 0;
  const overlap = [...incoming].filter((token) => current.has(token)).length;
  const score = (2 * overlap) / (incoming.size + current.size);
  const brandBoost = incomingBrand && currentBrand && normalizeKey(incomingBrand) === normalizeKey(currentBrand) ? 0.08 : 0;
  return Math.min(1, score + brandBoost);
}

function calculateRowConfidence({ name, galleryImages, description, categories, price, availability, brand }) {
  let score = 0.18;
  if (name) score += 0.18;
  if (brand) score += 0.1;
  if (galleryImages.length) score += 0.16;
  if (galleryImages.length >= 3) score += 0.08;
  if (description) score += 0.14;
  if (categories) score += 0.1;
  if (price) score += 0.08;
  if (availability) score += 0.06;
  return round2(Math.min(1, score));
}

function calculateImportQualityScore(product, warnings) {
  let score = 100;
  if (!product.image) score -= 18;
  if ((product.gallery || []).length < 3) score -= 8;
  if (!product.price) score -= 14;
  if (!product.category) score -= 14;
  if (!product.brand) score -= 8;
  if (!product.tagline?.en) score -= 7;
  if (!(product.specs || []).length) score -= 7;
  if (!(product.descriptionBlocks || []).length) score -= 5;
  if (warnings.some((warning) => warning.includes("unsafe_or_invalid_image"))) score -= 10;
  if (warnings.some((warning) => warning.includes("possible_match"))) score -= 18;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countBy(items, callback) {
  return items.reduce((counts, item) => {
    const key = callback(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function numberOrNull(value) {
  const text = String(value ?? "").replace(/[^\d.]/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 10);
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
