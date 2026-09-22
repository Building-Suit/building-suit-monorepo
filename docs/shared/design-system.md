# Building Suit design system

`packages/design-tokens/tokens.json` is the editable token source. It combines Building Suit's brand foundations with the latest Ledger Suit application palette, promoted to the shared system by [ADR 0003](../architecture/decisions/0003-ledger-neutral-palette.md). `pnpm tokens:generate` produces CSS variables, TypeScript and Tailwind color references. `pnpm tokens:check` detects drift. The preserved original token files in the documentation archive describe provenance and are not runtime imports.

All apps share Ledger's neutral surfaces: near-white/paper in light mode and ink/charcoal/graphite in dark mode. Building Navy and Premium Gold remain the brand/action colors; navy still appears in marketing and auth showcases. Hover, pressed, focus, text, border and overlay roles are canonical too, including the system-preference dark theme. These are shared tokens, not product CSS overrides. Semantic status colors, Manrope for Latin, IBM Plex Sans Arabic for Arabic and Hugeicons Stroke Rounded remain the shared foundations. Logos and app icons are served from `packages/brand/assets`; existing Shop's typographic S mark remains until an approved Shop asset is supplied.

| Role | Light | Dark |
|---|---|---|
| Background | `#FAFAFA` | `#0B0B0D` |
| Surface / raised surface | `#FFFFFF` / `#FFFFFF` | `#141416` / `#27272A` |
| Muted surface | `#F4F4F5` | `#1C1C1F` |
| Text / muted text | `#0B0B0D` / `#52525B` | `#FAFAFA` / `#A1A1AA` |
| Border / strong border | `#E4E4E7` / `#71717A` | `#27272A` / `#71717A` |
| Primary / hover / pressed | `#16293B` / `#1E3A50` / `#0D1B28` | `#D89B42` / `#EBB45A` / `#C8902F` |
| Accent / hover | `#D89B42` / `#EBB45A` | `#EBB45A` / `#F4CE86` |

Use semantic `--bs-*` roles for application UI. Raw neutral and gray aliases support intentionally dark previews; navy/gold primitives support brand areas. Future apps inherit the same palette through the shared Nuxt layer.

The shared Nuxt layer registers fonts, tokens, styles, components, composables, theme behavior and public brand assets. Product apps register Supabase and supply their own locale messages, content, routes and business logic.

Atomic Design organizes `packages/ui/src`: atoms (icons, brand marks, status), molecules (fields, empty states, KPI presentation), organisms (tables, dialogs, wizard, settings and feedback), templates (marketing frame, complete landing page, auth frame, authenticated shell). Product pages compose these and own validation, currencies, roles, queries and commands. Atomic Design does not define database or business-service boundaries.

Ledger supplies the layout composition for both products: landing hero/features/workflow/pricing, login/signup split frame, sidebar/header/content shell. App adapters provide navigation, content, assets and the pricing preview slots. Change shared layout code to change all consumers.

The `/components` route in the documentation app is the live catalogue. Check English/Arabic, LTR/RTL, light/dark, narrow screens, keyboard navigation and focus whenever changing shared components.
