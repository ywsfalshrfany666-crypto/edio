# Checkout Searchable Governorate Region Phone Options

## Execution Brief

Add searchable checkout option controls without changing shipping backend behavior. Restore region/district suggestions based on the selected Iraq governorate, make governorate and phone country-code choices searchable, and keep free-text fields free text. The update is limited to checkout input UX: no product data, auth, SEO, payment, or deployment changes. Region selection should remain compatible with the current Edio backend order payload by storing the chosen region label as text. If a customer's exact district is not listed, allow a custom region value so orders are not blocked. The UI must remain touch-friendly on mobile, with large rounded fields and search filtering after one or two typed characters.

## Scope

- `src/pages/Checkout.tsx`
- `docs/TASK_INDEX.md`
- `docs/TASK_HISTORY.md`

## Requirements

- Governorate: searchable option list, Iraq governorate values only.
- Region/district: searchable options dependent on selected governorate.
- Phone country code: searchable country/dial-code picker, Iraq default.
- Keep nearest point, address, delivery notes optional.
- Do not re-enable direct Alwaseet submission.
- Do not store sensitive customer fields in browser storage.
- No new UI library.

## Verification

- TypeScript typecheck.
- ESLint.
- Production build.
- Checkout route smoke check where possible.
