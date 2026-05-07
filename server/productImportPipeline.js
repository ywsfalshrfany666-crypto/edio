import { randomUUID } from "node:crypto";
import { buildDescriptionBlocksFromImportDraft } from "./productDescriptionMedia.js";

export const IMPORT_PIPELINE_VERSION = "edio-import-pipeline.v1";

export const IMPORT_SOURCE_WEIGHTS = {
  official: 1,
  manual: 0.98,
  structured_data: 0.94,
  retailer: 0.86,
  internal: 0.8,
  community: 0.48,
  model: 0.4,
};

export const IMPORT_MODEL_STEP_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "raw_input",
    "normalized_name",
    "brand",
    "model",
    "category_clues",
    "facts",
    "image_candidates",
    "offers",
    "quality_flags",
    "confidence",
  ],
  properties: {
    raw_input: { type: "string" },
    normalized_name: { type: "string" },
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    category_clues: { type: "array", items: { type: "string" } },
    facts: {
      type: "object",
      additionalProperties: { type: ["string", "number", "boolean", "null"] },
    },
    image_candidates: {
      type: "array",
      items: {
        type: "object",
        required: ["url", "role", "source_type"],
        properties: {
          url: { type: "string" },
          role: { type: "string" },
          source_type: { type: "string" },
          classification_reason: { type: "string" },
          confidence: { type: "number" },
          extracted_text: { type: "string" },
        },
      },
    },
    offers: {
      type: "array",
      items: {
        type: "object",
        required: ["price", "currency", "source_url"],
        properties: {
          price: { type: ["number", "null"] },
          currency: { type: "string" },
          availability: { type: ["string", "null"] },
          source_url: { type: "string" },
        },
      },
    },
    quality_flags: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      required: ["overall"],
      properties: { overall: { type: "number", minimum: 0, maximum: 1 } },
    },
  },
};

const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== "" && entry !== null),
  );
}

function sourceTypeWeight(sourceType) {
  return IMPORT_SOURCE_WEIGHTS[String(sourceType || "").trim()] ?? 0.35;
}

function boundedConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

export function normalizeImportProductName(value, brand = "") {
  let name = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+[|-]\s+(official store|official site|thomann|sweetwater|amazon|headphones\.com).*$/i, "")
    .replace(/\s*[-–—]\s*(buy online|best price|free shipping|official).*$/i, "")
    .replace(/\s*\([^)]*(official|free shipping|best price|sale|review)[^)]*\)\s*$/i, "")
    .trim();

  const brandText = String(brand || "").replace(/\s+/g, " ").trim();
  if (brandText && name && !name.toLowerCase().startsWith(brandText.toLowerCase())) {
    name = `${brandText} ${name}`.replace(/\s+/g, " ").trim();
  }
  return name;
}

export function rankImportEvidence(evidence = []) {
  return [...(Array.isArray(evidence) ? evidence : [])].sort((left, right) => {
    const byWeight = sourceTypeWeight(right.source_type) - sourceTypeWeight(left.source_type);
    if (byWeight) return byWeight;
    return String(left.source_url || "").localeCompare(String(right.source_url || ""));
  });
}

export function buildImportEvidenceFromDraft(draft = {}, context = {}) {
  const sourceUrl = String(draft.sourceUrl || context.sourceUrl || "").trim();
  const facts = unique([
    draft.nameEn,
    draft.brand ? `brand:${draft.brand}` : "",
    draft.category ? `category:${draft.category}` : "",
    ...(draft.subCategories || []).map((term) => `term:${term}`),
    ...(draft.features || []),
    ...(draft.specs || []).flatMap((spec) => [
      typeof spec.label === "string" ? spec.label : spec.label?.en || spec.label?.ar,
      spec.value,
    ]),
  ]).slice(0, 24);

  const evidence = [];
  if (context.usedStructuredData || draft.importMeta?.usedStructuredData) {
    evidence.push({
      source_type: "structured_data",
      source_url: sourceUrl,
      facts: unique([
        draft.nameEn ? `name:${draft.nameEn}` : "",
        draft.brand ? `brand:${draft.brand}` : "",
        draft.price || draft.priceUsd ? `price:${draft.price || draft.priceUsd}` : "",
        ...(draft.gallery || []).slice(0, 4).map((url) => `image:${url}`),
      ]),
    });
  }
  if (facts.length) {
    evidence.push({
      source_type: context.sourceType || draft.importMeta?.sourceType || "retailer",
      source_url: sourceUrl,
      facts,
    });
  }
  if (context.rawInput) {
    evidence.push({
      source_type: "model",
      source_url: "",
      facts: [`raw_input:${context.rawInput}`],
    });
  }
  return rankImportEvidence(evidence);
}

export function buildImportModelStepOutput(draft = {}, evidence = [], context = {}) {
  const normalizedName = normalizeImportProductName(draft.nameEn || context.rawInput || "", draft.brand);
  const descriptionBlocks = buildDescriptionBlocksFromImportDraft(draft, {
    sourceUrl: draft.sourceUrl || context.sourceUrl || "",
    sourceType: context.sourceType || draft.importMeta?.sourceType || "retailer",
    productName: normalizedName,
  });
  const descriptionImageCandidates = descriptionBlocks
    .filter((block) => block.media?.url)
    .map((block) => ({
      url: block.media.url,
      role: block.media.role || (block.type === "spec_image" ? "spec_image" : "description"),
      source_type: block.sourceType || "retailer",
      classification_reason: block.classificationReason || "description_media_candidate",
      confidence: block.confidence || 0.7,
      extracted_text: block.extractedText || "",
    }));
  return {
    raw_input: String(context.rawInput || draft.sourceUrl || draft.nameEn || "").trim(),
    normalized_name: normalizedName,
    brand: draft.brand || null,
    model: normalizedName && draft.brand ? normalizedName.replace(new RegExp(`^${escapeRegExp(draft.brand)}\\s+`, "i"), "") : null,
    category_clues: unique([draft.category, ...(draft.subCategories || [])]),
    facts: compactObject({
      color: findFactValue(draft.specs, "color"),
      connection_type: findFactValue(draft.specs, "connection"),
      driver_type: findFactValue(draft.specs, "driver"),
      open_closed: findOpenClosedClue(draft, evidence),
      microphone_type: findMicTypeClue(draft, evidence),
      io_counts: findFactValue(draft.specs, "i/o") || findFactValue(draft.specs, "inputs"),
    }),
    image_candidates: [
      ...(draft.gallery || []).slice(0, 12).map((url, index) => ({
        url,
        role: index === 0 ? "main" : "gallery",
        source_type: "retailer",
      })),
      ...descriptionImageCandidates,
    ],
    offers:
      draft.price || draft.priceUsd
        ? [
            {
              price: draft.priceUsd || draft.price || null,
              currency: draft.priceUsd ? "USD" : "IQD",
              availability: draft.inStock === false ? "out_of_stock" : null,
              source_url: draft.sourceUrl || "",
            },
          ]
        : [],
    quality_flags: unique([
      !draft.brand ? "brand_missing" : "",
      !draft.category ? "category_missing" : "",
      evidence.length ? "" : "evidence_missing",
    ]),
    confidence: {
      overall: boundedConfidence(context.confidence ?? draft.importMeta?.confidenceOverall ?? 0.6),
    },
  };
}

export function validateImportModelStepOutput(output) {
  const errors = [];
  const required = IMPORT_MODEL_STEP_OUTPUT_SCHEMA.required;
  for (const key of required) {
    if (!(key in (output || {}))) errors.push(`missing_${key}`);
  }
  if (output?.confidence && !Number.isFinite(Number(output.confidence.overall))) {
    errors.push("invalid_confidence_overall");
  }
  if (output?.offers?.some((offer) => offer.price !== null && !offer.currency)) {
    errors.push("offer_currency_missing");
  }
  return { valid: errors.length === 0, errors };
}

export function buildImportJobRecord({ mode = "url", input = "", sourceUrl = "", now = new Date().toISOString() } = {}) {
  return {
    id: `imp_${cryptoRandomId()}`,
    version: IMPORT_PIPELINE_VERSION,
    mode,
    input: String(input || "").trim(),
    sourceUrl: String(sourceUrl || "").trim(),
    status: "running",
    startedAt: now,
    finishedAt: null,
    productId: null,
    error: null,
    summary: {
      evidenceCount: 0,
      sourceWeights: IMPORT_SOURCE_WEIGHTS,
      normalizedImages: 0,
      reviewTaskCreated: false,
    },
  };
}

export function completeImportJobRecord(job, { draft, classification, evidence = [], normalizedImages = [], reviewTask = null } = {}, now = new Date().toISOString()) {
  return {
    ...job,
    status: classification?.needs_review ? "needs_review" : "completed",
    finishedAt: now,
    sourceUrl: draft?.sourceUrl || job.sourceUrl || "",
    productId: draft?.id || job.productId || null,
    summary: {
      ...(job.summary || {}),
      evidenceCount: evidence.length,
      confidenceScore: classification?.confidence_score ?? null,
      primaryCategorySlug: classification?.primary_category_slug || draft?.category || "",
      secondaryCategorySlugs: classification?.secondary_category_slugs || draft?.subCategories || [],
      normalizedImages: normalizedImages.length,
      reviewTaskCreated: Boolean(reviewTask),
    },
  };
}

export function failImportJobRecord(job, error, now = new Date().toISOString()) {
  return {
    ...job,
    status: "failed",
    finishedAt: now,
    error: {
      code: error?.code || error?.name || "import_failed",
      message: error?.message || "Import failed.",
    },
  };
}

export function buildImportReviewTask({ job, productId = null, draft = {}, classification = null, now = new Date().toISOString() } = {}) {
  const confidence = boundedConfidence(classification?.confidence_score ?? draft.importMeta?.confidenceOverall ?? 0);
  const needsReview =
    Boolean(classification?.needs_review) ||
    confidence < REVIEW_CONFIDENCE_THRESHOLD ||
    !classification?.primary_category_slug ||
    (classification?.primary_category_slug && !(classification?.secondary_category_slugs || []).length);

  if (!needsReview) return null;
  return {
    id: `rev_${productId || job?.id || cryptoRandomId()}`,
    type: "import_classification",
    status: "open",
    priority: confidence < 0.55 ? "high" : "normal",
    productId,
    jobId: job?.id || null,
    title: draft.nameEn || draft.name?.en || job?.input || "Imported product needs review",
    reason:
      classification?.classification_reason ||
      "Low confidence import classification. Admin review is required before publishing secondary categories.",
    confidenceScore: confidence,
    createdAt: now,
    updatedAt: now,
    evidence: classification?.evidence || [],
  };
}

export function shouldPreserveAcceptedClassification(product, { force = false } = {}) {
  if (force) return false;
  return Boolean(
    product?.categoryAssignment?.reviewedAt ||
      product?.categoryAssignment?.acceptedAt ||
      product?.acceptedClassificationAt,
  );
}

export function assignImportPipelineDataToDraft(draft, { job, evidence = [], modelStepOutput, validation, classification, normalizedImages = [], reviewTask = null } = {}) {
  const descriptionBlocks = buildDescriptionBlocksFromImportDraft(draft, {
    sourceUrl: draft.sourceUrl || job?.input || "",
    sourceType: "retailer",
    productName: draft.nameEn,
  });
  const pipeline = {
    version: IMPORT_PIPELINE_VERSION,
    jobId: job?.id || null,
    sourceWeights: IMPORT_SOURCE_WEIGHTS,
    evidence,
    modelStepOutput,
    schema: IMPORT_MODEL_STEP_OUTPUT_SCHEMA,
    validation,
    classification,
    normalizedImages,
    reviewTaskId: reviewTask?.id || null,
    descriptionMedia: descriptionBlocks,
    descriptionMediaCount: descriptionBlocks.length,
  };
  return {
    ...draft,
    ...(descriptionBlocks.length ? { descriptionBlocks } : {}),
    nameEn: modelStepOutput?.normalized_name || draft.nameEn,
    catalogClassification: draft.catalogClassification || draft.importMeta?.catalogClassification || null,
    categoryAssignment: classification
      ? {
          primary_category_slug: classification.primary_category_slug,
          secondary_category_slugs: classification.secondary_category_slugs || [],
          dynamic_collection_slugs: classification.dynamic_collection_slugs || [],
          confidence_score: classification.confidence_score,
          needs_review: classification.needs_review,
          classification_reason: classification.classification_reason,
          evidence: classification.evidence || [],
        }
      : draft.categoryAssignment,
    importMeta: {
      ...(draft.importMeta || {}),
      importJobId: job?.id || draft.importMeta?.importJobId,
      pipeline,
      evidenceCount: evidence.length,
      sourceWeights: IMPORT_SOURCE_WEIGHTS,
      normalizedImageCount: normalizedImages.length,
      descriptionMediaCount: descriptionBlocks.length,
      reviewTaskId: reviewTask?.id || draft.importMeta?.reviewTaskId,
      catalogClassification: draft.importMeta?.catalogClassification || draft.catalogClassification || null,
    },
  };
}

function findFactValue(specs = [], key) {
  const normalizedKey = String(key || "").toLowerCase();
  const match = (Array.isArray(specs) ? specs : []).find((spec) => {
    const label = typeof spec.label === "string" ? spec.label : spec.label?.en || spec.label?.ar || "";
    return String(label || "").toLowerCase().includes(normalizedKey);
  });
  return match?.value || null;
}

function findOpenClosedClue(draft, evidence = []) {
  const text = JSON.stringify([draft.nameEn, draft.taglineEn, draft.features, draft.specs, evidence]).toLowerCase();
  if (/\bopen[-\s]?back\b/.test(text)) return "open-back";
  if (/\bclosed[-\s]?back\b/.test(text)) return "closed-back";
  return null;
}

function findMicTypeClue(draft, evidence = []) {
  const text = JSON.stringify([draft.nameEn, draft.taglineEn, draft.features, draft.specs, evidence]).toLowerCase();
  if (/\bdynamic\b/.test(text)) return "dynamic";
  if (/\bcondenser\b/.test(text)) return "condenser";
  return null;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cryptoRandomId() {
  return randomUUID();
}
