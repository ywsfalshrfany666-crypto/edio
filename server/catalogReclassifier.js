import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  applyClassificationToProduct,
  classifyProductForCatalog,
  classifyProductForCatalogAsync,
  normalizeCategoryAssignment,
} from "./productClassificationEngine.js";
import { shouldPreserveAcceptedClassification } from "./productImportPipeline.js";

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeIds(values = []) {
  return unique(Array.isArray(values) ? values : [values]);
}

function sameList(left = [], right = []) {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function textFromLocalized(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.ar || "";
}

function currentAssignment(product = {}) {
  return {
    primary_category_slug: product.category || product.categoryAssignment?.primaryCategorySlug || "",
    secondary_category_slugs: Array.isArray(product.subCategories)
      ? product.subCategories
      : product.categoryAssignment?.secondaryCategorySlugs || [],
    relation_primary_category_slug: product.categoryAssignment?.primaryCategorySlug || "",
    relation_secondary_category_slugs: product.categoryAssignment?.secondaryCategorySlugs || [],
    confidence_score: product.confidenceScore ?? product.categoryAssignment?.confidenceScore ?? null,
    needs_review: Boolean(product.needsReview || product.categoryAssignment?.needsReview),
  };
}

function preservePrimaryUnlessClearlyWrong(product, classification, threshold) {
  const currentPrimary = product.category || product.categoryAssignment?.primaryCategorySlug || "";
  const proposedPrimary = classification.primary_category_slug || "";
  if (!currentPrimary || !proposedPrimary || currentPrimary === proposedPrimary) return classification;

  const clearPrimaryChange = classification.confidence_score >= Math.max(0.9, threshold + 0.15) && !classification.needs_review;
  if (clearPrimaryChange) return classification;

  return {
    ...classification,
    primary_category_slug: currentPrimary,
    secondary_category_slugs: [],
    confidence_score: Math.min(Number(classification.confidence_score || 0), 0.74),
    needs_review: true,
    classification_reason: `${classification.classification_reason}; primary conflict preserved current category ${currentPrimary} over proposed ${proposedPrimary}`,
  };
}

function classifyNeedsSecondaryReview(row) {
  return row.proposed.primary_category_slug && !row.proposed.secondary_category_slugs.length && row.proposed.needs_review;
}

function actionForRow({ locked, safe, changed, reviewNeeded }) {
  if (locked) return "skip_locked";
  if (safe) return changed ? "apply" : "unchanged";
  if (reviewNeeded) return "queue_review";
  return changed ? "queue_review" : "unchanged";
}

function rowFromProduct(product, classification, { threshold, force }) {
  const current = currentAssignment(product);
  const relationSynced =
    current.relation_primary_category_slug === classification.primary_category_slug &&
    sameList(current.relation_secondary_category_slugs, classification.secondary_category_slugs);
  const surfaceSynced =
    current.primary_category_slug === classification.primary_category_slug &&
    sameList(current.secondary_category_slugs, classification.secondary_category_slugs);
  const changed = !relationSynced || !surfaceSynced || current.needs_review !== Boolean(classification.needs_review);
  const locked = shouldPreserveAcceptedClassification(product, { force });
  const safe = classification.confidence_score >= threshold && !classification.needs_review && Boolean(classification.primary_category_slug);
  const reviewNeeded = classification.needs_review || classification.confidence_score < threshold || !classification.primary_category_slug;
  const row = {
    product_id: product.id,
    slug: product.slug,
    name: textFromLocalized(product.name) || product.slug || product.id,
    brand: product.brand || "",
    current_assignment: current,
    proposed: classification,
    confidence_score: classification.confidence_score,
    needs_review: Boolean(classification.needs_review),
    safe,
    locked,
    changed,
    action: actionForRow({ locked, safe, changed, reviewNeeded }),
    reason: classification.classification_reason,
    conflict: /conflicts:|primary conflict/i.test(classification.classification_reason || ""),
  };

  if (classifyNeedsSecondaryReview(row)) row.conflict = true;
  return row;
}

function productsForOptions(products = [], options = {}) {
  const ids = new Set(normalizeIds(options.productIds || options.product_ids || options.ids));
  return products.filter((product) => {
    if (ids.size && !ids.has(product.id) && !ids.has(product.slug)) return false;
    if (options.onlyReview && !product.needsReview && !product.categoryAssignment?.needsReview) return false;
    return true;
  });
}

export async function buildCatalogReclassificationPlan(db, options = {}) {
  const now = options.now || new Date().toISOString();
  const threshold = Number(options.confidenceThreshold ?? options.confidence_threshold ?? CLASSIFICATION_CONFIDENCE_THRESHOLD);
  const force = options.force === true;
  const context = {
    now,
    confidenceThreshold: threshold,
    existingCategories: Array.isArray(options.existingCategories)
      ? options.existingCategories
      : Array.isArray(db?.categories)
        ? db.categories.map((category) => category.slug).filter(Boolean)
        : undefined,
    enrich_web: options.enrichWeb === true || options.enrich_web === true,
    source_urls_by_product: options.sourceUrlsByProduct || options.source_urls_by_product || {},
    source_snippets_by_product: options.sourceSnippetsByProduct || options.source_snippets_by_product || {},
  };

  const rows = [];
  for (const product of productsForOptions(db?.products || [], options)) {
    const rawClassification = context.enrich_web
      ? await classifyProductForCatalogAsync(product, context)
      : classifyProductForCatalog(product, context);
    const classification = preservePrimaryUnlessClearlyWrong(product, rawClassification, threshold);
    rows.push(rowFromProduct(product, classification, { threshold, force }));
  }

  return {
    mode: options.commit ? "commit" : "dry-run",
    dry_run: !options.commit,
    force,
    threshold,
    generated_at: now,
    rows,
    summary: summarizeCatalogReclassification(rows),
  };
}

export function summarizeCatalogReclassification(rows = []) {
  const changedByCategory = {};
  for (const row of rows) {
    if (row.action !== "apply") continue;
    const category = row.proposed.primary_category_slug || "unknown";
    changedByCategory[category] = (changedByCategory[category] || 0) + 1;
  }

  return {
    total_scanned: rows.length,
    total_auto_assigned: rows.filter((row) => row.action === "apply").length,
    total_review_needed: rows.filter((row) => row.action === "queue_review").length,
    total_locked_skipped: rows.filter((row) => row.action === "skip_locked").length,
    total_unchanged: rows.filter((row) => row.action === "unchanged").length,
    changed_assignments_by_category: changedByCategory,
    conflicting_products: rows
      .filter((row) => row.conflict)
      .map((row) => ({
        product_id: row.product_id,
        slug: row.slug,
        name: row.name,
        reason: row.reason,
        confidence_score: row.confidence_score,
      })),
  };
}

export function applyCatalogReclassificationPlan(db, plan, options = {}) {
  const now = plan.generated_at || options.now || new Date().toISOString();
  const byId = new Map((db.products || []).map((product) => [product.id, product]));
  const assignments = [];
  const before = [];
  const appliedRows = [];
  const skippedRows = [];

  for (const row of plan.rows || []) {
    const product = byId.get(row.product_id);
    if (!product) continue;
    if (row.action === "apply") {
      before.push(JSON.parse(JSON.stringify(product)));
      assignments.push(applyClassificationToProduct(product, row.proposed, now));
      appliedRows.push({ id: row.product_id, action: row.action });
      continue;
    }

    if (row.action === "queue_review") {
      before.push(JSON.parse(JSON.stringify(product)));
      const reviewClassification = {
        ...row.proposed,
        needs_review: true,
      };
      const assignment = normalizeCategoryAssignment(product.id, reviewClassification, now);
      product.categoryAssignment = assignment;
      product.needsReview = true;
      product.confidenceScore = assignment.confidenceScore;
      product.updatedAt = now;
      assignments.push(assignment);
      appliedRows.push({ id: row.product_id, action: row.action });
      continue;
    }

    skippedRows.push({ id: row.product_id, action: row.action });
  }

  db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, assignments);
  db.bulkActionLogs = Array.isArray(db.bulkActionLogs) ? db.bulkActionLogs : [];
  const log = {
    id: `reclassify_${now.replace(/[^0-9]/g, "").slice(0, 14)}`,
    action: "catalog_reclassification",
    createdAt: now,
    productIds: [...new Set([...appliedRows, ...skippedRows].map((row) => row.id))],
    appliedIds: appliedRows.map((row) => row.id),
    skippedIds: skippedRows.map((row) => row.id),
    options: { ...options, confidenceThreshold: plan.threshold, force: plan.force },
    summary: plan.summary,
    undo: { available: true, products: before },
  };
  db.bulkActionLogs.unshift(log);
  db.bulkActionLogs = db.bulkActionLogs.slice(0, 100);
  db.meta = { ...(db.meta || {}), updatedAt: now };

  return {
    applied_count: appliedRows.length,
    skipped_count: skippedRows.length,
    assignments,
    log,
  };
}

export function upsertCategoryAssignments(existingAssignments = [], nextAssignments = []) {
  const byProduct = new Map(
    (Array.isArray(existingAssignments) ? existingAssignments : [])
      .filter((assignment) => assignment?.productId)
      .map((assignment) => [assignment.productId, assignment]),
  );
  for (const assignment of nextAssignments) {
    if (assignment?.productId) byProduct.set(assignment.productId, assignment);
  }
  return [...byProduct.values()];
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildReclassificationCsv(plan) {
  const headers = [
    "product_id",
    "slug",
    "name",
    "brand",
    "current_primary",
    "current_secondary",
    "proposed_primary",
    "proposed_secondary",
    "confidence",
    "needs_review",
    "action",
    "locked",
    "reason",
  ];
  const lines = [headers.join(",")];
  for (const row of plan.rows || []) {
    lines.push(
      [
        row.product_id,
        row.slug,
        row.name,
        row.brand,
        row.current_assignment.primary_category_slug,
        row.current_assignment.secondary_category_slugs,
        row.proposed.primary_category_slug,
        row.proposed.secondary_category_slugs,
        row.confidence_score,
        row.needs_review,
        row.action,
        row.locked,
        row.reason,
      ].map(csvCell).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function buildReclassificationMarkdown(plan) {
  const summary = plan.summary || summarizeCatalogReclassification(plan.rows || []);
  const changed = Object.entries(summary.changed_assignments_by_category || {})
    .map(([category, count]) => `- ${category}: ${count}`)
    .join("\n") || "- none";
  const conflicts = (summary.conflicting_products || [])
    .slice(0, 30)
    .map((item) => `- ${item.slug}: ${item.reason} (${Math.round(Number(item.confidence_score || 0) * 100)}%)`)
    .join("\n") || "- none";

  return `# EDIO Catalog Reclassification

- Mode: ${plan.mode}
- Generated: ${plan.generated_at}
- Confidence threshold: ${plan.threshold}
- Force: ${plan.force ? "yes" : "no"}

## Summary

- Total scanned: ${summary.total_scanned}
- Total auto-assigned: ${summary.total_auto_assigned}
- Total review-needed: ${summary.total_review_needed}
- Total locked/skipped: ${summary.total_locked_skipped}
- Total unchanged: ${summary.total_unchanged}

## Changed Assignments By Category

${changed}

## Conflicting Products

${conflicts}
`;
}
