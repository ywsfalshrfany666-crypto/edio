# Goal

Create or update one local Edio backend account as an admin for local testing.

# Scope

- Local JSON backend data only.
- Admin login verification against local API.
- Browser check for local admin route if feasible.

# Files Allowed

- `server/data/db.json`
- `docs/TASK_SPECS/2026-05-07-local-admin-account.md`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do Not Touch

- Frontend auth logic.
- Google Login.
- Production deploy files.
- Supabase secrets.
- Alwaseet secrets.

# Checks

- Local API login returns role `admin`.
- Local `/admin` opens with authenticated admin session.

# Final Report Format

- Task class
- Context used
- Files changed
- Checks
- Deploy
- Safety
- Final Decision
