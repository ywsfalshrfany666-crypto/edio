# Supabase Google Auth Setup

This setup enables Google Login for Edio while the production site is deployed as a static Vite build on Hostinger.

## Required Frontend Environment Variables

Set these for the build environment. Do not put real secrets in source control.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_URL=https://edio-iq.com
```

Use only the Supabase anon key in the frontend. Never use a Supabase service role key in React/Vite.

## Supabase

1. Open your Supabase project.
2. Go to `Authentication` > `URL Configuration`.
3. Set `Site URL`:
   `https://edio-iq.com`
4. Add these Redirect URLs:
   `https://edio-iq.com/auth/callback`
   `https://lavender-dogfish-486210.hostingersite.com/auth/callback`
   `http://localhost:5173/auth/callback`
5. Go to `Authentication` > `Providers` > `Google`.
6. Enable Google.
7. Paste the Google Client ID.
8. Paste the Google Client Secret.
9. Save.

## Google Cloud

1. Open Google Cloud Console.
2. Go to `APIs & Services` > `Credentials`.
3. Create an OAuth Client ID.
4. Application type: `Web application`.
5. Add Authorized JavaScript origins:
   `https://edio-iq.com`
   `https://lavender-dogfish-486210.hostingersite.com`
   `http://localhost:5173`
6. Add the Authorized redirect URI shown by Supabase Google Provider.
   It is usually:
   `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
7. Copy the Client ID and Client Secret into Supabase Google Provider settings.

## Hostinger Static Deploy

1. Build Edio with the required `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL` available to Vite.
2. Push only the generated `dist` output to the Hostinger-connected GitHub repository.
3. In Hostinger, click `Advanced` > `GIT` > `Deploy`.
4. Open `https://edio-iq.com`.
5. Test `Login` > `المتابعة باستخدام Google`.

## Security Notes

- Google users are mapped to Edio role `customer` only.
- Do not grant admin roles from Google claims, Google email domain, or frontend code.
- Keep admin roles in the existing internal system or a future trusted backend/table.
- Do not store passwords or OAuth tokens manually in localStorage.
- Supabase Auth manages the browser session.
