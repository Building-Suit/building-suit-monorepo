# Claude Design — Brand Guidelines Prompt

> **Status:** Complete (initial). A low-level, paste-ready prompt for **Claude Design** to create the multi-page **Building Suit Brand Guidelines PDF** (one page-frame per page, exported in order to a single PDF). Read `00_CLAUDE_DESIGN_SOURCE_PACK.md` first for the full token values.
>
> **Logo rule:** use the **uploaded logo files exactly** — navy logo (`assets/logos/building-suit-logo-dark.png`) on light pages, white/silver logo (`assets/logos/building-suit-logo-light.png`) on navy pages. Do **not** redesign, recolor, distort, rotate, stretch, or change the gold bars/windows.

---

## How to use this file
1. Provide Claude Design with `00_CLAUDE_DESIGN_SOURCE_PACK.md` and both uploaded logo PNGs.
2. Paste the **Prompt** block below.
3. Review with `05_CLAUDE_DESIGN_REVIEW_NOTES.md`; refine via `03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`.
4. Export per `04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` to `Building-Suit-Brand-Guidelines-v1.0.pdf`.

---

## Document specification (for reference)
- **Format:** landscape pages, **1920 × 1080 px** (16:9), one page-frame per page, exported in order to one PDF.
- **Grid:** 12 columns, 96px outer margins, 24px gutters, 8px spacing.
- **Master layout:** consistent header (page title + small gold section label + divider) and footer (small logo + page number + "Building Suit — Brand Guidelines v1.0 — Confidential").
- **Rhythm:** alternate navy and light pages; **one gold accent per page**; generous negative space.
- **27 pages**, in the exact order listed below.

---

## Prompt (paste into Claude Design)

```
Create a MULTI-PAGE Brand Guidelines PDF for "Building Suit" — a mobile-first, transparent operating system for self-managed residential buildings. Tagline: "Clarity you can trust." Produce ONE page-frame PER PAGE, each 1920 x 1080 px (16:9 landscape), named "BS / Guidelines / NN — <Page Name>", exported in order to a single PDF.

GLOBAL STYLE (every page)
- Premium, calm, editorial. Generous negative space. One gold accent per page only.
- 12-column grid, 96px outer margins, 24px gutters, 8px spacing system (4,8,12,16,24,32,48,64,96).
- Alternate page backgrounds: navy pages use Building Navy #16293B -> Deep Structure Navy #0D1B28; light pages use Pearl White #F7F8FA with white cards.
- Master header: page title (Manrope Bold) top-left, small gold overline section label above it, thin divider rule. Master footer: small logo (navy on light / white-silver on navy), page number at the outer edge, "Building Suit — Brand Guidelines v1.0 — Confidential".
- Radius: cards 16, buttons/inputs 12, chips 8, modals 24. Shadows: 0 2px 8px rgba(13,27,40,.08) / 0 4px 16px rgba(13,27,40,.12) / 0 8px 24px rgba(13,27,40,.16).
- Type: Manrope (Latin, 400/500/600/700/800); IBM Plex Sans Arabic (Arabic, RTL, right-aligned, no caps/tracking). Keep "Building Suit" in Latin.
- LOGO: use the two UPLOADED PNGs exactly. Do NOT redesign, recolor, distort, rotate, stretch, or change the gold bars/windows. Navy logo on light pages, white/silver on navy pages, >=1X clear space. Do not invent visual assets that aren't needed.

COLOR TOKENS
- Brand: Building Navy #16293B, Deep Structure Navy #0D1B28, Premium Gold #D89B42, Highlight Gold #EBB45A, Pearl White #F7F8FA, Soft Silver #E2E5EA, Cloud Gray #CBD2DB, Graphite Text #232B33.
- Dark surfaces: Midnight #0A111A, Navy Surface #14233A, Raised #1B2E47, Steel Border #2E3F52.
- Secondary blues: Slate Blue #36506E, Sky Steel #7E97B3, Pale Sky #DCE6F1. Neutrals: Slate Gray #5A6573, Steel Gray #9AA6B4.
- Gold ramp: #A86C1C, #C8902F, #D89B42, #EBB45A, #F4CE86.
- Semantic: Success #2E9E6B, Warning #E1841F, Error #D14B4B, Info #2F77C9 (each with a tinted background).
- RULES: one gold accent per page; primary action = Navy on light / Gold on dark; never gold for small text on light.

GENERATE THESE 27 PAGES IN ORDER:

01 — COVER (navy): navy gradient + window-grid + faint gold glow; centered UPLOADED white/silver logo; "Brand Guidelines" (Manrope ExtraBold, Pearl White); subtitle "Building Suit — Visual Identity System"; tagline "Clarity you can trust."; "v1.0 — Confidential".

02 — TABLE OF CONTENTS (light): "Contents"; numbered list of pages 03–27 with one-line descriptions and page numbers, two columns, gold accent on section numbers.

03 — BRAND INTRODUCTION (navy): what Building Suit is and the problem it solves (replaces messaging apps/paper/cash/spreadsheets with one transparent system); the hub-and-spoke ecosystem note; tagline prominent with one gold accent word.

04 — MISSION, VISION, PROMISE (light): three blocks — Mission, Vision, Brand Promise — short and specific, one gold accent.

05 — BRAND PERSONALITY (light): the five traits as cards (Clear · Honest · Calm · Premium · Dependable) with a one-line descriptor each; a quiet voice sample ("clear, warm, confident — no hype").

06 — TARGET AUDIENCE (light): primary audiences (building residents/owners, building managers, founders/partners) as persona cards with needs; bilingual note (Arabic + English users).

07 — LOGO SYSTEM (light + navy inset): the UPLOADED navy logo on white and the UPLOADED white/silver logo on a navy inset; variant-by-background rule.

08 — LOGO USAGE (light): correct placements, sizing, header/marketing examples; correct variant per background.

09 — LOGO CLEAR SPACE (light): clear-space diagram with 1X dashed boundary (X = building-B height or 25% of total height); minimum sizes.

10 — LOGO DO / DON'T RULES (split): "Do" (correct variant; clear space; generous room) vs "Don't" (recolor; change the gold bars; distort/stretch; rotate; add effects; place on busy/low-contrast).

11 — APP ICON GUIDE (navy): the building-B mark on a navy rounded-square icon (lit gold windows); size grid (1024/180/120/60); iOS + Android notes. Use the uploaded mark.

12 — COLOR SYSTEM (light): large swatches with name + HEX; gold ramp + navy/gold gradients; semantic row; light/dark role mapping and the primary-flips-by-mode rule; contrast note (gold fails text on light ~2.5:1).

13 — TYPOGRAPHY ENGLISH (light): Manrope scale (Display 32/40 ExtraBold; H1 26/34; H2 22/30; H3 18/26; Body L 16/24; Body M 14/22; Caption 12/18; Button 15/20) with labels and weights 400-800.

14 — TYPOGRAPHY ARABIC (light): IBM Plex Sans Arabic mirrored RTL scale with sample words, right-aligned; note line-height +10-15% over Latin, no caps/tracking; "Building Suit" stays Latin.

15 — VISUAL LANGUAGE (navy): window-grid motif, navy/gold gradient usage, photographic grade direction; one gold accent; short captions.

16 — LAYOUT AND SPACING (light): the 8px spacing scale (4-96), the 12-column grid, radii (chips 8/buttons 12/cards 16/modals 24), and the elevation shadow ladder.

17 — ICONOGRAPHY (light): explicitly name and use only the free Hugeicons Stroke Rounded library; do not use Solid, Duotone, Twotone, Bulk, or other paid styles; flat, 2px outline, rounded icon set sample; consistent stroke/size; neutral by default, gold only for the one emphasized icon; active state uses Gold plus a label/indicator without changing icon style; do not mix Lucide, Phosphor, or any other icon library.

18 — UI SYSTEM (light): overview of the product UI approach; light default + dark mode mention; primary-flips-by-mode; status = color + icon + label.

19 — COMPONENTS (light): a component kit — primary button (navy), secondary/ghost, input with gold focus ring, chip, status badges (paid=green/overdue=red/pending=amber), dashboard card with a balance figure, bottom-nav strip (active = Stroke Rounded + Gold + label/indicator).

20 — DARK MODE (navy): a phone mock in dark mode — Midnight background, Navy Surface cards, Pearl White text, Sky Steel muted, Gold primary button; note contrast and elevation.

21 — LIGHT MODE (light): a phone mock in light mode — Pearl White background, white cards with soft shadows, Graphite text, Navy primary button, gold accent detail.

22 — SOCIAL MEDIA (light): mini previews — Instagram square, Story 9:16, LinkedIn square; navy/gold treatment; one gold accent each; bilingual + alt-text note.

23 — WEBSITE HERO (navy): hero mock — navy gradient + window-grid + faint gold glow, white/silver logo, benefit-led headline with one gold accent word, gold primary CTA, phone mockup with a dashboard.

24 — BUSINESS CARD (light): front (navy, centered white/silver logo + tagline) and back (pearl/white, contact details, small navy logo, one thin gold rule); 85x55mm landscape.

25 — PRESENTATION STYLE (light): a 16:9 slide master sample — cover + content slide; one idea per slide, one gold accent, navy/light alternation, consistent footer; chart color note (navy primary series, gold for the one key series).

26 — DEVELOPER TOKENS (light): a tidy reference of the token outputs — design-tokens.json (source of truth), colors.css, tailwind.colors.js, flutter_colors.dart; show a few sample token names (buildingNavy, premiumGold, pearlWhite) and the primary-flips-by-mode rule.

27 — FINAL CHECKLIST (navy, closing): a tidy checklist summarizing logo, color, typography, spacing, accessibility, and bilingual requirements. Footer with white/silver logo, "buildingsuit", "Brand Guidelines v1.0 — Confidential".

Keep every page on the same grid, header, and footer, with one coherent premium navy-and-gold identity. Do not invent new colors, restyle the logo, or add unneeded visuals.
```

---

## Page → source mapping
| Page | Source documents |
|---|---|
| 01 Cover · 02 Contents | `02-logo-system/`, this document set |
| 03 Brand introduction | `01-strategy/01_BRAND_FOUNDATION.md` |
| 04 Mission/vision/promise · 05 Personality | `01-strategy/01–02` |
| 06 Target audience | `01-strategy/` audience doc |
| 07–11 Logo system/usage/clear space/do-don't/app icon | `02-logo-system/01–05`, `assets/logos/` |
| 12 Color system | `03-visual-identity/01_COLOR_SYSTEM.md`, `07-design-tokens/` |
| 13–14 Typography EN/AR | `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md` |
| 15 Visual language · 17 Iconography | `03-visual-identity/03,05,06` |
| 16 Layout and spacing | `03-visual-identity/04_LAYOUT_AND_SPACING.md` |
| 18–21 UI/components/dark/light | `04-ui-system/01–04` |
| 22–25 Marketing | `05-marketing/01–04` |
| 26 Developer tokens | `07-design-tokens/` |
| 27 Final checklist | `06-claude-design/04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` |
