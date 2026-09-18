# Building Suit design system

`packages/design-tokens/tokens.json` is the editable token source, copied from the original Building Suit brand package. `pnpm tokens:generate` produces CSS variables, TypeScript and Tailwind color references. `pnpm tokens:check` detects drift. The preserved original token files in the documentation archive describe provenance and are not runtime imports.

The original brand palette governs both apps: Building Navy and Premium Gold, canonical semantic roles for light/dark, Manrope for Latin and IBM Plex Sans Arabic for Arabic. The original Ledger graphite overrides were superseded by Building's published role tokens. Hugeicons Stroke Rounded is the shared icon library. Logos and app icons are served from `packages/brand/assets`; existing Shop's typographic S mark remains until an approved Shop asset is supplied.

The shared Nuxt layer registers fonts, tokens, styles, components, composables, theme behavior and public brand assets. Product apps register Supabase and supply their own locale messages, content, routes and business logic.

Atomic Design organizes `packages/ui/src`: atoms (icons, brand marks, status), molecules (fields, empty states, KPI presentation), organisms (tables, dialogs, wizard, settings and feedback), templates (marketing frame, complete landing page, auth frame, authenticated shell). Product pages compose these and own validation, currencies, roles, queries and commands. Atomic Design does not define database or business-service boundaries.

Ledger supplies the layout composition for both products: landing hero/features/workflow/pricing, login/signup split frame, sidebar/header/content shell. App adapters provide navigation, content, assets and the pricing preview slots. Change shared layout code to change all consumers.

The `/components` route in the documentation app is the live catalogue. Check English/Arabic, LTR/RTL, light/dark, narrow screens, keyboard navigation and focus whenever changing shared components.
