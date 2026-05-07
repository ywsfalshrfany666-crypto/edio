# Task Spec: Final Production Launch Gate

## Task ID
final-production-launch-gate

## Date
2026-05-04

## Goal
Run a final production launch gate for Edio and fix only launch-blocking or clearly unprofessional regressions. The result must be a clear GO / NO-GO report.

## Execution Brief
Perform a focused launch audit of Edio's critical public, shared, and admin surfaces. Inspect only files and routes directly related to homepage, category/subcategory, shop/search, product detail, cart/checkout, auth/account, admin product workflows, header/footer, product cards/images, SEO metadata, stock privacy, and deployment readiness. Classify findings as P0/P1/P2/P3. Fix only P0, P1, and very small safe P2 issues. Do not add features, redesign sections, run imports/enrichment, change product data, prices, stock, taxonomy, or delete routes/components. Verify with build, lint, typecheck, targeted tests, route/API smoke checks, and security/SEO checks where practical. Update task history after execution and return a concise launch decision.

## Scope
- Public storefront: homepage, category, subcategory, shop/search, product detail, cart, checkout, login/register, account.
- Shared: header, footer, product cards, product image gallery, lightbox, SEO metadata, OG image, responsive layout.
- Admin smoke: product list, add/edit product, import product, bulk edit, audit/review routes if present.
- Deployment readiness: production metadata, sitemap/robots if present, frontend secrets, stock privacy.

## Out of Scope
- No new features.
- No large redesigns.
- No backend changes unless necessary for a real P0/P1.
- No database edits unless launch-blocking.
- No imports, enrichment jobs, bulk product edits, price/stock/category changes, route/component deletion, heavy libraries, or broad refactors.

## Current Problem
The site needs a final pre-launch verification pass after several product image, description, title, admin, and homepage changes. The task is to catch regressions and launch blockers only.

## Required Changes
- Audit critical pages and APIs.
- Classify findings P0-P3.
- Fix P0/P1 and very safe P2 issues only.
- Run practical validation commands.
- Update `docs/TASK_HISTORY.md`.
- Produce a GO / NO-GO launch report.

## Existing Features To Preserve
- Product image gallery and lightbox.
- Description/spec images and blocks.
- WordPress/AI import systems.
- Product recommendations and quality score.
- Admin bulk edit, review, audit logs, and approval flows.
- Category/subcategory logic.
- Search, cart, checkout, auth, SEO/OG.
- Public stock privacy: exact stock visible only when `<= 3`.

## Acceptance Criteria
- Build succeeds.
- No P0 blockers remain.
- No critical console/hydration/API errors are found in smoke checks.
- Critical public routes return successfully.
- Product cards, product detail, lightbox, header, footer, search, category/subcategory, stock display, SEO metadata, and admin product list are launch-safe.
- No production metadata points to localhost.
- No obvious frontend secrets are exposed.

## Safety Rules
- Make the smallest safe change.
- Do not inspect unrelated systems.
- Do not run destructive commands.
- Do not modify product data in bulk.
- Do not deploy or push.

## Test Plan
- `eslint` on changed/critical files when practical.
- `tsc --noEmit`.
- `vite build`.
- Targeted tests for stock/API/SEO/product image logic if present.
- HTTP route smoke checks for public/admin critical routes.
- API smoke checks for product privacy and storefront visibility.
- Static scan for localhost metadata, secrets, console logs, raw unsafe HTML patterns.

## Final Report Format
Use the requested `# Final Launch Report` format with launch decision, P0/P1 issues, fixed issues, remaining non-blocking issues, files changed, commands, critical page check, image check, SEO check, security smoke check, and final notes.
