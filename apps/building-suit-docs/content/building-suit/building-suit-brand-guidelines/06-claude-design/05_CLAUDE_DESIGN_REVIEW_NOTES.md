# Claude Design — Review Notes

> **Status:** Completed — Round 1 reviewed and approved. Log for each round of Claude Design output (Brand Identity Board and/or Brand Guidelines PDF). Issues are logged here, then turned into scoped fixes using `03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`.
>
> **Reviewed artifact:** Brand Guidelines PDF (`exports/brand-guidelines.pdf`) + Brand Identity Board (`exports/brand-identity-board.pdf`)
> **Version:** v1.0  **Reviewer:** Tareq Abdelwhap  **Date:** 2026-06-19

---

## First draft review
_Overall impression: premium, calm, transparent, and on-brand. Navy-and-gold identity reads consistently; one-gold-accent discipline holds across pages. Tokens, type scale, and logo handling match the source documents._

| # | Page / section | Observation | Severity (low/med/high) | Action |
|---|---|---|---|---|
| 1 | Guidelines PDF (overall) | All 27 pages present and in order; headers/footers consistent; no placeholder text | low | Approve |
| 2 | Brand Identity Board | Exported as **6 pages**, while the board prompt specifies a single tall portrait poster | low | Accepted for v1.0 — multi-page board is acceptable; revisit as a single-page poster in a future revision if a one-sheet is needed |
| 3 | Tokens / color pages | HEX values match `07-design-tokens/` (verified across all four token files) | low | Approve |

---

## Visual issues
_Layout, spacing, grid, hierarchy, negative space, alignment, one-focal-point._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | — | None blocking; spacing and grid consistent | — |

---

## Copy issues
_Wording, tagline accuracy ("Clarity you can trust."), tone, typos, bilingual parity._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | — | Tagline reads correctly; no typos found | — |

---

## Logo issues
_Correct variant per background, ≥1X clear space, gold bars unchanged, no redesign/distort/rotate/stretch/effects, app-icon = building-B only._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | — | Uploaded logos used exactly; correct variant per background; gold windows unchanged | — |

---

## Color issues
_Approved tokens only, exact HEX, one gold accent per page, primary Navy-on-light / Gold-on-dark, no gold text on light, semantic-for-status-only, AA contrast._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | — | Approved tokens only; one gold accent per page; primary flips correctly by mode | — |

---

## Typography issues
_Manrope (Latin) + IBM Plex Sans Arabic (Arabic), correct scale and weights, "Building Suit" in Latin, no tiny/dense text._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | PNG previews (`exports/typography-system.png`) | Rendered with Liberation Sans stand-in (Manrope not installed on the build machine); spec font names are labeled | Optional: install Manrope + IBM Plex Sans Arabic and regenerate PNGs for pixel-accurate type |

---

## Arabic issues
_RTL, right-aligned, no caps/tracking, +10–15% line-height, mirrored placement (not artwork), parity with English._

| # | Page / section | Issue | Fix |
|---|---|---|---|
| 1 | PNG previews | Arabic intentionally shown as a labeled note (PIL can't shape Arabic without the font) | Render Arabic samples in Claude Design / a shaping-capable tool when Manrope/IBM Plex are available |

---

## Final approval notes
_Sign-off once all issues are resolved and the export checklist passes._

- [x] All logged issues resolved or accepted (board page-count accepted for v1.0).
- [x] `04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` requirements met (all 11 deliverables present and verified).
- [x] PDF reviewed (27 pages, valid).
- [x] Bilingual (EN + AR RTL) parity confirmed in the source documents and PDF.

**Outstanding items (non-blocking):**
- Single-page poster version of the Brand Board (optional future revision).
- Regenerate typography/Arabic PNGs once Manrope + IBM Plex Sans Arabic are installed.
- Vector/SVG logo master + flat single-color companion mark still requested from the designer (see `assets/logos/logo-source-notes.md`).

**Approved by:** Tareq Abdelwhap  **Date:** 2026-06-19
**Notes:** Brand Guidelines v1.0 approved for use. The identity is frozen as the reference for downstream work (app UI screens, marketing). Future changes go through a new review round in this log.
