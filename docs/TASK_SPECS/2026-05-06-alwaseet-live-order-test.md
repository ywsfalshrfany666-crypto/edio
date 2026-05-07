# Goal

Create one real Alwaseet order from production checkout to verify live integration.

# Scope

- Production checkout only: `https://edio-iq.com/checkout`
- Use one cart item already available in production.
- Submit one live checkout order.
- Use clearly marked test recipient data so the order can be identified and cancelled if needed.

# Files allowed

- `docs/TASK_SPECS/2026-05-06-alwaseet-live-order-test.md`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do not touch

- Application code
- Deploy folder
- GitHub remote
- Hostinger files
- Supabase secrets
- Alwaseet credentials

# Checks

- Confirm checkout page loads.
- Confirm required city/region fields work.
- Submit one order only.
- Capture the resulting confirmation signal without exposing secrets.

# Final report format

Short Edio report with whether live order submission succeeded and any order reference visible in the UI.
