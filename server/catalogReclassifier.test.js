import { describe, expect, it } from "vitest";
import {
  applyCatalogReclassificationPlan,
  buildCatalogReclassificationPlan,
  buildReclassificationCsv,
  buildReclassificationMarkdown,
} from "./catalogReclassifier.js";

const categories = [
  { slug: "headphones" },
  { slug: "iems" },
  { slug: "dap" },
  { slug: "dac" },
  { slug: "audio-interface" },
  { slug: "mic" },
  { slug: "accessories" },
];

function baseDb(products) {
  return {
    meta: {},
    categories,
    products: JSON.parse(JSON.stringify(products)),
    categoryAssignments: [],
    bulkActionLogs: [],
  };
}

describe("catalog reclassifier", () => {
  it("plans and applies safe secondary category assignments for existing products", async () => {
    const db = baseDb([
      {
        id: "p1",
        slug: "hifiman-ananda",
        name: { en: "HiFiMAN Ananda Planar Magnetic" },
        brand: "HiFiMAN",
        category: "headphones",
        subCategories: ["planar"],
        specs: [{ label: "Driver Type", value: "Planar Magnetic" }],
        features: [],
        tags: [],
        inStock: true,
      },
    ]);

    const plan = await buildCatalogReclassificationPlan(db, { now: "2026-04-25T00:00:00.000Z" });
    expect(plan.summary.total_auto_assigned).toBe(1);
    expect(plan.rows[0].proposed.secondary_category_slugs).toContain("planar-driver");

    const result = applyCatalogReclassificationPlan(db, plan, { now: "2026-04-25T00:00:00.000Z" });
    expect(result.applied_count).toBe(1);
    expect(db.products[0].subCategories).toEqual(["planar-driver"]);
    expect(db.categoryAssignments[0].secondaryCategorySlugs).toEqual(["planar-driver"]);
  });

  it("does not overwrite manually accepted assignments unless force is provided", async () => {
    const lockedProduct = {
      id: "p2",
      slug: "akg-k371",
      name: { en: "AKG K371 Closed-back Headphones" },
      brand: "AKG",
      category: "headphones",
      subCategories: ["closed-back"],
      specs: [{ label: "Driver Type", value: "Dynamic" }],
      features: [],
      tags: [],
      inStock: true,
      acceptedClassificationAt: "2026-04-24T00:00:00.000Z",
      categoryAssignment: {
        productId: "p2",
        primaryCategorySlug: "headphones",
        secondaryCategorySlugs: ["closed-back"],
        confidenceScore: 0.99,
        needsReview: false,
        acceptedAt: "2026-04-24T00:00:00.000Z",
      },
    };

    const lockedPlan = await buildCatalogReclassificationPlan(baseDb([lockedProduct]), {
      now: "2026-04-25T00:00:00.000Z",
    });
    expect(lockedPlan.rows[0].action).toBe("skip_locked");

    const forcedPlan = await buildCatalogReclassificationPlan(baseDb([lockedProduct]), {
      now: "2026-04-25T00:00:00.000Z",
      force: true,
    });
    expect(forcedPlan.rows[0].action).not.toBe("skip_locked");
  });

  it("queues low-confidence products for review without inventing categories", async () => {
    const db = baseDb([
      {
        id: "p3",
        slug: "mystery-device",
        name: { en: "Mystery Device" },
        brand: "",
        category: "",
        subCategories: [],
        specs: [],
        features: [],
        tags: [],
        inStock: true,
      },
    ]);

    const plan = await buildCatalogReclassificationPlan(db, { now: "2026-04-25T00:00:00.000Z" });
    expect(plan.rows[0].action).toBe("queue_review");

    applyCatalogReclassificationPlan(db, plan, { now: "2026-04-25T00:00:00.000Z" });
    expect(db.products[0].needsReview).toBe(true);
    expect(db.products[0].category).toBe("");
  });

  it("renders CSV and markdown summaries", async () => {
    const db = baseDb([
      {
        id: "p4",
        slug: "rode-podmic-usb",
        name: { en: "Rode PodMic USB Dynamic Microphone" },
        brand: "Rode",
        category: "mic",
        subCategories: [],
        specs: [{ label: "Transducer", value: "Dynamic" }],
        features: [],
        tags: [],
        inStock: true,
      },
    ]);
    const plan = await buildCatalogReclassificationPlan(db, { now: "2026-04-25T00:00:00.000Z" });

    expect(buildReclassificationCsv(plan)).toContain("rode-podmic-usb");
    expect(buildReclassificationMarkdown(plan)).toContain("Total scanned: 1");
  });
});
