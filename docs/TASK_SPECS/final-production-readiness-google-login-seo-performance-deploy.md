# Task Spec: Final Production Readiness Google Login SEO Performance Deploy

## Task ID
final-production-readiness-google-login-seo-performance-deploy

## Date
2026-05-04

## Goal
Make Edio production-ready at the highest practical standard by rebuilding with verified Supabase production env values, validating Google Login/Auth, SEO, performance/TBT, security, static deploy output, and pushing only the final deploy folder to GitHub if all gates pass.

## Execution Brief
Finalize Edio for Hostinger static production. Read only the official context files and this spec. Inspect only the listed auth, SEO, performance, build, and deploy artifacts. Verify required Vite Supabase env values without printing secrets, rebuild with `VITE_SITE_URL=https://edio-iq.com`, run lint/typecheck/tests/build/audit where practical, and prepare `/Users/yousif/.gemini/antigravity/scratch/edio-deploy` from the fresh `dist` only. Validate that Google Login is wired through Supabase, `/auth/callback` works as an SPA route, Google users remain customer-only, and no secrets/source files are exposed. Verify sitemap, robots, canonical, JSON-LD, OG/Twitter, and that product spec warnings are non-blocking when specs are unverified. Measure or smoke-check performance/TBT inside Codex-owned tooling only; do not use the user's browser. Push only deploy output to GitHub when checks pass and push credentials are available. Trigger Hostinger only if safely accessible; otherwise report manual deploy.

## Scope
- `src/App.tsx`
- Auth login/callback pages and guards
- Supabase client/auth store
- `public/.htaccess`
- `src/lib/seo.ts`
- `src/components/Seo.tsx`
- `src/pages/Index.tsx`
- `src/pages/Shop.tsx`
- `src/pages/Category.tsx`
- `src/pages/ProductDetail.tsx`
- `scripts/generate_static_seo.mjs`
- `src/data/catalog.ts`
- `src/lib/runtimeCatalog.ts`
- `src/lib/api.ts`
- `vite.config.ts`
- `package.json`
- `dist`
- `/Users/yousif/.gemini/antigravity/scratch/edio-deploy`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

## Out of Scope
- SaaS, marketplace, multi-vendor, or full enterprise features
- Product data invention or unverified specs enrichment
- UI redesign
- Server production deployment
- Source deployment
- Supabase/Google Cloud setting changes unless clearly required
- Hostinger deploy through personal browser sessions

## Current Problem
Previous local readiness was strong, but final readiness must prove the current production build used `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL=https://edio-iq.com`, then validate auth, SEO, performance, security, deploy output, and GitHub delivery.

## Required Changes
- Create/update this task documentation.
- Verify env readiness without printing values.
- Rebuild with production Supabase Vite env.
- Run lint/typecheck/tests/build and relevant audits.
- Prepare final deploy folder from fresh `dist`.
- Scan deploy output for forbidden source files and secret markers.
- Verify SEO/static routing/security/performance/auth smoke checks.
- Push deploy output only if all gates pass.
- Update task history.

## Existing Features To Preserve
- Supabase Google Login
- Static-safe auth UX
- Customer-only Google users
- Admin protections
- Cart/checkout/product/shop/category routes
- SEO static routes and generated metadata
- Product images and performance chunking
- Hostinger static deployment model

## Acceptance Criteria
- Required Vite env values are available for the build and not printed.
- lint/typecheck/tests/build pass.
- `dist` and deploy folder include `index.html`, `assets`, `.htaccess`, `sitemap.xml`, `robots.txt`, and generated SEO output when present.
- Deploy folder excludes `src`, `server`, `node_modules`, `.env`, GitHub tokens, service role keys, and client secrets.
- Auth routes exist, Google OAuth redirect can be tested to the provider or is clearly blocked by credentials/2FA.
- SEO basics are present: sitemap, robots, canonical, Product/Offer/Breadcrumb JSON-LD, OG/Twitter.
- TBT remains 0ms or below 50ms where measurable; if Lighthouse is unavailable, document the tooling blocker.
- Static deploy output is pushed to GitHub only when gates pass.

## Safety Rules
- Never print secrets or tokens.
- Never write secrets to files.
- Never upload source/server/node_modules/.env.
- Never use Supabase service role in frontend.
- Do not invent product specs, reviews, ratings, prices, or availability.
- Do not use the user's personal browser for tests.
- Do not rely on old conversation memory.

## Test Plan
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high --omit=dev`
- Static route smoke on `/`, `/shop`, `/category/iems`, one product, `/login`, `/auth/callback`, `/sitemap.xml`, `/robots.txt`
- Deploy folder source/secret scan
- SEO/static HTML smoke
- Lighthouse/performance if Codex-owned browser tooling is available
- Google OAuth redirect smoke; full login only if test credentials/2FA allow

## Final Report Format
Use the user's requested 13-section report:
Final Status, Context, Env Readiness, Build Checks, Auth Checks, SEO Checks, Performance Checks, Security Checks, Deploy Folder, GitHub, Hostinger, Remaining Issues, Final Decision.
