# Task Spec: Alwaseet API Diagnostics

## Goal

Diagnose and harden Edio's Alwaseet API integration, starting with safe dry-run diagnostics only. Determine whether available environment credentials authenticate as a main merchant, merchant user/employee, or fail login, without creating any live order.

## Scope

- Read official Edio context files and this Task Spec only.
- Inspect only Alwaseet, checkout, shipping, and Supabase Edge Function files related to this task.
- Verify credentials only from environment variables.
- Use Alwaseet official API docs for endpoint names and required fields.
- Run login and non-destructive supplementary API checks only when required env exists.
- Keep `ALWASEET_DRY_RUN=true` behavior as the default.

## Files Allowed

- `docs/TASK_SPECS/2026-05-06-alwaseet-api-diagnostics.md`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`
- Alwaseet-related frontend/backend files discovered by targeted `rg`
- Related tests only

## Do Not Touch

- Unrelated routes/components.
- Product data.
- Google Login.
- SEO infrastructure unless directly implicated.
- Deploy repository.
- `.env` files or any secrets.

## Checks

- No live create-order request.
- No credential/token output.
- Targeted tests for normalization, validation, mapper, dry-run, missing credentials, and error handling where code exists.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Final Report Format

Report credential diagnosis, API checks, root cause, fixes applied, security status, checks, remaining blocker, and one final decision.
