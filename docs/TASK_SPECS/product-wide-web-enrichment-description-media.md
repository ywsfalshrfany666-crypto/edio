# Task Spec: Product Wide Web Enrichment Description Media

## Task ID
product-wide-web-enrichment-description-media

## Date
2026-05-04

## Goal
Build safe admin-side product web enrichment logic that can search/source product pages, extract real product descriptions, description media, technical specs, and box contents, then preview/apply only high-confidence approved additions without changing product price, stock, category, main image, or gallery.

Execution Brief: Add an additive enrichment workflow for existing products only. Scope is limited to product enrichment/AI import, internet product import, description blocks/media, product API/rendering, admin preview, image safety/normalization, quality score, and audit logs. Use reliable sources in priority order: official brand pages/manuals, authorized audio retailers, current WordPress data. Never run web search on public product page visits. Start with dry-run; auto-apply only if product/source match confidence is `>= 0.90`, source is reliable, no ambiguity, images are safe, and data does not conflict. Extract inline product description images separately from gallery, classify image roles, reject policy/footer/review/shipping images, preserve order, dedupe, sanitize HTML, and expose only approved safe blocks publicly. Admin must preview sources, confidence, warnings, proposed text/images/specs/box contents before apply. Preserve WordPress import, AI import, Product Detail, cards, recommendations, quality score, stock privacy, SEO, and audit logs. Add focused tests and run build/lint/tests if practical.

## Scope
- Product enrichment / AI import helpers.
- Internet product import / source matching.
- Product description blocks and product media roles.
- Product API public/admin serialization.
- Admin enrichment preview/apply.
- Image safety and normalization helpers.
- Product detail rendering integration already used by description blocks.
- Quality score and audit logs.

## Out of Scope
- Full project scan.
- Public storefront live web searching.
- Product creation.
- Price, stock, category, subcategory, main image, or gallery mutation.
- Heavy OCR/vision libraries.
- Copying external product text verbatim at length.

## Current Problem
Edio has product pages that can be richer if real data is available from official/retailer sources, especially product pages where the description is image-heavy. Current enrichment/import logic needs a structured, safe dry-run and admin approval path for extracting description text, inline description media, spec images, and box contents while rejecting unrelated policy/review/footer imagery.

## Required Changes
- Create or improve enrichment dry-run job logic for existing products.
- Build source-candidate matching with confidence and source reliability.
- Extract product-page HTML into safe text blocks, description images, spec images, box images, technical specs, and box contents.
- Reject footer/header/related/review/shipping/return/warranty/trust/newsletter/policy images.
- Deduplicate media by normalized URL/source URL.
- Add admin API preview/apply endpoints or equivalent admin preview support.
- Apply only safe selected/high-confidence additions and audit every step.
- Keep public rendering limited to approved stored blocks.
- Update quality preview/score inputs without rewarding needs-review data.

## Existing Features To Preserve
- AI product import / internet discovery.
- WordPress/WooCommerce import.
- Product description images and spec images.
- Product Detail page, cards, recommendations.
- Quality score, audit logs, admin review flow.
- Public stock privacy and hidden product visibility rules.

## Acceptance Criteria
- Admin can run dry-run enrichment for products and see source URL, confidence, proposed blocks, images, specs, box contents, and warnings.
- Extraction captures inline description media and classifies roles.
- Policy/footer/reviews/shipping images are rejected.
- Fuzzy, low-confidence, ambiguous, or version-mismatched matches are skipped or marked review.
- Apply safe mode writes only approved/safe additions and never changes price/stock/category/main image/gallery.
- Public product pages show approved description images/specs/box sections through existing rendering and hide empty sections.
- Audit logs are written.
- Focused tests pass for matching, extraction, safety, apply, and no forbidden mutations.

## Safety Rules
- No hallucinated descriptions, specs, images, or box contents.
- No image mixing between products.
- No import below confidence `0.90`.
- No raw unsafe HTML.
- Block localhost/private/file/ftp URLs and invalid image types.
- Do not use source data from reviews/forums as authoritative unless marked review.
- Do not copy long copyrighted descriptions verbatim.

## Test Plan
- Matching accepts exact source/product match and rejects fuzzy/version mismatch.
- Extraction preserves inline media order, classifies spec/box images, and rejects policy/review/footer imagery.
- Safety blocks local/private/broken/duplicate images.
- Dry run does not write.
- Apply safe only appends approved blocks/specs/box contents and does not mutate price/stock/category/main image/gallery.
- Audit logs are created.
- Product description section utilities still hide empty sections.

## Final Report Format
- What was missing.
- What enrichment logic was added.
- Source selection and product-mixing prevention.
- Description image extraction and policy/footer/review rejection.
- Product page rendering behavior.
- Specs and box section behavior.
- Products checked/sources found/review count.
- Confirmation price/stock/category unchanged.
- Files changed.
- Build/lint/test status.
- Remaining issues.
