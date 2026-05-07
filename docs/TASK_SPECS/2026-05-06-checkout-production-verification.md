# Goal

Verify the production checkout flow after Hostinger deploy and Alwaseet live-mode activation.

# Scope

- Production domain: `https://edio-iq.com`
- Checkout route only.
- Non-destructive checks only.
- Do not submit a live checkout/order.

# Files allowed

- `docs/TASK_SPECS/2026-05-06-checkout-production-verification.md`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do not touch

- Frontend code
- Supabase function code
- Product data
- Deploy folder
- GitHub remote
- Alwaseet credentials

# Checks

- Production checkout HTTP response.
- Production build asset response.
- Browser checkout page visible.
- Supabase `ALWASEET_DRY_RUN` secret exists after live activation.
- Confirm no live create-order test is sent.

# Final report format

Short Edio report focused on checkout readiness.
