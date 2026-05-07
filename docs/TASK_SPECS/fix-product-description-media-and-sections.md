# Task Spec: Fix Product Description Media And Sections

## Task ID
fix-product-description-media-and-sections

## Date
2026-05-04

## Goal
Diagnose why WordPress/WooCommerce description images are not appearing on the product detail page, then fix the safe import/API/rendering path so matched products show real description media and product sections below the main product area.

Execution Brief: Fix only the product description media pipeline and product detail sections. Inspect WordPress/WooCommerce import, product description import, description blocks/media, product API serialization, Product Detail rendering, specs, box contents, and image rendering. Do not inspect the whole project. Import/apply only exact high-confidence matches (`>= 0.90`) via SKU, legacy ID, slug, or exact normalized title plus brand/model. Do not use fuzzy matches, create products, change price, stock, category, main image, gallery, quality score, cards, or lightbox. Preserve existing descriptions and hide empty sections. Description images must remain out of the gallery and render below the fold in their own section; spec/box images and box contents render only when real data exists. Public API returns safe blocks only. Add or update focused tests and run build/lint/tests where practical. Final report must explain root cause, files changed, processed/skipped counts, added media counts, price/stock/category status, where images now render, empty-section behavior, verification, and review items.

## Scope
- WordPress/WooCommerce import parsing and apply logic.
- Product description import scripts/helpers.
- `description_blocks`, product description media, product media roles.
- Product detail API public serialization.
- Product detail page sections/renderers for description text/images/specs/box contents.
- Related focused tests.

## Out of Scope
- Full project scan.
- Product cards, admin list, checkout, recommendations, AI import except directly shared description helpers.
- Price, stock, category, subcategory, main image, and gallery updates.
- New product creation.
- Heavy OCR/image-processing libraries.

## Current Problem
After the WordPress/WooCommerce import, product pages show text-only sections such as tidy specs, short explanation, and accessories, but the description images embedded in the old WordPress product descriptions do not appear below the product page.

## Required Changes
- Identify the real failure point: source file contents, parser extraction, storage, product matching, API response, rendering, or CSS.
- Extract ordered `<img>` sources from WordPress HTML descriptions including `src`, `data-src`, `srcset`, alt/caption, source URL, and surrounding context.
- Classify imported images as `description_image`, `spec_image`, `box_image`, or `unknown_description_image` with review flags when uncertain.
- Import/apply only exact safe matches with confidence `>= 0.90`; skip fuzzy, duplicate, conflict, broken, unsafe, or low-confidence rows.
- Preserve existing descriptions and append safe imported blocks without duplicating media.
- Render product page sections in order when data exists: description, description images, technical specifications/spec images, what's in the box/box images, existing related/accessories.
- Hide empty sections without placeholders.
- Keep public API safe: no raw unsafe HTML, source payloads, private paths, debug confidence, admin notes, or import internals.

## Existing Features To Preserve
- WordPress/WooCommerce import.
- Description images and spec images.
- Product detail page, gallery, thumbnails, lightbox.
- Quality score.
- Search, recommendations, public stock privacy, SEO.
- Transparent PNGs on pure white `#FFFFFF`.

## Acceptance Criteria
- Description images appear in the product detail page below the main product area for products with safely imported description media.
- Images are tied only to the correct product.
- No import below confidence `0.90` and no fuzzy import.
- Specs and box sections render only with real data.
- Empty sections are hidden.
- No price, stock, category, main image, or gallery changes.
- No raw unsafe HTML or broken images are shown.
- Images lazy load and do not overflow on mobile.
- Focused build/lint/tests pass where practical.

## Safety Rules
- Do not hallucinate description images, specs, or box contents.
- Do not mix media between products.
- Do not import from localhost/private/file/ftp URLs.
- Do not import SVG unless safe sanitization exists.
- Deduplicate by normalized URL/source URL/media ID where possible.
- Added blocks/media should carry source/import job information for rollback where available.

## Test Plan
- Parser tests for ordered image extraction, alt/caption, spec and box classification.
- Matching/import tests for confidence threshold, fuzzy skip, duplicate skip, correct product linkage, and no price/stock/category mutations.
- Rendering/API tests for safe public blocks, visible description images, visible spec/box sections only with data, and hidden empty sections.
- Security tests for unsafe HTML and blocked local/private image URLs where existing helpers support it.
- Run targeted lint, tests, typecheck/build if practical.

## Final Report Format
- Problem/root cause.
- Files changed.
- Products processed/skipped and why.
- Description/spec/box images and box contents added.
- Broken/duplicate skipped counts.
- Confirmation that price/stock/category were not modified.
- Where images render now and whether empty sections are hidden.
- Build/lint/test status.
- Remaining review items.
