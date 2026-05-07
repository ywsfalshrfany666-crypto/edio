# AI Product Importer Page Builder Enhancement

## Goal

Improve the existing admin AI Product Importer so it can create a reviewed research draft for Product Page Builder content without publishing or mutating products automatically.

## Execution Brief

This task upgrades the current admin product import flow in a narrow, safe scope. The importer should accept a product name or URL, prepare a research draft, rank sources by trust, deduplicate images/specs/products, track image license status, map approved data into Product Page Builder sections, and validate before Apply/Save/Publish. The first implementation must favor pure, testable utilities and admin review UI over unsafe live scraping. Remote fetching, if already present, must remain backend-side and must reject unsafe/private URLs. The product page public bundle must not import heavy admin research code. No fake specs, copied competitor content, invented sound claims, fake reviews, or unlicensed images may be added. Existing Google Login, SEO, performance, static Hostinger production behavior, and catalog data must remain intact.

## Scope

- Inspect only current admin product import/edit/add files, product form/type/schema files, catalog/runtime/API files, existing importer/enrichment backend files, and directly related tests.
- Add reviewed research draft logic for source ranking, confidence, dedupe, conflicts, URL/image safety, product matching, validation, and Product Page Builder mapping.
- Integrate draft controls into the existing admin Product Page Builder/admin importer UI with no automatic publish.
- Add focused tests for the new pure logic and admin-safe mapping.

## Files Allowed

- `src/pages/admin/AdminProducts.tsx`
- `src/lib/api.ts`
- `src/lib/runtimeCatalog.ts`
- `src/data/catalog.ts`
- `src/lib/productPageBuilder.ts`
- `src/lib/productContent/productContentTypes.ts`
- New focused `src/lib/*aiProductImporter*` files
- Directly related server importer/enrichment files if needed
- Directly related tests
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

## Do Not Touch

- Google Login/auth behavior
- Public deploy configuration
- Production `server/index.js` usage model for Hostinger static hosting
- Secrets or environment values
- Unrelated product/catalog data
- Old Task Specs unless a specific reference is required

## Checks

- Run lint for changed files when possible.
- Run typecheck.
- Run related tests when possible.
- Run build when possible.
- Report any environment blocker exactly.

## Final Report Format

Report: Overall, AI Importer, Images, Product Content, Deduplication, Backend/Admin, Security, Checks, Files changed, Remaining blockers, Final Decision.

Final Decision must be exactly one of:

- `READY FOR REVIEW`
- `NEEDS BACKEND STORAGE DECISION`
- `NOT READY`
