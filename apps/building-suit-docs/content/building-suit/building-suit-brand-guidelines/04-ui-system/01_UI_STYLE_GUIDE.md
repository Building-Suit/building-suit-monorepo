# UI Style Guide

> **Status:** Complete (initial). How the Building Suit brand identity becomes a premium mobile SaaS interface for building management. Source of truth: `01-strategy/`, `03-visual-identity/01_COLOR_SYSTEM.md`, `02_TYPOGRAPHY_SYSTEM.md`, `04_LAYOUT_AND_SPACING.md`, `05_ICONOGRAPHY_STYLE.md`, and the logo system.

---

## General UI personality
Building Suit's interface behaves like a **calm, trusted, premium building manager**: clear, structured, and quietly confident.

- **Clear** — plain hierarchy, one primary action per screen, no clutter.
- **Trustworthy** — money and status shown precisely and consistently; nothing hidden.
- **Structured** — everything on the 8px grid; repeatable card/list patterns.
- **Premium** — navy + neutrals with a single gold focal point; generous space; soft depth.
- **Warm** — friendly rounding, comfortable spacing, human copy (see `01-strategy/03_BRAND_VOICE.md`).

**Foundational UI tokens** (from the color system):
| Role | Light | Dark |
|---|---|---|
| Background | Pearl White `#F7F8FA` | Midnight `#0A111A` |
| Surface/card | White `#FFFFFF` | Navy Surface `#14233A` |
| Primary text | Graphite `#232B33` | Pearl White `#F7F8FA` |
| Secondary text | Slate Gray `#5A6573` | Sky Steel `#7E97B3` |
| Border | Cloud Gray `#CBD2DB` | Steel Border `#2E3F52` |
| Primary action | Building Navy `#16293B` | Premium Gold `#D89B42` |
| Accent | Premium Gold `#D89B42` | Highlight Gold `#EBB45A` |

**Interaction states (global):** Default → Hover (web) → Pressed (slightly darker/lighter) → Focus (2px Premium Gold ring, offset) → Disabled (reduced opacity / Cloud Gray). Keep motion quick and subtle (120–200ms ease).

---

## Mobile-first design direction
- **Designed for the phone first** (Flutter); web scales up from the same system.
- One-handed use: primary actions live at the **bottom** (bottom nav, FAB, sticky action bar).
- **44×44dp** minimum tap targets; 8px minimum spacing between targets.
- Respect safe areas (notch, status bar, home indicator) and keyboard insets.
- **Bilingual & RTL:** full mirroring for Arabic; directional icons flip, logo artwork never flips.
- Performance: flat UI with subtle depth; reserve 3D for brand moments (logo/splash/hero).

`[Insert mobile-first overview]`

---

## App layout style
- **Structure:** App bar (context) → scrollable content (cards on background) → bottom navigation.
- Single-column, card-grouped content with consistent 16dp screen padding and 24–32dp section spacing.
- Sticky app bar for context; bottom sheets/modals for focused tasks.
- Clear vertical rhythm; whitespace over dividers for grouping.
- A **dashboard/home** anchors each building (balance + key actions + recent activity).

`[Insert app layout skeleton]`

---

## Card style
Cards are the primary container — the building blocks of the structured look.

- **Surface:** White (light) / Navy Surface (dark); **radius 16px**; padding 16–24px.
- **Elevation:** soft navy-tinted shadow (light) / surface-lightness step (dark) — never heavy.
- **Anatomy:** optional leading icon → title (H3) → supporting text (Body M) → trailing value/action; status via badge.
- One clear focal point per card; gold only for the single most important element (e.g. active state, key amount emphasis).
- Group related cards in lists with 12–16px gaps.

`[Insert card style examples]`

---

## Navigation style
- **Bottom navigation** (3–5 items): use Hugeicons Stroke Rounded only; inactive = muted icon + label; **active = Stroke Rounded icon + Premium Gold + label/indicator**.
- **App bar:** title (H2/H3), optional back (mirrors in RTL), 1–2 trailing 24px outline actions.
- **Tabs/segmented controls** for switching views within a screen; active tab gets a gold indicator.
- Building **context switcher** in the app bar (which building you're managing/viewing).
- Keep navigation consistent and predictable across the app.

`[Insert navigation patterns]`

---

## Empty state style
- **Calm and instructive**, never apologetic or busy.
- Anatomy: simple brand illustration (window-grid/building motif) → short headline → one line of guidance → one primary action.
- Use brand voice: "No payments yet. Once you record one, it'll appear here with the unit balance updated."
- Generous space; muted colors; gold only on the single primary CTA.

`[Insert empty state examples]`

---

## Form style
- **Inputs:** Material 3-style outlined text fields themed with Building Suit brand tokens: minimum 48dp field height, 12px input radius, 1px outline, floating label, helper/error text below.
- **Focus:** Premium Gold ring; **error:** Signal Red border + message + icon.
- One column; logical grouping; labels always visible. Floating labels rest inside an empty inactive input and move to the top of the field on focus or once filled; do not use placeholder-only labels.
- **Money inputs** show currency and format clearly; validate at the boundary with calm, specific messages.
- Primary submit is a full-width Primary button at the bottom; destructive/financial actions get confirmation.
- RTL: labels, inputs, and helper text right-aligned; numerals per locale.

`[Insert form examples]`

---

## Modal style
- **Bottom sheets** for focused mobile tasks (radius 20–24px top corners); centered dialogs for confirmations.
- Anatomy: title (H3) → content → actions (primary + cancel); a grabber on bottom sheets.
- Scrim behind (navy at ~40–60% opacity); content on Surface color.
- Keep modals short and single-purpose; avoid stacking modals.
- Confirmation modals clearly state the effect (especially for money/destructive actions; note that corrections are tracked, not hidden).

`[Insert modal & sheet examples]`

---

## Dashboard style
The building home screen — the product's "control panel."

- **Top:** building name/context + the headline figure (e.g. **building balance** or the user's **unit balance**) using the Display weight; positive/negative in semantic green/red.
- **Quick actions:** record payment, add expense, post announcement, open issue (gold-accented primary action).
- **Cards:** outstanding balances, recent activity/ledger, open issues, active votes, urgent announcements.
- Scannable, calm, structured; one gold focal point (usually the primary action or a critical alert).
- Urgent items (overdue, urgent announcement, open vote closing soon) surface near the top with semantic color + icon.

`[Insert dashboard example]`

---

## Visual hierarchy rules
1. **One primary action per screen** — the single gold/navy focal point.
2. **Hierarchy via size + weight + color**, not size alone (see typography).
3. **Money is prominent and precise** — key figures large; semantic color for state.
4. **Group with space**, then cards, then dividers (in that order of preference).
5. **Gold = the one thing that matters** on a view; never scatter it.
6. **Consistent patterns** — the same component for the same job everywhere.
7. **Status is always color + icon + label**, never color alone.
8. **Whitespace signals premium** — don't crowd; let focal points breathe.

`[Insert visual hierarchy examples]`
