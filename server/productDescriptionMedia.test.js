import { describe, expect, it } from "vitest";
import {
  buildDescriptionBlocksFromImportDraft,
  classifyDescriptionImageCandidate,
  extractDescriptionImageCandidatesFromHtml,
} from "./productDescriptionMedia.js";

describe("product description media", () => {
  it("extracts images from product description HTML without putting them in gallery", () => {
    const html = `
      <section class="product-description">
        <h2>Specifications</h2>
        <img src="https://brand.example.com/chu-ii-spec-table.jpg" alt="Chu II specification table" width="1200" height="1800" />
      </section>
    `;
    const candidates = extractDescriptionImageCandidatesFromHtml(html, { sourceUrl: "https://brand.example.com/chu-ii" });
    const blocks = buildDescriptionBlocksFromImportDraft({ nameEn: "Moondrop Chu II", descriptionHtml: html });

    expect(candidates).toHaveLength(1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("spec_image");
    expect(blocks[0].media.role).toBe("spec_image");
    expect(blocks[0].sourceUrl).toContain("brand.example.com");
  });

  it("classifies feature and spec images with confidence reasons", () => {
    const spec = classifyDescriptionImageCandidate({
      url: "https://brand.example.com/frequency-response-chart.png",
      alt: "Frequency response chart",
      width: 900,
      height: 1400,
    });
    const feature = classifyDescriptionImageCandidate({
      url: "https://brand.example.com/driver-design.webp",
      alt: "Driver design feature",
    });

    expect(spec.role).toBe("spec_image");
    expect(spec.confidence).toBeGreaterThan(0.7);
    expect(spec.reason).toContain("spec_image_hint");
    expect(feature.role).toBe("feature");
  });

  it("classifies box images from package context and extracts srcset fallback", () => {
    const html = `
      <section>
        <h2>Package Contents</h2>
        <img data-srcset="https://brand.example.com/box.webp 1200w, https://brand.example.com/box-small.webp 600w" alt="Included accessories in the box" />
      </section>
    `;
    const candidates = extractDescriptionImageCandidatesFromHtml(html);
    const blocks = buildDescriptionBlocksFromImportDraft({ nameEn: "Test IEM", descriptionHtml: html });

    expect(candidates[0].url).toBe("https://brand.example.com/box.webp");
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].media.role).toBe("box_image");
  });

  it("blocks localhost and private description image URLs", () => {
    const blocks = buildDescriptionBlocksFromImportDraft({
      descriptionImages: ["http://127.0.0.1/private.png", "https://brand.example.com/feature.png"],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].media.url).toBe("https://brand.example.com/feature.png");
  });
});
