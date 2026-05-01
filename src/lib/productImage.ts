export const PRODUCT_IMAGE_CANVAS_CLASS = "product-image-canvas";
export const PRODUCT_IMAGE_CANVAS_BACKGROUND = "#FFFFFF";

export function isPotentialTransparentPng(src: string | null | undefined) {
  return /\.png(?:$|[?#])/i.test(String(src || "").trim());
}
