# Goal

Improve the local Edio home page accessibility score toward 100, focusing on the PageSpeed/Lighthouse accessibility gap.

# Scope

- Target route: `/`
- Local-only changes.
- Fix verified accessibility issues that affect Lighthouse/PageSpeed score.

# Files Allowed

- `src/components/home/*`
- `src/components/layout/*`
- `src/pages/Index.tsx`
- `src/components/Seo.tsx`
- `index.html`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do Not Touch

- Checkout / Alwaseet flow
- Auth / Google Login
- Product data
- Supabase secrets or credentials
- Deploy folder or GitHub remote

# Checks

- Targeted accessibility audit where possible
- `lint`
- `typecheck`
- `build`
- Local preview/smoke check

# Final Report Format

Use the standard Edio concise final report. Include that no deploy or push was performed.
