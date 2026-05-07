# Task Spec: Google Login Production Rebuild And Deploy

## Task ID
google-login-production-rebuild-and-deploy

## Date
2026-05-04

## Goal
Build the final Hostinger static production artifact with real Supabase Google Login environment variables, push only the generated static deploy folder to the GitHub deployment repository, and prepare the site for Hostinger Git deploy.

## Execution Brief
Complete the production Google Login rebuild for Edio without exposing secrets or changing unrelated features. Verify required environment variables for Supabase Auth and GitHub push without printing values. Inspect only auth/deploy-related files, confirm `/login` and `/auth/callback` are wired to Supabase client auth, and ensure Google users remain customer-only. Run lint/typecheck/tests/build with `VITE_SITE_URL=https://edio-iq.com` and available Supabase env values. Prepare `/Users/yousif/.gemini/antigravity/scratch/edio-deploy` from `dist` plus `public/.htaccess`, scan it for source files and secret patterns, then push only that static output to `https://github.com/ywsfalshrfany666-crypto/edio.git` on `main` if `EDIO_GITHUB_TOKEN` is available. Do not deploy to Hostinger unless access is available and the Git deploy action can be safely triggered. Update task history and report env readiness, build checks, deploy folder safety, GitHub push status, Hostinger action needed, and production auth verification status.

## Scope
- `src/App.tsx`
- Login page under `src/pages/auth/`
- `src/pages/auth/AuthCallback.tsx`
- `src/components/auth/Guards.tsx`
- Supabase client/auth store files
- `public/.htaccess`
- `vite.config.ts`
- `package.json`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`
- deploy folder `/Users/yousif/.gemini/antigravity/scratch/edio-deploy`

## Out of Scope
- Product data changes
- UI redesign
- Supabase/Google Cloud random changes
- Apple Login
- Node backend production auth
- Import/enrichment
- Uploading source, server, node_modules, or `.env`

## Current Problem
The last generated static artifact may not include production Supabase Vite environment variables, so the live login page can remain stale, cached, or not fully wired for Google Login.

## Required Changes
- Verify required env availability without printing values.
- Confirm Supabase Google Login code path and callback route.
- Build production artifact with proper env.
- Scan `dist` and deploy output for forbidden files and secret markers.
- Prepare static deploy folder.
- Push static deploy folder only to GitHub if token is available.
- Trigger Hostinger Git deploy only if safely available.

## Existing Features To Preserve
- Google Login and legacy login UI behavior
- Customer-only default role for Google users
- Admin protections
- Cart, checkout, routing, product pages, SEO output
- Hostinger static deployment model

## Acceptance Criteria
- Context files were read.
- Required Supabase env is available for build or missing vars are reported by name only.
- Lint/typecheck/tests/build pass when env is available.
- Deploy folder contains only static output and `.htaccess`.
- No source, server, node_modules, `.env`, GitHub token, service role key, Google client secret, or private key in deploy output.
- GitHub push succeeds if token is available.
- Hostinger manual deploy status is clear if Codex cannot trigger it.

## Safety Rules
- Never print secrets, tokens, keys, or passwords.
- Never save secrets in repo files or remotes.
- Do not use `SUPABASE_SERVICE_ROLE_KEY` in frontend.
- Remove temporary askpass and remotes after push.
- Do not push source files.

## Test Plan
- Check env presence with boolean output only.
- Run `npm run lint`.
- Run `npm run typecheck` if available.
- Run `npm run test` if available.
- Run `npm run build`.
- Scan `dist` and deploy folder for forbidden files and secret patterns.
- Verify static route files and `.htaccess` exist.
- If Hostinger deploy is triggered, test `/`, `/login`, `/auth/callback`, Google redirect, session, logout, and admin access as far as credentials allow.

## Final Report Format
1. Context files
2. Env readiness
3. Build checks
4. Deploy folder
5. GitHub
6. Hostinger
7. Production auth
8. Final Decision
