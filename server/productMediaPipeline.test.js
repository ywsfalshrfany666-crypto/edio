import { describe, expect, it, vi } from "vitest";
import {
  buildImageMetadata,
  buildImportMediaJob,
  buildProductMediaSet,
  checksumBuffer,
  collectImageCandidatesFromSources,
  dedupeAssetCandidates,
  retryWithBackoff,
  scoreHeroCandidate,
  stableImageUrlKey,
} from "./productMediaPipeline.js";

const product = {
  id: "prod_1",
  brand: "HiFiMAN",
  nameEn: "HiFiMAN HE6se V2",
  category: "headphones",
};

describe("product media pipeline", () => {
  it("normalizes URL keys by stripping query strings and size suffixes", () => {
    expect(stableImageUrlKey("https://cdn.example.com/products/he6se-v2_800x800.jpg?width=300")).toBe(
      "cdn.example.com/products/he6se-v2",
    );
  });

  it("dedupes exact and near duplicate candidates while keeping the better source", () => {
    const checksum = checksumBuffer(Buffer.from("same image bytes"));
    const { candidates, events } = dedupeAssetCandidates([
      {
        url: "/media/imports/he6se-v2-800.jpg",
        sourceType: "retailer",
        checksum,
        metadata: { width: 800, height: 800, format: "jpg" },
      },
      {
        url: "/media/imports/he6se-v2-1500.jpg",
        sourceType: "official",
        checksum,
        metadata: { width: 1500, height: 1500, format: "jpg" },
      },
      {
        url: "https://cdn.example.com/he6se-v2_300x300.jpg",
        sourceType: "retailer",
        metadata: { width: 300, height: 300, format: "jpg" },
      },
      {
        url: "https://cdn.example.com/he6se-v2_1500x1500.jpg",
        sourceType: "retailer",
        metadata: { width: 1500, height: 1500, format: "jpg" },
      },
    ]);

    expect(candidates).toHaveLength(2);
    expect(events.map((event) => event.type)).toContain("exact_duplicate");
    expect(events.map((event) => event.type)).toContain("near_duplicate");
    expect(candidates.some((candidate) => candidate.sourceType === "official")).toBe(true);
  });

  it("scores explicit high-resolution primary images above noisy low-resolution images", () => {
    const hero = scoreHeroCandidate(
      {
        url: "https://brand.example.com/he6se-v2-main-front.jpg",
        sourceType: "official",
        role: "main",
        metadata: { width: 1600, height: 1600, format: "jpg" },
      },
      product,
    );
    const noisy = scoreHeroCandidate(
      {
        url: "https://blog.example.com/youtube-logo-thumb.jpg",
        sourceType: "community",
        metadata: { width: 240, height: 120, format: "jpg" },
      },
      product,
    );

    expect(hero.score).toBeGreaterThan(0.8);
    expect(hero.reasons).toContain("explicit_primary_role");
    expect(noisy.score).toBeLessThan(hero.score);
    expect(noisy.reasons).toContain("noisy_filename_penalty");
  });

  it("selects a hero and fills storefront metadata", () => {
    const result = buildProductMediaSet(
      [
        {
          url: "/media/imports/he6se-v2-gallery.jpg",
          sourceType: "retailer",
          role: "gallery",
          metadata: { width: 900, height: 900, format: "jpg" },
        },
        {
          url: "/media/imports/he6se-v2-main-front.jpg",
          sourceType: "official",
          role: "main",
          metadata: { width: 1500, height: 1500, format: "jpg" },
        },
      ],
      product,
    );

    expect(result.media[0].role).toBe("main");
    expect(result.media[0].url).toContain("main-front");
    expect(result.media[0].altText).toContain("HiFiMAN HE6se V2");
    expect(result.summary.selectedHeroReasons).toContain("explicit_primary_role");
  });

  it("keeps generated alt text concise and useful", () => {
    const metadata = buildImageMetadata(product, { filename: "he6se-v2-front.jpg" }, "main");
    expect(metadata.altText).toBe("HiFiMAN HE6se V2 front view headphones");
    expect(metadata.title).toBe("HiFiMAN HE6se V2 main image");
  });

  it("retries transient failures with injectable sleep", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("rate limited"), { retryAfterMs: 1 }))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn(() => Promise.resolve());

    await expect(retryWithBackoff(operation, { maxAttempts: 2, sleep })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });

  it("collects image candidates from source pages, structured data, galleries, and loose URLs", () => {
    const candidates = collectImageCandidatesFromSources(
      {
        imageUrls: ["https://retailer.example.com/he6se-gallery-2.jpg"],
        sources: [
          {
            sourceType: "official",
            sourceUrl: "https://brand.example.com/he6se-v2",
            mainImage: "https://brand.example.com/he6se-v2-main-front.png",
            gallery: [
              { url: "https://brand.example.com/he6se-v2-side.png", role: "gallery", width: 1200, height: 1200 },
            ],
          },
          {
            sourceType: "retailer",
            url: "https://shop.example.com/he6se-v2",
            structuredData: {
              image: ["https://shop.example.com/he6se-primary.jpg", "https://shop.example.com/he6se-box.jpg"],
            },
          },
        ],
      },
      { productId: "prod_1", importJobId: "job_1" },
    );

    expect(candidates).toHaveLength(5);
    expect(candidates[0].productId).toBe("prod_1");
    expect(candidates.some((candidate) => candidate.role === "main" && candidate.sourceType === "official")).toBe(true);
    expect(candidates.some((candidate) => candidate.sourceType === "structured_data")).toBe(true);
    expect(candidates.every((candidate) => candidate.provenance.importJobId === "job_1")).toBe(true);
  });

  it("builds stable import job ids when the same idempotency key is used", () => {
    const first = buildImportMediaJob({ productId: "prod_1", mode: "media_import", idempotencyKey: "prod_1:source:a" });
    const second = buildImportMediaJob({ productId: "prod_1", mode: "media_import", idempotencyKey: "prod_1:source:a" });
    const different = buildImportMediaJob({ productId: "prod_1", mode: "media_import", idempotencyKey: "prod_1:source:b" });

    expect(first.id).toBe(second.id);
    expect(first.id).not.toBe(different.id);
  });
});
