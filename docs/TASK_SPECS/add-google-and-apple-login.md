# Task Spec: Add Google And Apple Login

## Task ID
add-google-and-apple-login

## Date
2026-05-04

## Execution Brief
Add Google and Apple social login to Edio without breaking existing email/password auth, admin access, sessions, cart, checkout, account, or orders. Inspect only auth-related files: login/register UI, auth store/hooks, session handling, server auth endpoints, user persistence, protected routes, environment configuration, and account/cart integration. Use the existing auth system rather than replacing it. Social OAuth must be server-side and safe: no client secrets in frontend, state-based callback validation, no open redirects, no access/refresh tokens in localStorage, and new social users must default to `customer`. Add account-linking storage for provider identities without duplicating users by verified email. Add Google and Apple buttons to login/register with loading/error states and RTL-friendly layout. Add `.env.example` entries and `docs/AUTH_PROVIDERS.md` setup notes. Add tests for provider config, callback URL validation, account linking, default role, and missing env safety where practical. Run build/lint/tests.

## Goal
إضافة تسجيل الدخول باستخدام Google و Apple بشكل آمن ومهني، مع الحفاظ على تسجيل الدخول الحالي ولوحة الإدارة.

## Scope
- Auth UI: login/register.
- Auth client state/hooks.
- Server auth endpoints and session helpers.
- User persistence and account linking.
- Environment variables and auth docs.
- Protected route/admin safety checks.

## Out of Scope
- Replacing the existing auth system.
- Changing cart/order/product/admin behavior unrelated to auth.
- Granting admin roles from social providers.
- Storing OAuth secrets or tokens in frontend/localStorage.
- Adding a heavy external auth platform unless unavoidable.

## Current Problem
Edio currently lacks Google and Apple social login. The implementation must be added without weakening existing custom auth/session behavior.

## Required Changes
- Identify current auth architecture before implementation.
- Add Google and Apple provider configuration using env vars.
- Add server-side OAuth start/callback endpoints with state validation and safe redirects.
- Add account-linking persistence for `google` and `apple`.
- Create/link users safely; new social users default to `customer`.
- Add social login buttons to Login/Register pages.
- Update `.env.example`.
- Add `docs/AUTH_PROVIDERS.md`.
- Add focused tests for config/linking/security helpers.

## Existing Features To Preserve
- Email/password login/register.
- Admin login and role separation.
- Sessions/logout.
- Cart, checkout, account, orders.
- Protected admin routes and APIs.

## Acceptance Criteria
- Google and Apple buttons exist and are ready to work when env vars are configured.
- Missing provider env does not crash the app.
- No secrets are exposed in frontend.
- Callback redirects are validated; no open redirect.
- Social-created users are `customer` by default.
- Existing password/admin auth remains intact.
- `.env.example` and `docs/AUTH_PROVIDERS.md` are updated.
- Build/lint/tests pass when practical.

## Safety Rules
- Do not delete existing auth routes or UI.
- Do not store access/refresh tokens in localStorage.
- Do not print tokens/secrets.
- Do not trust unverified provider email for unsafe linking.
- Do not grant admin role from OAuth claims.
- Do not allow external callback redirects.

## Test Plan
- Auth helper/provider config tests.
- Safe callback URL validation tests.
- Social account creation/linking tests.
- Default role/admin safety tests.
- Missing env safety tests.
- Build, lint, and relevant auth tests.

## Final Report Format
1. Current auth system found
2. Google login implementation
3. Apple login implementation
4. Files changed
5. Required env variables
6. Existing login/admin safety
7. Tests added/run
8. Google Console and Apple Developer production steps
