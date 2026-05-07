# Edio Backend Production Readiness Checklist

Status: Draft production gate
Scope: backend architecture, product data, admin operations, storefront APIs, search, inventory, media, cache, deployment, and observability.

Use this checklist before enabling backend-dependent production features. Every item must be measurable, testable, and owned.

## Data Integrity

☐ 100% of products have a stable `id`, `slug`, and `legacy_id` mapping.
☐ 100% of products have at least one base variant.
☐ 100% of sellable variants have an active price row.
☐ 100% of sellable variants have an inventory level in at least one location.
☐ 100% of published products have a hero image.
☐ 100% of published products have title, brand, category, price, inventory state, and media projection.
☐ Product count in normalized model equals legacy product count.
☐ Legacy-to-normalized parity failures for critical fields = 0.
☐ Backfill jobs are idempotent and can be rerun without duplicate variants, prices, media rows, or inventory levels.
☐ Product revision history exists for 100% of publish, price, category, inventory, and media changes.
☐ Data repair scripts produce dry-run reports before commit mode.
☐ Low-confidence category/media/import decisions are queued for review, not auto-published.

## API Stability

☐ 100% of existing public endpoints return the same response shape or a backward-compatible superset.
☐ 100% of existing admin endpoints remain reachable.
☐ 0 product detail routes return unexpected 404 for existing slugs.
☐ API error envelopes are consistent across auth, catalog, admin, import, inventory, and media routes.
☐ Storefront product listing API p95 latency < 200ms.
☐ PDP API p95 latency < 250ms.
☐ Admin product save p95 latency < 500ms excluding async media/import work.
☐ API 5xx error rate < 0.1% over a 24-hour production window.
☐ API request payload validation exists for 100% of write endpoints.
☐ Pagination or bounded limits exist for 100% of list endpoints.
☐ No endpoint returns secrets, password hashes, session tokens, or internal-only audit metadata.

## Backward Compatibility

☐ No existing route is removed.
☐ No existing endpoint is removed.
☐ No existing storefront component requires a breaking API response change.
☐ Static fallback catalog can still render the storefront if backend is unavailable.
☐ Legacy product `image`, `gallery`, `price`, `compareAt`, `stock`, and `status` fields remain populated during migration.
☐ Compatibility projection covers 100% of current storefront product card fields.
☐ Compatibility projection covers 100% of current PDP fields.
☐ Legacy admin product list remains usable after normalized model is added.
☐ Feature flags can disable normalized reads, search index reads, publishing workflow enforcement, inventory reservations, and media pipeline independently.
☐ Rollback from each migration phase does not require destructive database rollback.

## Security Hardening

☐ 100% of admin endpoints enforce server-side RBAC.
☐ 100% of customer endpoints verify authenticated user ownership server-side.
☐ 100% of write paths validate input server-side.
☐ 100% of auth flows are rate limited.
☐ 100% of webhook endpoints require HMAC verification in production.
☐ Session cookies are HttpOnly, Secure in production, SameSite configured, and scoped correctly.
☐ Password hashes use Argon2id or the strongest available approved fallback.
☐ Password reset and email verification tokens are stored hashed and expire.
☐ Sensitive actions require recent re-authentication.
☐ No plaintext secrets or PII are written to logs.
☐ Security headers are present on API and static responses.
☐ CSRF-sensitive cookie-authenticated mutations have a documented protection strategy.
☐ Dependency audit has no known critical vulnerabilities.
☐ Failed login and suspicious webhook attempts are audited and rate limited.

## Search Accuracy

☐ Indexed published product count matches storefront visible product count within 60 seconds.
☐ 0 draft, review, hidden, or archived products appear in the search index.
☐ Search response p95 latency < 200ms.
☐ Search zero-result rate < 3% for top 100 storefront queries.
☐ Facet count mismatch < 0.5% versus canonical catalog projection.
☐ SKU/model exact-match search returns the correct product as rank 1.
☐ Typo tolerance is disabled for SKU, barcode, MPN, and exact model fields.
☐ Arabic and English synonyms are covered for top category and brand terms.
☐ Search index replay can rebuild 100% of documents from canonical product projection.
☐ Search fallback path can be enabled with one feature flag.

## Inventory Correctness

☐ Inventory drift < 0.5% between canonical inventory and storefront availability.
☐ Oversell incidents = 0.
☐ Reservation creation p95 latency < 150ms.
☐ Expired reservations release success rate >= 99.9%.
☐ Webhook-to-visible-stock latency < 30 seconds p95.
☐ 100% of inventory webhook updates are signed and version-checked in production.
☐ 100% of inventory movements have audit entries.
☐ 100% of sellable variants have `available`, `reserved`, `incoming`, and `committed` values.
☐ Checkout cannot commit an order without successful inventory reservation when reservation flag is enabled.
☐ Inventory rollback can disable external webhook ingestion without breaking legacy stock display.

## Media Resilience

☐ 100% of published products have a valid hero image URL.
☐ Broken image rate = 0 across homepage, PLP, PDP, and admin product list smoke tests.
☐ 100% of transparent PNG product images are flattened or displayed on pure white `#FFFFFF`.
☐ 100% of generated derivatives remove alpha channel when used for product cards/PDP hero.
☐ Media derivative success rate >= 99%.
☐ Media processing job failures are retried with bounded retries and logged.
☐ Original media assets are never overwritten by normalization jobs.
☐ Exact duplicate media candidates are deduped by checksum.
☐ Near-duplicate media candidates are flagged or deduped by similarity score.
☐ 100% of storefront image tags have width/height or stable aspect ratio.
☐ Product image CLS contribution = 0 in Lighthouse/field checks.
☐ Missing alt text rate = 0 for published product media.

## Cache Coherence

☐ Publish-to-visible latency < 5 seconds where platform revalidation is supported; otherwise documented static deploy latency applies.
☐ Unpublish-to-hidden latency < 5 seconds where platform revalidation is supported.
☐ Price update visible on PDP/PLP within 30 seconds p95.
☐ Inventory availability update visible within 30 seconds p95.
☐ Cache invalidation event exists for 100% of publish, unpublish, price, inventory, media hero, and category changes.
☐ CDN/static cache can be purged or bypassed for emergency product correction.
☐ Admin APIs are served with `no-store`.
☐ Storefront cached responses never include draft/review/admin-only data.
☐ Stale cache detection compares public read model version to canonical product version.
☐ Cache rollback can route reads to legacy/fallback projection.

## Deployment Safety

☐ CI runs lint, typecheck, tests, and build on every main push and pull request.
☐ Production deploy requires successful CI.
☐ Required environment variables are validated at startup.
☐ Production refuses insecure auth cookie configuration.
☐ Database backup is completed before every schema migration.
☐ Migrations are additive-first and safe to rerun.
☐ Backfill jobs support dry-run, batching, checkpointing, and resume.
☐ Feature flags are configured before deploying new read/write paths.
☐ Health endpoint reports database, outbox, worker, and product platform status.
☐ Rollback instructions exist for search, inventory, publishing, media, and pricing.
☐ Static storefront deployment and Node backend deployment are validated separately.
☐ Smoke tests cover homepage, shop, category, product detail, login, and admin products.

## Observability Coverage

☐ 100% of requests receive a correlation ID.
☐ 100% of admin mutations emit audit events.
☐ 100% of product publish/unpublish/schedule actions emit audit events.
☐ 100% of price changes emit before/after audit events.
☐ 100% of inventory changes emit movement and audit events.
☐ Outbox backlog count and oldest event age are monitored.
☐ Search drift count is monitored.
☐ Inventory drift count is monitored.
☐ Media processing failure rate is monitored.
☐ PDP TTFB p95 is monitored.
☐ PLP/search latency p95 is monitored.
☐ API 4xx/5xx rates are monitored by route group.
☐ Auth failure rate and rate-limit events are monitored.
☐ Alerts have documented owner, threshold, and recovery action.
☐ Operational dashboards include storefront, admin, search, media, inventory, publishing, and outbox health.

## Release Gate

Production backend-dependent features may be enabled only when:

☐ All critical checklist items are passing.
☐ Every failed non-critical item has an owner and explicit launch exception.
☐ Rollback has been rehearsed for search, inventory, publishing, media, and pricing.
☐ Static fallback mode is still available.
☐ No existing Edio feature has been removed.
