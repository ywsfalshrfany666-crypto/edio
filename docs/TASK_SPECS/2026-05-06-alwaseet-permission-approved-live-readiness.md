# Goal

Prepare Edio for Alwaseet live order creation now that Alwaseet support approved Merchant API order creation.

# Scope

- Verify the deployed Edge Function is reachable.
- Ensure `ALWASEET_DRY_RUN=false` is configured in Supabase for live mode.
- Run non-destructive lookups checks.
- Do not create a live Alwaseet order without explicit final confirmation.

# Files Allowed

- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do Not Touch

- Product data
- Auth / Google Login
- SEO files
- Frontend code unless a blocker appears
- Credentials, `.env`, deploy tokens

# Checks

- Supabase Edge Function lookup invocation
- Production checkout smoke if needed
- No live create-order until confirmed

# Final Report Format

Use Edio concise report format with task class, context used, files changed, checks, deploy, safety, and final decision.
