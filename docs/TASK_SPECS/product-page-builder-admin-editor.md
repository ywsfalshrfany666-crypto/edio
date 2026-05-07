# Product Page Builder Admin Editor

## Goal

Add an Edio-native product page builder inside the admin product create/edit flow so each product can manage Description, Sound, Specs, SEO, media, sources, validation, and a live preview without copying competitor content or inventing product facts.

## Scope

- Extend the existing product data model in a backward-compatible way with optional `productPage` content.
- Extend the existing admin product form with a focused Product Page Builder panel.
- Add structured editors for Description blocks, Sound fields, Specs groups/rows, Media, SEO, and Sources.
- Add a draft-based live preview that reuses product page rendering components where possible.
- Add validation helpers for required fields, warnings, unsafe HTML/URLs, media licenses, SEO completeness, and source tracking.
- Keep old products rendering through existing fallbacks.
- Implement a dry-run research workflow placeholder that prepares reviewable drafts without mass import or automatic overwrite.

## Files Allowed

- `src/data/catalog.ts`
- `src/pages/ProductDetail.tsx`
- Existing product detail tabs/content/gallery components
- `src/pages/admin/AdminProducts.tsx`
- `src/lib/api.ts`
- `src/lib/runtimeCatalog.ts`
- `src/lib/seo.ts`
- `src/components/Seo.tsx`
- Related tests for product content, validation, SEO, and product detail rendering
- `package.json` / `vite.config.ts` only if needed for checks
- `docs/TASK_HISTORY.md`

## Do Not Touch

- Deploy folder
- GitHub push or Hostinger deploy
- Secrets, `.env`, tokens, service-role keys
- `server/index.js` production behavior
- Google Login/auth routes unless a direct compile blocker appears
- Unrelated storefront pages or product prices/data

## Checks

- `npm run lint`
- `npm run typecheck` if available
- `npm run test` if available and relevant
- `npm run build`
- Browser smoke on local `/admin/products` and one product detail route

## Execution Brief

Implement the smallest safe version of the builder as structured product content, not a full CMS. Use optional schema fields so existing catalog products continue to work. In admin, add clear tabs/sections for Basic, Media, Description, Sound, Specs, SEO, Sources, and Preview; include live draft preview, validation badges, and research dry-run controls without performing live web scraping or automatic overwrites. Rendering on `ProductDetail` must prefer `productPage` data and fall back to the current Description/Sound/Specs behavior. Avoid raw HTML; sanitize/validate text and URLs. Keep research/admin code out of the public product path as much as possible and do not deploy.

## Final Report Format

1. Overall
2. Admin/Product Builder
3. Backend/Data
4. Product Page
5. Research
6. Security
7. Checks
8. Files changed
9. Remaining blockers
10. Final Decision
