# Goal

Improve local Edio mobile performance focused on PageSpeed FCP, LCP, and Speed Index for the home page.

# Scope

- Local changes only.
- Focus on above-the-fold home page resources, hero image, critical CSS/JS hints, and mobile rendering cost.
- Do not deploy or push unless explicitly requested later.

# Files Allowed

- `index.html`
- `src/pages/Index.tsx`
- `src/components/home/Hero.tsx`
- `src/components/layout/Header.tsx`
- `src/index.css`
- `vite.config.ts`
- Image assets directly used above the fold if optimization is needed.
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

# Do Not Touch

- Checkout / Alwaseet logic
- Auth / Google Login
- Product data
- Deploy folder or GitHub deploy repo
- Secrets or `.env`

# Checks

- Measure relevant asset sizes before and after.
- `npm run typecheck`
- `npm run build`
- Local browser smoke if needed.
- No deploy.

# Final Report Format

Use Edio concise report format with local-only deploy status.
