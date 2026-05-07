# edio Project Context

## Project Identity

- edio is a premium audio store.
- Current target: Strong Production + Enterprise Lite only.
- Do not add SaaS, Marketplace, multi-vendor, or full Enterprise features.

## Technology

- Frontend stack: React + Vite + TypeScript.
- Current production mode is static hosting on Hostinger.
- Do not use `server/index.js` in production.

## Production And Deploy

- Production domain: https://edio-iq.com
- Temporary domain: https://lavender-dogfish-486210.hostingersite.com
- GitHub deploy repository must contain built `dist` output only.
- Do not upload `src`, `server`, `node_modules`, or `.env`.

## Safety Rules

- Preserve Google Login.
- Preserve SEO.
- Preserve performance.
- Do not invent product specifications.
- Do not add fake reviews or ratings.
- Do not expose secrets, tokens, SSH keys, Supabase keys, or deploy credentials.
