import type { ApiProduct } from "@/lib/api";
import type {
  ProductMediaLicenseStatus,
  ProductMediaPlacement,
  ProductPageContent,
  ProductPageMedia,
  ProductPageSpecGroup,
  ProductSourceConfidence,
  ProductSourceRef,
  ProductSourceType,
} from "@/lib/productContent/productContentTypes";
import { buildProductPageDraft, normalizeProductPageContent } from "@/lib/productPageBuilder";

export type AiResearchSourceType =
  | "official_manufacturer"
  | "official_manual"
  | "official_support"
  | "official_press_kit"
  | "official_video"
  | "authorized_distributor"
  | "official_marketplace"
  | "expert_review"
  | "measurement_site"
  | "forum"
  | "marketplace_seller"
  | "social_media"
  | "general_web"
  | "internal";

export type AiImageLicenseStatus =
  | ProductMediaLicenseStatus
  | "authorized_distributor";

export type AiRecommendedPlacement = ProductMediaPlacement | "main_gallery" | "not_recommended";

export type AiResearchSource = {
  id?: string;
  title: string;
  url: string;
  sourceType?: AiResearchSourceType;
  confidence?: ProductSourceConfidence;
  priority?: number;
  usedFields?: Array<"specs" | "sound" | "description" | "images">;
  notes?: string;
};

export type AiImageCandidate = {
  id?: string;
  url: string;
  originalSourceUrl?: string;
  sourceTitle?: string;
  sourceType?: AiResearchSourceType;
  width?: number;
  height?: number;
  format?: string;
  fileSize?: number;
  altSuggestion?: string;
  licenseStatus?: AiImageLicenseStatus;
  confidence?: ProductSourceConfidence;
  duplicateGroupId?: string;
  recommendedPlacement?: AiRecommendedPlacement;
  perceptualHash?: string;
  averageHash?: string;
  warnings?: string[];
};

export type AiSpecCandidate = {
  name: string;
  value: string;
  unit?: string;
  sourceRefId?: string;
  sourceUrl?: string;
  sourceType?: AiResearchSourceType;
  confidence?: ProductSourceConfidence;
};

export type AiResearchDraft = {
  query: string;
  normalizedInput: string;
  inputType: "url" | "query";
  sources: AiResearchSource[];
  images: AiImageCandidate[];
  duplicateImages: AiImageCandidate[];
  specs: AiSpecCandidate[];
  duplicateSpecs: AiSpecCandidate[];
  specConflicts: Array<{
    name: string;
    candidates: AiSpecCandidate[];
    preferred?: AiSpecCandidate;
  }>;
  productDuplicate?: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    reason: string;
  };
  productPageDraft?: ProductPageContent;
  warnings: string[];
  errors: string[];
};

export type ImportedProductLike = {
  sourceUrl?: string;
  nameEn?: string;
  nameAr?: string;
  brand?: string;
  category?: string;
  subCategories?: string[];
  taglineEn?: string;
  image?: string;
  gallery?: string[];
  features?: string[];
  specs?: Array<{ label: string | { en?: string; ar?: string }; value: string }>;
  importMeta?: {
    mode?: "url" | "query";
    query?: string;
    resolvedUrl?: string;
    matchedTitle?: string;
    confidenceOverall?: number;
    usedStructuredData?: boolean;
    publishDecision?: string;
    qualityFlags?: string[];
    pipeline?: {
      evidence?: Array<{ source_type: string; source_url: string; facts?: string[] }>;
    };
  };
};

const officialSourceHints = /(official|manufacturer|brand|support|manual|datasheet|spec\s*sheet|press\s*kit)/i;
const authorizedHints = /(authorized|distributor|dealer|reseller)/i;
const reviewHints = /(review|head-fi|headfonia|soundguys|rtings|audiosciencereview|measurements?)/i;
const marketplaceHints = /(amazon|aliexpress|ebay|noon|marketplace|seller)/i;
const socialHints = /(facebook|instagram|tiktok|twitter|x\.com|reddit|youtube|youtu\.be)/i;
const blockedImageHints = /(watermark|logo|favicon|sprite|placeholder|avatar|icon)/i;

export function normalizeResearchInput(value: string) {
  const normalizedInput = String(value || "").replace(/\s+/g, " ").trim();
  return {
    normalizedInput,
    inputType: looksLikeHttpUrl(normalizedInput) ? ("url" as const) : ("query" as const),
  };
}

export function classifyResearchSource(source: Pick<AiResearchSource, "title" | "url" | "sourceType">): Required<Pick<AiResearchSource, "sourceType" | "confidence" | "priority">> {
  if (source.sourceType) return sourceScore(source.sourceType);
  const haystack = `${source.title || ""} ${source.url || ""}`.toLowerCase();
  if (/manual|datasheet|spec\s*sheet|pdf/.test(haystack)) return sourceScore("official_manual");
  if (/support|downloads|docs/.test(haystack)) return sourceScore("official_support");
  if (/press|media-kit|presskit/.test(haystack)) return sourceScore("official_press_kit");
  if (/youtube\.com|youtu\.be/.test(haystack) && officialSourceHints.test(haystack)) return sourceScore("official_video");
  if (officialSourceHints.test(haystack)) return sourceScore("official_manufacturer");
  if (authorizedHints.test(haystack)) return sourceScore("authorized_distributor");
  if (/measurements?|frequency|graph|rtings|audiosciencereview/.test(haystack)) return sourceScore("measurement_site");
  if (reviewHints.test(haystack)) return sourceScore("expert_review");
  if (/forum|head-fi|reddit/.test(haystack)) return sourceScore("forum");
  if (marketplaceHints.test(haystack)) return sourceScore("marketplace_seller");
  if (socialHints.test(haystack)) return sourceScore("social_media");
  if (domainTokenMatchesTitle(source.url, source.title)) return sourceScore("official_manufacturer");
  return sourceScore("general_web");
}

export function scoreSourceConfidence(source: Pick<AiResearchSource, "title" | "url" | "sourceType">) {
  return classifyResearchSource(source).confidence;
}

export function rankSources(sources: AiResearchSource[]) {
  return sources
    .map((source, index) => {
      const scored = classifyResearchSource(source);
      return {
        ...source,
        sourceType: scored.sourceType,
        confidence: source.confidence || scored.confidence,
        priority: source.priority ?? scored.priority,
        id: source.id || `source_${index + 1}`,
      };
    })
    .sort((left, right) => (left.priority || 99) - (right.priority || 99) || confidenceRank(right.confidence) - confidenceRank(left.confidence));
}

export function normalizeImageCandidateUrl(value: string, baseUrl?: string) {
  const raw = String(value || "").trim().split(",")[0].split(/\s+/)[0];
  if (!raw || /^data:/i.test(raw)) return "";
  try {
    const parsed = new URL(raw, baseUrl || undefined);
    if (!["http:", "https:"].includes(parsed.protocol) && !parsed.pathname.startsWith("/")) return "";
    for (const param of ["width", "height", "w", "h", "fit", "crop", "resize", "format", "auto", "quality", "q"]) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = "";
    const normalized = parsed.toString();
    if (blockedImageHints.test(normalized)) return "";
    return normalized;
  } catch {
    return raw.startsWith("/") && !raw.startsWith("//") ? raw.replace(/[?#].*$/, "") : "";
  }
}

export function dedupeImageCandidates(candidates: AiImageCandidate[]) {
  const groups = new Map<string, AiImageCandidate[]>();
  candidates.forEach((candidate, index) => {
    const normalizedUrl = normalizeImageCandidateUrl(candidate.url);
    if (!normalizedUrl) return;
    const groupKey = imageGroupKey({ ...candidate, url: normalizedUrl });
    const group = groups.get(groupKey) || [];
    group.push({ ...candidate, id: candidate.id || `image_${index + 1}`, url: normalizedUrl });
    groups.set(groupKey, group);
  });

  const accepted: AiImageCandidate[] = [];
  const duplicates: AiImageCandidate[] = [];
  let duplicateIndex = 0;
  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => imageQualityScore(right) - imageQualityScore(left));
    const duplicateGroupId = group.length > 1 ? `image_dup_${duplicateIndex + 1}` : undefined;
    if (duplicateGroupId) duplicateIndex += 1;
    accepted.push({ ...sorted[0], duplicateGroupId });
    duplicates.push(...sorted.slice(1).map((item) => ({ ...item, duplicateGroupId })));
  }

  return { accepted, duplicates };
}

export function normalizeSpecName(value: string) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutPunctuation = normalized.replace(/[؟?:：]/g, "");
  const aliases: Record<string, string> = {
    impedance: "impedance",
    "مقاومة": "impedance",
    "المقاومة": "impedance",
    sensitivity: "sensitivity",
    "الحساسية": "sensitivity",
    "frequency response": "frequency response",
    "frequency range": "frequency response",
    "استجابة التردد": "frequency response",
    weight: "weight",
    "الوزن": "weight",
    driver: "driver",
    "driver size": "driver",
    "حجم الدرايفر": "driver",
    battery: "battery",
    "battery life": "battery",
    "عمر البطارية": "battery",
    warranty: "warranty",
    "الضمان": "warranty",
  };
  return aliases[withoutPunctuation] || withoutPunctuation;
}

export function normalizeSpecValue(value: string, unit = "") {
  const combined = `${value || ""} ${unit || ""}`
    .toLowerCase()
    .replace(/\bohms?\b/g, "Ω")
    .replace(/\bohm\b/g, "Ω")
    .replace(/\bgrams?\b/g, "g")
    .replace(/\bgram\b/g, "g")
    .replace(/\bhertz\b/g, "hz")
    .replace(/\s+/g, " ")
    .replace(/\s+([Ω%])/g, "$1")
    .trim();
  return combined;
}

export function dedupeSpecs(specs: AiSpecCandidate[]) {
  const groups = new Map<string, AiSpecCandidate[]>();
  for (const spec of specs) {
    const name = normalizeSpecName(spec.name);
    if (!name || !String(spec.value || "").trim()) continue;
    const group = groups.get(name) || [];
    group.push({ ...spec, name });
    groups.set(name, group);
  }

  const accepted: AiSpecCandidate[] = [];
  const duplicates: AiSpecCandidate[] = [];
  const conflicts: AiResearchDraft["specConflicts"] = [];

  for (const [name, group] of groups) {
    const valueGroups = new Map<string, AiSpecCandidate[]>();
    for (const item of group) {
      const key = normalizeSpecValue(item.value, item.unit);
      valueGroups.set(key, [...(valueGroups.get(key) || []), item]);
    }

    if (valueGroups.size === 1) {
      const sorted = [...group].sort((left, right) => specConfidenceScore(right) - specConfidenceScore(left));
      accepted.push(sorted[0]);
      duplicates.push(...sorted.slice(1));
      continue;
    }

    const sorted = [...group].sort((left, right) => specConfidenceScore(right) - specConfidenceScore(left));
    const best = sorted[0];
    const highConfidenceValues = new Set(sorted.filter((item) => item.confidence === "high").map((item) => normalizeSpecValue(item.value, item.unit)));
    const unresolved = highConfidenceValues.size > 1 || best.confidence !== "high";
    conflicts.push({ name, candidates: sorted, preferred: unresolved ? undefined : best });
    if (!unresolved) accepted.push(best);
  }

  return { accepted, duplicates, conflicts };
}

export function findProductDuplicateCandidate(products: ApiProduct[], draft: Pick<ImportedProductLike, "brand" | "nameEn" | "sourceUrl"> & { slug?: string }) {
  const brandKey = normalizeIdentity(draft.brand || "");
  const nameKey = normalizeIdentity(draft.nameEn || "");
  const slugKey = normalizeIdentity(draft.slug || slugFromName(draft.nameEn || ""));
  const sourceKey = normalizeUrlForCompare(draft.sourceUrl || "");

  for (const product of products) {
    const productBrand = normalizeIdentity(product.brand);
    const productName = normalizeIdentity(product.name.en);
    const productSlug = normalizeIdentity(product.slug);
    const productSource = normalizeUrlForCompare(product.sourceUrl || "");
    if (sourceKey && productSource && sourceKey === productSource) {
      return toProductDuplicate(product, "same source URL");
    }
    if (slugKey && productSlug && slugKey === productSlug) {
      return toProductDuplicate(product, "same slug/model");
    }
    if (brandKey && productBrand === brandKey && nameKey && productName === nameKey) {
      return toProductDuplicate(product, "same brand and normalized model");
    }
  }

  return undefined;
}

export function isUnsafeResearchUrl(value: string) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return true;
    if (url.username || url.password) return true;
    if (/(token|secret|service_role|password|access_key|apikey|api_key)=/i.test(url.search)) return true;
    return isPrivateHost(url.hostname);
  } catch {
    return true;
  }
}

export function isPrivateHost(hostname: string) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "metadata.google.internal") return true;
  if (/^::1$|^fc|^fd|^fe80:/i.test(host)) return true;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return false;
}

export function createResearchDraftFromImported(input: {
  query: string;
  imported: ImportedProductLike;
  candidates?: Array<{ title: string; url: string; image?: string; score?: number; draft?: ImportedProductLike }>;
  products?: ApiProduct[];
}) {
  const { normalizedInput, inputType } = normalizeResearchInput(input.query);
  const imported = input.imported;
  const evidenceSources =
    imported.importMeta?.pipeline?.evidence?.map((evidence, index) => ({
      id: `evidence_${index + 1}`,
      title: evidence.source_type.replaceAll("_", " "),
      url: evidence.source_url,
      sourceType: mapEvidenceSourceType(evidence.source_type),
      usedFields: ["specs", "description"] as AiResearchSource["usedFields"],
    })) || [];
  const candidateSources =
    input.candidates?.map((candidate, index) => ({
      id: `candidate_${index + 1}`,
      title: candidate.title,
      url: candidate.url,
      usedFields: ["description", "specs", "images"] as AiResearchSource["usedFields"],
    })) || [];
  const baseSource = imported.sourceUrl
    ? [{ id: "source_primary", title: imported.importMeta?.matchedTitle || imported.nameEn || "Product source", url: imported.sourceUrl, usedFields: ["description", "specs", "images"] as AiResearchSource["usedFields"] }]
    : [];
  const sources = rankSources(dedupeSources([...baseSource, ...candidateSources, ...evidenceSources]));
  const sourceByUrl = new Map(sources.map((source) => [normalizeUrlForCompare(source.url), source]));
  const images = [
    imported.image,
    ...(imported.gallery || []),
    ...(input.candidates?.map((candidate) => candidate.image || "") || []),
  ]
    .filter(Boolean)
    .map((url, index) => {
      const source = sourceByUrl.get(normalizeUrlForCompare(imported.sourceUrl || "")) || sources[0];
      const classification = source ? classifyResearchSource(source) : sourceScore("general_web");
      return {
        id: `image_${index + 1}`,
        url,
        originalSourceUrl: source?.url || imported.sourceUrl || "",
        sourceTitle: source?.title || "",
        sourceType: classification.sourceType,
        altSuggestion: `${imported.nameEn || normalizedInput} ${index === 0 ? "main image" : `image ${index + 1}`}`,
        licenseStatus: imageLicenseForSource(classification.sourceType),
        confidence: classification.confidence,
        recommendedPlacement: index === 0 ? "main_gallery" : "description",
      } satisfies AiImageCandidate;
    });
  const imageDedupe = dedupeImageCandidates(images);
  const rawSpecs = (imported.specs || []).map((spec, index) => {
    const label = typeof spec.label === "string" ? spec.label : spec.label.en || spec.label.ar || "";
    const source = sources.find((item) => item.confidence === "high") || sources[0];
    return {
      name: label,
      value: spec.value,
      sourceRefId: source?.id,
      sourceUrl: source?.url,
      sourceType: source?.sourceType,
      confidence: source?.confidence || "low",
    } satisfies AiSpecCandidate;
  });
  const specDedupe = dedupeSpecs(rawSpecs);
  const productDuplicate = findProductDuplicateCandidate(input.products || [], {
    brand: imported.brand,
    nameEn: imported.nameEn,
    sourceUrl: imported.sourceUrl,
  });
  const warnings = [
    "Research draft only. Review selected images, source references, and facts before saving.",
    ...imageDedupe.accepted
      .filter((image) => image.licenseStatus === "unknown")
      .map((image) => `Image ${image.id || image.url} has unknown license.`),
    ...(specDedupe.conflicts.length ? [`${specDedupe.conflicts.length} spec conflict(s) need review.`] : []),
    ...(productDuplicate ? [`Existing product match found: ${productDuplicate.name}. Use Update Draft instead of creating a duplicate.`] : []),
  ];
  const errors = imageDedupe.accepted
    .filter((image) => image.licenseStatus === "do_not_use")
    .map((image) => `Image ${image.id || image.url} is marked do not use.`);

  const researchDraft: AiResearchDraft = {
    query: input.query,
    normalizedInput,
    inputType,
    sources,
    images: imageDedupe.accepted,
    duplicateImages: imageDedupe.duplicates,
    specs: specDedupe.accepted,
    duplicateSpecs: specDedupe.duplicates,
    specConflicts: specDedupe.conflicts,
    productDuplicate,
    warnings,
    errors,
  };
  return {
    ...researchDraft,
    productPageDraft: mapResearchDraftToProductPage(researchDraft, imported),
  };
}

export function mapResearchDraftToProductPage(researchDraft: AiResearchDraft, imported: ImportedProductLike): ProductPageContent {
  const fallback = buildProductPageDraft({
    slug: slugFromName(imported.nameEn || researchDraft.normalizedInput),
    sourceUrl: imported.sourceUrl,
    name: { en: imported.nameEn || researchDraft.normalizedInput, ar: imported.nameAr || imported.nameEn || researchDraft.normalizedInput },
    brand: imported.brand || "",
    category: imported.category || "",
    subCategories: imported.subCategories || [],
    tagline: { en: imported.taglineEn || "", ar: "" },
    price: 0,
    image: imported.image || researchDraft.images[0]?.url || "",
    gallery: researchDraft.images.map((image) => image.url),
    features: imported.features || [],
    specs: researchDraft.specs.map((spec) => ({
      label: spec.name,
      value: spec.unit ? `${spec.value} ${spec.unit}` : spec.value,
    })),
  });
  const sources = researchDraft.sources.map(toProductSourceRef);
  const media = researchDraft.images.map((image, index) => toProductPageMedia(image, index));
  const descriptionBlocks = [
    {
      id: "desc_hero",
      type: "hero_editorial" as const,
      title: imported.nameEn || researchDraft.normalizedInput,
      subtitle: imported.brand || "",
      body: imported.taglineEn || "",
      media: media[0],
      layout: "image-right" as const,
      order: 0,
      visible: true,
      sourceRefIds: sources.slice(0, 1).map((source) => source.id),
    },
    ...(imported.features || []).slice(0, 2).map((feature, index) => ({
      id: `desc_feature_${index + 1}`,
      type: "feature" as const,
      title: `Key feature ${index + 1}`,
      body: feature,
      media: media[index + 1],
      layout: index % 2 ? ("image-left" as const) : ("image-right" as const),
      order: index + 1,
      visible: true,
      sourceRefIds: sources.slice(0, 1).map((source) => source.id),
    })),
  ];
  const specGroups = groupSpecsForProductPage(researchDraft.specs);

  return normalizeProductPageContent({
    ...fallback,
    description: { blocks: descriptionBlocks },
    media,
    sources,
    specs: { groups: specGroups },
    sound: { sourceConfidence: "low" },
    seo: {
      title: imported.nameEn || fallback.seo?.title,
      metaDescription: imported.taglineEn || fallback.seo?.metaDescription,
      canonicalPath: fallback.seo?.canonicalPath,
      ogImage: media.find((item) => item.isPrimary)?.url || fallback.seo?.ogImage,
      keywords: [imported.brand, imported.category, ...(imported.subCategories || [])].filter(Boolean),
    },
    seoWarnings: Array.from(new Set([...(fallback.seoWarnings || []), ...researchDraft.warnings.slice(0, 8)])),
    contentStatus: "needs_research",
    updatedAt: new Date().toISOString(),
  }) as ProductPageContent;
}

export function validateResearchDraft(draft?: AiResearchDraft) {
  const errors = [...(draft?.errors || [])];
  const warnings = [...(draft?.warnings || [])];
  if (!draft) errors.push("Research draft is missing.");
  if (draft && !draft.normalizedInput) errors.push("Missing product name or URL.");
  if (draft?.inputType === "url" && isUnsafeResearchUrl(draft.normalizedInput)) errors.push("Product URL is unsafe or private.");
  if (draft && !draft.sources.length) warnings.push("No source references found.");
  if (draft && !draft.sources.some((source) => source.confidence === "high")) warnings.push("No official/high-confidence source found.");
  if (draft && !draft.images.some((image) => image.recommendedPlacement === "main_gallery" && image.licenseStatus !== "unknown" && image.licenseStatus !== "do_not_use")) warnings.push("No approved main image with clear license.");
  if (draft?.duplicateImages.length) warnings.push(`${draft.duplicateImages.length} duplicate image candidate(s) kept out of final gallery.`);
  if (draft?.duplicateSpecs.length) warnings.push(`${draft.duplicateSpecs.length} duplicate spec candidate(s) collapsed.`);
  if (draft?.specConflicts.some((conflict) => !conflict.preferred)) errors.push("Unresolved spec conflict.");
  if (draft?.productDuplicate) warnings.push(`Duplicate product candidate: ${draft.productDuplicate.name}.`);
  return { errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)), score: Math.max(0, 100 - errors.length * 25 - warnings.length * 5) };
}

function sourceScore(sourceType: AiResearchSourceType) {
  if (["official_manufacturer", "official_manual", "official_support", "official_press_kit", "official_video", "official_marketplace"].includes(sourceType)) {
    return { sourceType, confidence: "high" as const, priority: 1 };
  }
  if (sourceType === "authorized_distributor") return { sourceType, confidence: "high" as const, priority: 2 };
  if (sourceType === "expert_review" || sourceType === "measurement_site") return { sourceType, confidence: "medium" as const, priority: 3 };
  if (sourceType === "forum") return { sourceType, confidence: "low" as const, priority: 4 };
  if (sourceType === "internal") return { sourceType, confidence: "medium" as const, priority: 5 };
  return { sourceType, confidence: "low" as const, priority: 6 };
}

function confidenceRank(confidence?: ProductSourceConfidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function imageLicenseForSource(sourceType: AiResearchSourceType): AiImageLicenseStatus {
  if (["official_manufacturer", "official_manual", "official_support", "official_press_kit"].includes(sourceType)) return "official_manufacturer";
  if (sourceType === "authorized_distributor") return "authorized_distributor";
  if (sourceType === "marketplace_seller" || sourceType === "social_media") return "do_not_use";
  return "unknown";
}

function imageGroupKey(candidate: AiImageCandidate) {
  const normalizedUrl = normalizeUrlForCompare(candidate.url);
  const hash = candidate.perceptualHash || candidate.averageHash;
  if (hash) return `hash:${hash}`;
  const file = filenameFromUrl(candidate.url);
  const dimensions = candidate.width && candidate.height ? `${candidate.width}x${candidate.height}` : "";
  const size = candidate.fileSize ? String(candidate.fileSize) : "";
  return normalizedUrl || [file, dimensions, size].filter(Boolean).join(":");
}

function imageQualityScore(candidate: AiImageCandidate) {
  const pixels = Number(candidate.width || 0) * Number(candidate.height || 0);
  const source = candidate.sourceType ? sourceScore(candidate.sourceType) : sourceScore("general_web");
  const license =
    candidate.licenseStatus === "official_manufacturer" ? 80 :
    candidate.licenseStatus === "owned" || candidate.licenseStatus === "licensed" || candidate.licenseStatus === "authorized_distributor" ? 60 :
    candidate.licenseStatus === "unknown" ? 10 : -100;
  const placement = candidate.recommendedPlacement === "main_gallery" ? 20 : candidate.recommendedPlacement === "not_recommended" ? -30 : 0;
  return license + confidenceRank(candidate.confidence || source.confidence) * 12 + Math.min(50, pixels / 10000) + placement + Math.min(10, Number(candidate.fileSize || 0) / 250000);
}

function specConfidenceScore(spec: AiSpecCandidate) {
  const source = spec.sourceType ? sourceScore(spec.sourceType) : undefined;
  return confidenceRank(spec.confidence || source?.confidence) * 10 + (spec.sourceType?.startsWith("official") ? 5 : 0);
}

function groupSpecsForProductPage(specs: AiSpecCandidate[]): ProductPageSpecGroup[] {
  const buckets = new Map<string, AiSpecCandidate[]>();
  for (const spec of specs) {
    const group = specGroupTitle(spec.name);
    buckets.set(group, [...(buckets.get(group) || []), spec]);
  }
  return [...buckets.entries()].map(([title, rows], index) => ({
    id: `spec_${slugFromName(title) || index}`,
    title,
    specs: rows.map((spec) => ({
      name: spec.name,
      value: spec.value,
      unit: spec.unit,
      sourceRefId: spec.sourceRefId,
    })),
    order: index,
  }));
}

function specGroupTitle(name: string) {
  const key = normalizeSpecName(name);
  if (/bluetooth|wifi|usb|connector|input|codec|wireless|cable/.test(key)) return "Connectivity";
  if (/weight|material|driver|dimension|color|build|earpad/.test(key)) return "Design & Build";
  if (/battery|charging|power/.test(key)) return "Power/Battery";
  if (/box|included|contents|cable|case|tips/.test(key)) return "In The Box";
  if (/warranty/.test(key)) return "Warranty";
  return "Audio";
}

function toProductSourceRef(source: AiResearchSource): ProductSourceRef {
  const mappedType: ProductSourceType =
    source.sourceType === "official_manual" ? "official_manual" :
    source.sourceType === "authorized_distributor" ? "authorized_distributor" :
    source.sourceType === "expert_review" || source.sourceType === "measurement_site" ? "expert_review" :
    source.sourceType === "forum" ? "forum_user_review" :
    source.sourceType === "internal" ? "internal" :
    "manufacturer";
  return {
    id: source.id || `source_${Math.abs(hashText(source.url))}`,
    title: source.title || source.url,
    url: source.url,
    sourceType: mappedType,
    confidence: source.confidence || scoreSourceConfidence(source),
    usedFields: source.usedFields,
    notes: source.notes,
  };
}

function toProductPageMedia(candidate: AiImageCandidate, index: number): ProductPageMedia {
  const licenseStatus: ProductMediaLicenseStatus =
    candidate.licenseStatus === "authorized_distributor" ? "authorized_distributor" :
    candidate.licenseStatus || "unknown";
  return {
    id: candidate.id || `media_${index + 1}`,
    url: candidate.url,
    alt: candidate.altSuggestion || `Product image ${index + 1}`,
    width: candidate.width,
    height: candidate.height,
    sourceUrl: candidate.originalSourceUrl,
    licenseStatus,
    placement: candidate.recommendedPlacement === "main_gallery" ? "gallery" : candidate.recommendedPlacement === "not_recommended" ? "description" : candidate.recommendedPlacement || "description",
    order: index,
    isPrimary: index === 0 || candidate.recommendedPlacement === "main_gallery",
  };
}

function dedupeSources(sources: AiResearchSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || isUnsafeResearchUrl(source.url)) return false;
    const key = normalizeUrlForCompare(source.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapEvidenceSourceType(sourceType: string): AiResearchSourceType {
  if (/official|manual|structured_data/.test(sourceType)) return "official_manufacturer";
  if (/retailer|distributor/.test(sourceType)) return "authorized_distributor";
  if (/community|forum/.test(sourceType)) return "forum";
  return "general_web";
}

function toProductDuplicate(product: ApiProduct, reason: string) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name.en || product.name.ar,
    brand: product.brand,
    reason,
  };
}

function looksLikeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function filenameFromUrl(value: string) {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
  } catch {
    return String(value || "").split("/").pop()?.toLowerCase() || "";
  }
}

function normalizeUrlForCompare(value: string) {
  const normalized = normalizeImageCandidateUrl(value);
  if (normalized) return normalized.replace(/^https?:\/\/www\./i, "https://").replace(/\/$/g, "").toLowerCase();
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/^https?:\/\/www\./i, "https://").replace(/\/$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeIdentity(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromName(value: string) {
  return normalizeIdentity(value).replace(/\s+/g, "-");
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function domainTokenMatchesTitle(url: string, title: string) {
  try {
    const hostToken = new URL(url).hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    const titleToken = String(title || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return hostToken.length >= 4 && titleToken.includes(hostToken);
  } catch {
    return false;
  }
}
