# Dark Mode Guide

> **Status:** Complete (initial). How Building Suit renders in dark mode. Tokens from `03-visual-identity/01_COLOR_SYSTEM.md`; logo rules from `02-logo-system/`. Dark mode is a first-class theme (the brand's navy heritage makes it feel native).

---

## Dark mode backgrounds
- **App background:** Midnight Background `#0A111A`.
- **Brand/hero sections:** Building Navy `#16293B` → Deep Structure Navy `#0D1B28` gradient.
- Keep the base background the darkest layer; build elevation by getting **lighter**, not by shadows.

| Layer | Color |
|---|---|
| Background (0) | Midnight `#0A111A` |
| Surface / card (1) | Navy Surface `#14233A` |
| Raised / menu / sheet (2) | `#1B2E47` |
| Modal (3) | `#1B2E47` + scrim behind |

---

## Dark mode cards
- **Surface:** Navy Surface `#14233A`; raised elements `#1B2E47`.
- **Borders:** Steel Border `#2E3F52` (subtle separation since shadows read weakly on dark).
- **Elevation:** primarily via **surface lightness steps**; shadows only very subtle.
- Radius 16px, padding 16–24px (same as light).

`[Insert dark mode card examples]`

---

## Dark mode text
| Role | Color | Notes |
|---|---|---|
| Primary text | Pearl White `#F7F8FA` | ~12.8:1 on Midnight ✓ AAA |
| Secondary text | Sky Steel `#7E97B3` | captions/meta ✓ AA |
| Disabled text | `#4A5A6E` | non-essential only |
| Links | Highlight Gold `#EBB45A` or Sky Steel | distinguish with weight/underline |

- Avoid pure white (`#FFFFFF`) for large text blocks — Pearl White is softer and reduces glare.

---

## Dark mode gold usage
- On dark, **gold can lead as the primary action color** (Premium Gold `#D89B42` button bg with Deep Navy text) — high contrast and premium.
- Use **Highlight Gold `#EBB45A`** for hover/active emphasis and small glows (the "lit window" feel reads beautifully on dark).
- Still **one gold focus per view**; gold is not a status color (keep semantic green/red/amber/blue for status).
- Gold on dark text: large/bold only; don't use gold for body text.

`[Insert dark mode gold usage]`

---

## Dark mode logo usage
- Use the **light / silver logo** (`assets/logos/building-suit-logo-light.png`) on dark surfaces — strong contrast, gold windows glow.
- **Never** use the dark/navy logo on dark backgrounds (it disappears).
- App icon default already uses the light building-B on navy (see `02-logo-system/05_APP_ICON_GUIDE.md`).
- Respect clear space; don't add glows/shadows to the logo.

`[Insert dark mode logo placement]`

---

## Dark mode UI examples
- **Dashboard:** Midnight background, Navy Surface cards, Pearl White figures, balance positive/negative in Verified Green / Signal Red, one gold primary action.
- **Bottom nav:** Navy Surface bar with Hugeicons Stroke Rounded only; inactive muted Sky Steel icons; **active Stroke Rounded icon + Premium Gold + label/indicator**.
- **Forms:** Navy Surface inputs, Steel Border, gold focus ring, Signal Red errors (lightened ~12% for dark).
- **Payment card:** Navy Surface, semantic amount color, status badge on tinted dark chip.
- **Modal/bottom sheet:** `#1B2E47` content over a deep navy scrim.

`[Insert dark mode screen examples]`

---

## Accessibility notes
- Target **WCAG AA** (4.5:1 text / 3:1 large + UI).
- **Verified:** Pearl White on Midnight ~12.8:1 ✓ AAA; Premium Gold on Navy Surface ~5+:1 ✓ AA; Highlight Gold on Navy ~7.5:1 ✓ AAA.
- **Lighten semantic colors ~10–15%** for dark backgrounds so they keep contrast (e.g. green/red/amber/blue tuned brighter).
- Don't rely on color alone — status = color + icon + label.
- Keep focus rings (Premium Gold) clearly visible on dark surfaces.
- Avoid pure-black backgrounds + pure-white text (harsh halation); use Midnight + Pearl White.
- Verify every new pairing with a contrast checker.
