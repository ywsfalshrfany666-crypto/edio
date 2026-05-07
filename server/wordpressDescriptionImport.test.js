import { describe, expect, it } from "vitest";
import {
  applyWordPressDescriptionImport,
  buildWordPressDescriptionBlocks,
  createWordPressDescriptionImportPlan,
  rollbackWordPressDescriptionImport,
  validatePublicImageUrl,
} from "./wordpressDescriptionImport.js";

const sampleCsv = [
  [
    "ID",
    "Type",
    "SKU",
    "Name",
    "Short description",
    "Description",
    "Images",
    "Brands",
  ].join(","),
  [
    "30256",
    "simple",
    "CHU-II",
    "\"Moondrop Chu II\"",
    "\"Compact IEM\"",
    "\"<p>Intro text</p><img src=\"\"https://brand.example.com/chu-feature.webp\"\" alt=\"\"Feature image\"\" /><p>Specs follow</p><img src=\"\"https://brand.example.com/chu-spec-chart.jpg\"\" alt=\"\"Frequency response chart\"\" width=\"\"1200\"\" height=\"\"1700\"\" />\"",
    "\"https://cdn.example.com/chu-main.jpg\"",
    "Moondrop",
  ].join(","),
  [
    "99999",
    "simple",
    "",
    "\"Moondrop Chu Two\"",
    "",
    "\"<img src=\"\"https://brand.example.com/not-safe.webp\"\" />\"",
    "",
    "Moondrop",
  ].join(","),
].join("\n");

function createDb() {
  return {
    meta: {},
    auditLogs: [],
    importJobLogs: [],
    products: [
      {
        id: "30256",
        legacyId: "30256",
        slug: "moondrop-chu-ii-30256",
        sku: "CHU-II",
        name: { en: "Moondrop Chu II", ar: "Moondrop Chu II" },
        brand: "Moondrop",
        category: "iems",
        price: 29000,
        stock: 6,
        image: "/media/imports/chu.jpg",
        gallery: ["/media/imports/chu.jpg"],
        descriptionBlocks: [],
      },
    ],
  };
}

describe("WordPress description import", () => {
  it("builds ordered text, image, and spec image blocks from HTML", () => {
    const row = {
      name: "Moondrop Chu II",
      raw: {
        "Short description": "Compact IEM",
        Description: `<p>Intro</p><img src="https://brand.example.com/spec-table.jpg" alt="Specification table" width="1000" height="1500" />`,
      },
    };
    const blocks = buildWordPressDescriptionBlocks(row, { sourceUrl: "https://brand.example.com/chu" });

    expect(blocks.map((block) => block.type)).toEqual(["text", "text", "spec_image"]);
    expect(blocks[0].content.text).toBe("Compact IEM");
    expect(blocks[2].media.url).toContain("spec-table.jpg");
  });

  it("keeps srcset description images and classifies box media from context", () => {
    const row = {
      name: "Moondrop Chu II",
      raw: {
        Description: `<h2>What's in the box</h2><img data-srcset="https://brand.example.com/chu-box.webp 1200w, https://brand.example.com/chu-box-small.webp 600w" alt="Package contents" />`,
      },
    };
    const blocks = buildWordPressDescriptionBlocks(row, { sourceUrl: "https://brand.example.com/chu" });

    const imageBlock = blocks.find((block) => block.media?.url);
    expect(imageBlock.media.url).toBe("https://brand.example.com/chu-box.webp");
    expect(imageBlock.media.role).toBe("box_image");
  });

  it("plans only safe exact matches and skips fuzzy/non-matches", async () => {
    const plan = await createWordPressDescriptionImportPlan(sampleCsv, createDb());

    expect(plan.summary.safeMatches).toBe(1);
    expect(plan.summary.skipped).toBe(1);
    expect(plan.items[0]).toMatchObject({ matchType: "sku", matchConfidence: 1, safeToImport: true });
    expect(plan.items[1].safeToImport).toBe(false);
  });

  it("applies blocks without changing price, stock, category, image, or gallery", async () => {
    const db = createDb();
    const before = structuredClone(db.products[0]);
    const { report } = await applyWordPressDescriptionImport(sampleCsv, db, {
      importJobId: "job_test",
      imageValidator: async () => ({ ok: true, reason: "test" }),
      now: "2026-05-04T00:00:00.000Z",
    });
    const product = db.products[0];

    expect(report.matchedProducts).toBe(1);
    expect(report.textBlocksAdded).toBeGreaterThan(0);
    expect(report.descriptionImagesAdded).toBe(1);
    expect(report.specImagesAdded).toBe(1);
    expect(product.price).toBe(before.price);
    expect(product.stock).toBe(before.stock);
    expect(product.category).toBe(before.category);
    expect(product.image).toBe(before.image);
    expect(product.gallery).toEqual(before.gallery);
    expect(product.descriptionBlocks.every((block) => block.importJobId === "job_test")).toBe(true);
    expect(db.auditLogs.some((log) => log.action === "wordpress_description_import_completed")).toBe(true);
  });

  it("deduplicates image blocks and rolls back only the import job", async () => {
    const db = createDb();
    await applyWordPressDescriptionImport(sampleCsv, db, {
      importJobId: "job_test",
      imageValidator: async () => ({ ok: true, reason: "test" }),
    });
    const firstCount = db.products[0].descriptionBlocks.length;
    const second = await applyWordPressDescriptionImport(sampleCsv, db, {
      importJobId: "job_second",
      imageValidator: async () => ({ ok: true, reason: "test" }),
    });
    expect(second.report.duplicateBlocksSkipped).toBeGreaterThan(0);
    expect(db.products[0].descriptionBlocks).toHaveLength(firstCount);

    const rollback = rollbackWordPressDescriptionImport(db, "job_test");
    expect(rollback.blocksRemoved).toBe(firstCount);
    expect(db.products[0].descriptionBlocks).toHaveLength(0);
  });

  it("blocks localhost and private image URLs before validation", async () => {
    await expect(validatePublicImageUrl("http://127.0.0.1/image.jpg")).resolves.toMatchObject({ ok: false });
    await expect(validatePublicImageUrl("ftp://example.com/image.jpg")).resolves.toMatchObject({ ok: false });
    await expect(validatePublicImageUrl("https://brand.example.com/file.svg")).resolves.toMatchObject({ ok: false });
  });
});
