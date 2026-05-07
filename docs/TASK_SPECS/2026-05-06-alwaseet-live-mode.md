# Goal

Enable Alwaseet live order creation for Edio by changing the Supabase Edge Function secret `ALWASEET_DRY_RUN` from `true` to `false`.

# Scope

- Supabase project: `ofvgjveyfqgpcryeoddi`
- Edge Function: `create-alwaseet-order`
- Change only the runtime secret needed for live mode.
- Do not create a live test order during activation.

# Files allowed

- `docs/TASK_SPECS/2026-05-06-alwaseet-live-mode.md`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do not touch

- Frontend source
- Backend function source
- Product data
- Deploy folder
- GitHub remote
- Hostinger files
- Any `.env` or credential file

# Checks

- Confirm Supabase CLI is available.
- Set `ALWASEET_DRY_RUN=false` without printing secrets.
- Verify production checkout still responds.

# Final report format

Use the Edio short final report format and include whether live mode was enabled.
