# Login Issue Diagnosis

## Goal

Diagnose and fix the current edio login problem without breaking Google Login, SEO, checkout, or production static hosting.

## Scope

- Login page and auth callback flow.
- Supabase client/config helpers.
- Auth store/session handling.
- Route guards only if directly implicated.
- Production smoke checks for auth routes.

## Files Allowed

- `src/pages/auth/Login.tsx`
- `src/pages/auth/AuthCallback.tsx`
- `src/components/auth/*`
- `src/store/auth.ts`
- `src/lib/supabase*.ts`
- `src/lib/socialAuth.ts`
- `src/App.tsx`
- related auth tests only if present
- `docs/TASK_HISTORY.md`

## Do Not Touch

- Product data, catalog, checkout shipping, Alwaseet credentials/functions, SEO artifacts unless auth route requires it.
- `server/index.js` for production behavior.
- Deploy folder or GitHub push unless explicitly requested after verification.
- Secrets, tokens, `.env`, or service role keys.

## Checks

- Targeted auth smoke in Codex browser/tooling.
- `npm run typecheck` if available.
- `npm run lint` if TS/TSX logic changes.
- `npm run build` before any deploy request.

## Final Report Format

Use the Edio concise report with task class, context used, files changed, checks, deploy, safety, root cause, and final decision.
