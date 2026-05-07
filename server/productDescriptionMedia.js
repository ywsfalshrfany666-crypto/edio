import crypto from "node:crypto";

const DESCRIPTION_ROLE_HINTS = {
  spec_image: [
    "spec",
    "specification",
    "technical",
    "parameter",
    "chart",
    "frequency",
    "response",
    "measurement",
    "driver",
    "table",
  ],
  box_image: ["box", "package", "included", "contents", "accessories included", "inside the box", "what's in the box"],
  comparison: ["compare", "comparison", "versus", "vs"],
  diagram: ["diagram", "structure", "exploded", "layout", "circuit"],
  feature: ["feature", "design", "technology", "benefit", "highlight"],
  description: ["description", "detail", "intro", "story", "overview", "infographic"],
};

const ROLE_TO_BLOCK_TYPE = {
  spec_image: "spec_image",
  box_image: "image",
  comparison: "spec_image",
  diagram: "spec_image",
  feature: "image",
  description: "image",
  unknown_description_image: "image",
  unknown: "image",
};

export function sanitizeDescriptionText(value, { max = 5000 } = {}) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\bjavascript\s*:/gi, "")
    .trim()
    .slice(0, max);
}

export function extractDescriptionImageCandidatesFromHtml(html = "", context = {}) {
  const cleanHtml = sanitizeDescriptionText(html, { max: 120000 });
  const candidates = [];
  const imagePattern = /<img\b[^>]*>/gi;
  let match;
  let index = 0;

  while ((match = imagePattern.exec(cleanHtml))) {
    const tag = match[0];
    const url =
      readHtmlAttribute(tag, "src") ||
      readHtmlAttribute(tag, "data-src") ||
      readHtmlAttribute(tag, "data-original") ||
      readFirstSrcsetUrl(readHtmlAttribute(tag, "srcset") || readHtmlAttribute(tag, "data-srcset"));
    if (!isSafePublicImageUrl(url)) continue;
    const alt = readHtmlAttribute(tag, "alt") || readHtmlAttribute(tag, "title") || "";
    const width = numberOrNull(readHtmlAttribute(tag, "width"));
    const height = numberOrNull(readHtmlAttribute(tag, "height"));
    const nearbyText = cleanHtml.slice(Math.max(0, match.index - 700), Math.min(cleanHtml.length, match.index + tag.length + 700));

    candidates.push({
      url,
      alt,
      width,
      height,
      role: "description",
      source_type: context.sourceType || "retailer",
      source_url: context.sourceUrl || "",
      section_text: nearbyText,
      sort_order: index,
    });
    index += 1;
  }

  return candidates;
}

export function classifyDescriptionImageCandidate(candidate = {}, context = {}) {
  const text = [
    candidate.role,
    candidate.type,
    candidate.url,
    candidate.alt,
    candidate.caption,
    candidate.section_text,
    context.section,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let role = normalizeDescriptionImageRole(candidate.role || candidate.type);
  let confidence = role === "unknown" ? 0.52 : 0.72;
  const reasons = [];

  let strongestHint = { role: role === "unknown" ? "" : role, hits: [], weight: 0 };
  for (const [candidateRole, hints] of Object.entries(DESCRIPTION_ROLE_HINTS)) {
    const hits = hints.filter((hint) => text.includes(hint));
    if (!hits.length) continue;
    confidence += Math.min(0.2, hits.length * 0.05);
    reasons.push(`${candidateRole}_hint:${hits.slice(0, 3).join(",")}`);

    const hasStrongSpecSignal = candidateRole === "spec_image" && hits.some((hit) =>
      ["spec", "specification", "technical", "chart", "frequency", "response", "measurement", "table"].includes(hit),
    );
    const weight = hits.length + (hasStrongSpecSignal ? 2 : 0);
    if (weight > strongestHint.weight) strongestHint = { role: candidateRole, hits, weight };
  }

  if (role === "unknown" || strongestHint.weight >= 2) {
    role = strongestHint.role || role;
  }

  const width = Number(candidate.width || candidate.metadata?.width || 0);
  const height = Number(candidate.height || candidate.metadata?.height || 0);
  if (width > 0 && height > 0 && height / width >= 1.35) {
    if (role === "unknown" || role === "description") role = "spec_image";
    confidence += 0.08;
    reasons.push("tall_image_likely_infographic");
  }

  if (!reasons.length) reasons.push("inside_description_context");

  return {
    role: role === "unknown" ? "unknown_description_image" : role,
    confidence: clamp01(confidence),
    reason: reasons.join("; "),
    needs_review: confidence < 0.85,
  };
}

export function buildDescriptionBlockFromCandidate(candidate = {}, context = {}) {
  const classified = classifyDescriptionImageCandidate(candidate, context);
  const url = String(candidate.url || candidate.src || "").trim();
  if (!isSafePublicImageUrl(url)) return null;

  return {
    id: candidate.id || `desc_${shortHash(`${url}:${candidate.sort_order ?? ""}`)}`,
    type: ROLE_TO_BLOCK_TYPE[classified.role] || "image",
    content: { imageRole: classified.role },
    media: {
      url,
      alt: String(candidate.alt || candidate.alt_text || `${context.productName || "Product"} detail image`).trim(),
      width: numberOrNull(candidate.width || candidate.metadata?.width) || undefined,
      height: numberOrNull(candidate.height || candidate.metadata?.height) || undefined,
      role: classified.role,
    },
    sortOrder: Number.isFinite(Number(candidate.sort_order ?? candidate.sortOrder))
      ? Number(candidate.sort_order ?? candidate.sortOrder)
      : 0,
    altText: String(candidate.alt || candidate.alt_text || "").trim(),
    caption: String(candidate.caption || "").trim(),
    sourceUrl: String(candidate.source_url || candidate.sourceUrl || context.sourceUrl || url).trim(),
    sourceType: normalizeSourceType(candidate.source_type || candidate.sourceType || context.sourceType),
    extractedText: String(candidate.extracted_text || candidate.extractedText || "").trim(),
    extractionConfidence: numberOrNull(candidate.extraction_confidence || candidate.extractionConfidence) || 0,
    needsReview: Boolean(candidate.needs_review ?? candidate.needsReview ?? classified.needs_review),
    classificationReason: classified.reason,
    confidence: classified.confidence,
  };
}

export function buildDescriptionBlocksFromImportDraft(draft = {}, context = {}) {
  const explicitBlocks = Array.isArray(draft.descriptionBlocks) ? draft.descriptionBlocks : [];
  const explicitCandidates = [
    ...(Array.isArray(draft.descriptionImages) ? draft.descriptionImages.map((url) => ({ url, role: "description" })) : []),
    ...(Array.isArray(draft.description_images) ? draft.description_images.map((url) => ({ url, role: "description" })) : []),
    ...(Array.isArray(draft.specImages) ? draft.specImages.map((url) => ({ url, role: "spec_image" })) : []),
    ...(Array.isArray(draft.spec_images) ? draft.spec_images.map((url) => ({ url, role: "spec_image" })) : []),
    ...(Array.isArray(draft.image_candidates)
      ? draft.image_candidates.filter((item) => isDescriptionMediaRole(item.role || item.type))
      : []),
  ];

  const htmlCandidates = [
    draft.descriptionHtml,
    draft.description_html,
    draft.longDescriptionHtml,
    draft.long_description_html,
    draft.rawDescriptionHtml,
    draft.raw_description_html,
  ].flatMap((html) => extractDescriptionImageCandidatesFromHtml(html, context));

  const blocks = [
    ...explicitBlocks,
    ...[...explicitCandidates, ...htmlCandidates].map((candidate, index) =>
      buildDescriptionBlockFromCandidate(
        { ...candidate, sort_order: candidate.sort_order ?? index },
        { ...context, productName: draft.nameEn || draft.name?.en || context.productName },
      ),
    ),
  ].filter(Boolean);

  const seen = new Set();
  return blocks
    .filter((block) => {
      const key = stableUrlKey(block.media?.url || block.id);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((block, index) => ({ ...block, sortOrder: block.sortOrder ?? index }));
}

export function normalizeDescriptionImageRole(value) {
  const role = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  if (["spec", "specs", "technical", "specification", "specifications"].includes(role)) return "spec_image";
  if (["box", "package", "package_contents", "contents", "included", "box_image"].includes(role)) return "box_image";
  if (["unknown_description_image", "description_unknown"].includes(role)) return "unknown_description_image";
  if (["description_image", "description", "detail", "details"].includes(role)) return "description";
  if (["feature", "features", "infographic"].includes(role)) return "feature";
  if (["comparison", "compare"].includes(role)) return "comparison";
  if (["diagram", "schematic", "chart"].includes(role)) return "diagram";
  return "unknown";
}

export function isDescriptionMediaRole(value) {
  return normalizeDescriptionImageRole(value) !== "unknown";
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

function isSafePublicImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host.endsWith(".local")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|169\.254\.)/.test(host)) return false;
    return /\.(?:png|jpe?g|webp|avif)(?:$|\?)/i.test(parsed.pathname) || !/\.[a-z0-9]{2,6}$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function normalizeSourceType(value) {
  const sourceType = String(value || "unknown").toLowerCase();
  return ["official", "retailer", "imported", "manual", "unknown"].includes(sourceType) ? sourceType : "unknown";
}

function stableUrlKey(value) {
  return String(value || "").trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}
