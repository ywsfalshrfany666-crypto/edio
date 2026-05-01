import { describe, expect, it } from "vitest";
import {
  isPotentialTransparentPng,
  PRODUCT_IMAGE_CANVAS_BACKGROUND,
  PRODUCT_IMAGE_CANVAS_CLASS,
} from "./productImage";

describe("product image display policy", () => {
  it("uses a pure white product canvas for transparent product art", () => {
    expect(PRODUCT_IMAGE_CANVAS_CLASS).toBe("product-image-canvas");
    expect(PRODUCT_IMAGE_CANVAS_BACKGROUND).toBe("#FFFFFF");
  });

  it("detects PNG candidates that may carry alpha transparency", () => {
    expect(isPotentialTransparentPng("/media/imports/iem.png")).toBe(true);
    expect(isPotentialTransparentPng("https://example.com/product.PNG?width=800")).toBe(true);
    expect(isPotentialTransparentPng("/media/imports/iem.webp")).toBe(false);
  });
});
