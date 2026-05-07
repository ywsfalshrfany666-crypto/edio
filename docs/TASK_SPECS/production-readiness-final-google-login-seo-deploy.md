# Task Spec: Production Readiness Final Google Login SEO Deploy

## Task ID
production-readiness-final-google-login-seo-deploy

## Date
2026-05-04

## Goal
Resolve the remaining production readiness blockers for Edio by rebuilding with production Supabase Google Login env values, verifying SEO/performance/auth/deploy output, and pushing only the static deploy folder to GitHub if all required checks pass.

## Execution Brief
Finalize Edio for Hostinger static deployment without changing product data, UI, Supabase/Google settings, or backend behavior. Confirm required Supabase Vite env values and GitHub push capability without printing secrets. Inspect only Google Login/Auth, `.htaccess`, Vite/package/deploy output, and generated SEO files. Rebuild with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL=https://edio-iq.com`; run lint, typecheck, tests, and build. Prepare `/Users/yousif/.gemini/antigravity/scratch/edio-deploy` from `dist` plus `.htaccess`, scan for forbidden source files and secret markers, validate sitemap/robots/canonical/schema basics, and run Lighthouse/performance smoke on key routes where practical. Do not invent product specs; SEO warnings for missing specs are non-blocking if schema and core SEO are valid. Push only static deploy output to `https://github.com/ywsfalshrfany666-crypto/edio.git` on `main` if required credentials are available. Trigger Hostinger deploy only if available and safe; otherwise report manual action.

## Scope
- `src/App.tsx`
- `src/pages/auth/Login.tsx`
- `src/pages/auth/AuthCallback.tsx`
- `src/components/auth/Guards.tsx`
- `src/lib/supabase.ts`
- `src/store/auth.ts`
- `public/.htaccess`
- `vite.config.ts`
- `package.json`
- `dist`
- `/Users/yousif/.gemini/antigravity/scratch/edio-deploy`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

## Out of Scope
- Product data changes
- Specs enrichment without verified dry-run
- UI redesign
- Supabase/Google Cloud setting changes
- Node production backend
- Source deployment
- Apple Login
- Import/enrichment jobs

## Current Problem
Previous readiness was blocked because the final build had not been conclusively rebuilt with production Supabase env values, leaving Google Login verification incomplete.

## Required Changes
- Verify required env availability without printing values.
- Check Google Login/Auth files for current production-safe behavior.
- Build with production Supabase Vite env.
- Validate SEO/performance/security output.
- Prepare deploy folder from final `dist`.
- Push static deploy folder only if checks pass and credentials are available.
- Update task history.

## Existing Features To Preserve
- Google Login
- Legacy/static-safe auth UI
- Customer-only Google users
- Admin protections
- Cart/checkout/product routes
- SEO static routes
- Performance code splitting/vendor chunks
- Hostinger static deployment model

## Acceptance Criteria
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL=https://edio-iq.com` are used for production build.
- lint/typecheck/tests/build pass.
- Deploy folder includes `index.html`, `assets`, `.htaccess`, `sitemap.xml`, and `robots.txt`.
- Deploy folder excludes `src`, `server`, `node_modules`, `.env`, and secret markers.
- sitemap/robots/canonical/schema checks pass.
- TBT remains 0ms or below 50ms on sampled routes.
- GitHub static push succeeds if credentials are available.
- Hostinger deploy status is clear.

## Safety Rules
- Never print secrets or tokens.
- Never write secrets to files.
- Never upload source/server/node_modules/.env.
- Never use service role key in frontend.
- Do not make broad code changes.
- Do not invent product specs.

## Test Plan
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Deploy folder forbidden-file scan
- Secret marker scan
- sitemap/robots/schema smoke
- Lighthouse/performance smoke on `/`, `/shop`, `/category/iems`, and one product route where practical
- Auth route smoke for `/login` and `/auth/callback`; full OAuth only if credentials/browser flow allow it

## Final Report Format
1. Final Status
2. Env Readiness
3. Build Checks
4. SEO Checks
5. Performance Checks
6. Auth Checks
7. Deploy Folder
8. GitHub
9. Hostinger
10. Final Decision
