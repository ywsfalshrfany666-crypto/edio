# Task Spec: Final Production Readiness Performance Auth SEO Mobile Grid Deploy

## Task ID
final-production-readiness-performance-auth-seo-mobile-grid-deploy

## Date
2026-05-05

## Execution Brief
Complete the remaining Edio production readiness gates without relying on prior chat history. Verify required Supabase production Vite env values and GitHub push access without printing secrets. Preserve Edio as a premium audio store with Strong Production + Enterprise Lite scope only. Inspect only auth, SEO, performance, static deploy, and mobile product grid files. Confirm Google Login wiring through Supabase, customer-only role safety, `/auth/callback`, logout/session behavior, SEO artifacts, security scans, PageSpeed/Lighthouse performance, and mobile product grids defaulting to two columns with a one/two toggle. Build with production env, prepare the static deploy folder only, scan for secrets/source files, and push deploy output to GitHub only if all gates pass. Do not use `server/index.js` for production auth, do not print or save secrets, do not push source/backend/env files, and do not trigger Hostinger deploy unless safe access is available.

## Goal
Make Edio production-ready across Google Login, auth/security, SEO, performance/PageSpeed, mobile product grid behavior, final static deploy folder, and GitHub static deploy push.

## Scope
- Auth: `src/App.tsx`, login/callback pages, auth guards, Supabase client/config, `src/lib/api.ts`, `public/.htaccess`.
- SEO: SEO helpers/components, shop/category/product/home pages, static SEO generation, catalog/runtime catalog.
- Performance: Vite config, package scripts, public assets, dist/deploy output, above-the-fold components if measured as bottlenecks.
- Mobile grid: shop/category/product recommendation grids and product card/grid toggle components.
- Docs: this task spec, task index, task history.

## Out of Scope
- SaaS, marketplace, multi-vendor, full enterprise features.
- Product data rewrites, invented specs, fake reviews/ratings.
- Backend production deployment or use of `server/index.js` for Hostinger static production.
- Broad redesigns, route/component deletion, unrelated refactors.
- Pushing `src`, `server`, `node_modules`, `.env`, or secrets.

## Current Problem
Previous local readiness work exists, but the final production artifact must be rebuilt and verified with production Supabase env values, current performance/mobile-grid changes, clean SEO/security output, and a deploy-folder-only GitHub push if all gates pass.

## Required Changes
- Verify required env values without exposing them.
- Confirm or minimally fix Google Login, auth safety, SEO artifacts, performance blockers, mobile grid toggle/default behavior, and deploy folder cleanliness.
- Run lint/typecheck/tests/build with production env.
- Use Codex-controlled browser tooling only for UI/performance checks.
- Prepare final static deploy folder and push it only if all required gates pass.

## Existing Features To Preserve
Storefront, header/footer, product/category/search/detail flows, cart/checkout where present, admin routes, Google Login, SEO/static indexing, product images/description media/spec images, public stock privacy, recommendations, audit/import/bulk/admin features.

## Acceptance Criteria
- Required production env and GitHub push capability are available, or execution stops with the exact missing variable.
- Build/lint/typecheck/tests pass or any unavailable script is reported.
- Mobile product grids default to two columns and persist one/two preference.
- Google Login reaches Supabase/Google OAuth redirect; final session verification is reported if blocked by credentials/2FA.
- SEO artifacts and schema remain present and production-domain-only.
- Performance has measured before/after results where tooling is available.
- Deploy folder contains only static output and no secrets/source/backend/env files.
- GitHub push updates only the static deploy repository when all gates pass.

## Safety Rules
- Never print secrets/tokens/keys.
- Never save secrets in files or remotes.
- Never use service role keys in frontend/build.
- Do not deploy to Hostinger unless safe access is clearly available.
- Keep changes minimal and tied to verified blockers.

## Test Plan
- Run `npm run lint`, `npm run typecheck` if present, `npm test` if present, and `npm run build`.
- Run static preview and test `/`, `/shop`, `/category/iems`, a product page, `/login`, `/auth/callback`, `/sitemap.xml`, and `/robots.txt`.
- Test mobile widths 375, 390, and 412 for grid default/toggle/persistence/no overflow.
- Run Lighthouse/trace/PageSpeed tooling where available.
- Scan source/dist/deploy folder for secrets and forbidden files.

## Final Report Format
Use the requested concise sections: final status, context, env readiness, mobile grid, build checks, auth, SEO, performance before/after, PageSpeed issues, security, deploy folder, GitHub, Hostinger, remaining blockers, and final decision.
