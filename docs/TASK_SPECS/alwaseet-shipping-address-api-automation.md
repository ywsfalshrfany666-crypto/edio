# Task Spec: Alwaseet Shipping Address API Automation

## Task ID
alwaseet-shipping-address-api-automation

## Date
2026-05-05

## Goal
Add a secure dry-run-first shipping integration between Edio checkout and Alwaseet, using a backend-only API layer so customer order/address data can be prepared for official Alwaseet order creation without exposing credentials in the frontend.

## Execution Brief
Implement Alwaseet shipping automation for Edio checkout with Supabase Edge Functions as the production-safe backend because Hostinger serves the site as static output. Add customer/address fields required for Alwaseet, validate Iraqi phone/address inputs, map Edio checkout data into an Alwaseet-compatible payload, and call a `create-alwaseet-order` Edge Function. The function must default to dry-run, read Alwaseet credentials only from secure function environment variables, enforce idempotency, sanitize logs/responses, and refuse live order creation unless credentials and safe backend storage are available. Add minimal Supabase migration tables for orders, customer addresses, shipping integrations, and shipping events. Preserve cart, checkout, auth, SEO, admin, and static deployment behavior. Run lint/typecheck/test/build where practical and report remaining blockers such as missing live Alwaseet credentials or undeployed Edge Function.

## Scope
- `src/pages/Checkout.tsx`
- `src/pages/OrderConfirmation.tsx`
- `src/lib/alwaseet.ts`
- `supabase/functions/create-alwaseet-order/*`
- `supabase/migrations/*`
- `.env.example`
- tests for Alwaseet validation/mapper
- task docs/history/index

## Out of Scope
- No scraping or browser automation against Alwaseet.
- No live shipment creation during implementation.
- No credentials in React, Vite env, docs, git, or dist.
- No marketplace, SaaS, or full ERP/order platform.
- No Hostinger/GitHub deploy unless explicitly requested.

## Current Problem
Checkout currently creates a local order snapshot and redirects to confirmation. There is no production backend order creation, no shipping submission, no Alwaseet mapping, and no safe storage for shipping integration status.

## Required Changes
- Add checkout fields for Iraqi delivery details: secondary phone, province, region/district, nearest point, address, notes.
- Discover Alwaseet field types from the official API and mirror them: city, region, and package size are dropdowns backed by Alwaseet IDs; customer name, phones, location, nearest point, and notes are free-text/phone inputs.
- Treat `type_name`, `items_number`, `price`, `replacement`, and optional numeric `company_order_id` as internal/derived payload values, not customer-entered dropdowns.
- Use selected `cityId`, `regionId`, and `packageSizeId` directly in the Edge Function mapper; do not re-resolve selected IDs from display labels.
- Omit `company_order_id` for Edio's normal string order IDs because Alwaseet documents it as an optional integer.
- Add frontend validation and safe Supabase Edge Function invocation.
- Add Edge Function `create-alwaseet-order` with dry-run default, live API support, idempotency, sanitized responses, and backend-only credentials.
- Add migration SQL for minimal order/address/shipping tables.
- Add tests for phone/address validation, payload building, dry-run behavior shape, and error normalization.

## Existing Features To Preserve
- Current cart totals/coupon/shipping pricing.
- Checkout route and order confirmation route.
- Google Login and auth routes.
- SEO/static output behavior.
- Admin routes and current API-backed admin behavior.

## Acceptance Criteria
- No Alwaseet secret appears in frontend code, dist, docs, or `.env.example`.
- Checkout validates required shipping fields and phone format.
- Checkout calls a backend function, not Alwaseet directly.
- Edge Function defaults to dry-run and does not create live orders unless explicitly configured.
- Idempotency is based on `edioOrderId`.
- Build/typecheck/tests pass or failures are reported clearly.

## Safety Rules
- Do not use `VITE_ALWASEET_*`.
- Do not store full sensitive payloads in browser storage.
- Do not log passwords/tokens/full phone numbers.
- Do not rely on frontend for shipping price or live authorization.
- Do not create a live Alwaseet order during tests.

## Test Plan
- Unit tests: Iraqi phone normalization, checkout validation, Edio payload construction, safe response normalization.
- Mock/integration path: dry-run response shape and duplicate/idempotent behavior.
- Manual route checks: `/checkout`, `/cart`, `/login`, `/auth/callback`, `/order-confirmation`.
- Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Final Report Format
- Overall status
- Alwaseet API research
- Architecture
- Address fields added
- Files changed
- Security checks
- Tests/build status
- Manual verification
- Remaining blockers
- Final decision
