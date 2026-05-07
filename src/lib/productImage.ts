export const PRODUCT_IMAGE_CANVAS_CLASS = "product-image-canvas";
export const PRODUCT_IMAGE_CANVAS_BACKGROUND = "#FFFFFF";
export const PRODUCT_CARD_THUMBNAIL_POLICY = {
  background: PRODUCT_IMAGE_CANVAS_BACKGROUND,
  fit: "contain",
  aspectRatio: "1 / 1",
  preservesOriginal: true,
} as const;

export function isPotentialTransparentPng(src: string | null | undefined) {
  const value = String(src || "").trim();
  return /\.png(?:$|[?#])/i.test(value) || /^data:image\/png[;,]/i.test(value);
}

type ProductCardImageCandidate = {
  image?: string;
  gallery?: string[];
  squareThumbnailUrl?: string | null;
  square_thumbnail_url?: string | null;
  squareThumbnail?: string | null;
  paddedPreviewUrl?: string | null;
  padded_preview_url?: string | null;
  paddedPreview?: string | null;
  thumbnailUrl?: string | null;
  normalizedImageUrl?: string | null;
  normalizedCardImageUrl?: string | null;
  cardImageUrl?: string | null;
  imageProcessing?: {
    squareThumbnailUrl?: string | null;
    square_thumbnail_url?: string | null;
    squareThumbnail?: string | null;
    paddedPreviewUrl?: string | null;
    padded_preview_url?: string | null;
    paddedPreview?: string | null;
    thumbnailUrl?: string | null;
    cardImageUrl?: string | null;
    normalizedCardImageUrl?: string | null;
    outputUrl?: string | null;
  } | null;
};

export type ProductCardImageMode = "cover" | "contain";
export type ProductCardThumbnailPresentation = {
  src: string;
  canvasClass: typeof PRODUCT_IMAGE_CANVAS_CLASS;
  background: typeof PRODUCT_IMAGE_CANVAS_BACKGROUND;
  fit: typeof PRODUCT_CARD_THUMBNAIL_POLICY.fit;
  aspectRatio: typeof PRODUCT_CARD_THUMBNAIL_POLICY.aspectRatio;
  preservesOriginal: typeof PRODUCT_CARD_THUMBNAIL_POLICY.preservesOriginal;
};

export function getBestProductCardImage(product: ProductCardImageCandidate) {
  const candidates = [
    product.squareThumbnailUrl,
    product.square_thumbnail_url,
    product.squareThumbnail,
    product.paddedPreviewUrl,
    product.padded_preview_url,
    product.paddedPreview,
    product.normalizedCardImageUrl,
    product.cardImageUrl,
    product.thumbnailUrl,
    product.imageProcessing?.squareThumbnailUrl,
    product.imageProcessing?.square_thumbnail_url,
    product.imageProcessing?.squareThumbnail,
    product.imageProcessing?.paddedPreviewUrl,
    product.imageProcessing?.padded_preview_url,
    product.imageProcessing?.paddedPreview,
    product.imageProcessing?.cardImageUrl,
    product.imageProcessing?.normalizedCardImageUrl,
    product.imageProcessing?.thumbnailUrl,
    product.normalizedImageUrl,
    product.imageProcessing?.outputUrl,
    product.image,
    ...(Array.isArray(product.gallery) ? product.gallery : []),
  ];

  return candidates.find((candidate) => isUsableProductCardImage(candidate)) || "";
}

export function getProductCardThumbnailPresentation(product: ProductCardImageCandidate): ProductCardThumbnailPresentation {
  return {
    src: getBestProductCardImage(product),
    canvasClass: PRODUCT_IMAGE_CANVAS_CLASS,
    background: PRODUCT_IMAGE_CANVAS_BACKGROUND,
    fit: PRODUCT_CARD_THUMBNAIL_POLICY.fit,
    aspectRatio: PRODUCT_CARD_THUMBNAIL_POLICY.aspectRatio,
    preservesOriginal: PRODUCT_CARD_THUMBNAIL_POLICY.preservesOriginal,
  };
}

export function getProductCardImageMode(src: string | null | undefined): ProductCardImageMode {
  return isPotentialTransparentPng(src) ? "contain" : "cover";
}

function isUsableProductCardImage(src: string | null | undefined) {
  const value = String(src || "").trim();
  if (!value) return false;
  if (/\/(?:spec|specification|frequency|response|chart|graph|measurement)[-_./]/i.test(value)) return false;
  return /^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpe?g|webp|avif);base64,)/i.test(value);
}
