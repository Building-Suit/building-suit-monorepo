# Building Suit Design System — Shop Suit implementation

Token source of truth: `apps/shop-crm/app/assets/css/tailwind.css` (Tailwind v4
`@theme` + semantic CSS custom properties). Everything user-visible consumes the
semantic layer; no component picks raw palette values.

## Fonts (self-hosted, OFL)

`apps/shop-crm/public/fonts/`:

- `manrope-*.woff2` (Latin) — weights 400/500/600/700/800
- `IBMPlexSansArabic-*.woff2` (Arabic) — weights 400/500/600/700

Declared in `@font-face` blocks with `font-display: swap` and unicode-range
subsets (`@font-face` for Arabic family covers Arabic + Latin fallback). Stack:
`Manrope, IBM Plex Sans Arabic, …` for Latin; Arabic UI resolves IBM Plex Sans
Arabic first via the `ar` locale `dir`/family ordering in the base CSS.

## Palette tokens (§17 of the design brief)

All canonical values are declared verbatim as CSS custom properties
(`--bs-building-navy: #16293B`, `--bs-premium-gold: #D89B42`, the full
light/neutral family, semantic + dark semantic sets).

## Semantic theme tokens (§18)

`:root` (light) and `.dark` map the palette into semantic names:

| Token | Light | Dark |
|---|---|---|
| background | Pearl White `#F7F8FA` | Midnight `#0A111A` |
| surface | `#FFFFFF` | Navy Surface `#14233A` |
| surface-muted | Soft Silver | Deep Structure Navy |
| surface-raised | `#FFFFFF` | Navy Surface Raised `#1B2E47` |
| text | Graphite | Pearl White |
| text-muted | Slate Gray | Sky Steel |
| border | Cloud Gray | Steel Border |
| primary | Building Navy (fg Pearl White) | Premium Gold (fg Deep Structure Navy) |
| accent / focus | Premium Gold / Gold 700 | Highlight Gold |

Semantic status colors (success/warning/error/info + `*-bg` + `*-fg` contrast
foregrounds + dark variants) are tokenized separately and **never** fall back to
brand gold. Tailwind v4 maps these via `@theme inline` to utilities such as
`bg-primary`, `text-muted-foreground`, `border-border`, `bg-success`, `text-success-fg`,
plus `font-sans`/`font-arabic`.

## Geometry (§19) and typography (§20)

- Radii: `--radius-sm: 8px`, `--radius-md: 12px` (inputs/buttons),
  `--radius-lg: 16px` (cards), `--radius-xl: 24px` (dialogs/sheets) — surfaced
  through `rounded-*` tokens.
- Touch targets: controls min-h 44px; primary form controls 48px
  (`h-12` primitives in `ui/button`).
- Spacing uses Tailwind's 4px-base scale (4/8/12/16/…/64) — no arbitrary values.
- Typography scale tokens (`text-display-sm` … `text-label-sm`) match the brief
  (32/40 800 down to 11/16 600); Arabic gets relaxed line-height via
  `[dir='rtl']` overrides to prevent clipping.

## Component rules applied (§23)

- Primary button: navy/white in light, gold/deep-navy in dark; 48px; radius 12px
  (`apps/shop-crm/app/components/ui/button`).
- Danger uses semantic error, not gold.
- Inputs: filled surface, 12px radius, 1px→2px focus border using interaction
  gold, label/help/error hierarchy (auth pages).
- Cards: 16px radius, subtle border, hover/focus feedback on interactive cards
  (pricing/features).
- Badges: 8px radius; semantic colors for status, gold never generic.
- Navigation: selected state uses primary + restrained gold accent; ThemeToggle
  persists `bs-theme` and an inline head script applies it pre-hydration
  (no flash of wrong theme).

## Accessibility & RTL (§24, §26)

- Visible focus rings on all interactive primitives (`focus-visible` ring token).
- Form fields have real `<label>`s; error text is announced via `aria-live`.
- Status is never color-only (badge text + icon).
- Arabic (`ar`, default) renders `dir="rtl"`; layout uses logical properties and
  Tailwind's `ms-*/me-*/ps-*/pe-*` utilities; the social-proof gradient is the
  one intentional physical-edge case (documented inline).
