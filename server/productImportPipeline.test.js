import { describe, expect, it } from "vitest";
import {
  IMPORT_PIPELINE_VERSION,
  assignImportPipelineDataToDraft,
  buildImportEvidenceFromDraft,
  buildImportJobRecord,
  buildImportModelStepOutput,
  buildImportReviewTask,
  normalizeImportProductName,
  rankImportEvidence,
  shouldPreserveAcceptedClassification,
  validateImportModelStepOutput,
} from "./productImportPipeline.js";

const draft = {
  sourceUrl: "https://www.thomannmusic.com/rode_podmic_usb.htm",
  nameEn: "Rode PodMic USB - Thomann United States",
  brand: "Rode",
  category: "mic",
  subCategories: ["dynamic"],
  taglineEn: "Dynamic USB/XLR broadcast microphone",
  priceUsd: 199,
  image: "/media/imports/rode-podmic-usb.png",
  gallery: ["/media/imports/rode-podmic-usb.png"],
  features: ["USB-C and XLR connectivity", "Dynamic microphone for speech"],
  specs: [
    { label: { en: "Connector", ar: "" }, value: "USB-C / XLR" },
    { label: { en: "Microphone type", ar: "" }, value: "Dynamic" },
  ],
  importMeta: { usedStructuredData: true, catalogClassification: { legacy: true } },
};

describe("product import pipeline", () => {
  it("normalizes noisy store titles without removing brand/model identity", () => {
    expect(normalizeImportProductName("PodMic USB - Thomann United States", "Rode")).toBe("Rode PodMic USB");
  });

  it("ranks official and structured evidence before retailer/model evidence", () => {
    const ranked = rankImportEvidence([
      { source_type: "model", source_url: "", facts: ["raw input"] },
      { source_type: "retailer", source_url: "https://retailer.example", facts: ["price"] },
      { source_type: "official", source_url: "https://rode.com", facts: ["dynamic mic"] },
      { source_type: "structured_data", source_url: "https://retailer.example", facts: ["json-ld product"] },
    ]);

    expect(ranked.map((item) => item.source_type)).toEqual([
      "official",
      "structured_data",
      "retailer",
      "model",
    ]);
  });

  it("builds strict model-step JSON and validates required fields", () => {
    const evidence = buildImportEvidenceFromDraft(draft, {
      rawInput: "Rode PodMic USB",
      sourceType: "retailer",
      usedStructuredData: true,
    });
    const output = buildImportModelStepOutput(draft, evidence, { rawInput: "Rode PodMic USB", confidence: 0.88 });

    expect(output.raw_input).toBe("Rode PodMic USB");
    expect(output.normalized_name).toBe("Rode PodMic USB");
    expect(output.facts.microphone_type).toBe("dynamic");
    expect(validateImportModelStepOutput(output)).toEqual({ valid: true, errors: [] });
  });

  it("adds description/spec media candidates separately from gallery candidates", () => {
    const output = buildImportModelStepOutput(
      {
        ...draft,
        descriptionHtml: '<section><h2>Technical specifications</h2><img src="https://rode.com/podmic-spec-table.jpg" alt="PodMic spec table" /></section>',
      },
      [],
      { confidence: 0.91 },
    );

    expect(output.image_candidates.some((item) => item.role === "main")).toBe(true);
    expect(output.image_candidates.some((item) => item.role === "spec_image")).toBe(true);
    expect(output.image_candidates.find((item) => item.role === "spec_image")?.classification_reason).toContain("spec_image_hint");
  });

  it("creates review tasks for low-confidence import classifications", () => {
    const job = buildImportJobRecord({ mode: "query", input: "unknown audio thing", now: "2026-04-25T00:00:00.000Z" });
    const task = buildImportReviewTask({
      job,
      draft: { nameEn: "Unknown Audio Thing" },
      classification: {
        primary_category_slug: "",
        secondary_category_slugs: [],
        confidence_score: 0.42,
        needs_review: true,
        classification_reason: "identity unresolved",
        evidence: [],
      },
      now: "2026-04-25T00:00:00.000Z",
    });

    expect(task.status).toBe("open");
    expect(task.priority).toBe("high");
    expect(task.jobId).toBe(job.id);
  });

  it("does not overwrite legacy catalogClassification shape in import meta", () => {
    const job = buildImportJobRecord({ mode: "url", input: draft.sourceUrl });
    const classification = {
      primary_category_slug: "mic",
      secondary_category_slugs: ["dynamic"],
      dynamic_collection_slugs: [],
      confidence_score: 0.91,
      needs_review: false,
      classification_reason: "structured evidence",
      evidence: [],
    };
    const result = assignImportPipelineDataToDraft(draft, {
      job,
      classification,
      modelStepOutput: buildImportModelStepOutput(draft, [], { confidence: 0.91 }),
      validation: { valid: true, errors: [] },
    });

    expect(result.importMeta.pipeline.version).toBe(IMPORT_PIPELINE_VERSION);
    expect(result.importMeta.pipeline.classification.primary_category_slug).toBe("mic");
    expect(result.importMeta.catalogClassification).toEqual({ legacy: true });
  });

  it("preserves accepted admin classification unless force is passed", () => {
    const product = {
      categoryAssignment: {
        reviewedAt: "2026-04-25T00:00:00.000Z",
      },
    };

    expect(shouldPreserveAcceptedClassification(product)).toBe(true);
    expect(shouldPreserveAcceptedClassification(product, { force: true })).toBe(false);
  });
});
