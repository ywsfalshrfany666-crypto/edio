import type { Product } from "@/data/catalog";
import type {
  ProductContentBlock,
  ProductDetailContent,
  ProductEditorialBlock,
  ProductPageContent,
  ProductPageMedia,
  ProductPageSpecGroup,
  ProductSoundProfile,
  ProductSpecGroup,
  ProductSourceRef,
} from "@/lib/productContent/productContentTypes";

const allowedBlockTypes = new Set([
  "hero_editorial",
  "brand_story",
  "feature",
  "image_text",
  "full_width_image",
  "video_embed",
  "press_quote",
  "faq",
]);
const allowedLayouts = new Set(["image-left", "image-right", "full-width", "two-column"]);
const allowedLicenses = new Set(["official_manufacturer", "owned", "licensed", "authorized_distributor", "unknown", "do_not_use"]);
const allowedPlacements = new Set(["gallery", "description", "sound", "specs"]);
const allowedSourceTypes = new Set(["manufacturer", "official_manual", "authorized_distributor", "expert_review", "forum_user_review", "internal"]);
const allowedConfidence = new Set(["high", "medium", "low"]);

export type ProductPageValidation = {
  errors: string[];
  warnings: string[];
  score: number;
};

export function parseProductPageJson(value: string): ProductPageContent | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  try {
    return normalizeProductPageContent(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function stringifyProductPage(value?: ProductPageContent) {
  const normalized = normalizeProductPageContent(value);
  return normalized ? JSON.stringify(normalized, null, 2) : "";
}

export function normalizeProductPageContent(value: unknown): ProductPageContent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as ProductPageContent;
  const media = normalizeMediaList(source.media);
  const sources = normalizeSources(source.sources);
  const videos = Array.isArray(source.videos)
    ? source.videos
        .map((video, index) => ({
          id: cleanText(video.id || `video_${index}`, 80),
          title: cleanText(video.title, 140),
          url: safeUrl(video.url),
          thumbnail: safeUrl(video.thumbnail || ""),
          sourceUrl: safeUrl(video.sourceUrl || ""),
        }))
        .filter((video) => video.title && video.url)
        .slice(0, 8)
    : [];

  const blocks = Array.isArray(source.description?.blocks)
    ? source.description.blocks
        .map((block, index) => normalizeBlock(block, index))
        .filter((block): block is ProductContentBlock => Boolean(block))
        .sort((left, right) => left.order - right.order)
        .slice(0, 24)
    : [];

  const groups = Array.isArray(source.specs?.groups)
    ? source.specs.groups
        .map((group, index) => normalizeSpecGroup(group, index))
        .filter((group): group is ProductPageSpecGroup => Boolean(group))
        .sort((left, right) => left.order - right.order)
        .slice(0, 12)
    : [];

  const sound = source.sound
    ? {
        signature: cleanText(source.sound.signature, 160),
        bass: cleanText(source.sound.bass, 600),
        mids: cleanText(source.sound.mids, 600),
        treble: cleanText(source.sound.treble, 600),
        soundstage: cleanText(source.sound.soundstage, 600),
        imaging: cleanText(source.sound.imaging, 600),
        detail: cleanText(source.sound.detail, 600),
        comfort: cleanText(source.sound.comfort, 600),
        pairing: cleanText(source.sound.pairing, 600),
        dacAmpRequirement: cleanText(source.sound.dacAmpRequirement, 400),
        genreMatch: cleanList(source.sound.genreMatch, 12, 60),
        graphImage: normalizeMedia(source.sound.graphImage, 0),
        sourceRefs: normalizeSources(source.sound.sourceRefs),
        sourceConfidence: normalizeEnum(source.sound.sourceConfidence, allowedConfidence, undefined),
      }
    : undefined;

  return {
    description: { blocks },
    sound,
    specs: { groups },
    media,
    videos,
    sources,
    seo: source.seo
      ? {
          title: cleanText(source.seo.title, 70),
          metaDescription: cleanText(source.seo.metaDescription, 170),
          keywords: cleanList(source.seo.keywords, 20, 60),
          canonicalPath: safePath(source.seo.canonicalPath || ""),
          ogImage: safeUrl(source.seo.ogImage || ""),
        }
      : undefined,
    seoWarnings: cleanList(source.seoWarnings, 20, 120),
    contentStatus: normalizeEnum(source.contentStatus, new Set(["draft", "needs_research", "reviewed", "published"]), "draft"),
    updatedAt: cleanText(source.updatedAt, 40),
  };
}

export function validateProductPageContent(product: Partial<Product>, page?: ProductPageContent): ProductPageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = typeof product.name === "object" ? product.name.en || product.name.ar : "";

  if (!name) errors.push("Missing product name.");
  if (!product.brand) errors.push("Missing brand.");
  if (!product.category) errors.push("Missing category.");
  if (!Number(product.price)) errors.push("Invalid or missing price.");
  if (!product.image) errors.push("Missing main image.");

  const blocks = page?.description?.blocks?.filter((block) => block.visible !== false) || [];
  if (!blocks.length) warnings.push("No product page description blocks.");
  if (!page?.seo?.title) warnings.push("Missing SEO title.");
  if (!page?.seo?.metaDescription) warnings.push("Missing meta description.");
  if (!page?.seo?.canonicalPath) warnings.push("Missing canonical path.");
  if (!page?.seo?.ogImage && !product.image) warnings.push("Missing OG image.");
  if (!page?.sound || !hasSoundContent(page.sound)) warnings.push("Sound tab needs research.");
  if (!page?.specs?.groups?.some((group) => group.specs.length)) warnings.push("Specs groups are empty.");
  if (!page?.sources?.length) warnings.push("No source references.");

  for (const media of page?.media || []) {
    if (!media.alt) warnings.push(`Missing alt text for media ${media.id}.`);
    if (!media.width || !media.height) warnings.push(`Missing width/height for media ${media.id}.`);
    if (media.licenseStatus === "unknown") warnings.push(`Unknown license for media ${media.id}.`);
    if (media.licenseStatus === "do_not_use") errors.push(`Media ${media.id} is marked do not use.`);
    if (containsPrivateToken(media.url) || containsPrivateToken(media.sourceUrl || "")) errors.push(`Private token-like URL found in media ${media.id}.`);
  }

  for (const source of page?.sources || []) {
    if (containsPrivateToken(source.url)) errors.push(`Private token-like URL found in source ${source.id}.`);
  }

  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 6);
  return { errors, warnings, score };
}

export function buildProductPageDraft(product: Partial<Product>): ProductPageContent {
  const name = product.name?.en || product.name?.ar || "Product";
  const canonicalSlug = product.slug ? `/product/${product.slug}` : "";
  const specs = (product.specs || [])
    .map((spec) => ({
      name: typeof spec.label === "string" ? spec.label : spec.label.en || spec.label.ar || "",
      value: spec.value,
    }))
    .filter((spec) => spec.name && spec.value);

  const media = [product.image, ...(product.gallery || [])]
    .filter(Boolean)
    .map((url, index) => ({
      id: `media_${index + 1}`,
      url,
      alt: `${name} ${index === 0 ? "main image" : `gallery image ${index}`}`,
      licenseStatus: "unknown",
      placement: index === 0 ? "gallery" : "description",
      order: index,
      isPrimary: index === 0,
    })) satisfies ProductPageMedia[];

  return {
    description: {
      blocks: [
        {
          id: "desc_hero",
          type: "hero_editorial",
          title: name,
          subtitle: product.brand || "",
          body: product.tagline?.en || "",
          media: media[0],
          layout: "image-right",
          order: 0,
          visible: true,
        },
      ],
    },
    sound: { sourceConfidence: "low" },
    specs: specs.length ? { groups: [{ id: "spec_audio", title: "Audio", specs, order: 0 }] } : { groups: [] },
    media,
    videos: [],
    sources: product.sourceUrl
      ? [{ id: "source_primary", title: `${product.brand || "Product"} source`, url: product.sourceUrl, sourceType: "manufacturer", confidence: "medium", usedFields: ["description", "specs"] }]
      : [],
    seo: {
      title: name,
      metaDescription: product.tagline?.en || "",
      canonicalPath: canonicalSlug,
      ogImage: product.image || "",
      keywords: cleanList([product.brand, product.category, ...(product.subCategories || [])], 12, 60),
    },
    seoWarnings: [],
    contentStatus: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export function productPageToDetailContent(page?: ProductPageContent): ProductDetailContent | undefined {
  const normalized = normalizeProductPageContent(page);
  if (!normalized) return undefined;
  return {
    descriptionBlocks: normalized.description?.blocks
      ?.filter((block) => block.visible !== false && block.type !== "faq")
      .map(toEditorialBlock)
      .filter((block): block is ProductEditorialBlock => Boolean(block)),
    sound: normalized.sound ? toSoundProfile(normalized) : undefined,
    specGroups: normalized.specs?.groups?.map(toSpecGroup).filter((group) => group.specs.length),
    video: normalized.videos?.[0]
      ? {
          title: normalized.videos[0].title,
          thumbnail: normalized.videos[0].thumbnail,
          youtubeId: getYoutubeId(normalized.videos[0].url),
        }
      : undefined,
  };
}

function toEditorialBlock(block: ProductContentBlock): ProductEditorialBlock | null {
  if (!block.title && !block.body && !block.media?.url) return null;
  return {
    id: block.id,
    title: block.title,
    body: block.body,
    image: block.media?.url ? { url: block.media.url, alt: block.media.alt, width: block.media.width, height: block.media.height } : undefined,
    layout: block.layout === "image-left" || block.layout === "image-right" ? block.layout : block.media?.url ? "full-width-image" : "text-only",
  };
}

function toSoundProfile(page: ProductPageContent): ProductSoundProfile {
  const sound = page.sound || {};
  const notes = [
    ["Bass", sound.bass],
    ["Midrange", sound.mids],
    ["Treble", sound.treble],
    ["Soundstage", sound.soundstage],
    ["Imaging", sound.imaging],
    ["Detail", sound.detail],
    ["Comfort", sound.comfort],
    ["Pairing", sound.pairing],
    ["DAC/AMP", sound.dacAmpRequirement],
  ]
    .filter(([, body]) => Boolean(body))
    .map(([title, body], index) => ({ id: `sound_${index}`, title: String(title), body: String(body) }));

  return {
    signature: sound.signature,
    summary: notes[0]?.body,
    strengths: notes.map((note) => `${note.title}: ${note.body}`),
    listeningNotes: notes,
    soundTags: sound.genreMatch,
    frequencyGraphImage: sound.graphImage?.url ? { url: sound.graphImage.url, alt: sound.graphImage.alt, width: sound.graphImage.width, height: sound.graphImage.height } : undefined,
  };
}

function toSpecGroup(group: ProductPageSpecGroup): ProductSpecGroup {
  return {
    title: group.title,
    specs: group.specs.map((spec) => ({ name: spec.name, value: spec.value, unit: spec.unit })).filter((spec) => spec.name && spec.value),
  };
}

function normalizeBlock(block: ProductContentBlock, index: number): ProductContentBlock | null {
  if (!block || typeof block !== "object") return null;
  const type = normalizeEnum(block.type, allowedBlockTypes, "feature");
  return {
    id: cleanText(block.id || `block_${index}`, 80),
    type,
    title: cleanText(block.title, 180),
    subtitle: cleanText(block.subtitle, 220),
    body: cleanText(block.body, 5000),
    media: normalizeMedia(block.media, index),
    video: block.video ? { id: cleanText(block.video.id || `video_${index}`, 80), title: cleanText(block.video.title, 140), url: safeUrl(block.video.url), thumbnail: safeUrl(block.video.thumbnail || ""), sourceUrl: safeUrl(block.video.sourceUrl || "") } : undefined,
    layout: normalizeEnum(block.layout, allowedLayouts, "image-right"),
    order: Number.isFinite(Number(block.order)) ? Number(block.order) : index,
    visible: block.visible !== false,
    sourceRefIds: cleanList(block.sourceRefIds, 12, 80),
  };
}

function normalizeSpecGroup(group: ProductPageSpecGroup, index: number): ProductPageSpecGroup | null {
  if (!group || typeof group !== "object") return null;
  const specs = Array.isArray(group.specs)
    ? group.specs
        .map((spec) => ({
          name: cleanText(spec.name, 120),
          value: cleanText(spec.value, 240),
          unit: cleanText(spec.unit, 40),
          sourceRefId: cleanText(spec.sourceRefId, 80),
        }))
        .filter((spec) => spec.name && spec.value)
        .slice(0, 40)
    : [];
  return {
    id: cleanText(group.id || `spec_group_${index}`, 80),
    title: cleanText(group.title || "Specs", 80),
    specs,
    order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
  };
}

function normalizeMediaList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((media, index) => normalizeMedia(media, index)).filter((media): media is ProductPageMedia => Boolean(media)).slice(0, 40);
}

function normalizeMedia(media: ProductPageMedia | undefined, index: number): ProductPageMedia | undefined {
  if (!media || typeof media !== "object") return undefined;
  const url = safeUrl(media.url);
  if (!url) return undefined;
  return {
    id: cleanText(media.id || `media_${index}`, 80),
    url,
    alt: cleanText(media.alt, 180),
    caption: cleanText(media.caption, 240),
    width: positiveNumber(media.width),
    height: positiveNumber(media.height),
    sourceUrl: safeUrl(media.sourceUrl || ""),
    licenseStatus: normalizeEnum(media.licenseStatus, allowedLicenses, "unknown"),
    placement: normalizeEnum(media.placement, allowedPlacements, "description"),
    order: Number.isFinite(Number(media.order)) ? Number(media.order) : index,
    isPrimary: Boolean(media.isPrimary),
  };
}

function normalizeSources(value: unknown): ProductSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((source, index) => {
      const item = source as ProductSourceRef;
      const url = safeUrl(item.url);
      if (!url) return null;
      return {
        id: cleanText(item.id || `source_${index}`, 80),
        title: cleanText(item.title, 180),
        url,
        sourceType: normalizeEnum(item.sourceType, allowedSourceTypes, "internal"),
        confidence: normalizeEnum(item.confidence, allowedConfidence, "low"),
        usedFields: cleanList(item.usedFields, 8, 40).filter((field) => ["specs", "sound", "description", "images"].includes(field)) as ProductSourceRef["usedFields"],
        notes: cleanText(item.notes, 500),
      };
    })
    .filter((source): source is ProductSourceRef => Boolean(source))
    .slice(0, 40);
}

function hasSoundContent(sound: NonNullable<ProductPageContent["sound"]>) {
  return Boolean(
    sound.signature ||
      sound.bass ||
      sound.mids ||
      sound.treble ||
      sound.soundstage ||
      sound.imaging ||
      sound.detail ||
      sound.comfort ||
      sound.pairing ||
      sound.genreMatch?.length ||
      sound.graphImage?.url,
  );
}

function cleanText(value: unknown, max = 500) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\bjavascript\s*:/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  return Array.from(new Set(list.map((item) => cleanText(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function safeUrl(value: unknown) {
  const url = cleanText(value, 1000);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

function safePath(value: unknown) {
  const path = cleanText(value, 240);
  if (!path) return "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "";
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function normalizeEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T | undefined) {
  const normalized = String(value || "").trim();
  return allowed.has(normalized) ? (normalized as T) : fallback;
}

function containsPrivateToken(value: string) {
  return /(token|secret|service_role|password|access_key|apikey|api_key)=/i.test(value || "");
}

function getYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return match?.[1];
}
