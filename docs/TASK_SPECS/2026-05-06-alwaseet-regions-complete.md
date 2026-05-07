# Goal

Ensure the checkout region field uses the complete region list returned by Alwaseet for the selected city/governorate, so Mosul and other cities do not show only a small district subset.

# Scope

- Production checkout shipping city/region selection.
- Alwaseet lookup loading and UI option mapping only.
- Preserve secure backend-only Alwaseet credentials.

# Files allowed

- `src/pages/Checkout.tsx`
- `src/lib/alwaseet.ts`
- `supabase/functions/create-alwaseet-order/index.ts`
- Related tests if needed
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`
- This Task Spec

# Do not touch

- Product catalog data
- Auth / Google Login
- Payment UI except where needed for shipping validation
- Deploy repo until build/checks pass
- Secrets or `.env`

# Checks

- Confirm source of regions.
- Verify Mosul/Nineveh region count from Alwaseet lookup.
- Run targeted tests/build as feasible.
- Do not create live orders.

# Final report format

Use Edio short report and include whether deploy is needed.
