# Task Spec: Rebuild Homepage Category Showcase White Images

## Task ID
rebuild-homepage-category-showcase-white-images

## Date
2026-05-04

## Goal
Rebuild only the homepage category showcase section into a premium dark Edio section with clean white-background category imagery, concise Arabic/English copy, valid existing category links, and excellent responsive behavior.

Execution Brief: Replace the existing homepage category showcase only. Inspect the homepage category section component, its data, image assets used by that section, and CSS/Tailwind for that section. Keep Header, Footer, Hero, backend, taxonomy, routes, Product Detail, product cards, and category data intact. Use only categories that already exist in Edio. Prefer existing product/category assets that are clean and product-focused; every category image must sit on a pure white `#FFFFFF` media surface and use `object-fit: contain` without heavy overlays or nested cards. Rebuild the layout as a premium dark section with short copy, fully clickable cards, accessible alt text, RTL-safe spacing, focus-visible states, stable aspect ratios, and no runtime image fetching. Run build/lint/tests where practical and report image choices plus any assets that may need later replacement.

## Scope
- Homepage.
- Homepage category showcase component.
- Category cards and category section data.
- Image assets referenced by this section.
- CSS/Tailwind for this section only.
- Responsive layout for this section.

## Out of Scope
- Full homepage redesign.
- Header, Footer, main Hero, backend, taxonomy, routes, Product Detail, Lightbox, admin, import systems.
- Adding new categories or changing category slugs.
- Runtime web fetching for images.
- Heavy animation or image-processing libraries.

## Current Problem
The current homepage category area is visually inconsistent and too busy. It mixes dark/lifestyle/white images, uses heavier overlays, and does not feel like a focused premium navigation surface for Edio's audio categories.

## Required Changes
- Replace the current category showcase layout.
- Use a dark premium section with white product image cards.
- Keep copy short and strong.
- Use only existing categories and correct category links.
- Choose category-appropriate, product-focused images on white surfaces.
- Use `object-fit: contain`, stable aspect ratios, lazy loading, and accessible alt text.
- Ensure desktop, tablet, mobile, and RTL work without overflow.

## Existing Features To Preserve
- Current category routes and slugs.
- Homepage sections outside this category showcase.
- Header/Footer behavior.
- Product cards and product detail media.
- SEO/OG, search, category pages, and public storefront visibility rules.

## Acceptance Criteria
- Old category showcase is replaced with a new premium design.
- Images are displayed on white clean surfaces and match their categories.
- No dark/lifestyle/watermarked/random imagery in the category cards.
- Links go to existing categories only.
- Arabic RTL looks correct.
- Mobile/tablet/desktop layouts do not overflow.
- No CLS-prone image layout.
- Build/lint pass when practical.

## Safety Rules
- Do not add or rename categories.
- Do not touch backend or product data.
- Do not use remote image hotlinks at runtime.
- Do not touch description/spec images.
- Do not use heavy overlays or text over the product image.
- Do not create card-in-card visual nesting.

## Test Plan
- Inspect category data and links used by the homepage section.
- Verify chosen images exist in project assets.
- Run targeted lint for the edited component/CSS.
- Run typecheck and production build.
- If browser tooling is available, smoke-check homepage desktop/mobile for overflow and visual fit.

## Final Report Format
- Old component location.
- What was replaced.
- Categories retained.
- Image chosen for each category and source.
- Whether images are on white backgrounds.
- Files changed.
- Link and responsive status.
- Build/lint/test status.
- Any images needing later replacement.
