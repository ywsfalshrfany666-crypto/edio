# Auth Providers

Edio uses its existing custom auth system with server-side OAuth callbacks. Google and Apple sign-in only create or link customer accounts. Admin roles are never granted from provider claims.

## Required Redirect URLs

Use your production `PUBLIC_APP_URL` origin.

- Google: `https://your-domain.com/api/auth/oauth/google/callback`
- Apple: `https://your-domain.com/api/auth/oauth/apple/callback`

For local development through Vite proxy:

- Google: `http://127.0.0.1:8081/api/auth/oauth/google/callback`
- Apple: `http://127.0.0.1:8081/api/auth/oauth/apple/callback`

## Google Setup

1. Create an OAuth web client in Google Cloud Console.
2. Add the redirect URL above as an authorized redirect URI.
3. Configure only the scopes Edio needs: `openid`, `email`, `profile`.
4. Set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` if it differs from `PUBLIC_APP_URL + /api/auth/oauth/google/callback`

## Apple Setup

1. In Apple Developer, enable Sign in with Apple for the app/service.
2. Create or use a Services ID as `APPLE_CLIENT_ID`.
3. Register the return URL above.
4. Create a Sign in with Apple key and note the Team ID and Key ID.
5. Set either:
   - `APPLE_CLIENT_SECRET`, or
   - `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY`

`APPLE_PRIVATE_KEY` may be stored with escaped newlines, for example `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`.

## Security Notes

- Do not expose client secrets or Apple private keys to frontend code.
- Do not store provider access tokens in localStorage.
- OAuth state and nonce are validated server-side.
- Callback redirects are limited to same-site paths.
- New social users are created as `customer`.
- Existing accounts are linked only when the provider email is verified.
- Apple may only provide name/email during the first authorization; Edio stores available profile data when provided.
