# Claude Design — Brand Board Prompt

> **Status:** Complete (initial). A low-level, paste-ready prompt for **Claude Design** to create a single-page premium **Building Suit Brand Identity Board**. Read `00_CLAUDE_DESIGN_SOURCE_PACK.md` first — it holds the full token values this prompt references.
>
> **Logo rule:** use the **uploaded logo files exactly** — `assets/logos/building-suit-logo-dark.png` (navy logo, light backgrounds) and `assets/logos/building-suit-logo-light.png` (white/silver logo, dark backgrounds). Do **not** redesign, recolor, distort, rotate, stretch, or change the gold bars/windows.

---

## How to use this file
1. Provide Claude Design with `00_CLAUDE_DESIGN_SOURCE_PACK.md` and both uploaded logo PNGs.
2. Paste the **Prompt** block below.
3. Review the result with `05_CLAUDE_DESIGN_REVIEW_NOTES.md`; refine via `03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`.
4. Export per `04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md`.

---

## Board specification (for reference)
- **Single page**, portrait poster, **1920 × 3240 px**, 12-column grid, 80px outer margin, 32px gutters, 8px spacing.
- **Base:** Pearl White `#F7F8FA`; alternate navy `#16293B` and light bands for rhythm.
- **One gold accent per section.** Generous negative space. Premium, calm, structured.
- **13 sections**, stacked top to bottom in this order: Cover → Brand essence → Dark and light logos → Logo system → Color palette → English & Arabic typography → UI component previews → App icon preview → Splash screen preview → Social media preview → Website hero preview → Business card preview → Brand rules.

---

## Prompt (paste into Claude Design)

```
Create ONE premium single-page Brand Identity Board for "Building Suit" — a mobile-first, transparent operating system for self-managed residential buildings. Tagline: "Clarity you can trust." Portrait poster, 1920 x 3240 px.

GLOBAL STYLE
- Premium, calm, structured, trustworthy. Generous negative space. One gold accent per section only.
- 12-column grid, 80px outer margins, 32px gutters, 8px spacing system (4,8,12,16,24,32,48,64,96).
- Base background Pearl White #F7F8FA; alternate some sections on Building Navy #16293B for rhythm.
- Radius: cards 16, buttons/inputs 12, chips 8, modals 24. Shadows (navy-tinted): 0 2px 8px rgba(13,27,40,.08); 0 4px 16px rgba(13,27,40,.12); 0 8px 24px rgba(13,27,40,.16).
- Type: Manrope (Latin, 400/500/600/700/800); IBM Plex Sans Arabic (Arabic, RTL, right-aligned, no caps/tracking). Keep "Building Suit" in Latin.
- LOGO: use the two UPLOADED PNGs exactly. Do NOT redesign, recolor, distort, rotate, stretch, or change the gold bars/windows. Navy logo on light, white/silver logo on navy, >=1X clear space. Do not invent visual assets that aren't needed.

COLOR TOKENS
- Brand: Building Navy #16293B, Deep Structure Navy #0D1B28, Premium Gold #D89B42, Highlight Gold #EBB45A, Pearl White #F7F8FA, Soft Silver #E2E5EA, Cloud Gray #CBD2DB, Graphite Text #232B33.
- Dark surfaces: Midnight #0A111A, Navy Surface #14233A, Raised #1B2E47, Steel Border #2E3F52.
- Secondary blues: Slate Blue #36506E, Sky Steel #7E97B3, Pale Sky #DCE6F1.
- Gold ramp: #A86C1C, #C8902F, #D89B42, #EBB45A, #F4CE86. Gold gradient 135deg #EBB45A -> #D89B42 -> #A86C1C. Navy gradient #16293B -> #0D1B28.
- Semantic: Success #2E9E6B (bg #E4F4EC), Warning #E1841F (bg #FBEEDD), Error #D14B4B (bg #F8E3E3), Info #2F77C9 (bg #DCE6F1).
- RULES: one gold accent per section; primary action = Navy on light / Gold on dark; never gold for small text on light.

LAY OUT THESE 13 SECTIONS, STACKED TOP TO BOTTOM, each titled with a small gold overline label:

1. COVER (navy band, tall hero)
   - Navy -> Deep Structure Navy gradient, subtle window-grid motif, faint gold glow.
   - Centered UPLOADED white/silver logo with clear space. Below: "Building Suit" and tagline "Clarity you can trust." in Pearl White (Manrope ExtraBold title). Small caption "Brand Identity Board — v1.0".

2. BRAND ESSENCE (navy band)
   - Pearl White title "Brand Essence". Pillars as cards: Transparency, Trust, Premium clarity, Community (icon + label + one line each). Quiet personality row: Clear · Honest · Calm · Premium · Dependable.

3. DARK AND LIGHT LOGOS (split band)
   - Two large cards side by side: the UPLOADED navy logo on a white/pearl card, and the UPLOADED white/silver logo on a navy card. Caption: "Navy logo on light. Light/silver logo on dark."

4. LOGO SYSTEM (light band)
   - Title "Logo System". Show: clear-space diagram (1X dashed boundary around the mark), minimum-size note, and the app-icon mark (building-B only). Caption: "Never recolor, distort, rotate, or change the gold bars."

5. COLOR PALETTE (light band)
   - Title "Color Palette". Large swatches with name + HEX: Building Navy, Deep Structure Navy, Premium Gold, Highlight Gold, Pearl White, Soft Silver, Cloud Gray, Graphite. Second row: gold ramp + navy/gold gradients. Third row: semantic chips (Success/Warning/Error/Info) with HEX.

6. ENGLISH AND ARABIC TYPOGRAPHY (light band)
   - Title "Typography".
   - Left (LTR, Manrope): the scale — Display 32/40 ExtraBold, H1 26/34 Bold, H2 22/30 Bold, H3 18/26 SemiBold, Body L 16/24, Body M 14/22, Caption 12/18, Button 15/20 — each row labeled.
   - Right (RTL, IBM Plex Sans Arabic): the same scale with Arabic sample words, right-aligned. One bilingual lockup with "Building Suit" kept in Latin.

7. UI COMPONENT PREVIEWS (light band, white cards)
   - Title "UI Components". Kit: primary button (navy on light), secondary/ghost button, input with gold focus ring, chip, status badges (paid=green, overdue=red, pending=amber), and a card showing a balance figure. Note: "Primary = Navy on light, Gold on dark. One gold focus per view."

8. APP ICON PREVIEW (navy band)
   - Title "App Icon". The building-B mark on a navy rounded-square iOS-style icon with lit gold windows, plus a small size grid (1024, 180, 120, 60). Use the uploaded mark; do not redraw.

9. SPLASH SCREEN PREVIEW (navy band)
   - Title "Splash Screen". A phone frame: navy gradient, centered white/silver logo, faint gold glow, optional thin progress indicator. Calm and premium.

10. SOCIAL MEDIA PREVIEW (light band)
    - Title "Social Media". Three previews: Instagram square 1:1 (navy base, one gold accent word, app-icon mark in a corner); Story 9:16 with central safe-zone text; LinkedIn square with a data/quote card.

11. WEBSITE HERO PREVIEW (light band)
    - Title "Website Hero". Desktop hero mock: navy gradient + window-grid + faint gold glow, white/silver logo in a slim header, headline "See exactly where your building's money goes." with one gold accent word, gold primary CTA "Get started", phone mockup on the right showing a dashboard.

12. BUSINESS CARD PREVIEW (light band)
    - Title "Business Card". Front: navy card, centered white/silver logo + tagline. Back: pearl/white card with name, role, contact details, small navy logo in a corner, one thin gold rule. Landscape 85x55mm proportions.

13. BRAND RULES (navy band, closing)
    - Pearl White title "Brand Rules". Two columns — "Do" (navy base + one gold accent; correct logo per background; generous space; bilingual + alt text) and "Don't" (multiple golds; recolor/distort logo; change the gold bars; gold text on light; cluttered, hype-heavy layouts). Footer: small white/silver logo + "buildingsuit" + "Brand Board v1.0 — Confidential".

Keep everything aligned to the grid, with consistent spacing and one coherent premium navy-and-gold identity. Do not invent new colors, restyle the logo, or add unneeded visuals.
```

---

## Source mapping (what feeds each section)
| Section | Source documents |
|---|---|
| Cover | `02-logo-system/`, `03-visual-identity/01_COLOR_SYSTEM.md`, `01-strategy/` (tagline) |
| Brand essence | `01-strategy/01_BRAND_FOUNDATION.md` + personality |
| Dark/light logos · Logo system | `02-logo-system/01–05`, `assets/logos/` |
| Color palette | `03-visual-identity/01_COLOR_SYSTEM.md`, `07-design-tokens/` |
| English & Arabic typography | `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md` |
| UI components | `04-ui-system/`, `03-visual-identity/04_LAYOUT_AND_SPACING.md` |
| App icon · Splash | `02-logo-system/05_APP_ICON_GUIDE.md`, `04-ui-system/` |
| Social · Website hero · Business card | `05-marketing/01–03` |
| Brand rules | `02-logo-system/04_LOGO_DOS_AND_DONTS.md`, `05-marketing/` do/don't tables |
