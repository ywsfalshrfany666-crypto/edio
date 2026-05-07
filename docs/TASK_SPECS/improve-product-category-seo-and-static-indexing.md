# Task Spec: Improve Product Category SEO And Static Indexing

## Task ID
improve-product-category-seo-and-static-indexing

## Date
2026-05-04

## Goal
Improve Edio SEO for products, categories, shop, and core pages so Google can better understand the premium audio catalog, without promising rankings or changing product data.

## Scope
Inspect and update only SEO-related storefront files: `src/components/Seo.tsx`, `src/pages/Index.tsx`, `src/pages/Shop.tsx`, `src/pages/Category.tsx`, `src/pages/ProductDetail.tsx`, catalog/runtime helpers, `public/robots.txt`, `public/sitemap.xml`, `vite.config.ts`, `package.json`, and build scripts needed for static SEO output.

## Out of Scope
No GitHub push, no deploy, no Supabase/Google Cloud changes, no product data edits, no backend production dependency, no fake reviews/ratings, no guaranteed ranking claims, no unlicensed media imports.

## Current Problem
The SPA updates metadata client-side, but product/category pages need stronger canonical, Open Graph, JSON-LD, sitemap coverage, and build-time static HTML for better crawler and merchant-listing compatibility.

## Required Changes
- Research official Google and Schema.org SEO requirements.
- Add reusable product/category SEO helpers.
- Improve Product, Offer, Brand, Organization, WebSite, BreadcrumbList, and CollectionPage JSON-LD.
- Generate `sitemap.xml` from the catalog and category taxonomy.
- Generate static route HTML copies with route-specific head metadata and JSON-LD after Vite build.
- Keep structured data aligned with visible product price, availability, image, and description.
- Add lightweight SEO validation/reporting for duplicate slugs, thin content, missing images, and missing specs.

## Existing Features To Preserve
Google Login, normal login, cart/checkout, product pages, product cards, description/spec images, category routing, static Hostinger deployment, and performance improvements.

## Acceptance Criteria
- Product/category/shop/home metadata are unique and canonical.
- Product pages include valid Product and Offer JSON-LD without fake ratings.
- Breadcrumb JSON-LD is present where relevant.
- Sitemap includes home, shop, categories, subcategory terms, and all products using `https://edio-iq.com`.
- Robots points to production sitemap.
- Static HTML route copies exist in `dist` after build.
- Build/lint/typecheck/tests pass or known unrelated warnings are reported.

## Safety Rules
Do not expose secrets, `.env`, source folders, server folders, or temporary domains in production SEO files. Do not alter prices, stock, categories, or product facts.

## Test Plan
Run lint, typecheck, tests, build, sitemap validation, local route smoke, secret scan, and Lighthouse SEO where practical.

## Final Report Format
Use the user-requested SEO report with research sources, fixes, product/category coverage, structured data, technical SEO, import/catalog logic, performance impact, auth verification, commands, checks, deploy folder status, remaining opportunities, and final decision.
