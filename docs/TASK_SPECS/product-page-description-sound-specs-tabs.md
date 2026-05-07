# Product Page Description / Sound / Specs Tabs

## Goal

Add an Edio-native product detail tab system inspired by product information architecture from premium audio stores. The page should show Description, Sound, and Specs sections with safe fallbacks for products that do not have enriched content.

## Scope

- Extend product detail content types with optional rich content fields.
- Update the product detail UI to render accessible tabs.
- Use existing product facts only; do not invent specs, sound claims, prices, ratings, or reviews.
- Add at most one safe sample product content entry if existing catalog data supports it.
- Preserve SEO, routing, Google Login, and static Hostinger assumptions.

## Files Allowed

- `src/pages/ProductDetail.tsx`
- Product-related components under `src/components/`
- Product/catalog/runtime types and helpers under `src/data/` and `src/lib/`
- Product-related tests only
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

## Do Not Touch

- Google Login and `/auth/callback`
- Deployment folders and GitHub push flow
- Product prices, stock, or unsupported product facts
- `server/index.js` for production behavior
- Old Task Specs

## Checks

- `npm run lint`
- `npm run typecheck` if available
- product-related tests if available
- `npm run build`
- Browser smoke for one product route, `/shop`, `/category/iems`, `/login`, `/auth/callback`

## Final Report Format

- Summary
- Files changed
- Data model and fallback behavior
- UI verification
- SEO/performance notes
- Checks
- Safety
- Final Decision: `READY FOR REVIEW` or `NOT READY`
