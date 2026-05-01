# Design System: EDIO

## 1. Visual Theme & Atmosphere
EDIO is a restrained sonic-gallery interface: deep charcoal, precision hardware surfaces, warm orange signal accents, and quiet cinematic motion. The experience should feel like a premium audio room, not a generic ecommerce template. Density is balanced, spacing is generous, and product imagery remains the hero.

## 2. Color Palette & Roles
- **Sonic Black** (`hsl(32 18% 5.5%)`) — primary page background, never pure black.
- **Low Noise Surface** (`hsl(33 20% 4.3%)`) — deepest section and footer substrate.
- **Machined Surface** (`hsl(34 15% 8.5%)`) — cards, panels, and product trays.
- **Warm Ink** (`hsl(34 18% 91%)`) — primary text.
- **Muted Titanium** (`hsl(35 10% 64%)`) — secondary text and metadata.
- **EDIO Orange** (`hsl(16 100% 52%)`) — the only accent, used for CTAs, active states, signal lines, focus rings, and sale badges.
- **Whisper Border** (`hsl(34 10% 20%)`) — structural dividers and double-bezel hairlines.

## 3. Typography Rules
- **Display:** Familjen Grotesk for English; IBM Plex Sans Arabic for Arabic. Use tight line height, strong weights, and no negative letter spacing for Arabic.
- **Body:** Afacad for English; IBM Plex Sans Arabic for Arabic. Keep paragraphs under 65 characters where possible.
- **Mono:** Geist Mono for technical labels, prices, metadata, and product-system cues in English. Arabic technical labels should avoid forced tracking.
- **Banned:** Inter, Roboto, Arial, Open Sans, pure system-default typography, generic serif fonts, excessive uppercase Arabic tracking.

## 4. Component Styling
- **Major Cards:** Use double-bezel construction: `.premium-shell` outside and `.premium-core` inside. The outer shell behaves like a machined tray; the inner core holds content.
- **Product Cards:** Product image first, clean price hierarchy, no redundant CTA buttons inside cards unless the action is essential.
- **Buttons:** Primary actions use `.premium-cta` with a nested `.premium-icon`. Ghost actions use `.premium-ghost`. All buttons need press feedback.
- **Inputs:** Labels above, helper/error text below, `.admin-field` or an equivalent machined field treatment.
- **Badges:** Product condition badges must be readable white-on-dark or white-on-orange. Sale percentages use EDIO Orange with white text.

## 5. Layout Principles
- Use asymmetric grids and wide whitespace, especially on the homepage and shop discovery flows.
- Collapse every complex layout to a single column below `768px`.
- Avoid generic equal three-column feature rows. Prefer editorial splits, staggered bento, horizontal product rails, or masonry-like category grids.
- Keep header floating and detached from the viewport edge.
- Use `min-height: 100dvh` for full-viewport sections.
- Prevent horizontal overflow at the root.

## 6. Motion & Interaction
- Motion should feel heavy and physical: `cubic-bezier(0.22, 1, 0.36, 1)` is the default timing.
- Entry reveals use `IntersectionObserver` and animate only `transform` and `opacity`.
- Hover states should be tactile: small lift, subtle border change, and internal icon movement.
- Perpetual motion is allowed only for low-cost details: sound waves, signal dots, promo shimmer, and brand rails.
- Respect `prefers-reduced-motion`.

## 7. Anti-Patterns
- No pure black backgrounds.
- No neon purple or blue AI gradients.
- No generic gray borders without inner highlights.
- No large blurred glass panels inside normal scrolling content.
- No filler copy such as "scroll to explore".
- No repeated CTA clutter inside product cards.
- No horizontal overflow on mobile.
- No hidden low-contrast badge text.
- No default-looking 404, footer, admin modal, or empty state.
