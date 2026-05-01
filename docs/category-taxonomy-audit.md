# EDIO Category Taxonomy Audit

## Existing Primary Categories

- `headphones`
- `iems`
- `dap`
- `dac`
- `audio-interface`
- `mic`
- `accessories`

`pre-owned` is currently a dynamic storefront filter at `/shop?filter=preowned`, not a top-level catalog category.

## Existing Secondary Categories

### `headphones`

- `closed-back`
- `open-back`
- `dynamic-driver`
- `planar-driver`

Grouped UI terms also exist for `type-back` and `driver-configuration`.

### `iems`

- `dynamic-driver`
- `planar-driver`
- `balanced-armatures`
- `hybrid-drivers`
- `wireless`

Grouped UI term: `driver-configuration`.

### `dap`

- `portable`
- `bluetooth`

### `dac`

- `portable`
- `desktop`
- `bluetooth`

### `audio-interface`

- `desktop`
- `portable`

### `mic`

- `dynamic`
- `condenser`

### `accessories`

- `audio-cables`
- `eartips`
- `cable-convertors`
- `cases`

## Broken / Weak Wiring Found

- Category pages already have primary and child routes: `/category/:slug` and `/category/:slug/:term`.
- Child pages already avoid falling back to parent products when empty.
- The weak path was data wiring: product cards/pages and API filters read `subCategories`, while newer import/reclassification work also stores explicit `categoryAssignment.secondaryCategorySlugs`.
- That meant future imported or reclassified products could have a correct assignment relation but still be missed by child pages if `subCategories` was empty.
- `/api/categories` only returned parent counts, so secondary term counts were not available from the API contract.

## Files That Changed

- `src/lib/categoryTaxonomy.ts`
- `src/lib/runtimeCatalog.ts`
- `src/lib/api.ts`
- `server/index.js`
- `src/lib/productCategories.test.ts`
- `scripts/category-logic-smoke.mjs`

## Fix Summary

- Merged legacy `subCategories` and explicit `categoryAssignment.secondaryCategorySlugs` wherever category-term matching happens.
- Made API product serialization emit merged secondary terms.
- Added existing secondary term counts to `/api/categories`.
- Added regression coverage so assignment-only products still appear in the proper child category and do not leak into sibling categories.
