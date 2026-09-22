# Shared Ledger neutral palette

Status: accepted by user direction, 2026-09-19. Supersedes ADR 0001's original application color-role choice.

Use Ledger Suit's latest implemented palette across Ledger, Shop, the documentation app and future apps. Keep `packages/design-tokens/tokens.json` as the sole editable runtime token source; regenerate the CSS, TypeScript and Tailwind references instead of copying a product stylesheet into each app.

The source is [Ledger's token stylesheet at `6fb152e`](https://github.com/Building-Suit/ledger-suit/blob/6fb152ee72e2b6b22269230917b2f9237fc2612d/app/assets/css/tokens.css), verified against the current remote `dev` tip and open feature heads `ab57689` (PR 96) and `cb01387` (PR 97). All three contain Git blob `7193247f1b4972a18742ee0ccc3cc9f12081923e`. This records the imported revision; future authorized palette changes belong in the monorepo token source.

Promote the ink, charcoal, graphite, paper and gray primitives and their light/dark semantic roles. Include Ledger's exact primary hover/pressed, accent hover and scrim values. Explicit dark mode and system-preference dark mode use the same roles. Preserve Building's navy/gold brand areas, semantic status colors, typography, spacing, radii and assets.

The generated aliases also supply the shared landing preview and hero-grid styles, which already referenced Ledger's neutral primitives. Components and applications continue consuming the same shared roles. Archived original Building documents remain historical evidence; the maintained design-system specification describes the current palette.
