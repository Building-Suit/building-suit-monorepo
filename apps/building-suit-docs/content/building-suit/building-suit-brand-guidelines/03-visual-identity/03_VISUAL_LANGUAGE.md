# Visual Language

> **Status:** Complete (initial). The overarching visual style that ties all Building Suit design together. Derived from the logo (a premium 3D, lit building) and the brand foundation (transparent, trustworthy, organised, premium, warm).

---

## Overall visual style
**Premium, architectural, and calm.** Building Suit looks like a well-run building: solid and structured, with clean navy surfaces, generous space, and a single warm gold light marking what matters. It feels modern and trustworthy — financial-grade seriousness softened by human warmth.

Three words to design by: **structured · premium · transparent.**

`[Insert visual language moodboard]`

---

## Architectural depth
The logo is a 3D building; the brand carries a sense of **built structure and depth** without becoming heavy.

- Use **layered surfaces** (background → card → raised element) to create a clear sense of floors/levels.
- Subtle elevation and soft shadows imply depth; the UI should feel like solid, stacked planes, not flat paper.
- The **window-grid motif** (square modules from the logo façade) is the signature pattern: use it for backgrounds, dividers, loading states, and section devices.
- Geometry is **rectilinear and ordered** (like a façade), softened by consistent rounded corners.

---

## Premium contrast
Premium feel comes from **strong, confident contrast** used sparingly.

- High contrast between **deep navy** and **light/silver** surfaces; let elements breathe.
- **Gold against navy** is the signature premium contrast — reserve it for highlights.
- Avoid muddy mid-tones and low-contrast gray-on-gray; be decisive (dark or light, not in-between).
- Quality over quantity: a few sharp, high-contrast focal points beat busy, evenly-weighted layouts.

---

## Structured layout
Order is a brand value, expressed through layout.

- Everything sits on a **consistent grid and 8px spacing system** (see `04_LAYOUT_AND_SPACING.md`).
- Clear hierarchy: one primary action and one focal point per view.
- Align to columns; keep consistent margins and rhythm; group related content into cards.
- Status-driven content (issues, votes, payments) uses consistent, repeatable card/list patterns — structure mirrors the product's structured workflows.

---

## Community trust
The serious system stays human and community-minded.

- **Warmth via gold** — the "lights on" glow signals life, occupancy, and care.
- Friendly, rounded corners and comfortable spacing keep it approachable across all tech-literacy levels.
- Imagery and illustration center **people and community** within the architecture (see `06_IMAGERY_STYLE.md`).
- Transparency is shown, not just stated: open layouts, visible data, clear status — "you can see inside."

---

## Use of gold accents
Gold is the **jewel of the system** — precious, intentional, small.

- Use for: active/selected states, key CTAs, highlights, important indicators, "verified/active" moments, and small premium flourishes.
- **One gold focus per view.** Multiple golds compete and cheapen the effect.
- Never use gold as a large background fill or for body text.
- The premium **gold gradient** (`#EBB45A → #D89B42 → #A86C1C`) is for special hero/icon moments only.
- On dark surfaces gold can act as the primary action color; on light it's an accent (mind contrast — see color system).

---

## Use of shadows
Shadows imply real, stacked structure — soft and consistent, never harsh.

- **Light mode:** soft, low-opacity navy-tinted shadows (e.g. `0 2px 8px rgba(13,27,40,0.08)`), larger blur for higher elevation.
- **Dark mode:** rely more on **surface lightness steps** than shadows for elevation; keep any shadows subtle.
- One consistent light direction (top-down), matching the logo's lighting.
- Don't stack multiple heavy shadows or add shadows to the logo (see logo do/don'ts).
- Elevation ladder: background (0) → card (1) → raised/menu (2) → modal (3); each step = slightly stronger shadow / lighter surface.

---

## Use of negative space
Space is a premium signal — generosity reads as confidence.

- Be generous with padding and margins; don't crowd.
- Let the gold focal point sit in clear space so it stands out.
- Group with space (proximity) before reaching for borders/dividers.
- Respect logo clear space everywhere (see `02-logo-system/03_LOGO_CLEAR_SPACE.md`).
- Empty states are calm and roomy, not apologetic or busy.

---

## 3D vs flat usage
A deliberate split keeps the brand both premium and usable:

| Use 3D / dimensional | Use flat / simplified |
|---|---|
| The logo & app icon | In-product UI icons |
| Hero & marketing imagery | Buttons, inputs, lists, tables |
| Splash screen, app store art | Small sizes, favicons, notification icon |
| Spot brand illustrations | Data-dense screens |

- **Product UI is primarily flat** (with subtle depth via shadows/surfaces) for clarity and performance.
- **Brand moments are 3D/dimensional** (logo, hero, icon) to carry the premium identity.
- Don't render flat UI elements with faux-3D bevels; don't flatten the 3D logo by hand (use the flat companion mark — outstanding asset).

---

## Brand mood keywords
**Premium · Architectural · Transparent · Structured · Trustworthy · Calm · Warm · Solid · Modern · Lit.**

Anti-keywords (avoid): cluttered, cheap, loud, chaotic, flat-and-lifeless, cold, gimmicky.

`[Insert mood keyword board]`
