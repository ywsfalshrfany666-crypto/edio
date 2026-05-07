# Goal

Ensure Edio checkout fields and backend order mapping are compatible with the official Alwaseet create-order API fields.

# Scope

- Verify and adjust checkout-to-Alwaseet payload mapping.
- Ensure required Alwaseet fields are present in dry-run/create-order mapping:
  - `client_name`
  - `client_mobile`
  - `city_id`
  - `region_id`
  - `location`
  - `type_name`
  - `items_number`
  - `price`
  - `package_size`
  - `replacement`
- Keep customer-facing fields ergonomic and avoid exposing credentials or tokens.

# Files Allowed

- `src/pages/Checkout.tsx`
- `src/lib/alwaseet.ts`
- `src/lib/alwaseet.test.ts`
- `src/lib/edioOrder.ts`
- `src/lib/edioOrder.test.ts`
- `supabase/functions/create-alwaseet-order/index.ts`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do Not Touch

- Product data
- Auth / Google Login
- SEO config unless required by build
- Deploy credentials, `.env`, tokens
- `server/index.js`

# Checks

- Targeted lint for edited TS/TSX files
- `npm run typecheck`
- Related tests
- `npm run build`
- No live Alwaseet create-order during verification

# Final Report Format

Use the standard Edio concise report with task class, context used, files changed, checks, deploy, safety, and final decision.
