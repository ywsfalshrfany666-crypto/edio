# Task Spec: Alwaseet API Order Automation

## Task ID
alwaseet-api-order-automation

## Date
2026-05-06

## Execution Brief
Build a secure, dry-run-first Alwaseet shipping automation for Edio. Frontend checkout must collect customer/order data and call a Supabase Edge Function; React must never store or send Alwaseet credentials directly. The Edge Function reads `ALWASEET_USERNAME` and `ALWASEET_PASSWORD` from secrets, defaults `ALWASEET_DRY_RUN=true`, uses official Alwaseet merchant API fields, validates city/region/package size/phone/order data, prevents duplicate submissions where possible, and returns only safe success/error responses. Do not deploy, push, or create live Alwaseet orders unless live mode is explicitly enabled. Inspect only checkout/order/API/Supabase-function files and related tests. Preserve Google Login, SEO, performance, product pages, cart, and static Hostinger production constraints.

## Goal
Create real Alwaseet order automation through a safe backend path, starting in dry-run mode.

## Scope
Checkout/order submission, `src/lib/api.ts`, Supabase Edge Functions, Alwaseet validation/mapping utilities, and directly related tests/docs.

## Out of Scope
No frontend secrets, no direct React-to-Alwaseet credentialed calls, no `server/index.js` production dependency, no GitHub push, no deploy, no live order unless explicitly enabled.

## Current Problem
Checkout can collect shipping details, but live Alwaseet order creation must be backed by official API calls through a secure backend and must not expose merchant credentials.

## Required Changes
- Confirm official Alwaseet API contract for login, cities, regions, package sizes, and create-order.
- Add or complete Supabase Edge Function backend for Alwaseet public data and order creation.
- Ensure city/region/package size are dropdown-backed by Alwaseet data and region depends on city.
- Add validation, phone normalization, mapper, dry-run default, safe errors, and idempotency design.
- Add targeted tests for validation, mapping, dry-run, and mocked API behavior.

## Existing Features To Preserve
Checkout UI, cart, product pages, Google Login, `/auth/callback`, SEO output, performance, and static Hostinger hosting.

## Acceptance Criteria
- No Alwaseet credentials or token in frontend/dist/docs.
- Dry-run does not call live create-order.
- Live mode uses Edge Function secrets only.
- Cities/regions/package sizes follow official API.
- Valid dry-run checkout succeeds; invalid phone or missing city/region/package fails safely.

## Safety Rules
No secret values in files/logs/reports. No `.env` commit. No `VITE_ALWASEET_*`. No raw Alwaseet errors to customers. No live shipment during automated tests.

## Test Plan
Run lint, typecheck, related tests or full tests when practical, and build. Browser smoke only checkout/login/auth/shop/product if backend/env is available enough to validate.

## Final Report Format
Report API docs used, architecture, UI behavior, changed files, tests, security checks, manual verification, remaining blockers, and one final decision.
