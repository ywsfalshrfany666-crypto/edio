# Alwaseet Shipping Setup

Edio integrates with Alwaseet through a Supabase Edge Function named `create-alwaseet-order`.
The React/Vite frontend never stores or sends Alwaseet merchant credentials directly.

## Official API References

- Merchant API: https://al-waseet.com/apis-main/index
- Integration Guide V1.6.1: https://aggregator.alwaseet-iq.net/apiDoc/

## Required Supabase Function Secrets

Set these as Supabase Edge Function secrets, not Vite variables:

```bash
ALWASEET_API_BASE_URL=https://api.alwaseet-iq.net/v1/merchant
ALWASEET_DRY_RUN=false
ALWASEET_USERNAME=
ALWASEET_PASSWORD=
```

If Alwaseet provides a persistent token, use `ALWASEET_API_TOKEN` instead of username/password.

Do not create any `VITE_ALWASEET_*` variable. Vite variables are bundled into the browser.

## Dry Run And Live Mode

- Production live mode: `ALWASEET_DRY_RUN=false`
- Dry-run mode validates and records the shipping attempt but does not create a live Alwaseet order.
- Live mode requires `ALWASEET_DRY_RUN=false`, valid Alwaseet credentials, Supabase service role access inside the Edge Function, and the migration tables applied.

## Supabase Database

Apply `supabase/migrations/20260505_alwaseet_shipping.sql` before live use.

The migration adds:

- `orders`
- `customer_addresses`
- `shipping_integrations`
- `shipping_events`

The Edge Function uses `shipping_integrations` for idempotency by `edioOrderId`.

## Field Discovery

Based on the official Alwaseet merchant API documentation, Edio mirrors field types instead of guessing them:

| Alwaseet field | Required | Alwaseet type/value | Edio UI type | Dependency | Payload value |
|---|---:|---|---|---|---|
| `client_name` | Yes | `string` | Text input | None | Customer name string |
| `client_mobile` | Yes | `string`, `+9647xxxxxxxxx` | Phone input | None | Normalized Iraqi phone string |
| `client_mobile2` | No | `string`, `+9647xxxxxxxxx` | Optional phone input | None | Normalized Iraqi phone string |
| `city_id` | Yes | `int` from Cities API | Dropdown loaded from `/citys` | None | City ID |
| `region_id` | Yes | `int` from Regions API | Dependent dropdown loaded from `/regions?city_id=...` | Selected city | Region ID |
| `location` | Yes | `string` | Optional text inputs plus selected region/city fallback | Region/city selection | Address + nearest point + region + city |
| `type_name` | Yes | `string` | Internal text value | None | `معدات صوتية` |
| `items_number` | Yes | `int` | Derived number | Cart contents | Total cart quantity |
| `price` | Yes | `int` | Derived number | Cart total | COD total including delivery, in IQD |
| `package_size` | Yes | `int` from Package Sizes API | Dropdown loaded from `/package-sizes` | None | Package size ID |
| `merchant_notes` | No | `string` | Textarea | None | Edio order id + customer notes |
| `replacement` | Yes | `0` or `1` | Hidden/internal value | None | `0` for normal Edio orders |
| `company_order_id` | No | `int` | Hidden/internal value | Numeric internal id only | Omitted for normal `EDIO-*` string order ids |

Do not convert Alwaseet ID fields into free text fields in Edio. Do not convert free-text fields such as customer name, phones, address, or notes into dropdowns unless the official API adds lookup endpoints for them.

## Deployment Checklist

1. Apply the migration in Supabase.
2. Deploy the Edge Function `create-alwaseet-order`.
3. Set Function secrets in Supabase.
4. Keep `ALWASEET_DRY_RUN=true` for dry-run checks, then set `ALWASEET_DRY_RUN=false` for live production orders.
5. Test checkout and confirm a clearly marked test order before accepting customer traffic.
6. Confirm Alwaseet city/region matching for real customer addresses.
7. Switch to `ALWASEET_DRY_RUN=false` only when ready for a clearly marked live test.

## Security Notes

- Do not log full phone numbers.
- Do not expose `qr_link` tokens to public UI unless intentionally needed for admin printing.
- Do not allow customers to trigger manual resend outside the checkout flow.
- Keep CORS restricted to Edio production and local development origins.
