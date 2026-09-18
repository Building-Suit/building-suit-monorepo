# Light Mode Guide

> **Status:** Complete (initial). How Building Suit renders in light mode (the default theme). Tokens from `03-visual-identity/01_COLOR_SYSTEM.md`; logo rules from `02-logo-system/`.

---

## Light mode backgrounds
- **App background:** Pearl White `#F7F8FA` (soft, not pure white — reduces glare, lets white cards lift).
- **Brand/hero sections:** Building Navy `#16293B` → Deep Structure Navy `#0D1B28` gradient (with the light/silver logo).
- Build elevation with **white surfaces + soft shadows** above the off-white background.

| Layer | Color |
|---|---|
| Background (0) | Pearl White `#F7F8FA` |
| Surface / card (1) | White `#FFFFFF` |
| Raised / menu / sheet (2) | White `#FFFFFF` + stronger shadow |
| Modal (3) | White `#FFFFFF` + scrim behind |

---

## Light mode cards
- **Surface:** White `#FFFFFF` on the Pearl White background.
- **Borders:** Cloud Gray `#CBD2DB` (optional; prefer shadow + space for separation).
- **Elevation:** soft, navy-tinted shadows — e.g. `0 2px 8px rgba(13,27,40,.08)`; stronger for higher layers.
- Radius 16px, padding 16–24px.

`[Insert light mode card examples]`

---

## Light mode text
| Role | Color | Notes |
|---|---|---|
| Primary text | Graphite Text `#232B33` | ~13:1 on Pearl White ✓ AAA |
| Secondary text | Slate Gray `#5A6573` | captions/meta ✓ AA |
| Disabled text | Steel Gray `#9AA6B4` | non-essential only |
| Links | Slate Blue `#36506E` | distinguish with weight/underline |

- Use Graphite (not pure black) for a softer, premium feel.

---

## Light mode gold usage
- On light, **gold is an accent, not the primary button color** — the **primary action uses Building Navy** (gold on white fails text/icon contrast, ~2.5:1).
- Use gold for: active states, selected borders, small highlights, focus rings, and a single key flourish.
- For gold-on-light emphasis, use **large/bold** elements or gold on a navy chip — never gold body text on white.
- Still **one gold focus per view**; semantic colors handle status.

`[Insert light mode gold usage]`

---

## Light mode logo usage
- Use the **dark / navy logo** (`assets/logos/building-suit-logo-dark.png`) on light surfaces — highest clarity.
- **Never** use the light/silver logo on light backgrounds (it washes out).
- On a navy hero section within a light page, switch to the light/silver logo.
- Respect clear space; don't add shadows/effects to the logo.

`[Insert light mode logo placement]`

---

## Light mode UI examples
- **Dashboard:** Pearl White background, White cards with soft shadows, Graphite figures, positive/negative balances in Verified Green / Signal Red, **navy primary action** with a gold accent detail.
- **Bottom nav:** White bar + top hairline with Hugeicons Stroke Rounded only; inactive muted Slate Gray icons; **active Stroke Rounded icon + Premium Gold + label/indicator**.
- **Forms:** White inputs, Cloud Gray borders, gold focus ring, Signal Red errors.
- **Payment card:** White surface, semantic amount color, status badge on tinted chip.
- **Modal/bottom sheet:** White content over a navy scrim.

`[Insert light mode screen examples]`

---

## Accessibility notes
- Target **WCAG AA** (4.5:1 text / 3:1 large + UI).
- **Verified:** Graphite on Pearl White ~13:1 ✓ AAA; Building Navy on Pearl White ~12.8:1 ✓ AAA; Premium Gold on Pearl White ~2.5:1 ✗ (decorative/large only — **don't use gold for text/icons needing contrast on light**).
- Use full-saturation **semantic colors** for status text/icons; tints only for backgrounds.
- Don't rely on color alone — status = color + icon + label.
- Ensure focus rings (Premium Gold) are visible against white/Pearl White (use offset + sufficient thickness).
- Verify every new pairing with a contrast checker.
