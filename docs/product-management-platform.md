# Edio Product Management Platform

This layer is additive. It keeps the existing `products` records and builds a variant-first read/write model beside them.

## Modules

- `catalog`: legacy products, variants, channel listings, categories, collections.
- `pricing`: variant-level prices in `variantPrices`.
- `inventory`: location-aware levels in `inventoryLevels` and webhook movement logs.
- `media`: product media rows with CDN/source fields, while old image fields keep working.
- `search`: `searchIndexDocuments` read model, updated through outbox events.
- `publishing`: lifecycle state and `productChannelListings`.
- `admin-workflows`: import previews and `approvalRequests`.
- `outbox/jobs`: durable `outboxEvents` for indexing, publishing, revalidation, and integrations.

## Compatibility

Every legacy product receives a base variant, default storefront listing, default Mosul inventory location, price row, media rows, and search document during safe migration/backfill. Existing API routes remain available.

## New Endpoints

- `GET /api/admin/products/:id`
- `POST /api/admin/products/:id/publish`
- `POST /api/admin/products/:id/unpublish`
- `POST /api/admin/products/:id/schedule`
- `POST /api/admin/import/products`
- `POST /api/webhooks/inventory-updated`
- `POST /api/internal/revalidate`

## Required Secrets

- `EDIO_INVENTORY_WEBHOOK_SECRET`: HMAC-SHA256 secret for inventory webhooks.
- `EDIO_INTERNAL_REVALIDATE_TOKEN`: bearer token for internal revalidation requests.

## Safe Rollout

The storefront can continue reading the old catalog fields. Admin workflows can gradually move to variants, prices, listings, inventory levels, and approval requests when the UI is ready.
