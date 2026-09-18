# Color System

> **Status:** Complete (initial). The full Building Suit color palette and rules for applying it. Values are derived from the approved logo (sampled navy `#102030`–`#182838`, gold `#D89838`–`#E0A040`, silver `#E8E8E8`–`#F0F0F0`) and the brand direction in `01-strategy/`. These values are the source for `07-design-tokens/`.

> **Concept:** navy = trust, gold = premium / "lit & active," white-silver = clarity & transparency. (See `02-logo-system/01_LOGO_ANALYSIS.md`.)

---

## Core palette (named)
| Name | HEX | RGB | Approx HSL | Role |
|---|---|---|---|---|
| **Building Navy** | `#16293B` | 22, 41, 59 | 211°, 46%, 16% | Primary brand color |
| **Deep Structure Navy** | `#0D1B28` | 13, 27, 40 | 210°, 51%, 10% | Deepest navy; depth, footers, shadows |
| **Premium Gold** | `#D89B42` | 216, 155, 66 | 38°, 65%, 55% | Primary accent ("lit/active/valuable") |
| **Highlight Gold** | `#EBB45A` | 235, 180, 90 | 38°, 78%, 64% | Lighter gold; highlights, glow, hover |
| **Pearl White** | `#F7F8FA` | 247, 248, 250 | 220°, 25%, 97% | Lightest surface / light-mode background |
| **Soft Silver** | `#E2E5EA` | 226, 229, 234 | 218°, 14%, 90% | Silver surface / subtle fills |
| **Cloud Gray** | `#CBD2DB` | 203, 210, 219 | 214°, 17%, 83% | Light borders, dividers, disabled |
| **Graphite Text** | `#232B33` | 35, 43, 51 | 210°, 19%, 17% | Primary text on light |
| **Midnight Background** | `#0A111A` | 10, 17, 26 | 213°, 44%, 7% | Dark-mode background |
| **Navy Surface** | `#14233A` | 20, 35, 58 | 216°, 49%, 15% | Dark-mode elevated surface |
| **Steel Border** | `#2E3F52` | 46, 63, 82 | 212°, 28%, 25% | Borders on dark surfaces |

---

## Primary colors
The brand rests on **navy + gold**.

| Token | Color | Use |
|---|---|---|
| `primary` | **Building Navy** `#16293B` | Primary brand surfaces, headers, primary buttons, key text on light |
| `primary-deep` | **Deep Structure Navy** `#0D1B28` | Depth, footers, pressed states, gradients with Building Navy |
| `accent` | **Premium Gold** `#D89B42` | Primary accent: active states, highlights, key CTAs, "lit" moments |
| `accent-bright` | **Highlight Gold** `#EBB45A` | Hover/glow on gold, small highlights, gradients with Premium Gold |

**Gold discipline:** gold is a *precious accent* — small areas only (icons, indicators, key CTA, active rail). Never large flood fills.

---

## Secondary colors
Supporting hues for variety, data, and links (kept subordinate to navy + gold).

| Name | HEX | RGB | Use |
|---|---|---|---|
| **Slate Blue** | `#36506E` | 54, 80, 110 | Secondary surfaces, secondary buttons, links on light |
| **Sky Steel** | `#7E97B3` | 126, 151, 179 | Muted secondary text on dark, subtle accents |
| **Pale Sky** | `#DCE6F1` | 220, 230, 241 | Info backgrounds, selected rows on light |

---

## Light mode palette
| Role | Token | Color |
|---|---|---|
| Background | `bg` | Pearl White `#F7F8FA` |
| Surface / card | `surface` | `#FFFFFF` |
| Surface (subtle) | `surface-muted` | Soft Silver `#E2E5EA` |
| Primary text | `text` | Graphite Text `#232B33` |
| Secondary text | `text-muted` | `#5A6573` |
| Border / divider | `border` | Cloud Gray `#CBD2DB` |
| Brand / primary action | `primary` | Building Navy `#16293B` |
| Accent | `accent` | Premium Gold `#D89B42` |

`[Insert light-mode palette swatches]`

---

## Dark mode palette
| Role | Token | Color |
|---|---|---|
| Background | `bg` | Midnight Background `#0A111A` |
| Surface / card | `surface` | Navy Surface `#14233A` |
| Surface (elevated) | `surface-raised` | `#1B2E47` |
| Primary text | `text` | Pearl White `#F7F8FA` |
| Secondary text | `text-muted` | Sky Steel `#7E97B3` |
| Border / divider | `border` | Steel Border `#2E3F52` |
| Brand / primary action | `primary` | Premium Gold `#D89B42` *(gold leads as the action color on dark)* |
| Accent | `accent` | Highlight Gold `#EBB45A` |

> In dark mode the **light/silver logo** is used; in light mode the **dark/navy logo** is used (see `02-logo-system/02_LOGO_USAGE_RULES.md`).

`[Insert dark-mode palette swatches]`

---

## Metallic gold palette
A small gold ramp for the accent and for premium gradients (the "lit window" feel).

| Step | HEX | RGB | Use |
|---|---|---|---|
| Gold 700 (shadow) | `#A86C1C` | 168, 108, 28 | Gold edges/shadow, pressed gold |
| Gold 600 (core) | `#C8902F` | 200, 144, 47 | Solid gold on light, gold borders |
| **Gold 500 (Premium Gold)** | `#D89B42` | 216, 155, 66 | Default accent |
| Gold 400 (Highlight Gold) | `#EBB45A` | 235, 180, 90 | Hover, highlight |
| Gold 300 (light) | `#F4CE86` | 244, 206, 134 | Tints, subtle gold backgrounds |

**Gold gradient (premium):** `#EBB45A → #D89B42 → #A86C1C` (top-light to bottom-shadow), echoing the logo's lit, dimensional gold. Use sparingly for hero/icon moments, never behind text.

`[Insert metallic gold ramp]`

---

## Neutral palette
| Name | HEX | RGB | Use |
|---|---|---|---|
| White | `#FFFFFF` | 255,255,255 | Cards/surfaces (light) |
| Pearl White | `#F7F8FA` | 247,248,250 | Light background |
| Soft Silver | `#E2E5EA` | 226,229,234 | Muted surface |
| Cloud Gray | `#CBD2DB` | 203,210,219 | Borders, disabled (light) |
| Steel Gray | `#9AA6B4` | 154,166,180 | Muted icons/text (mid) |
| Slate Gray | `#5A6573` | 90,101,115 | Secondary text (light) |
| Graphite Text | `#232B33` | 35,43,51 | Primary text (light) |
| Navy Surface | `#14233A` | 20,35,58 | Surface (dark) |
| Midnight Background | `#0A111A` | 10,17,26 | Background (dark) |

---

## Text colors
| Context | Color | Notes |
|---|---|---|
| Primary text on light | Graphite Text `#232B33` | Body & headings (≈13:1 on Pearl White ✓ AAA) |
| Secondary text on light | Slate Gray `#5A6573` | Captions, hints (✓ AA) |
| Disabled text on light | Steel Gray `#9AA6B4` | Non-essential only |
| Primary text on dark | Pearl White `#F7F8FA` | Body & headings (✓ AAA on Midnight) |
| Secondary text on dark | Sky Steel `#7E97B3` | Captions, hints |
| Link on light | Slate Blue `#36506E` | Underline or weight to distinguish |
| **Gold as text** | Premium Gold | **Avoid on light** (fails contrast); on dark use large/bold only |

---

## Border colors
| Context | Color |
|---|---|
| Border / divider (light) | Cloud Gray `#CBD2DB` |
| Strong border (light) | Steel Gray `#9AA6B4` |
| Border / divider (dark) | Steel Border `#2E3F52` |
| Focus ring | Premium Gold `#D89B42` (2px, offset) |
| Selected / active border | Premium Gold `#D89B42` |

---

## Background colors
| Context | Color |
|---|---|
| App background (light) | Pearl White `#F7F8FA` |
| Card/surface (light) | White `#FFFFFF` |
| App background (dark) | Midnight Background `#0A111A` |
| Card/surface (dark) | Navy Surface `#14233A` |
| Brand section / hero | Building Navy `#16293B` → Deep Structure Navy `#0D1B28` gradient |
| Info background | Pale Sky `#DCE6F1` (light) / `#1B2E47` (dark) |

---

## Semantic colors
Tuned to read as distinct from brand gold (warning is deliberately more orange).

| Meaning | Name | HEX | RGB | Finance use |
|---|---|---|---|---|
| Success / positive | Verified Green | `#2E9E6B` | 46,158,107 | Paid, credit, approved |
| Warning / attention | Amber Alert | `#E1841F` | 225,132,31 | Pending, due soon |
| Error / negative | Signal Red | `#D14B4B` | 209,75,75 | Overdue, debit, failed, blocked |
| Info / neutral | Info Blue | `#2F77C9` | 47,119,201 | Notices, neutral status |

Each has a tint for backgrounds (e.g. Success bg `#E4F4EC`, Warning bg `#FBEEDD`, Error bg `#F8E3E3`, Info bg `#DCE6F1`) and a dark-mode variant (raise lightness ~10–15%).

> **Finance color convention:** money owed/overdue → Signal Red; paid/credit → Verified Green; pending → Amber Alert. Keep this consistent everywhere money appears.

`[Insert semantic color swatches]`

---

## Color usage rules
1. **Navy is the foundation, gold is the jewel.** Lead with navy and neutrals; add gold in small, intentional doses.
2. **One gold focus per view.** Avoid multiple competing gold elements; gold marks *the* thing that matters.
3. **Don't use gold for body text.** Use it for icons, indicators, borders, and large/bold accents only.
4. **Keep semantic colors for status**, not decoration. Don't repaint brand elements in green/red except to convey state.
5. **Maintain mode integrity.** Use the light-mode set on light, the dark-mode set on dark; never mix surfaces and text across modes.
6. **Respect the logo pairing.** Dark/navy logo on light; light/silver logo on dark; navy logo only on gold.
7. **Use tints for backgrounds, full color for emphasis.** Status backgrounds use tints; status text/icons use the full semantic color.
8. **Reference tokens, not raw HEX,** in product code (see `07-design-tokens/`).

---

## Accessibility notes
- Target **WCAG 2.1 AA**: ≥ 4.5:1 for normal text, ≥ 3:1 for large text (≥ 24px / 19px bold) and UI components/icons.
- **Verified pairings:**
  - Graphite `#232B33` on Pearl White → ~13:1 ✓ AAA
  - Building Navy `#16293B` on Pearl White → ~12.8:1 ✓ AAA
  - Pearl White on Building Navy → ~12.8:1 ✓ AAA
  - Premium Gold `#D89B42` on Building Navy → ~5.7:1 ✓ AA (normal), AAA (large)
  - Highlight Gold `#EBB45A` on Building Navy → ~7.5:1 ✓ AAA
- **Failing pairings to avoid for text:**
  - Premium Gold on Pearl White → ~2.5:1 ✗ (decorative/large only)
  - Sky Steel `#7E97B3` on Pearl White → low ✗ (use only on dark)
- **Don't rely on color alone** for status (pair red/green/amber with icons + labels) — important for finance and colorblind users.
- **Focus states** must be visible: 2px Premium Gold ring with offset, on both modes.
- Verify any new pairing with a contrast checker before shipping.

---

## Do / Don't color usage
| ✅ Do | ❌ Don't |
|---|---|
| Lead with navy + neutrals, gold as accent | Flood large areas with gold |
| Use gold for one key focus per screen | Scatter gold across many elements |
| Use Graphite/Pearl White for text | Use gold for body text (esp. on light) |
| Use semantic colors only for status | Recolor brand elements green/red decoratively |
| Pair status color with icon + label | Rely on color alone to signal state |
| Keep dark logo on light / light logo on dark | Put the light logo on light, or navy on navy |
| Use tints for status backgrounds | Use full-saturation status colors as big backgrounds |
| Reference design tokens | Hard-code random HEX values |

`[Insert do/don't color examples]`
