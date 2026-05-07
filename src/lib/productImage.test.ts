import { describe, expect, it } from "vitest";
import {
  getBestProductCardImage,
  getProductCardImageMode,
  getProductCardThumbnailPresentation,
  isPotentialTransparentPng,
  PRODUCT_CARD_THUMBNAIL_POLICY,
  PRODUCT_IMAGE_CANVAS_BACKGROUND,
  PRODUCT_IMAGE_CANVAS_CLASS,
} from "./productImage";

describe("product image display policy", () => {
  it("uses a pure white product canvas for transparent product art", () => {
    expect(PRODUCT_IMAGE_CANVAS_CLASS).toBe("product-image-canvas");
    expect(PRODUCT_IMAGE_CANVAS_BACKGROUND).toBe("#FFFFFF");
    expect(PRODUCT_CARD_THUMBNAIL_POLICY).toMatchObject({
      aspectRatio: "1 / 1",
      background: "#FFFFFF",
      fit: "contain",
      preservesOriginal: true,
    });
  });

  it("detects PNG candidates that may carry alpha transparency", () => {
    expect(isPotentialTransparentPng("/media/imports/iem.png")).toBe(true);
    expect(isPotentialTransparentPng("https://example.com/product.PNG?width=800")).toBe(true);
    expect(isPotentialTransparentPng("data:image/png;base64,abc")).toBe(true);
    expect(isPotentialTransparentPng("/media/imports/iem.webp")).toBe(false);
  });

  it("prefers normalized card images and avoids spec-like gallery images", () => {
    expect(
      getBestProductCardImage({
        image: "/media/main.jpg",
        normalizedImageUrl: "/media/normalized-card.webp",
        gallery: ["/media/frequency-response-chart.jpg", "/media/side.jpg"],
      }),
    ).toBe("/media/normalized-card.webp");

    expect(
      getBestProductCardImage({
        gallery: ["/media/specification-table.jpg", "/media/product-side.webp"],
      }),
    ).toBe("/media/product-side.webp");
  });

  it("prefers square card derivatives before original images", () => {
    expect(
      getBestProductCardImage({
        image: "/media/main-wide.jpg",
        gallery: ["/media/side.jpg"],
        squareThumbnailUrl: "/media/main-square-card.webp",
      }),
    ).toBe("/media/main-square-card.webp");

    expect(
      getBestProductCardImage({
        image: "/media/main-wide.jpg",
        imageProcessing: {
          paddedPreviewUrl: "/media/main-padded-preview.webp",
        },
      }),
    ).toBe("/media/main-padded-preview.webp");
  });

  it("builds a square white contain presentation for storefront product cards", () => {
    expect(
      getProductCardThumbnailPresentation({
        image: "/media/main-wide.jpg",
      }),
    ).toEqual({
      src: "/media/main-wide.jpg",
      canvasClass: PRODUCT_IMAGE_CANVAS_CLASS,
      background: PRODUCT_IMAGE_CANVAS_BACKGROUND,
      fit: "contain",
      aspectRatio: "1 / 1",
      preservesOriginal: true,
    });
  });

  it("uses cover for normal card photos and contain for transparent PNG candidates", () => {
    expect(getProductCardImageMode("/media/product.jpg")).toBe("cover");
    expect(getProductCardImageMode("/media/product.png")).toBe("contain");
  });
});
