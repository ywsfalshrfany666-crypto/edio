# EDIO Backend

Local JSON-backed API for the EDIO storefront.

## Run

```bash
npm run api
```

The API starts on `http://127.0.0.1:8787` by default.

Optional environment variables:

```bash
API_PORT=8787
API_HOST=127.0.0.1
JWT_SECRET=change-this-for-real-deployments
EDIO_DB_FILE=server/data/db.json
```

The first run creates `server/data/db.json` from the current frontend catalog in `src/data/catalog.ts`.

## Seed Accounts

Admin:

```text
admin@edio.iq
admin123
```

Customer:

```text
customer@edio.iq
customer123
```

## Core Endpoints

Health:

```http
GET /api/health
```

Catalog:

```http
GET /api/catalog
GET /api/currency
POST /api/currency/convert
GET /api/products?sort=newest&limit=24
GET /api/products/:idOrSlug
GET /api/brands
GET /api/brands/:brand
GET /api/categories
GET /api/categories/:slug
GET /api/collections
GET /api/collections/:slug
```

Auth:

```http
POST /api/auth/signup
POST /api/auth/login
GET /api/auth/me
PATCH /api/auth/me
POST /api/auth/password-reset
POST /api/auth/reset-password
```

Cart and checkout:

```http
GET /api/cart
PUT /api/cart
POST /api/coupons/validate
POST /api/orders
GET /api/orders
GET /api/orders/:idOrNumber
```

Addresses:

```http
GET /api/addresses
POST /api/addresses
PATCH /api/addresses/:id
DELETE /api/addresses/:id
```

Admin:

```http
GET /api/admin/dashboard
GET /api/admin/users
PATCH /api/admin/users/:id
GET /api/admin/orders
GET /api/admin/orders/:idOrNumber
PATCH /api/admin/orders/:idOrNumber/status
GET /api/admin/products
POST /api/admin/products
PATCH /api/admin/products/:idOrSlug
DELETE /api/admin/products/:idOrSlug
GET /api/admin/coupons
POST /api/admin/coupons
PATCH /api/admin/coupons/:code
DELETE /api/admin/coupons/:code
```

Authenticated requests use:

```http
Authorization: Bearer <token>
```

## Notes

This backend is production-shaped but still local-file based. For public deployment, move persistence to a real database, set a strong `JWT_SECRET`, serve over HTTPS, and add rate limiting.
