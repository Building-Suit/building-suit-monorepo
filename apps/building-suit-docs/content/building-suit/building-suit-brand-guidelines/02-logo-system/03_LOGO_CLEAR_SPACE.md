# Logo Clear Space

> **Status:** Complete (initial). Protected spacing and placement rules that keep the Building Suit logo legible and premium. Works alongside `02_LOGO_USAGE_RULES.md`.

---

## Clear space rule
The logo must always be surrounded by a minimum area of empty space, free of text, graphics, other logos, or busy imagery.

- **Minimum clear space = 1 unit (`X`) on all four sides** of the logo's bounding box.
- More space is always better; `1X` is the *minimum*, not the target.
- Clear space scales with the logo: if the logo grows, the clear space grows with it.

`[Insert clear space diagram]`

---

## Safe area rule
The **safe area** is the logo's bounding box plus the `1X` clear space on every side. Nothing may enter the safe area.

- No text, icons, rules/lines, or competing logos inside the safe area.
- No edges of containers, cards, or screens cutting into the safe area.
- In photography, the safe area must sit over a calm, low-detail region (or a scrim).

`[Insert safe area diagram]`

---

## Suggested measurement system
Define the clear-space unit from a feature *inside* the mark so it scales naturally with the logo.

- **`X` = the height of one window square** in the building façade (a single pane of the gold window grid).
- This ties the spacing system directly to the logo's own architecture (the window/unit motif).

| Token | Definition | Use |
|---|---|---|
| `X` | Height of one window pane in the mark | Base clear-space unit |
| `1X` | One window-pane height | **Minimum** clear space on all sides |
| `1.5X`–`2X` | One-and-a-half to two panes | **Recommended** clear space for hero / standalone use |

> Alternative if window panes aren't easy to measure in a given export: set **`X` = 25% of the logo's total height**. Use one consistent definition per project and document which was used in the design files.

`[Insert measurement-unit diagram]`

---

## Placement rules
- **Anchor to a corner or center**, with at least the safe area to the nearest edge.
- Preferred positions: top-left (LTR layouts), top-center, or centered for splash/hero.
- **RTL (Arabic) layouts:** mirror horizontal placement — the logo's "home" corner moves to the top-right. The logo artwork itself is **never** mirrored or flipped.
- Keep the logo clear of folds, trim, bleed, punch-holes, and UI safe-area insets (notches, status bars).
- Maintain consistent placement across a set (don't move the logo around between pages/screens).

`[Insert placement examples]`

---

## Alignment rules
- Align the logo to the **layout grid** (see `03-visual-identity/04_LAYOUT_AND_SPACING.md` once defined).
- Use the logo's **optical** center/edges, not just its bounding box — the tall building stem can make pure bounding-box alignment look off; adjust optically.
- When paired with a wordmark, tagline, or partner logo, align on a shared baseline or centerline and separate by at least `1X` (with a divider rule for co-branding).
- Keep the logo upright — never rotate (see `04_LOGO_DOS_AND_DONTS.md`).

`[Insert alignment examples]`

---

## Logo isolation examples
Concrete spacing scenarios:

| Scenario | Clear space | Notes |
|---|---|---|
| App header / web nav | `1X` minimum | Reduce logo size before reducing clear space |
| Splash / hero | `1.5X`–`2X` | Give the brand moment room to breathe |
| Business card | `1X` minimum | Keep clear of trim and other elements |
| Co-branding lockup | `1X` between logos + divider | Equal visual weight; never crowd |
| Over photography | `1X` + calm area/scrim | Safe area must sit on low-detail region |

`[Insert logo isolation examples]`

---

## Visual notes for Claude Design
For building the brand board and guideline pages:

- Treat the logo as a reusable block with the `1X` clear space baked in as transparent padding, so placements inherit correct spacing.
- Enforce the safe area by wrapping the logo in padding = `1X` on every placement.
- Add a **clear-space overlay** (dashed bounding box + `X` measurement labels) on the guidelines clear-space page.
- Define `X` once as a value (e.g. `logo/clear-space-unit`) and reference it everywhere.
- Provide **two variants** (dark/navy and light/silver) and choose by background: Light → navy logo, Dark → light/silver logo.
- Include **mirror-for-RTL** guidance (mirror *placement*, never the artwork).
- Keep export settings at native resolution; add `@1x/@2x/@3x` export presets. Flag the need for a vector master.

`[Insert clear-space frame mockup]`
