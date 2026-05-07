import crypto from "node:crypto";
import path from "node:path";

export const MEDIA_PIPELINE_VERSION = "edio-media-pipeline.v1";

export const MEDIA_SOURCE_WEIGHTS = {
  official: 1,
  manual: 0.98,
  structured_data: 0.94,
  retailer: 0.86,
  internal: 0.78,
  upload: 0.76,
  community: 0.45,
  unknown: 0.35,
};

export const MEDIA_DERIVATIVE_TARGETS = {
  thumbnail: { width: 320, height: 320, fit: "contain", background: "#FFFFFF" },
  card: { width: 720, height: 720, fit: "contain", background: "#FFFFFF" },
  pdp: { width: 1200, height: 1200, fit: "contain", background: "#FFFFFF" },
  gallery: { width: 1500, height: 1500, fit: "contain", background: "#FFFFFF" },
  master: { preserveQuality: true },
};

const HERO_FILENAME_HINTS = ["hero", "main", "primary", "front", "product", "01", "angle"];
const NOISY_FILENAME_HINTS = ["logo", "icon", "banner", "review", "youtube", "avatar", "sprite", "loader", "placeholder"];
const SOURCE_IMAGE_KEYS = [
  "image",
  "mainImage",
  "main_image",
  "primaryImage",
  "primary_image",
  "images",
  "imageUrls",
  "image_urls",
  "gallery",
  "media",
  "imageCandidates",
  "image_candidates",
  "descriptionImages",
  "description_images",
  "specImages",
  "spec_images",
  "featureImages",
  "feature_images",
  "comparisonImages",
  "comparison_images",
  "diagramImages",
  "diagram_images",
];

const SOURCE_IMAGE_KEY_ROLES = {
  descriptionImages: "description",
  description_images: "description",
  specImages: "spec_image",
  spec_images: "spec_image",
  featureImages: "feature",
  feature_images: "feature",
  comparisonImages: "comparison",
  comparison_images: "comparison",
  diagramImages: "diagram",
  diagram_images: "diagram",
};

const DESCRIPTION_MEDIA_ROLES = new Set(["description", "feature", "spec_image", "comparison", "diagram"]);

export function checksumBuffer(buffer, algorithm = "sha256") {
  return crypto.createHash(algorithm).update(buffer).digest("hex");
}

export function stableImageUrlKey(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://edio.local");
    parsed.hash = "";
    parsed.search = "";
    const decoded = decodeURIComponent(parsed.pathname)
      .toLowerCase()
      .replace(/(@2x|_large|_small|_medium|_thumb|_thumbnail|_master|_grande)/g, "")
      .replace(/[-_](\d{2,5})x(\d{2,5})(?=\.)/g, "")
      .replace(/\.(webp|avif|jpe?g|png|gif|svg)$/i, "");
    return `${parsed.hostname.toLowerCase()}${decoded}`;
  } catch {
    return raw
      .toLowerCase()
      .split("?")[0]
      .replace(/(@2x|_large|_small|_medium|_thumb|_thumbnail|_master|_grande)/g, "")
      .replace(/[-_](\d{2,5})x(\d{2,5})(?=\.)/g, "")
      .replace(/\.(webp|avif|jpe?g|png|gif|svg)$/i, "");
  }
}

export function buildPerceptualImageKey({ url = "", filename = "", width = null, height = null } = {}) {
  const source = filename || url;
  const base = path
    .basename(String(source || "image").split("?")[0])
    .toLowerCase()
    .replace(/\.(webp|avif|jpe?g|png|gif|svg)$/i, "")
    .replace(/(@2x|_large|_small|_medium|_thumb|_thumbnail|_master|_grande)/g, "")
    .replace(/[-_](\d{2,5})x(\d{2,5})/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const aspect =
    Number.isFinite(numericWidth) && Number.isFinite(numericHeight) && numericWidth > 0 && numericHeight > 0
      ? Math.round((numericWidth / numericHeight) * 10) / 10
      : "unknown";
  return `${stableImageUrlKey(url) || base}:${aspect}`;
}

export function normalizeAssetCandidate(input = {}, context = {}) {
  const now = context.now || new Date().toISOString();
  const sourceType = normalizeSourceType(input.sourceType || input.source_type || context.sourceType || "unknown");
  const sourcePriority = clamp01(Number(input.sourcePriority ?? input.source_priority ?? MEDIA_SOURCE_WEIGHTS[sourceType] ?? 0.35));
  const metadata = input.metadata || {};
  const filename = input.filename || inferFilename(input.storedUrl || input.url || input.sourceUrl || "");
  const checksum = input.checksum || input.sha256 || "";
  const candidate = {
    id: input.id || `asset_candidate_${checksum ? checksum.slice(0, 16) : shortHash(`${input.url || ""}:${now}`)}`,
    productId: input.productId || context.productId || null,
    url: input.url || input.storedUrl || "",
    storedUrl: input.storedUrl || input.url || "",
    sourceUrl: input.sourceUrl || input.source_url || input.url || "",
    sourceType,
    sourcePriority,
    role: normalizeRole(input.role || input.desiredRole || "gallery"),
    filename,
    checksum,
    perceptualHash: input.perceptualHash || buildPerceptualImageKey({ url: input.sourceUrl || input.url, filename, ...metadata }),
    metadata: {
      width: numberOrNull(metadata.width),
      height: numberOrNull(metadata.height),
      format: metadata.format || input.format || "",
      transparent: Boolean(metadata.transparent || input.transparent),
      contentType: metadata.contentType || input.contentType || "",
      byteSize: numberOrNull(metadata.byteSize ?? input.byteSize ?? input.size),
    },
    derivatives: input.derivatives || buildDerivativeManifest(input.storedUrl || input.url || ""),
    provenance: {
      sourceType,
      sourceUrl: input.sourceUrl || input.source_url || "",
      pageUrl: input.pageUrl || input.page_url || context.pageUrl || "",
      importJobId: input.importJobId || context.importJobId || null,
    },
    quality: input.quality || { score: 0, confidence: 0, reasons: [] },
    status: input.status || "candidate",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
  return candidate;
}

export function collectImageCandidatesFromSources(input = {}, context = {}) {
  const candidates = [];
  const seenRawKeys = new Set();
  const now = context.now || new Date().toISOString();

  const addCandidate = (value, defaults = {}) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => addCandidate(item, { ...defaults, index }));
      return;
    }

    const sourceType = normalizeSourceType(defaults.sourceType || context.sourceType || "unknown");
    const candidate =
      typeof value === "string"
        ? {
            url: value,
            sourceUrl: value,
          }
        : {
            ...value,
          };

    const rawUrl =
      candidate.url ||
      candidate.storedUrl ||
      candidate.sourceUrl ||
      candidate.src ||
      candidate.href ||
      candidate.contentUrl ||
      candidate.thumbnailUrl ||
      candidate.image_url ||
      "";
    if (!rawUrl) return;

    const rawKey = `${sourceType}:${String(rawUrl).trim()}:${defaults.role || candidate.role || ""}`;
    if (seenRawKeys.has(rawKey)) return;
    seenRawKeys.add(rawKey);

    const role =
      defaults.role ||
      candidate.role ||
      candidate.type ||
      (defaults.index === 0 && defaults.explicitPrimary ? "main" : "gallery");
    const pageUrl =
      candidate.pageUrl ||
      candidate.page_url ||
      defaults.pageUrl ||
      context.pageUrl ||
      defaults.sourceUrl ||
      context.sourceUrl ||
      "";

    candidates.push(
      normalizeAssetCandidate(
        {
          ...candidate,
          id: candidate.id,
          productId: candidate.productId || context.productId || null,
          url: rawUrl,
          storedUrl: candidate.storedUrl || "",
          sourceUrl: candidate.sourceUrl || candidate.source_url || rawUrl,
          pageUrl,
          sourceType: candidate.sourceType || candidate.source_type || sourceType,
          sourcePriority:
            candidate.sourcePriority ??
            candidate.source_priority ??
            defaults.sourcePriority ??
            MEDIA_SOURCE_WEIGHTS[sourceType],
          role,
          metadata: {
            ...(candidate.metadata || {}),
            width: candidate.width ?? candidate.metadata?.width,
            height: candidate.height ?? candidate.metadata?.height,
            format: candidate.format ?? candidate.metadata?.format,
            transparent: candidate.transparent ?? candidate.metadata?.transparent,
            contentType: candidate.contentType ?? candidate.content_type ?? candidate.metadata?.contentType,
            byteSize: candidate.byteSize ?? candidate.size ?? candidate.metadata?.byteSize,
          },
          importJobId: candidate.importJobId || context.importJobId || null,
          createdAt: candidate.createdAt || now,
          updatedAt: candidate.updatedAt || now,
        },
        { ...context, sourceType, pageUrl, now },
      ),
    );
  };

  for (const key of SOURCE_IMAGE_KEYS) {
    const value = input?.[key];
    if (value) {
      addCandidate(value, {
        sourceType: context.sourceType || input.sourceType || input.source_type || "unknown",
        sourceUrl: input.sourceUrl || input.source_url || input.url || "",
        pageUrl: input.pageUrl || input.page_url || input.sourceUrl || input.url || "",
        explicitPrimary: ["image", "mainImage", "main_image", "primaryImage", "primary_image"].includes(key),
        role: ["image", "mainImage", "main_image", "primaryImage", "primary_image"].includes(key)
          ? "main"
          : SOURCE_IMAGE_KEY_ROLES[key],
      });
    }
  }

  const structuredData = input.structuredData || input.structured_data || input.jsonLd || input.json_ld;
  if (structuredData) {
    addCandidate(structuredData.image || structuredData.images, {
      sourceType: "structured_data",
      sourceUrl: input.sourceUrl || input.source_url || input.url || "",
      pageUrl: input.pageUrl || input.page_url || input.sourceUrl || input.url || "",
      explicitPrimary: true,
    });
  }

  const sources = Array.isArray(input.sources) ? input.sources : [];
  for (const [sourceIndex, source] of sources.entries()) {
    if (!source) continue;
    const sourceType = normalizeSourceType(source.sourceType || source.source_type || source.type || "unknown");
    const pageUrl = source.pageUrl || source.page_url || source.sourceUrl || source.source_url || source.url || "";
    for (const key of SOURCE_IMAGE_KEYS) {
      const value = source[key];
      if (!value) continue;
      addCandidate(value, {
        sourceType,
        sourcePriority: source.sourcePriority ?? source.source_priority ?? MEDIA_SOURCE_WEIGHTS[sourceType],
        sourceUrl: source.sourceUrl || source.source_url || source.url || "",
        pageUrl,
        explicitPrimary: ["image", "mainImage", "main_image", "primaryImage", "primary_image"].includes(key),
        role: ["image", "mainImage", "main_image", "primaryImage", "primary_image"].includes(key)
          ? "main"
          : SOURCE_IMAGE_KEY_ROLES[key],
        index: sourceIndex,
      });
    }
    const sourceStructured = source.structuredData || source.structured_data || source.jsonLd || source.json_ld;
    if (sourceStructured) {
      addCandidate(sourceStructured.image || sourceStructured.images, {
        sourceType: "structured_data",
        sourcePriority: MEDIA_SOURCE_WEIGHTS.structured_data,
        sourceUrl: source.sourceUrl || source.source_url || source.url || "",
        pageUrl,
        explicitPrimary: true,
      });
    }
  }

  return candidates;
}

export function dedupeAssetCandidates(candidates = []) {
  const events = [];
  const byExact = new Map();
  const byNear = new Map();

  for (const original of candidates.map((candidate) => normalizeAssetCandidate(candidate))) {
    const exactKey = original.checksum || String(original.storedUrl || original.url || original.sourceUrl || "").split("#")[0];
    if (exactKey && byExact.has(exactKey)) {
      const kept = chooseBetterCandidate(byExact.get(exactKey), original);
      const dropped = kept === original ? byExact.get(exactKey) : original;
      byExact.set(exactKey, kept);
      events.push(buildDedupeEvent("exact_duplicate", kept, dropped));
      continue;
    }
    if (exactKey) byExact.set(exactKey, original);
  }

  for (const candidate of byExact.values()) {
    const nearKey = candidate.perceptualHash || buildPerceptualImageKey(candidate);
    if (nearKey && byNear.has(nearKey)) {
      const kept = chooseBetterCandidate(byNear.get(nearKey), candidate);
      const dropped = kept === candidate ? byNear.get(nearKey) : candidate;
      byNear.set(nearKey, kept);
      events.push(buildDedupeEvent("near_duplicate", kept, dropped));
      continue;
    }
    if (nearKey) byNear.set(nearKey, candidate);
  }

  return { candidates: [...byNear.values()], events };
}

export function scoreHeroCandidate(candidate = {}, product = {}) {
  const normalized = normalizeAssetCandidate(candidate);
  const reasons = [];
  let score = 0.18;

  score += normalized.sourcePriority * 0.22;
  reasons.push(`source_${normalized.sourceType}`);

  if (["main", "hero", "primary"].includes(normalized.role)) {
    score += 0.22;
    reasons.push("explicit_primary_role");
  }

  const filename = String(normalized.filename || normalized.sourceUrl || "").toLowerCase();
  if (HERO_FILENAME_HINTS.some((hint) => filename.includes(hint))) {
    score += 0.1;
    reasons.push("hero_filename_hint");
  }
  if (NOISY_FILENAME_HINTS.some((hint) => filename.includes(hint))) {
    score -= 0.22;
    reasons.push("noisy_filename_penalty");
  }

  const width = Number(normalized.metadata.width);
  const height = Number(normalized.metadata.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const longSide = Math.max(width, height);
    const aspect = width / height;
    if (longSide >= 1400) {
      score += 0.14;
      reasons.push("high_resolution");
    } else if (longSide >= 900) {
      score += 0.09;
      reasons.push("storefront_resolution");
    } else if (longSide < 500) {
      score -= 0.2;
      reasons.push("low_resolution_penalty");
    }
    if (aspect >= 0.75 && aspect <= 1.4) {
      score += 0.12;
      reasons.push("square_friendly_aspect");
    } else if (aspect >= 0.55 && aspect <= 1.8) {
      score += 0.04;
      reasons.push("usable_aspect");
    } else {
      score -= 0.12;
      reasons.push("awkward_aspect_penalty");
    }
  } else {
    reasons.push("metadata_incomplete");
  }

  const productTokens = productNameTokens(product);
  const sourceText = `${normalized.filename} ${normalized.sourceUrl}`.toLowerCase();
  const matchedTokens = productTokens.filter((token) => sourceText.includes(token));
  if (matchedTokens.length >= Math.min(2, productTokens.length)) {
    score += 0.08;
    reasons.push("product_name_match");
  }

  const confidence = clamp01(score);
  return {
    score: confidence,
    confidence,
    reasons,
  };
}

export function buildProductMediaSet(rawCandidates = [], product = {}, options = {}) {
  const normalized = rawCandidates.map((candidate) => normalizeAssetCandidate(candidate, options));
  const deduped = dedupeAssetCandidates(normalized);
  const scored = deduped.candidates
    .map((candidate) => {
      const quality = scoreHeroCandidate(candidate, product);
      return {
        ...candidate,
        quality,
        updatedAt: options.now || new Date().toISOString(),
      };
    })
    .sort((a, b) => b.quality.score - a.quality.score);

  const hero = scored.find((candidate) => isHeroEligibleRole(candidate.role)) || null;
  const media = scored.map((candidate, index) => {
    const isSelectedHero = Boolean(hero && candidate.id === hero.id);
    const metadata = buildImageMetadata(product, candidate, isSelectedHero ? "main" : candidate.role);
    return {
      ...candidate,
      role: isSelectedHero ? "main" : normalizeRole(candidate.role === "main" ? "gallery" : candidate.role),
      sortOrder: index,
      altText: candidate.altText || metadata.altText,
      title: candidate.title || metadata.title,
      status: isSelectedHero ? "selected_hero" : DESCRIPTION_MEDIA_ROLES.has(candidate.role) ? "selected_description_media" : "selected_gallery",
    };
  });

  return {
    hero,
    media,
    events: deduped.events,
    summary: {
      inputCount: rawCandidates.length,
      dedupedCount: deduped.candidates.length,
      selectedHeroId: hero?.id || null,
      selectedHeroScore: hero?.quality?.score || 0,
      selectedHeroReasons: hero?.quality?.reasons || [],
    },
  };
}

export function buildImageMetadata(product = {}, candidate = {}, role = "gallery") {
  const brand = String(product.brand || "").trim();
  const name = resolveProductName(product);
  const category = String(product.category || "").trim();
  const view = inferImageView(candidate);
  const parts = [brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? brand : "", name].filter(Boolean);
  const label = [...new Set(parts)].join(" ").trim() || name;
  const viewText = view && view !== "product" ? ` ${view}` : "";
  return {
    altText: `${label}${viewText}${category ? ` ${category}` : ""}`.replace(/\s+/g, " ").slice(0, 140),
    title: `${label}${role === "main" ? " main image" : " gallery image"}`.replace(/\s+/g, " ").slice(0, 120),
  };
}

export function buildImportMediaJob({
  productId = null,
  mode = "media_recompute",
  input = null,
  sourceUrl = null,
  idempotencyKey = null,
} = {}) {
  const now = new Date().toISOString();
  const stableKey = idempotencyKey || `${productId || "catalog"}:${mode}:${input || sourceUrl || ""}`;
  return {
    id: `media_job_${shortHash(stableKey)}`,
    version: MEDIA_PIPELINE_VERSION,
    productId,
    mode,
    input,
    sourceUrl,
    idempotencyKey: stableKey,
    status: "running",
    attempts: 0,
    summary: {},
    errors: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export async function retryWithBackoff(operation, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
  const baseMs = Math.max(1, Number(options.baseMs || 250));
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || (options.shouldRetry && !options.shouldRetry(error))) break;
      const retryAfterMs = Number(error?.retryAfterMs || 0);
      const jitter = Math.floor(Math.random() * Math.min(100, baseMs));
      const delay = retryAfterMs > 0 ? retryAfterMs : baseMs * 2 ** (attempt - 1) + jitter;
      await sleep(delay);
    }
  }
  throw lastError;
}

function buildDerivativeManifest(url) {
  if (!url) return {};
  return Object.fromEntries(
    Object.entries(MEDIA_DERIVATIVE_TARGETS).map(([key, target]) => [
      key,
      {
        url,
        ...target,
        generated: key === "master" ? true : false,
        pendingDerivative: key !== "master",
      },
    ]),
  );
}

function buildDedupeEvent(type, kept, dropped) {
  return {
    type,
    keptId: kept.id,
    droppedId: dropped.id,
    keptUrl: kept.storedUrl || kept.url,
    droppedUrl: dropped.storedUrl || dropped.url,
    createdAt: new Date().toISOString(),
  };
}

function chooseBetterCandidate(a, b) {
  return candidateQualityBasis(b) > candidateQualityBasis(a) ? b : a;
}

function candidateQualityBasis(candidate) {
  const width = Number(candidate?.metadata?.width || 0);
  const height = Number(candidate?.metadata?.height || 0);
  const pixels = width * height;
  return (Number(candidate?.sourcePriority || 0) * 1_000_000) + pixels + (candidate?.role === "main" ? 500_000 : 0);
}

function productNameTokens(product) {
  return `${product.brand || ""} ${resolveProductName(product)} ${product.model || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function resolveProductName(product = {}) {
  const raw = product.nameEn || product.title || product.model || product.name;
  if (typeof raw === "string") return raw.trim() || "Product";
  if (raw && typeof raw === "object") {
    return String(raw.en || raw.ar || raw.label || raw.value || product.model || "Product").trim() || "Product";
  }
  return "Product";
}

function inferImageView(candidate = {}) {
  const text = `${candidate.filename || ""} ${candidate.sourceUrl || ""}`.toLowerCase();
  if (text.includes("front")) return "front view";
  if (text.includes("back")) return "back view";
  if (text.includes("side")) return "side view";
  if (text.includes("package") || text.includes("box")) return "package view";
  if (text.includes("port") || text.includes("io")) return "ports view";
  return "product";
}

function inferFilename(url = "") {
  try {
    return path.basename(new URL(String(url), "https://edio.local").pathname) || "product-image";
  } catch {
    return path.basename(String(url || "product-image").split("?")[0]) || "product-image";
  }
}

function normalizeSourceType(value) {
  const sourceType = String(value || "unknown").toLowerCase();
  return MEDIA_SOURCE_WEIGHTS[sourceType] ? sourceType : "unknown";
}

function normalizeRole(value) {
  const role = String(value || "gallery").toLowerCase();
  if (["hero", "main", "primary", "cover"].includes(role)) return "main";
  if (["ports", "package", "lifestyle", "gallery"].includes(role)) return role;
  if (["description", "description_image", "detail"].includes(role)) return "description";
  if (["feature", "infographic"].includes(role)) return "feature";
  if (["spec", "specs", "spec_image", "technical", "chart"].includes(role)) return "spec_image";
  if (["comparison", "compare"].includes(role)) return "comparison";
  if (["diagram", "schematic"].includes(role)) return "diagram";
  return "gallery";
}

function isHeroEligibleRole(role) {
  return !DESCRIPTION_MEDIA_ROLES.has(normalizeRole(role));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}
