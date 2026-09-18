# Claude Design — Refinement Prompts

> **Status:** Complete (initial). Section-by-section refinement prompts to improve the generated Claude Design output **without regenerating the whole document**. Paste only the relevant block, scoped to the page/section you're fixing. All refinements must keep the rules in `00_CLAUDE_DESIGN_SOURCE_PACK.md` intact.
>
> **Always-true constraints:** uploaded logos used exactly (no redesign/recolor/distort/rotate/stretch, never change the gold bars); one gold accent per section/page; primary action Navy on light / Gold on dark; only approved tokens; Manrope + IBM Plex Sans Arabic.

---

## Cover
- "Keep only the UPLOADED white/silver logo on the cover, centered, with ≥1X clear space — do not restyle or recolor it."
- "Apply the Navy → Deep Structure Navy gradient with a *subtle* window-grid motif and a *faint* gold glow; keep it calm, not busy."
- "Set the title 'Brand Guidelines' in Manrope ExtraBold, Pearl White; tagline 'Clarity you can trust.' below in muted Sky Steel."
- "Reduce cover clutter to one focal point (the logo) and protect generous negative space."

## Logo system
- "Replace any altered logo with the uploaded PNG exactly; restore the correct variant — navy logo on light, white/silver on navy."
- "Add a clear-space diagram with a 1X dashed boundary (X = building-B height) around the mark."
- "Do not change the gold bars/windows or add shadows, outlines, or effects to the logo."
- "Show the app-icon mark as the building-B only — not the full tall lockup squeezed into a square."

## Color palette
- "Make swatches larger and uniform; label each with name + exact HEX in Manrope Medium, Graphite on white."
- "Use only approved tokens; remove any invented colors and snap values to the exact HEX list."
- "Keep exactly one gold accent in this section; convert extra golds to navy or neutral."
- "Add the gold ramp (#A86C1C → #F4CE86) and the navy/gold gradients as a separate row; add the semantic chips row."

## Typography
- "Align the type scale so sizes step cleanly: Display 32/40, H1 26/34, H2 22/30, H3 18/26, Body L 16/24, Body M 14/22, Caption 12/18, Button 15/20 — label each row."
- "Set all Latin text in Manrope; limit to weights 400/500/600/700/800; max 2–3 weights on the page."
- "Keep 'Building Suit' in Latin in every lockup, even Arabic ones."

## Arabic RTL
- "Mirror all Arabic samples to RTL, right-aligned, in IBM Plex Sans Arabic; remove any caps or letter-tracking."
- "Increase Arabic line-height ~10–15% over the Latin equivalent for comfortable reading."
- "Mirror layout *placement* for RTL (logo, alignment) but never mirror the logo artwork."
- "Ensure the Arabic typography page mirrors the English scale exactly, just RTL."

## UI components
- "Make the primary button Navy on light surfaces and Gold on dark surfaces; never gold text on white."
- "Give inputs a single gold focus ring; keep one gold focus per view."
- "Show status as color + icon + label (paid=green, overdue=red, pending=amber) — never color alone."
- "Apply correct radii (buttons 12, cards 16, chips 8) and the soft navy-tinted shadow ladder."

## App icon
- "Use the uploaded building-B mark on a navy rounded-square icon with the gold windows lit; do not redraw the mark."
- "Show a clean size grid (1024, 180, 120, 60) with the mark legible at every size."
- "Keep the icon background a solid navy (or navy gradient) — no busy patterns behind the mark."

## Marketing pages
- "Keep each marketing preview to one gold accent and one focal point; protect negative space."
- "Use the correct logo variant per background (white/silver on navy hero, navy on light card)."
- "Add the bilingual note (English + Arabic RTL) and an alt-text reminder where text sits on imagery."
- "On the website hero, use a gold primary CTA on the navy background; on light marketing surfaces, primary stays navy."

## PDF consistency
- "Make the header and footer identical on every page; fix any drift in title position, page numbers, or footer text ('Building Suit — Brand Guidelines v1.0 — Confidential')."
- "Enforce one gold accent per page; convert extra golds to navy/neutral."
- "Keep the navy/light page alternation rhythm consistent; verify margins (96px) and grid alignment on every page."
- "Reduce text density: one takeaway per page, supported by visuals, with generous whitespace."

## Export readiness
- "Confirm every page is exactly 1920 × 1080 px and in the correct order (01 → 27)."
- "Ensure all embedded logo/screens are sharp at 100%; replace any soft/pixelated placements with crisp ones."
- "Verify no page invents assets beyond the page list; remove anything not required."
- "Confirm fonts render as Manrope / IBM Plex Sans Arabic with no substitution before export to PDF."
