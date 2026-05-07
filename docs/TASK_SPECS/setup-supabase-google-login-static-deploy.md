# Task Spec: Setup Supabase Google Login Static Deploy

## Task ID
setup-supabase-google-login-static-deploy

## Date
2026-05-04

## Goal
Prepare Edio static Hostinger deployment to support Google Login through Supabase Auth without relying on the local Node.js server in production.

## Scope
Inspect and update only auth-related frontend files: login/register/account pages, auth state, auth guards/bootstrap, Supabase/client config, routing, header account state, package/env config, and setup documentation. Local `server/index.js` auth endpoints may be inspected only to understand the previous flow.

## Out of Scope
No Apple Login. No custom OAuth backend for production. No source deploy. No `.env` secrets. No admin role grants from Google. No cart/checkout redesign. No product/admin/storefront data changes. No production push unless a valid `EDIO_GITHUB_TOKEN` exists in the shell environment.

## Current Problem
Production is static only on Hostinger, while the existing email/password and server OAuth flows depend on `server/index.js`. That backend is not running in production, so login/register cannot rely on `/api/auth/*` there.

## Required Changes
- Add `@supabase/supabase-js`.
- Add `src/lib/supabase.ts` with safe env handling.
- Extend auth state with Supabase session/user support, Google sign-in, sign-out, and refresh.
- Add `/auth/callback` route/page.
- Update login/register UI to use Google via Supabase when configured and avoid broken backend requests in static production.
- Keep existing backend auth for local/dev or explicit API deployments.
- Update `.env.example`.
- Add `docs/SUPABASE_GOOGLE_AUTH_SETUP.md`.
- Build and verify.

## Existing Features To Preserve
Storefront, cart/checkout, admin local auth, existing account pages, route structure, SEO, and product/catalog behavior.

## Acceptance Criteria
- Supabase client exists and does not crash without env.
- Google login button exists when Supabase env is configured.
- `/auth/callback` exists and safely redirects internally.
- Account page can render Supabase users as customer users.
- Sign out works.
- `.env.example` and setup docs exist.
- Build succeeds.
- No service role key, OAuth secret, or token is committed or printed.

## Safety Rules
Do not store passwords or OAuth tokens manually. Let Supabase manage the session. Never grant admin from Google claims. Any Supabase user maps to role `customer` only. Keep open redirects blocked.

## Test Plan
Run `npm run typecheck`, `npm run lint`, and `npm run build` when practical. Verify auth chunks do not contain localhost auth URLs or service role key names. Verify routes `/login`, `/signup`, `/auth/callback`, and `/account` compile.

## Final Report Format
- Problem
- Files changed
- What changed
- Env variables required
- Build/lint/test status
- Push status
- Manual Supabase/Google/Hostinger steps
- Risks/notes
