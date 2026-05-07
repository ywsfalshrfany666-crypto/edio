# Edio Zero-Downtime Backend Modernization Migration Plan

Status: Draft for production rollout review
Scope: Edio backend modernization with no endpoint breakage, no data loss, additive-first migrations, gradual backfill, and phase-level rollback.

## Global Migration Rules

- No existing endpoint may be removed or changed without a compatibility layer.
- No existing product route, slug, ID, image URL, category route, or admin flow may break.
- No existing product data may be overwritten destructively.
- All schema changes are additive first.
- Legacy fields remain readable until replacement fields are proven correct.
- Every backfill job must be idempotent and safe to resume.
- Every phase must ship behind feature flags.
- Every write-path change must emit audit logs.
- Every rollback must prefer feature flag disablement and read-path fallback over database rollback.

## Feature Flag Registry

| Flag | Default | Purpose |
|---|---:|---|
| `catalog.compatibilityProjection.enabled` | on | Keep legacy storefront/admin DTOs stable while new models are introduced. |
| `catalog.normalizedWrites.enabled` | off | Write product updates into normalized product/variant tables. |
| `catalog.dualWrite.enabled` | off | Write both legacy product fields and new normalized records. |
| `catalog.normalizedReads.enabled` | off | Serve storefront/admin reads from normalized projections. |
| `search.externalIndex.enabled` | off | Route search/PLP reads to new search index. |
| `publishing.workflow.enabled` | off | Enforce draft/review/scheduled/published lifecycle. |
| `inventory.reservations.enabled` | off | Use variant-level reservation model for checkout/sellability. |
| `media.pipeline.enabled` | off | Use new media assets/derivatives pipeline. |
| `legacy.decommission.enabled` | off | Disable legacy fields after all validation gates pass. |

## Phase 0 – Compatibility Layer

### What Changes

- Add DTO mappers that can produce the existing product, category, media, price, and inventory response shapes from either legacy records or future normalized projections.
- Add compatibility helpers for current storefront routes, admin routes, and fallback catalog behavior.
- Add read-only parity checks comparing legacy product output to compatibility projection output.
- Add operational logging for which read path served each request.

### What Stays Untouched

- Existing database/product JSON fields.
- Existing storefront routes.
- Existing admin routes.
- Existing product slugs and IDs.
- Existing static fallback catalog.
- Existing media URLs.

### Data Backfill Job Required

No data mutation required in Phase 0.

Optional job:
- `compatibility:scan`
- Reads all products.
- Produces a parity report for required fields:
  - id
  - slug
  - title
  - brand
  - category
  - price
  - compareAt
  - image
  - gallery
  - stock
  - status

### Rollback Plan

- Disable compatibility projection flag.
- Keep all reads on the existing legacy product model.
- No data rollback required because this phase is read-only.

### Validation Metrics

- 100% of existing product routes still resolve.
- 100% of product slugs unchanged.
- 0 difference in public product count.
- 0 console/API errors on homepage, category pages, product detail pages, shop, and admin products.
- Compatibility projection parity >= 99.5% for non-derived fields.

### Feature Flag Strategy

- `catalog.compatibilityProjection.enabled = on` for internal verification.
- Do not enable `catalog.normalizedReads.enabled`.
- Do not enable `catalog.dualWrite.enabled`.

## Phase 1 – Additive Data Model

### What Changes

- Add new tables/collections:
  - `products` compatibility extensions
  - `product_variants`
  - `product_media`
  - `variant_prices`
  - `inventory_locations`
  - `inventory_levels`
  - `product_channel_listings`
  - `product_revisions`
  - `approval_requests`
  - `import_jobs`
  - `outbox_events`
- Add fields where required:
  - `legacy_id`
  - `external_reference`
  - `source_payload`
  - `version`
  - `published_at`
  - `archived_at`
  - `quality_score`
  - `audit_metadata`

### What Stays Untouched

- Existing write path.
- Existing read path.
- Existing admin UI behavior.
- Existing storefront behavior.
- Existing product fields remain canonical during this phase.

### Data Backfill Job Required

Job: `catalog:backfill-normalized-model`

For each legacy product:
- Create one base variant if missing.
- Create variant price from legacy `price` and `compareAt`.
- Create default inventory location if missing.
- Create inventory level from legacy `stock`, `inStock`, and `availabilityStatus`.
- Create product media from legacy `image` and `gallery`.
- Create storefront channel listing from legacy status.
- Create initial product revision snapshot.
- Store source payload snapshot for traceability.

Backfill requirements:
- Idempotent by `legacy_id`.
- Batch size configurable.
- Resume from checkpoint.
- Dry-run mode required.
- Report skipped, created, updated, conflict, and review-needed counts.

### Rollback Plan

- Disable all normalized model flags.
- Leave additive tables in place.
- Existing reads/writes continue using legacy fields.
- If backfill created bad rows, mark them invalid or rerun backfill with corrected mapping; do not delete legacy data.

### Validation Metrics

- 100% of products have a base variant.
- 100% of base variants have a price row.
- 100% of products have a storefront listing row.
- 100% of products with legacy image have at least one `product_media` row.
- Product count in normalized model equals legacy product count.
- Backfill conflict rate < 1%.

### Feature Flag Strategy

- `catalog.normalizedWrites.enabled = off`
- `catalog.dualWrite.enabled = off`
- `catalog.normalizedReads.enabled = off`
- Compatibility projection stays on for parity reporting.

## Phase 2 – Dual Write Strategy

### What Changes

- Admin product mutations write to both:
  - legacy product fields
  - normalized product/variant/media/pricing/inventory records
- Add write parity checks after mutation.
- Add audit events for dual-write operations.
- Add outbox event creation for product changes, but workers may remain passive.

### What Stays Untouched

- Existing response contracts.
- Existing storefront still reads legacy-compatible output.
- Existing admin UI does not need to change.
- Existing product slugs remain canonical.

### Data Backfill Job Required

Job: `catalog:repair-dual-write-gaps`

Purpose:
- Detect products changed after Phase 1 backfill but before dual-write activation.
- Reconcile legacy product fields into normalized records.
- Report mismatched price, media, inventory, category, and status fields.

### Rollback Plan

- Disable `catalog.dualWrite.enabled`.
- Continue writing only legacy fields.
- Keep normalized records as stale but non-serving data.
- Run repair job before re-enabling dual-write.

### Validation Metrics

- Dual-write success rate >= 99.9%.
- Post-write parity failures = 0 for critical fields:
  - price
  - inventory
  - status
  - slug
  - primary image
- Admin product save p95 < 500ms.
- 0 lost updates during concurrent admin edits.

### Feature Flag Strategy

- Enable `catalog.normalizedWrites.enabled`.
- Enable `catalog.dualWrite.enabled` for internal/admin-only traffic first.
- Keep `catalog.normalizedReads.enabled = off`.
- Add emergency kill switch for normalized writes.

## Phase 3 – Search Index Introduction

### What Changes

- Add search read model or external index.
- Process product publish/update/category/price/inventory events from outbox.
- Add search document schema:
  - product id
  - slug
  - title
  - brand
  - category
  - secondary categories
  - price
  - availability
  - tags
  - searchable Arabic/English terms
- Add internal fallback to legacy search.

### What Stays Untouched

- Existing search UI.
- Existing category/shop routes.
- Existing product detail routes.
- Existing legacy query path remains fallback.

### Data Backfill Job Required

Job: `search:rebuild-index`

Requirements:
- Index only published/visible products.
- Exclude draft, hidden, archived, or review-only products.
- Build index from compatibility projection initially.
- Run parity check:
  - indexed count vs visible product count
  - facet counts vs category counts
  - sample query result comparison

### Rollback Plan

- Disable `search.externalIndex.enabled`.
- Route all search/PLP/filter reads back to legacy search path.
- Keep outbox events and index data for debugging.
- Rebuild index offline and re-enable only after parity passes.

### Validation Metrics

- Indexed visible product count matches storefront visible product count within 1 minute.
- Search response p95 < 200ms.
- Search index drift age < 60 seconds.
- 0 draft/review/archived products in index.
- Facet count mismatch < 0.5%.

### Feature Flag Strategy

- Shadow mode first:
  - query legacy search and new search
  - log differences
  - serve legacy response
- Gradual rollout:
  - admin-only
  - 5% storefront
  - 25%
  - 50%
  - 100%
- Immediate fallback to legacy search on error rate > 1%.

## Phase 4 – Publishing Workflow Activation

### What Changes

- Activate product lifecycle:
  - draft
  - review
  - scheduled
  - published
  - archived
- Add quality gates before publish:
  - title exists
  - base variant exists
  - active price exists
  - inventory state exists
  - hero image exists
  - SEO metadata exists
  - category assignment confidence acceptable
- Store product revisions and approval requests.

### What Stays Untouched

- Existing published products remain publicly visible.
- Existing product URLs remain stable.
- Existing admin product edit page remains available.
- Legacy status remains mapped for compatibility.

### Data Backfill Job Required

Job: `publishing:backfill-lifecycle`

Mapping:
- Existing visible/published products -> `published`
- Existing draft/hidden products -> `draft` or `archived` based on current status
- Existing needs_review products -> `review`
- Existing products with missing critical fields -> `review`

### Rollback Plan

- Disable `publishing.workflow.enabled`.
- Serve products based on legacy `status`, `inStock`, and existing visibility rules.
- Preserve lifecycle fields and revisions.
- If bad workflow state was assigned, rerun lifecycle backfill with corrected mapping.

### Validation Metrics

- 0 unpublished products visible in storefront.
- 0 published products without price.
- 0 published products without hero image.
- 0 broken product detail pages.
- Publish-to-public-read latency < 60 seconds.
- All publish/unpublish actions have audit logs.

### Feature Flag Strategy

- Start in advisory mode:
  - calculate lifecycle and quality gates
  - do not block publish
- Then enforce for new imports only.
- Then enforce for edited products.
- Then enforce globally.

## Phase 5 – Inventory Reservation Model

### What Changes

- Activate variant-level inventory:
  - available
  - reserved
  - incoming
  - committed
- Add reservation records for checkout.
- Add inventory movement audit trail.
- Add webhook HMAC verification and version handling.
- Sync compatibility fields:
  - legacy `stock`
  - legacy `inStock`
  - legacy `availabilityStatus`

### What Stays Untouched

- Existing storefront stock display remains compatible.
- Existing product cards and PDP availability UI remain stable.
- Existing checkout flow continues to work until reservation flag is enabled.

### Data Backfill Job Required

Job: `inventory:backfill-levels`

For each base variant:
- Create inventory level in default location.
- Map legacy stock to `available`.
- Set `reserved = 0`, `incoming = 0`, `committed = 0`.
- Flag products with inconsistent stock/inStock values for review.

### Rollback Plan

- Disable `inventory.reservations.enabled`.
- Continue using legacy stock fields.
- Keep inventory movement logs.
- Reconcile variant inventory back into legacy stock if needed.
- Disable external webhook ingestion if corrupt data is suspected.

### Validation Metrics

- Inventory drift count = 0 for sellable variants.
- Reservation creation p95 < 150ms.
- Webhook-to-visible-stock SLA < 30 seconds.
- Expired reservation release success rate >= 99.9%.
- Oversell incidents = 0.

### Feature Flag Strategy

- Shadow mode:
  - calculate reservation result without enforcing it.
- Enable for admin test orders.
- Enable for low-risk products.
- Enable globally after 0 oversell/drift incidents in monitoring window.

## Phase 6 – Media Pipeline Replacement

### What Changes

- New media pipeline becomes canonical for:
  - source candidate ingestion
  - provenance
  - EXIF normalization
  - transparent PNG flattening to `#FFFFFF`
  - derivative generation
  - exact/near dedupe
  - hero image scoring
  - alt/title metadata
- Storefront reads media from compatibility projection.

### What Stays Untouched

- Existing image URLs remain usable.
- Existing gallery display remains compatible.
- Original assets are never overwritten.
- Existing product media fields remain populated.

### Data Backfill Job Required

Job: `media:backfill-assets`

For each product:
- Create media asset records from legacy image/gallery.
- Detect duplicates.
- Normalize transparent PNGs.
- Generate derivatives.
- Select hero image.
- Fill alt text if missing.
- Report images that fail processing.

### Rollback Plan

- Disable `media.pipeline.enabled`.
- Serve legacy image/gallery fields.
- Stop derivative worker.
- Keep original assets and media records.
- Requeue bad derivatives after policy fix.

### Validation Metrics

- 100% of products with legacy image have product media records.
- Hero image exists for 100% of published products.
- Broken image rate = 0.
- Transparent PNGs render on pure white `#FFFFFF`.
- Media derivative success rate >= 99%.
- Card/PDP image CLS = 0.

### Feature Flag Strategy

- Start media pipeline in shadow mode.
- Use normalized media only in admin preview.
- Enable on product detail pages for reviewed products.
- Enable on listing cards.
- Enable globally after image parity checks pass.

## Phase 7 – Decommission Legacy Fields

Optional. This phase must not start until all previous phases pass validation for at least one full production release cycle.

### What Changes

- Legacy fields become compatibility projections only.
- Storefront and admin reads use normalized projections.
- Legacy write path is disabled.
- Legacy fields may remain physically present for archival and rollback.

### What Stays Untouched

- Public routes.
- Product slugs.
- Product IDs exposed to clients.
- Storefront response shape unless a versioned API is introduced.
- Static fallback export if still needed.

### Data Backfill Job Required

Job: `legacy:final-parity-audit`

Checks:
- Every public product can be generated from normalized model.
- Every price matches variant canonical price.
- Every media field maps from product media.
- Every inventory field maps from inventory levels.
- Every category maps from taxonomy assignments.
- Every published product has correct structured data.

### Rollback Plan

- Disable `legacy.decommission.enabled`.
- Re-enable legacy write path.
- Serve legacy fields from last compatibility projection.
- Run repair job from normalized model back into legacy fields if needed.

### Validation Metrics

- 30 days with no parity failures.
- 0 legacy-only fields required by frontend/admin.
- 0 routes depending on legacy-only data.
- 100% of product API contract covered by normalized projection tests.
- Rollback drill completed successfully.

### Feature Flag Strategy

- Keep `legacy.decommission.enabled = off` until explicitly approved.
- Enable only in staging first.
- Enable for read-only projection checks in production.
- Do not remove physical legacy fields until multiple production release cycles pass.

## Production Cutover Checklist

- API health checks green.
- Database backup completed.
- Additive migrations applied.
- Backfill dry-run completed.
- Backfill commit completed.
- Parity report reviewed.
- Feature flags configured with emergency rollback.
- Audit logging enabled.
- Outbox worker healthy.
- Search fallback tested.
- Inventory fallback tested.
- Media fallback tested.
- Publishing rollback tested.
- Admin smoke test passed.
- Storefront smoke test passed.
- Product detail smoke test passed.
- Category route smoke test passed.
- No endpoint removed.
- No route changed without compatibility.
- No legacy data deleted.
