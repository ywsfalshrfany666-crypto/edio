# Task Spec: Mobile Product Grid View Toggle

## Task ID
mobile-product-grid-view-toggle

## Date
2026-05-04

## Goal
Make storefront product grids on mobile default to two products per row, with a compact user toggle for switching between one-column and two-column mobile views.

## Execution Brief
Add a mobile-only storefront product grid preference using `localStorage` key `edio_product_grid_view` with only `one` and `two` values. Default to `two`. Apply it to public product grids in Shop, Category, and ProductDetail recommendation grids while preserving current tablet/desktop breakpoints. Add an accessible compact toggle near existing product controls. Keep the change additive and scoped; do not modify product data, auth, SEO, backend, deploy, or desktop/tablet layout. Verify mobile viewports, persistence after refresh, filter/sort behavior, no horizontal overflow, and run available lint/typecheck/test/build.

## Scope
- `src/pages/Shop.tsx`
- `src/pages/Category.tsx`
- `src/pages/ProductDetail.tsx`
- `src/components/shop/ProductCard.tsx`
- Shared storefront product grid toggle/hook component
- Task docs and history/index

## Out of Scope
- Product data changes
- Auth, Google Login, Supabase, admin, backend, SEO schema changes
- Header/footer redesign
- GitHub push or Hostinger deploy
- Desktop/tablet layout redesign

## Current Problem
Public product grids currently fall back to one column on mobile because the grid classes start at `sm:grid-cols-*`. Users cannot choose between a compact two-column mobile product view and a larger one-column view.

## Required Changes
- Add a small `useProductGridView()` hook that reads/writes the user preference after mount.
- Add a mobile-only `ProductGridViewToggle` with accessible labels and active state.
- Default mobile grids to two columns.
- Allow one-column mobile mode and persist it.
- Keep existing `sm`, `lg`, `xl` grid behavior intact.
- Apply the same preference to related/recommendation product grids.
- Adjust mobile ProductCard spacing/type only enough to fit two-column cards cleanly.

## Existing Features To Preserve
- Product links, filters, sorting, search, progressive rendering
- Product image square canvas and `object-contain`
- SEO metadata/schema and product URLs
- Google Login/auth/session behavior
- Desktop/tablet product grids

## Acceptance Criteria
- `/shop` mobile defaults to two columns.
- `/category/*` mobile defaults to two columns.
- Product detail recommendations respect the same mobile preference.
- Toggle switches to one column and back to two.
- Preference persists after refresh.
- No horizontal overflow on 375/390/412px widths.
- Filter/sort/search continue working.
- No product data, SEO, or auth regression.

## Safety Rules
- Use `localStorage` only for UI preference, never security/auth.
- Accept only `one` and `two`.
- Do not add a new library.
- Do not deploy or push.

## Test Plan
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Browser check with mobile viewports `375`, `390`, `412` on `/shop`, `/category/iems`, another category with products, and a product detail page with recommendations.

## Final Report Format
- Summary
- Files changed
- Behavior verified
- Checks
- Regression
- Final Decision
