import type { Product, ProductDescriptionBlock, ProductDescriptionBlockType } from "@/data/catalog";

export type NormalizedDescriptionBlock = {
  id: string;
  type: ProductDescriptionBlockType;
  imageRole: NonNullable<ProductDescriptionBlock["media"]>["role"] | "description";
  text: string;
  mediaUrl: string;
  alt: string;
  caption: string;
  section: string;
  width?: number;
  height?: number;
  extractedText: string;
  sortOrder: number;
};

export function normalizeProductDescriptionBlocks(product: Product, lang: "en" | "ar"): NormalizedDescriptionBlock[] {
  const blocks = Array.isArray(product.descriptionBlocks) ? product.descriptionBlocks : [];
  const productName = product.name?.[lang] || product.name?.en || product.slug || "Product";

  return blocks
    .map((block, index) => normalizeDescriptionBlock(block, index, productName))
    .filter((block): block is NormalizedDescriptionBlock => {
      if (!block) return false;
      if (block.type === "text" || block.type === "callout") return Boolean(block.text);
      return Boolean(block.mediaUrl);
    })
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function splitProductDescriptionSections(blocks: NormalizedDescriptionBlock[]) {
  const explicitBoxTextBlocks = blocks.filter((block) => (block.type === "text" || block.type === "callout") && block.section === "box_contents");
  const textBlocks = blocks.filter(
    (block) => (block.type === "text" || block.type === "callout") && block.section !== "box_contents" && block.section !== "technical_specs",
  );
  const imageBlocks = blocks.filter((block) => block.mediaUrl);
  const specImageBlocks = imageBlocks.filter((block) =>
    block.type === "spec_image" || block.section === "technical_specs" || ["spec_image", "comparison", "diagram"].includes(block.imageRole),
  );
  const boxImageBlocks = imageBlocks.filter((block) => block.imageRole === "box_image" || block.section === "box_contents");
  const descriptionImageBlocks = imageBlocks.filter(
    (block) => !specImageBlocks.includes(block) && !boxImageBlocks.includes(block),
  );

  return {
    textBlocks,
    descriptionImageBlocks,
    specImageBlocks,
    boxImageBlocks,
    boxContents: extractBoxContents([...explicitBoxTextBlocks, ...textBlocks]),
  };
}

function normalizeDescriptionBlock(
  block: ProductDescriptionBlock,
  index: number,
  productName: string,
): NormalizedDescriptionBlock | null {
  if (!block || typeof block !== "object") return null;
  const type = normalizeBlockType(block.type);
  const media = block.media || null;
  const text = safeText(block.content?.text || block.content?.markdown || block.content?.html_or_markdown || "");
  const mediaUrl = safeUrl(media?.url || "");
  const imageRole = normalizeImageRole(media?.role || block.content?.imageRole);
  const section = safeText(block.section || block.content?.section || "");
  const alt = safeText(block.altText || block.alt_text || media?.alt || `${productName} description image`).slice(0, 180);
  const caption = safeText(block.caption || "");
  const extractedText = safeText(block.extractedText || block.extracted_text || "");
  const width = positiveNumber(media?.width);
  const height = positiveNumber(media?.height);

  return {
    id: block.id || `description-block-${index}`,
    type,
    imageRole,
    text,
    mediaUrl,
    alt,
    caption,
    section: normalizeSection(section, type, imageRole),
    width,
    height,
    extractedText,
    sortOrder: Number.isFinite(Number(block.sortOrder ?? block.sort_order))
      ? Number(block.sortOrder ?? block.sort_order)
      : index,
  };
}

function normalizeSection(value: string, type: ProductDescriptionBlockType, imageRole: NormalizedDescriptionBlock["imageRole"]) {
  const section = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  if (["description", "description_media", "technical_specs", "box_contents"].includes(section)) return section;
  if (imageRole === "box_image") return "box_contents";
  if (type === "spec_image" || ["spec_image", "comparison", "diagram"].includes(imageRole)) return "technical_specs";
  if (type === "image" || type === "image_group") return "description_media";
  return "description";
}

function normalizeBlockType(value: string): ProductDescriptionBlockType {
  if (value === "spec_image" || value === "image_group" || value === "callout" || value === "text") return value;
  return "image";
}

function normalizeImageRole(value: unknown): NormalizedDescriptionBlock["imageRole"] {
  const role = String(value || "description").trim().toLowerCase().replace(/-/g, "_");
  if (
    [
      "description",
      "feature",
      "spec_image",
      "box_image",
      "unknown_description_image",
      "comparison",
      "diagram",
      "unknown",
    ].includes(role)
  ) {
    return role as NormalizedDescriptionBlock["imageRole"];
  }
  if (["spec", "specs", "technical", "chart"].includes(role)) return "spec_image";
  if (["box", "package", "package_contents", "contents", "included"].includes(role)) return "box_image";
  return "description";
}

function extractBoxContents(textBlocks: NormalizedDescriptionBlock[]) {
  const items: string[] = [];
  const addItem = (value: string) => {
    const clean = safeText(value)
      .replace(/^[-•*]+\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!clean || clean.length > 120) return;
    if (!looksLikeBoxItem(clean)) return;
    if (!items.some((item) => item.toLowerCase() === clean.toLowerCase())) items.push(clean);
  };

  for (const block of textBlocks) {
    const text = block.text;
    if (!/\b(?:inside the box|in the box|package contents?|what(?:'|’)s in the box|contents)\b/i.test(text)) continue;
    const afterHeading = text.split(/\b(?:inside the box|in the box|package contents?|what(?:'|’)s in the box|contents)\b[:：-]?/i)[1] || "";
    for (const line of afterHeading.split(/\n|(?=\b\d+\s*x\b)|(?=\bx\d+\b)|(?=\b\d+[.)]\s+)/i).slice(0, 12)) {
      addItem(line);
    }
  }

  return items.slice(0, 10);
}

function looksLikeBoxItem(value: string) {
  return /\b(?:user manual|manual|warranty card|service card|certificate|storage case|carrying pouch|pouch|adapter|ear\s*tips?|eartips?|ear\s*pads?|plug|cable|case|bag|earphones?|headphones?|iems?)\b/i.test(value) ||
    /^(?:x\d+|\d+\s*x)\b/i.test(value);
}

function safeUrl(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpe?g|webp|avif);base64,)/i.test(normalized)) return normalized;
  return "";
}

function safeText(value: string) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
