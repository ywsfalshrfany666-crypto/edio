import { classifyProductForCatalog } from "./productClassificationEngine.js";

export const BULK_CONFIDENCE_THRESHOLD = 0.75;

export const BULK_AVAILABILITY_STATES = new Set([
  "in_stock",
  "out_of_stock",
  "pre_order",
  "discontinued",
  "hidden",
]);

export const BULK_PRODUCT_STATUSES = new Set([
  "published",
  "draft",
  "needs_review",
  "hidden",
  "archived",
]);

export const CATEGORY_TERM_DEFINITIONS = {
  headphones: [
    {
      slug: "type-back",
      aliases: ["back-type"],
      children: [
        { slug: "closed-back", aliases: ["closed"] },
        { slug: "open-back", aliases: ["open"] },
      ],
    },
    {
      slug: "driver-configuration",
      aliases: ["driver", "driver-configuration-headphone"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic", "dynamic-driver-driver-configuration-headphone"] },
        { slug: "planar-driver", aliases: ["planar", "planar-driver-driver-configuration-headphone"] },
      ],
    },
  ],
  iems: [
    {
      slug: "driver-configuration",
      aliases: ["driver"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic"] },
        { slug: "planar-driver", aliases: ["planar"] },
        { slug: "balanced-armatures", aliases: ["ba", "balanced-armature"] },
        { slug: "hybrid-drivers", aliases: ["hybrid"] },
      ],
    },
    { slug: "wireless", aliases: ["tws", "true-wireless"] },
  ],
  dap: [
    { slug: "portable" },
    { slug: "bluetooth" },
  ],
  dac: [
    { slug: "portable", aliases: ["dongle"] },
    { slug: "desktop" },
    { slug: "bluetooth" },
  ],
  "audio-interface": [
    { slug: "desktop" },
    { slug: "portable" },
  ],
  mic: [
    { slug: "dynamic" },
    { slug: "condenser" },
  ],
  accessories: [
    { slug: "audio-cables", aliases: ["cables", "cable"] },
    { slug: "eartips", aliases: ["ear-tips", "ear-tips-tips"] },
    { slug: "cable-convertors", aliases: ["convertors", "converters", "adapters", "adaptors"] },
    { slug: "cases", aliases: ["case", "storage", "storage-boxes", "storage-boxes-cases"] },
  ],
};

const CATEGORY_ALIASES = {
  headphone: "headphones",
  headphones: "headphones",
  iem: "iems",
  iems: "iems",
  earphone: "iems",
  earphones: "iems",
  earbuds: "iems",
  dap: "dap",
  dac: "dac",
  amp: "dac",
  "dac-amp": "dac",
  microphone: "mic",
  microphones: "mic",
  mic: "mic",
  "audio-interface": "audio-interface",
  interface: "audio-interface",
  accessory: "accessories",
  accessories: "accessories",
  cable: "accessories",
  cables: "accessories",
};

export function slugifyBulk(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function keyifyBulk(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBulkCategory(value, existingCategories = []) {
  const key = keyifyBulk(value);
  const direct = CATEGORY_ALIASES[key] || key;
  const allowed = existingCategories.length ? existingCategories.map(keyifyBulk) : Object.keys(CATEGORY_TERM_DEFINITIONS);
  const match = allowed.find((category) => keyifyBulk(category) === keyifyBulk(direct));
  return match || "";
}

export function flattenBulkCategoryTerms(category, includeGroups = true) {
  const terms = CATEGORY_TERM_DEFINITIONS[category] || [];
  const flat = [];
  const visit = (term) => {
    if (includeGroups || !term.children?.length) flat.push(term);
    for (const child of term.children || []) visit(child);
  };
  for (const term of terms) visit(term);
  return flat;
}

export function resolveBulkCategoryTerm(category, value) {
  const requested = keyifyBulk(value);
  if (!requested) return null;
  return (
    flattenBulkCategoryTerms(category).find((term) =>
      [term.slug, ...(term.aliases || [])].map(keyifyBulk).includes(requested),
    ) || null
  );
}

function textOf(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return [...new Set([value.en, value.ar].filter(Boolean).map((entry) => String(entry).trim()))].join(" ");
}

function labelOf(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return [...new Set([value.en, value.ar].filter(Boolean).map((entry) => String(entry).trim()))].join(" ");
}

export function buildProductText(product) {
  return [
    product?.slug,
    product?.brand,
    textOf(product?.name),
    textOf(product?.tagline),
    product?.category,
    ...(product?.subCategories || []),
    ...(product?.features || []),
    ...(product?.specs || []).flatMap((spec) => [labelOf(spec.label), spec.value]),
    ...(product?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferCategoryFromProduct(product, existingCategories) {
  const direct = normalizeBulkCategory(product?.category, existingCategories);
  const text = buildProductText(product);
  const title = [textOf(product?.name), product?.slug].filter(Boolean).join(" ").toLowerCase();

  const matches = [];
  const add = (category, score, reason) => {
    if (normalizeBulkCategory(category, existingCategories)) matches.push({ category, score, reason });
  };

  if (/\b(audio interface|usb interface|recording interface|sound card|xlr interface|scarlett|volt|apollo)\b/.test(title)) {
    add("audio-interface", 0.94, "audio interface identity found in title");
  } else if (/\b(audio interface|usb interface|recording interface|sound card|xlr interface|scarlett|volt|apollo)\b/.test(text)) {
    add("audio-interface", 0.92, "audio interface keywords found");
  }
  if (/\b(dap|digital audio player|music player|hi-?res player|hiby|snowsky)\b/.test(title)) {
    add("dap", 0.93, "portable player identity found in title");
  } else if (/\b(dap|digital audio player|music player|hi-?res player|hiby|snowsky)\b/.test(text)) {
    add("dap", 0.9, "portable player keywords found");
  }
  if (/\b(microphone|podmic|sm7b|sm58|condenser mic|dynamic mic|usb microphone|xlr microphone)\b/.test(title)) {
    add("mic", 0.94, "microphone identity found in title");
  } else if (/\b(microphone|podmic|sm7b|sm58|condenser mic|dynamic mic|usb microphone|xlr microphone)\b/.test(text)) {
    add("mic", 0.91, "microphone keywords found");
  }
  if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(title)) {
    add("headphones", 0.91, "headphone identity found in title");
  } else if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(text)) {
    add("headphones", 0.86, "headphone keywords found");
  }
  if (/\b(iem|iems|in-ear monitor|in ear monitor|earphone|earphones|earbud|earbuds|tws)\b/.test(title)) {
    add("iems", 0.93, "IEM or earphone identity found in title");
  } else if (/\b(iem|iems|in-ear monitor|in ear monitor|earphone|earphones|earbud|earbuds|tws)\b/.test(text)) {
    add("iems", 0.9, "IEM or earphone keywords found");
  }
  if (/\b(dac|amp|amplifier|dongle|decoder|balanced out|line out|cs43131|ak4493|es9039)\b/.test(text)) {
    add("dac", 0.84, "DAC/AMP keywords found");
  }
  if (/\b(cable|cables|adapter|adaptor|eartip|eartips|ear tip|ear tips|case|pouch|storage|convertor|converter|mmcx|2-pin|0\.78mm)\b/.test(title)) {
    add("accessories", 0.92, "accessory identity found in title");
  } else if (/\b(cable|cables|adapter|adaptor|eartip|eartips|ear tip|ear tips|case|pouch|storage|convertor|converter|mmcx|2-pin|0\.78mm)\b/.test(text)) {
    add("accessories", 0.86, "accessory keywords found");
  }

  const best = matches.sort((a, b) => b.score - a.score)[0];
  if (direct && best && best.category !== direct && best.score < 0.92) {
    return { category: direct, score: 0.82, reason: "kept existing category because competing evidence was not strong enough" };
  }
  if (best) return best;
  if (direct) return { category: direct, score: 0.78, reason: "kept existing supported category" };
  return { category: "", score: 0.45, reason: "no reliable category evidence found" };
}

function inferSubCategories(product, category) {
  const text = buildProductText(product);
  const terms = new Set();
  const add = (value) => {
    const resolved = resolveBulkCategoryTerm(category, value);
    if (resolved) terms.add(resolved.slug);
  };

  if (category === "headphones") {
    if (/\bclosed[-\s]?back|sealed\b/.test(text)) add("closed-back");
    if (/\bopen[-\s]?back|open air\b/.test(text)) add("open-back");
    if (/\bplanar|orthodynamic\b/.test(text)) add("planar-driver");
    if (/\bdynamic driver|dynamic\b/.test(text)) add("dynamic-driver");
  }

  if (category === "iems") {
    if (/\bhybrid|tria?brid|quadbrid\b/.test(text)) add("hybrid-drivers");
    if (/\bbalanced armature|\bba\b/.test(text)) add("balanced-armatures");
    if (/\bplanar\b/.test(text)) add("planar-driver");
    if (/\bdynamic driver|single dd|dual dd|dynamic\b/.test(text)) add("dynamic-driver");
    if (/\btws|true wireless|bluetooth\b/.test(text)) add("wireless");
  }

  if (category === "mic") {
    if (/\bdynamic\b/.test(text)) add("dynamic");
    if (/\bcondenser|electret\b/.test(text)) add("condenser");
  }

  if (category === "accessories") {
    if (/\bcable|balanced cable|xlr|trs|mmcx|2-pin|0\.78mm\b/.test(text)) add("audio-cables");
    if (/\bear ?tips?|eartips?|silicone tips?|foam tips?\b/.test(text)) add("eartips");
    if (/\badapter|adaptor|convertor|converter|dongle\b/.test(text)) add("cable-convertors");
    if (/\bcase|pouch|storage|box\b/.test(text)) add("cases");
  }

  if (category === "dac" || category === "dap" || category === "audio-interface") {
    if (/\bportable|dongle|pocket|usb-c\b/.test(text)) add("portable");
    if (/\bdesktop|rack|studio\b/.test(text)) add("desktop");
    if (/\bbluetooth|bt\b/.test(text)) add("bluetooth");
  }

  return [...terms];
}

function inferTags(product, category, subCategories) {
  const tags = new Set([...(product.tags || [])].map(keyifyBulk).filter(Boolean));
  if (category) tags.add(category);
  for (const item of subCategories) tags.add(item);
  if (product.inStock) tags.add("available-now");
  if (product.badge === "preowned") tags.add("pre-owned");
  if (!Number(product.price || 0)) tags.add("missing-price");
  return [...tags].slice(0, 12);
}

export function classifyProductForBulk(product, context = {}) {
  const result = classifyProductForCatalog(product, context);
  const category = result.primary_category_slug || product.category || "";
  const subCategories = result.secondary_category_slugs.length ? result.secondary_category_slugs : product.subCategories || [];
  const needsReview = result.needs_review;
  const missingFields = [];
  if (!category) missingFields.push("category");
  if (!subCategories.length && ["headphones", "iems", "mic", "accessories"].includes(category)) missingFields.push("subcategory");

  return {
    category: category || product.category || "",
    subCategories: subCategories.length ? subCategories : (product.subCategories || []),
    tags: inferTags(product, category || product.category, subCategories.length ? subCategories : product.subCategories || []),
    confidence_score: result.confidence_score,
    reason: result.classification_reason,
    needs_review: needsReview,
    missing_fields: missingFields,
    categoryAssignment: result,
  };
}

export function getProductQualityFlags(product) {
  const flags = [];
  if (!textOf(product.name).trim()) flags.push("missing_name");
  if (!String(product.brand || "").trim()) flags.push("missing_brand");
  if (!String(product.category || "").trim()) flags.push("missing_category");
  if (!Array.isArray(product.subCategories) || product.subCategories.length === 0) flags.push("missing_subcategory");
  if (!String(product.image || "").trim()) flags.push("missing_image");
  if (!Number(product.price || 0)) flags.push("missing_price");
  if (!Array.isArray(product.specs) || product.specs.length === 0) flags.push("missing_specs");
  if (!String(product.slug || "").trim()) flags.push("missing_slug");
  if (!product.seo?.metaTitle) flags.push("missing_meta_title");
  if (!product.seo?.metaDescription) flags.push("missing_meta_description");
  if (product.needsReview) flags.push("needs_review");
  return flags;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(", ") || "none";
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value === undefined || value === null || value === "") return "none";
  return String(value);
}

function makePreviewRow(product, action, currentValue, proposedValue, confidence, reason, changes = {}, extra = {}) {
  const threshold = Number(extra.threshold ?? BULK_CONFIDENCE_THRESHOLD);
  const blocked = confidence < threshold || Boolean(extra.blocked);
  return {
    id: product.id,
    product: {
      id: product.id,
      slug: product.slug,
      name: textOf(product.name) || product.slug || product.id,
      brand: product.brand || "",
      image: product.image || "",
    },
    action,
    current_value: displayValue(currentValue),
    proposed_value: displayValue(proposedValue),
    confidence: Number(confidence.toFixed(2)),
    reason,
    safe: !blocked,
    needs_review: Boolean(extra.needsReview || blocked),
    changes,
    warnings: extra.warnings || [],
  };
}

function buildSeo(product) {
  const title = textOf(product.name) || product.slug || "audio product";
  const brand = product.brand ? `${product.brand} ` : "";
  const category = product.category ? ` ${product.category}` : "";
  return {
    metaTitle: `${brand}${title}`.slice(0, 68),
    metaDescription: `${title} من Edio. صفحة مختصرة للمنتج مع السعر، التوفر، المواصفات، والصور الواضحة.`.slice(0, 155),
    keywords: [product.brand, product.category, ...(product.subCategories || []), title]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .slice(0, 10),
  };
}

function previewAvailability(product, options, threshold) {
  const availability = String(options.availability || "").trim();
  const valid = BULK_AVAILABILITY_STATES.has(availability);
  const current = product.availabilityStatus || (product.inStock ? "in_stock" : "out_of_stock");
  const changes = valid
    ? {
        availabilityStatus: availability,
        inStock: availability === "in_stock",
        ...(availability === "in_stock" ? { stock: Math.max(1, Number(product.stock || 0)) } : {}),
        ...(availability !== "in_stock" ? { stock: 0 } : {}),
      }
    : {};
  return makePreviewRow(
    product,
    "update_availability",
    current,
    valid ? availability : "invalid availability",
    valid ? 1 : 0.2,
    valid ? "Availability state is explicit." : "Choose a supported availability state.",
    changes,
    { threshold, blocked: !valid },
  );
}

function previewStatus(product, options, threshold) {
  const status = String(options.status || "").trim();
  const valid = BULK_PRODUCT_STATUSES.has(status);
  return makePreviewRow(
    product,
    "update_status",
    product.status || "published",
    valid ? status : "invalid status",
    valid ? 1 : 0.2,
    valid ? "Status state is explicit." : "Choose a supported product status.",
    valid ? { status, needsReview: status === "needs_review" } : {},
    { threshold, blocked: !valid, needsReview: status === "needs_review" },
  );
}

function previewCategoryAssignment(product, options, context, threshold) {
  const category = normalizeBulkCategory(options.category, context.existingCategories || []);
  const term = options.subcategory ? resolveBulkCategoryTerm(category, options.subcategory) : null;
  const valid = Boolean(category) && (!options.subcategory || Boolean(term));
  const nextSubCategories = term ? [term.slug] : product.subCategories || [];
  return makePreviewRow(
    product,
    "assign_category",
    { category: product.category, subCategories: product.subCategories || [] },
    valid ? { category, subCategories: nextSubCategories } : "invalid category",
    valid ? 0.94 : 0.35,
    valid
      ? "Category exists in the current EDIO taxonomy."
      : "This category or subcategory is not part of the current taxonomy.",
    valid ? { category, subCategories: nextSubCategories, needsReview: false } : {},
    { threshold, blocked: !valid },
  );
}

function previewSubcategoryAssignment(product, options, threshold) {
  const category = normalizeBulkCategory(options.category || product.category, Object.keys(CATEGORY_TERM_DEFINITIONS));
  const term = resolveBulkCategoryTerm(category, options.subcategory || options.term);
  const current = product.subCategories || [];
  const next = term ? Array.from(new Set([...current, term.slug])) : current;
  return makePreviewRow(
    product,
    "assign_subcategory",
    current,
    term ? next : "invalid subcategory",
    term ? 0.9 : 0.32,
    term ? "Subcategory exists under the selected category." : "No matching existing child category was found.",
    term ? { subCategories: next, needsReview: false } : {},
    { threshold, blocked: !term },
  );
}

function previewTagChange(product, action, options, threshold) {
  const rawTags = Array.isArray(options.tags) ? options.tags : String(options.tags || "").split(",");
  const tags = rawTags.map(keyifyBulk).filter(Boolean);
  const current = Array.isArray(product.tags) ? product.tags : [];
  const next =
    action === "add_tags"
      ? Array.from(new Set([...current, ...tags]))
      : current.filter((tag) => !tags.includes(keyifyBulk(tag)));
  const valid = tags.length > 0;
  return makePreviewRow(
    product,
    action,
    current,
    valid ? next : "no tags supplied",
    valid ? 0.95 : 0.25,
    valid ? "Tags are explicit admin input." : "Add at least one tag.",
    valid ? { tags: next } : {},
    { threshold, blocked: !valid },
  );
}

function previewReclassify(product, context, threshold) {
  const classification = classifyProductForBulk(product, context);
  return makePreviewRow(
    product,
    "reclassify",
    { category: product.category, subCategories: product.subCategories || [] },
    {
      category: classification.category,
      subCategories: classification.subCategories,
      tags: classification.tags,
      categoryAssignment: classification.categoryAssignment,
    },
    classification.confidence_score,
    classification.reason,
    {
      category: classification.category,
      subCategories: classification.subCategories,
      tags: classification.tags,
      confidenceScore: classification.confidence_score,
      needsReview: classification.needs_review,
      categoryAssignment: classification.categoryAssignment,
    },
    { threshold, needsReview: classification.needs_review },
  );
}

function previewFixMissingFields(product, threshold) {
  const flags = getProductQualityFlags(product);
  const changes = {};
  if (flags.includes("missing_slug")) changes.slug = slugifyBulk(textOf(product.name) || product.id);
  if (flags.includes("missing_meta_title") || flags.includes("missing_meta_description")) changes.seo = buildSeo(product);
  if (flags.includes("missing_image")) changes.needsReview = true;
  if (flags.includes("missing_brand") || flags.includes("missing_category") || flags.includes("missing_price") || flags.includes("missing_specs")) {
    changes.needsReview = true;
  }
  const confidence = flags.length ? 0.84 : 0.96;
  return makePreviewRow(
    product,
    "fix_missing_fields",
    flags,
    Object.keys(changes).length ? changes : "no cleanup needed",
    confidence,
    flags.length ? "Safe automatic cleanup is limited to slugs, SEO, and review flags." : "No obvious cleanup issues were found.",
    changes,
    { threshold, needsReview: Boolean(changes.needsReview), warnings: flags },
  );
}

function previewGenerateSeo(product, threshold) {
  return makePreviewRow(
    product,
    "generate_seo",
    product.seo || "none",
    buildSeo(product),
    0.92,
    "SEO text is generated from the current product name, brand, category, and terms.",
    { seo: buildSeo(product) },
    { threshold },
  );
}

function previewNormalizeImages(product, threshold) {
  const image = String(product.image || "").trim();
  const transparentHint = /\.(png)(?:[?#]|$)/i.test(image) || /transparent/i.test(image);
  const hasImage = Boolean(image);
  const normalizedImageUrl = hasImage ? product.normalizedImageUrl || image : "";
  return makePreviewRow(
    product,
    "normalize_images",
    product.normalizedImageUrl || product.image || "none",
    hasImage ? normalizedImageUrl : "missing image",
    hasImage ? (transparentHint ? 0.92 : 0.82) : 0.2,
    hasImage
      ? transparentHint
        ? "PNG or transparent-looking product image should be rendered on pure white."
        : "Product image will be marked as normalized and displayed with object-fit contain."
      : "No image exists to normalize.",
    hasImage
      ? {
          normalizedImageUrl,
          imageProcessing: {
            background: "#FFFFFF",
            objectFit: "contain",
            shadow: false,
            gradient: false,
          },
        }
      : {},
    { threshold, blocked: !hasImage },
  );
}

export function buildBulkPreview(products, body = {}, context = {}) {
  const action = String(body.action || "").trim();
  const options = body.options || {};
  const threshold = Number(options.confidence_threshold ?? BULK_CONFIDENCE_THRESHOLD);
  const preview = products.map((product) => {
    switch (action) {
      case "update_availability":
        return previewAvailability(product, options, threshold);
      case "update_status":
        return previewStatus(product, options, threshold);
      case "assign_category":
        return previewCategoryAssignment(product, options, context, threshold);
      case "assign_subcategory":
        return previewSubcategoryAssignment(product, options, threshold);
      case "add_tags":
      case "remove_tags":
        return previewTagChange(product, action, options, threshold);
      case "mark_featured":
        return makePreviewRow(product, action, product.badge || "none", "featured", 1, "Featured badge is explicit.", { storedBadge: "featured", badge: "featured" }, { threshold });
      case "unmark_featured":
        return makePreviewRow(product, action, product.badge || "none", "none", 1, "Featured badge will be removed only when it is currently featured.", { storedBadge: product.badge === "featured" ? null : product.storedBadge || product.badge || null, badge: product.badge === "featured" ? null : product.badge || null }, { threshold });
      case "reclassify":
        return previewReclassify(product, context, threshold);
      case "refresh_product_data":
        return makePreviewRow(product, action, product.updatedAt || "unknown", "queued for manual refresh", 0.78, "The product is marked for data refresh without inventing specs.", { needsReview: true, refreshRequestedAt: context.now || new Date().toISOString() }, { threshold, needsReview: true });
      case "fix_missing_fields":
        return previewFixMissingFields(product, threshold);
      case "generate_seo":
        return previewGenerateSeo(product, threshold);
      case "normalize_images":
        return previewNormalizeImages(product, threshold);
      case "delete":
        return makePreviewRow(product, action, "existing product", "delete selected product", 1, "Delete is destructive and requires explicit confirmation.", {}, { threshold, warnings: ["destructive_action"] });
      case "export_selected":
        return makePreviewRow(product, action, "catalog product", "included in export", 1, "Selected product will be included in the export payload.", {}, { threshold });
      default:
        return makePreviewRow(product, action || "unknown", "none", "unsupported action", 0.1, "Unsupported bulk action.", {}, { threshold, blocked: true });
    }
  });

  return {
    action,
    threshold,
    selected_count: products.length,
    safe_count: preview.filter((row) => row.safe).length,
    blocked_count: preview.filter((row) => !row.safe).length,
    preview,
  };
}

export function applyPreviewChangesToProduct(product, row, now) {
  if (!row?.safe || !row.changes || row.action === "delete" || row.action === "export_selected") return false;
  Object.assign(product, row.changes);
  product.lastBulkActionAt = now;
  product.updatedAt = now;
  return true;
}
