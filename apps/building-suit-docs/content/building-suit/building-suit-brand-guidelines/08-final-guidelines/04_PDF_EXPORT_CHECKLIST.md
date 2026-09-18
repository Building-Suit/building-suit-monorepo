# PDF Export Checklist

> **Status:** Complete (initial). The final pre-flight and export checklist for the **Building Suit Brand Guidelines PDF** and its companion exports. Run this top to bottom before declaring the guidelines "done." Source of truth: `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`, `03-visual-identity/`, `04-ui-system/`, `05-marketing/`, `07-design-tokens/`.
>
> **Visual production:** **Claude Design** builds the visual board and guidelines PDF. **Claude Coworker** owns files, text, rules, tokens, checklists, and review notes.
>
> **Logo rule:** uploaded logos are used **exactly** — never redesigned, recolored, distorted, rotated, stretched, and the gold bars/windows never change.

---

## 1. Required source files
- [ ] `08-final-guidelines/01_BRAND_GUIDELINES_STRUCTURE.md` — table of contents / section mapping, final.
- [ ] `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` — consolidated, reviewed document, final.
- [ ] `08-final-guidelines/03_BRAND_GUIDELINES_PDF_COPY.md` — print/PDF-optimized copy (cover, page breaks, dividers), final.
- [ ] `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md` — brand reference used to drive the visuals.
- [ ] `06-claude-design/01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md` and `02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md` — generation prompts.
- [ ] `assets/logos/building-suit-logo-dark.png` (navy logo) and `building-suit-logo-light.png` (white/silver logo) — uploaded masters, present and unaltered.
- [ ] `07-design-tokens/` — `design-tokens.json` (source of truth) + `colors.css`, `tailwind.colors.js`, `flutter_colors.dart`, in sync.
- [ ] All upstream sections (`01`–`05`) complete and consistent (no contradictions with strategy).

---

## 2. Required Claude Design frames
The Brand Guidelines PDF is built from **27 page-frames** (1920 × 1080 px, 16:9), in order. Confirm all are present and named `BS / Guidelines / NN — <Page Name>`:
- [ ] 01 Cover · 02 Table of contents · 03 Brand introduction
- [ ] 04 Mission, vision, promise · 05 Brand personality · 06 Target audience
- [ ] 07 Logo system · 08 Logo usage · 09 Logo clear space · 10 Logo do/don't rules · 11 App icon guide
- [ ] 12 Color system · 13 Typography English · 14 Typography Arabic
- [ ] 15 Visual language · 16 Layout and spacing · 17 Iconography
- [ ] 18 UI system · 19 Components · 20 Dark mode · 21 Light mode
- [ ] 22 Social media · 23 Website hero · 24 Business card · 25 Presentation style
- [ ] 26 Developer tokens · 27 Final checklist
- [ ] Brand Identity Board frame present (`BS / Brand Board`, 1920 × 3240 px, all 13 sections).
- [ ] Every frame on the 12-column grid with consistent master header/footer.

---

## 3. Required exported visuals
Saved under `exports/` (PNGs at 2x; transparent for marks, opaque for composed scenes):
- [ ] `exports/brand-guidelines.pdf` — full 27-page PDF.
- [ ] `exports/brand-identity-board.pdf` — single-page board.
- [ ] `exports/logo-system.png`
- [ ] `exports/color-palette.png`
- [ ] `exports/typography-system.png`
- [ ] `exports/ui-components.png`
- [ ] `exports/app-icon-preview.png`
- [ ] (Optional) per-page PNGs and marketing previews (splash, social, website hero, business card front/back).

---

## 4. Logo quality checklist
- [ ] Uploaded logo PNGs used exactly — no redesign, recolor, distort, rotate, stretch, or effects.
- [ ] **Gold bars/windows unchanged** in color and shape.
- [ ] Correct variant per background: **navy logo on light**, **white/silver logo on navy**.
- [ ] Clear space ≥ **1X** on every placement (X = building-B height or 25% of total height).
- [ ] Minimum sizes respected; gold windows remain legible.
- [ ] App-icon uses the building-B mark only (not the full tall lockup).
- [ ] No light-on-light or dark-on-dark; never on busy/low-contrast backgrounds.
- [ ] Logo crisp at export scale (flag a vector master for any print-critical use).

---

## 5. Color consistency checklist
- [ ] Only approved tokens; exact HEX — Navy `#16293B`, Deep Navy `#0D1B28`, Gold `#D89B42`, Highlight Gold `#EBB45A`, Pearl `#F7F8FA`, Soft Silver `#E2E5EA`, Cloud Gray `#CBD2DB`, Graphite `#232B33`.
- [ ] **One gold accent** per page / per board section.
- [ ] Primary action correct per mode: **Navy on light, Gold on dark**.
- [ ] **No gold for small text/icons on light** (~2.5:1 fails AA).
- [ ] Semantic colors only for real status (paid=green, overdue=red, pending=amber); never decoration.
- [ ] Contrast meets **WCAG AA** (4.5:1 text / 3:1 large + UI); status = color + icon + label.
- [ ] No off-brand or invented colors anywhere; PNGs/PDF match `design-tokens.json`.

---

## 6. Typography checklist
- [ ] Latin in **Manrope**; Arabic in **IBM Plex Sans Arabic** (fallbacks only if unavailable).
- [ ] Scale matches: Display 32/40 (800), H1 26/34 (700), H2 22/30 (700), H3 18/26 (600), Body L 16/24, Body M 14/22, Caption 12/18 (500), Overline 11/16 (600), Button 15/20 (600).
- [ ] Weights limited to 400/500/600/700/800; ≤3 weights per surface.
- [ ] Product name **"Building Suit" in Latin** in all bilingual contexts.
- [ ] No tiny/illegible text; no dense paragraphs on hero/marketing pages.
- [ ] Fonts embedded or outlined in the PDF (no substitution).

---

## 7. Arabic RTL checklist
- [ ] Arabic is **RTL, right-aligned**, IBM Plex Sans Arabic.
- [ ] **No caps/tracking** on Arabic.
- [ ] Arabic line-height **+10–15%** over Latin.
- [ ] Layout **placement mirrored** for RTL (logo, alignment) — **artwork never mirrored**.
- [ ] Typography Arabic page mirrors the English scale exactly.
- [ ] Bilingual parity: English content has its Arabic counterpart where required.

---

## 8. UI components checklist
- [ ] Component kit present: primary button (navy on light / gold on dark), secondary/ghost, input with gold focus ring, chip, status badges, dashboard card with a balance figure, bottom-nav (active = Stroke Rounded + Gold + label/indicator).
- [ ] Correct radii (chips 8, buttons/inputs 12, cards 16, modals 24) and the navy-tinted shadow ladder (`0 2px 8px` / `0 4px 16px` / `0 8px 24px rgba(13,27,40,…)`).
- [ ] One gold focus per view; status = color + icon + label.
- [ ] **Dark mode** page (Midnight bg, Navy Surface cards, Pearl White text, Gold primary) and **Light mode** page (Pearl White bg, white cards, Graphite text, Navy primary) both shown.
- [ ] Components match the UI system docs and `design-tokens.json`.

---

## 9. Marketing examples checklist
- [ ] Social previews: Instagram square, Story 9:16 (central safe zone), LinkedIn square — navy base, one gold accent each.
- [ ] Website hero: navy gradient + window-grid + faint gold glow, white/silver logo, benefit-led headline with one gold accent word, gold primary CTA, phone mockup with a real on-brand screen.
- [ ] Business card: front (navy, centered white/silver logo + tagline) and back (pearl/white, contact details, small navy logo, one thin gold rule); 85×55mm landscape.
- [ ] Presentation style: 16:9 master sample (cover + content), one idea per slide, one gold accent, consistent footer, navy-primary chart series with gold for the key series.
- [ ] Bilingual parity (EN + AR RTL) and alt-text reminder where text sits on imagery.

---

## 10. PDF export settings
- [ ] Page dimensions **1920 × 1080 px (16:9)**; consistent across all pages.
- [ ] Pages in correct order (01 → 27); no blank/orphan/duplicate pages.
- [ ] Fonts **embedded or outlined**; no font-substitution warnings.
- [ ] Vectors kept as vectors (text/shapes); raster images sharp at 100% (2x sources).
- [ ] Color profile **sRGB** for the screen PDF; supply **CMYK/Pantone** separately for print pieces (business-card gold).
- [ ] Sensible compression — high image quality, reasonable file size.
- [ ] Header/footer, version ("v1.0"), and "Confidential" consistent on every page.
- [ ] Bookmarks/outline match the table of contents (optional but recommended).

---

## 11. Final review checklist
- [ ] Content matches the approved markdown (no stale/placeholder text).
- [ ] Spell-check EN + AR; tagline reads exactly **"Clarity you can trust."**
- [ ] One takeaway per page; generous negative space; premium, calm, consistent navy-and-gold identity.
- [ ] All checklists above (logo, color, typography, Arabic RTL, UI, marketing) pass.
- [ ] Review log completed in `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md`.
- [ ] Opened the exported PDF in a fresh viewer to confirm rendering before handoff.
- [ ] No invented/unneeded visual assets included.
- [ ] Stakeholder approval recorded.

---

## 12. File naming rules
- [ ] All lowercase, hyphen-separated; no spaces or special characters.
- [ ] PDFs: `brand-guidelines.pdf`, `brand-identity-board.pdf`.
- [ ] PNGs: descriptive name + `.png` (e.g. `logo-system.png`, `color-palette.png`); use `@2x` suffix for higher-res variants if both are kept.
- [ ] App-icon sizes encode the pixel size: `app-icon-1024.png`, `app-icon-180.png`, etc.
- [ ] Versioned masters (if archived) append `-vX.Y` (e.g. `brand-guidelines-v1.0.pdf`); the canonical delivery filenames in §13 stay unversioned.
- [ ] All deliverables saved under `exports/` (tokens stay in `07-design-tokens/`).

---

## 13. Final deliverables list
The project is "done" when all of the following exist, pass the checklists above, and are approved:

**Visual exports (`exports/`)**
- [ ] `exports/brand-guidelines.pdf`
- [ ] `exports/brand-identity-board.pdf`
- [ ] `exports/logo-system.png`
- [ ] `exports/color-palette.png`
- [ ] `exports/typography-system.png`
- [ ] `exports/ui-components.png`
- [ ] `exports/app-icon-preview.png`

**Developer tokens (`07-design-tokens/`)**
- [ ] `07-design-tokens/colors.css`
- [ ] `07-design-tokens/tailwind.colors.js`
- [ ] `07-design-tokens/flutter_colors.dart`
- [ ] `07-design-tokens/design-tokens.json`
