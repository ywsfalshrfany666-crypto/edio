# Goal

Run a broad but targeted checkout and Alwaseet verification battery to catch functional, security, deploy, and production issues after enabling complete Alwaseet regions.

# Scope

- Checkout page behavior.
- Alwaseet lookup and dry-run-safe validation paths.
- Supabase Edge Function availability and safe error handling.
- Production assets and deploy output.
- Secret exposure checks in source, build, and deploy output.

# Files allowed

- `src/pages/Checkout.tsx`
- `src/lib/alwaseet.ts`
- `src/lib/alwaseet.test.ts`
- `src/lib/edioOrder.ts`
- `src/lib/edioOrder.test.ts`
- `supabase/functions/create-alwaseet-order/index.ts`
- `docs/TASK_HISTORY.md`
- This Task Spec

# Do not touch

- Product catalog data.
- Google Login configuration.
- Production credentials.
- `.env` files.
- Deploy repo contents unless a fix is required and checks pass.

# Checks

- Run lint/typecheck/build and targeted tests.
- Run repeated checkout/Alwaseet validation scripts with many city/region/phone/payload cases.
- Verify production checkout assets and Alwaseet region loading.
- Scan source/dist/deploy for secret markers and forbidden folders.
- Do not create a live Alwaseet order.

# Final report format

Use the Edio short report, include number of test cases/checks executed, failures found, and final decision.
