# Component Style Guide

> **Status:** Complete (initial). Visual specs for Building Suit's core components. Each entry covers purpose, color, typography, radius, shadow, states, and do/don't. Tokens reference `03-visual-identity/01_COLOR_SYSTEM.md`. Colors shown light → dark where they differ.

**Shared conventions:** 8px spacing scale · min tap target 44×44dp · focus = 2px Premium Gold ring (offset) · disabled = reduced opacity / Cloud Gray · motion 120–200ms ease · status = color + icon + label.

---

## Primary button
- **Purpose:** the single most important action on a view (e.g. Record payment, Submit).
- **Color:** Light: Building Navy `#16293B` bg, Pearl White text. Dark: Premium Gold `#D89B42` bg, Deep Structure Navy text.
- **Typography:** Button 15/SemiBold (600), centered.
- **Radius:** 12px. **Height:** ≥48dp; full-width on mobile.
- **Shadow:** soft (light: `0 2px 8px rgba(13,27,40,.12)`); none/subtle in dark.
- **States:** Default → Hover (slightly darker navy / brighter gold) → Pressed (deeper) → Focus (gold ring) → Disabled (Cloud Gray bg, muted text) → Loading (spinner, label hidden).
- **Do / Don't:** ✅ one primary per view. ❌ two primary buttons competing; ❌ gold primary on light where contrast fails (use navy on light).

`[Insert primary button states]`

---

## Secondary button
- **Purpose:** secondary actions beside the primary (e.g. Cancel-but-meaningful, alternate path).
- **Color:** outlined — transparent bg, Building Navy border + text (light); Pearl White border + text (dark). Optional Slate Blue fill variant.
- **Typography:** Button 15/SemiBold.
- **Radius:** 12px. **Height:** ≥48dp.
- **Shadow:** none.
- **States:** Hover (subtle navy tint fill) → Pressed (stronger tint) → Focus (gold ring) → Disabled (Cloud Gray border + muted text).
- **Do / Don't:** ✅ pair with a primary. ❌ make it look identical to primary; ❌ use gold border (reserve gold for accents/active).

`[Insert secondary button states]`

---

## Ghost button
- **Purpose:** low-emphasis/tertiary actions (e.g. "See all", inline text actions).
- **Color:** transparent bg, Slate Blue/Building Navy text (light) / Pearl White or Sky Steel (dark); no border.
- **Typography:** Button 15/Medium–SemiBold.
- **Radius:** 12px (for the hover/pressed hit area).
- **Shadow:** none.
- **States:** Hover (faint surface tint) → Pressed (stronger tint) → Focus (gold ring) → Disabled (muted).
- **Do / Don't:** ✅ for tertiary/inline actions. ❌ for primary actions; ❌ overuse so the screen has no clear hierarchy.

`[Insert ghost button states]`

---

## Input fields
- **Purpose:** text/number/money entry.
- **Color:** Surface bg, 1px Cloud Gray border (light) / Steel Border (dark); label Graphite/Pearl White; helper Slate Gray/Sky Steel.
- **Typography:** Resting label Body M/Regular; floated label Caption 12/SemiBold; input Body M 14–16/Regular; helper Caption 12.
- **Radius:** 12px outlined container from the Building Suit input token. **Height:** minimum 48dp target; do not adopt Material default shape values that conflict with the brand radius scale.
- **Shadow:** none (focus uses border/ring).
- **States:** Default with label resting inside field → Focus (label floats to top + Premium Gold border/ring) → Filled (label remains floated) → Error (Signal Red border + message + icon) → Disabled (muted bg) → Read-only.
- **Do / Don't:** ✅ associated floating label; clear money formatting/currency. ❌ placeholder-as-label; ❌ color-only error (always add text + icon).

`[Insert input field states]`

---

## Select fields
- **Purpose:** choose from options (unit, role, category, building).
- **Color/Typography/Radius:** same as Input fields; trailing chevron (24px Hugeicons Stroke Rounded, muted).
- **Shadow:** dropdown/menu uses elevation-2 soft shadow (light) / raised surface (dark).
- **States:** Default → Focus (gold) → Open (menu, selected item highlighted with gold check/indicator) → Error → Disabled.
- **Do / Don't:** ✅ native pickers/bottom-sheet selects on mobile for long lists. ❌ tiny tap targets; ❌ hide the selected value.

`[Insert select field states]`

---

## Cards
- **Purpose:** group related content (the core container).
- **Color:** White (light) / Navy Surface (dark); border optional (Cloud Gray / Steel Border).
- **Typography:** Title H3 18/SemiBold; body Body M 14; values emphasized (SemiBold).
- **Radius:** 16px. **Padding:** 16–24px.
- **Shadow:** soft elevation-1 (light) / surface step (dark).
- **States:** Static; if tappable → Hover/Pressed (subtle tint/elevation), Focus (gold ring), Selected (Premium Gold border).
- **Do / Don't:** ✅ one focal point; consistent padding. ❌ nested heavy cards; ❌ gold-filled card backgrounds.

`[Insert card variants]`

---

## Badges
- **Purpose:** compact status/labels (Paid, Overdue, Pending, Open, Closed, Urgent).
- **Color:** semantic tint bg + full semantic text/icon — Success `#2E9E6B`, Warning `#E1841F`, Error `#D14B4B`, Info `#2F77C9`; neutral badge uses Soft Silver/Steel Border.
- **Typography:** Caption 12/SemiBold (or Overline for tags, Latin only).
- **Radius:** 8px (or pill). **Padding:** 2–4px × 8px.
- **Shadow:** none.
- **States:** mostly static; reflect live status.
- **Do / Don't:** ✅ color + icon + label together; consistent status vocabulary. ❌ gold badges (gold isn't a status); ❌ color-only meaning.

`[Insert badge set]`

---

## Tabs
- **Purpose:** switch between views within a screen (e.g. Ledger / Expenses / Charges).
- **Color:** inactive label muted; **active label + indicator in Premium Gold** (or navy underline on light if preferred); track on Surface.
- **Typography:** Body M/SemiBold for labels.
- **Radius:** indicator 2–4px; segmented-control container 12px.
- **Shadow:** none.
- **States:** Inactive → Hover → Active (Stroke Rounded icon + Gold indicator) → Focus (gold ring) → Disabled.
- **Do / Don't:** ✅ 2–5 tabs; clear active state. ❌ too many tabs (use a select/menu); ❌ ambiguous active state.

`[Insert tabs example]`

---

## Bottom navigation
- **Purpose:** top-level navigation (3–5 destinations) on mobile.
- **Color:** Surface bg with top hairline border; use Hugeicons Stroke Rounded only; inactive = muted icon + label; **active = Stroke Rounded icon + Premium Gold + label/indicator**.
- **Typography:** Caption 11–12/Medium labels.
- **Radius:** container square (respects safe area); active indicator optional.
- **Shadow:** subtle top shadow/border to separate from content.
- **States:** Active / Inactive / Pressed; optional badge dot for notifications.
- **Do / Don't:** ✅ 3–5 items, labels always shown. ❌ 6+ items; ❌ gold on every item (only active).

`[Insert bottom navigation]`

---

## App bar
- **Purpose:** screen context, title, and 1–2 actions.
- **Color:** Background/Surface; title Graphite/Pearl White; actions use muted Hugeicons Stroke Rounded icons; building context switcher optional.
- **Typography:** Title H2/H3 (700/600).
- **Radius:** square (may have bottom rounding if it's a header panel).
- **Shadow:** none when flush; subtle shadow/border on scroll.
- **States:** Default → Scrolled (elevation/condense) → with back button (mirrors in RTL).
- **Do / Don't:** ✅ one clear title; ≤2 trailing actions. ❌ crowding the bar; ❌ flipping the logo for RTL (flip placement only).

`[Insert app bar variants]`

---

## Toasts
- **Purpose:** brief, non-blocking feedback ("Payment recorded").
- **Color:** Navy Surface/Deep Navy bg with Pearl White text (both modes for consistency); semantic accent icon for success/error.
- **Typography:** Body M 14/Medium.
- **Radius:** 12px. **Position:** above bottom nav, within safe area.
- **Shadow:** elevation-2 soft shadow.
- **States:** Enter (slide/fade) → Visible (auto-dismiss ~3–4s) → optional single action ("Undo") → Exit.
- **Do / Don't:** ✅ short, one line, optional single action. ❌ use toasts for critical errors needing decisions (use a modal/inline); ❌ stack many toasts.

`[Insert toast examples]`

---

## Modals
- **Purpose:** focused tasks and confirmations.
- **Color:** Surface content on navy scrim (~40–60%); title Graphite/Pearl White.
- **Typography:** Title H3; body Body M; actions Button.
- **Radius:** dialog 20px; bottom sheet 20–24px top corners (with grabber).
- **Shadow:** elevation-3.
- **States:** Open/Close (fade + slide); loading; scrollable content; destructive variant (Signal Red primary).
- **Do / Don't:** ✅ single purpose; state the effect of money/destructive actions. ❌ stacking modals; ❌ burying the primary action.

`[Insert modal examples]`

---

## Payment cards
- **Purpose:** show a charge/payment/expense or unit balance entry in the ledger.
- **Color:** Surface; **amount in semantic color** — credit/paid Verified Green, owed/overdue Signal Red, pending Amber Alert; status badge alongside.
- **Typography:** amount emphasized (H3/SemiBold or Display for headline balances); meta in Caption; unit/date clearly shown.
- **Radius:** 16px. **Padding:** 16px.
- **Shadow:** elevation-1.
- **States:** Paid / Pending / Overdue / Failed; tappable → detail; selected (gold border).
- **Do / Don't:** ✅ precise amount + currency + unit + date; consistent finance color convention. ❌ gold for amounts (gold is accent, not status); ❌ color-only status.

`[Insert payment card examples]`

---

## Building cards
- **Purpose:** represent a building in discovery/selection/“my buildings.”
- **Color:** Surface; navy/gradient header or building image; gold accent only for a key state (e.g. "Active" or selected).
- **Typography:** building name H3/SemiBold; meta (units, role, balance) Body M/Caption.
- **Radius:** 16px. **Padding:** 16px (or image header + padded body).
- **Shadow:** elevation-1; hover/press elevation-2 if tappable.
- **States:** Default → Selected (Premium Gold border) → Pending join (Amber badge) → Disabled/blocked.
- **Do / Don't:** ✅ show role + key figure at a glance; use the building/window motif. ❌ drop the full logo as the building image; ❌ clutter with too many stats.

`[Insert building card examples]`

---

## Voting cards
- **Purpose:** present a vote (normal, money, election) with status and action.
- **Color:** Surface; status badge (Open/Closed/Closing soon); progress bars in navy/gold or semantic where meaningful; **CTA gold/navy**.
- **Typography:** vote title H3; options Body M; counts/percentages emphasized; deadline in Caption (Amber if closing soon).
- **Radius:** 16px. **Padding:** 16–24px.
- **Shadow:** elevation-1.
- **States:** Open (votable) → Voted (your choice marked, gold check) → Closed (results shown) → Closing soon (Amber) → Disabled (not eligible).
- **Do / Don't:** ✅ clear deadline, options, and your status; show results transparently. ❌ hide who can vote or the outcome; ❌ make results ambiguous.

`[Insert voting card examples]`

---

## Component checklist
- [ ] Uses color tokens (not raw HEX) and the correct light/dark roles.
- [ ] Radius from the set (8/12/16/20–24); spacing from the 8px scale.
- [ ] All states defined (default, hover, pressed, focus, disabled + component-specific).
- [ ] Focus ring (Premium Gold) and 44×44dp tap target met.
- [ ] Status shown as color + icon + label.
- [ ] One gold focal point per view; gold not used for status or body text.
- [ ] RTL-correct (mirrored layout/icons; numerals per locale).
- [ ] Contrast verified (see mode guides).
