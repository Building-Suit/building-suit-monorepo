# Claude Design — Export Checklist

> **Status:** Complete (initial). Pre-flight and export checklist for the Claude Design outputs (Brand Identity Board + Brand Guidelines PDF). Run before exporting and before handoff. Save all exports under `exports/`. Source of truth: `00_CLAUDE_DESIGN_SOURCE_PACK.md` and the approved documents it references.
>
> **Logo rule reminder:** the uploaded logos are used **exactly** — never redesigned, recolored, distorted, rotated, stretched, and the gold bars/windows never change.

---

## 1. Required PDF exports
- [ ] **`Building-Suit-Brand-Guidelines-v1.0.pdf`** — all **27 pages** in order (01 Cover → 27 Final Checklist), saved to `exports/pdf/`.
- [ ] **`Building-Suit-Brand-Board-v1.0.pdf`** (optional) — single-page Brand Board, saved to `exports/pdf/`.
- [ ] Page size consistent (1920 × 1080 / 16:9) across all guideline pages; no blank/orphan pages.
- [ ] Pages in correct order with no duplicates or gaps.

---

## 2. Required PNG exports
Export at **2x**; transparent where the asset is a mark, opaque for composed scenes. Save to `exports/png/`.
- [ ] `brand-board@2x.png` — full Brand Board.
- [ ] One PNG per guidelines page: `guidelines-01-cover@2x.png` … `guidelines-27-final-checklist@2x.png`.
- [ ] `app-icon-1024.png`, `app-icon-180.png`, `app-icon-120.png`, `app-icon-60.png`.
- [ ] `splash@2x.png`.
- [ ] `social-instagram@2x.png` (1080×1080), `social-story@2x.png` (1080×1920), `social-linkedin@2x.png`.
- [ ] `website-hero@2x.png`.
- [ ] `business-card-front@2x.png`, `business-card-back@2x.png`.
- [ ] `color-palette@2x.png` (optional quick-reference sheet).

---

## 3. Required source assets
- [ ] The two **uploaded logo PNGs** referenced exactly (not redrawn): `assets/logos/building-suit-logo-dark.png`, `assets/logos/building-suit-logo-light.png`.
- [ ] App-icon mark derived from the same artwork (building-B only) — not a redesign.
- [ ] No invented/extra visual assets beyond what the page list requires.
- [ ] (Flag, not blocker) request a **vector master** for any print-critical placement — raster PNG is not ideal at large/print scale.

---

## 4. Logo quality checklist
- [ ] Used the uploaded logo PNGs exactly — no redesign, recolor, distort, rotate, stretch, or effects.
- [ ] **Gold bars/windows unchanged** in color and shape.
- [ ] Correct variant per background: **navy logo on light**, **white/silver logo on navy**.
- [ ] Clear space ≥ **1X** on every placement.
- [ ] Minimum sizes respected; gold windows still legible.
- [ ] App-icon uses the building-B mark only.
- [ ] No light logo on light, no dark logo on dark; never placed on busy/low-contrast backgrounds.
- [ ] Logo edges crisp at export scale.

---

## 5. Color consistency checklist
- [ ] Only approved tokens used; exact HEX (Navy `#16293B`, Deep Navy `#0D1B28`, Gold `#D89B42`, Highlight Gold `#EBB45A`, Pearl `#F7F8FA`, Soft Silver `#E2E5EA`, Cloud Gray `#CBD2DB`, Graphite `#232B33`).
- [ ] **One gold accent** per board section / per page.
- [ ] Primary action correct per mode: **Navy on light, Gold on dark**.
- [ ] **No gold for small text/icons on light** (~2.5:1 fails AA).
- [ ] Semantic colors only for real status; status = color + icon + label.
- [ ] Contrast meets **WCAG AA** (4.5:1 text / 3:1 large + UI).
- [ ] No off-brand or invented colors anywhere.

---

## 6. Typography checklist
- [ ] Latin in **Manrope**; Arabic in **IBM Plex Sans Arabic** (fallbacks only if unavailable).
- [ ] Scale matches: Display 32/40 (800), H1 26/34 (700), H2 22/30 (700), H3 18/26 (600), Body L 16/24, Body M 14/22, Caption 12/18 (500), Overline 11/16 (600), Button 15/20 (600).
- [ ] Weights limited to 400/500/600/700/800; ≤3 weights per surface.
- [ ] Product name **"Building Suit" in Latin** in all bilingual contexts.
- [ ] No tiny/illegible text; no dense paragraphs on hero/marketing pages.

---

## 7. Arabic RTL checklist
- [ ] Arabic is **RTL, right-aligned**, IBM Plex Sans Arabic.
- [ ] **No caps/tracking** on Arabic.
- [ ] Arabic line-height **+10–15%** over Latin.
- [ ] Layout **placement mirrored** for RTL (logo, alignment) — **artwork never mirrored**.
- [ ] Arabic typography page mirrors the English scale exactly.
- [ ] Bilingual parity: anything shown in English has an Arabic counterpart where required.

---

## 8. PDF export settings
- [ ] Page dimensions 1920 × 1080 px (16:9); consistent across all pages.
- [ ] Fonts **embedded or outlined**; no font-substitution warnings.
- [ ] Vectors kept as vectors (text/shapes); raster images sharp at 100% (2x sources).
- [ ] Color profile **sRGB** for the screen PDF; supply **CMYK/Pantone** separately for print pieces (e.g. business card gold).
- [ ] Sensible compression — high image quality, reasonable file size.
- [ ] Header/footer, version ("v1.0"), and "Confidential" consistent on every page.
- [ ] File named `Building-Suit-Brand-Guidelines-v1.0.pdf`, saved to `exports/pdf/`.

---

## 9. Final deliverables checklist
- [ ] `Building-Suit-Brand-Guidelines-v1.0.pdf` (27 pages, in order) in `exports/pdf/`.
- [ ] Brand Board PDF and/or `brand-board@2x.png` in `exports/`.
- [ ] All required PNG exports present in `exports/png/`.
- [ ] All checklists above (logo, color, typography, Arabic RTL, PDF settings) pass.
- [ ] Spell-check EN + AR; tagline reads exactly "Clarity you can trust."
- [ ] Review log completed in `05_CLAUDE_DESIGN_REVIEW_NOTES.md`.
- [ ] Final visual pass: premium, calm, consistent navy-and-gold identity; no unneeded assets.
- [ ] Opened the exported PDF in a fresh viewer to confirm rendering before handoff.
- [ ] Stakeholder approval recorded.
