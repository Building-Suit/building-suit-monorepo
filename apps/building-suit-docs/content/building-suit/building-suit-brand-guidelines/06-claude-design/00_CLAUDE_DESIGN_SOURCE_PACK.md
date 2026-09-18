# Claude Design — Source Pack

> **Status:** Complete (initial). The single condensed reference that **Claude Design** consumes to produce the visual **Brand Identity Board** and the visual **Brand Guidelines PDF**. Everything here is distilled from the approved documents in `01-strategy/`, `02-logo-system/`, `03-visual-identity/`, `04-ui-system/`, `05-marketing/`, `07-design-tokens/`. The markdown in this repository remains the source of truth; Claude Design consumes it and stays in sync.
>
> **Division of responsibility**
> - **Claude Design** → creates the visual artifacts (Brand Identity Board, Brand Guidelines PDF).
> - **Claude Coworker** → owns files, text, rules, tokens, checklists, and review notes.

---

## Brand name
**Building Suit** — always written in Latin script, in both English and Arabic contexts. Never translated, never transliterated.

---

## Brand purpose
A mobile-first, transparent operating system for **self-managed residential buildings**. It replaces fragmented coordination (messaging apps, paper records, informal cash handling, spreadsheets) with one unit-centered system for building finance, membership, issues, announcements, governance, and service-provider discovery. It is the first active portal in a wider hub-and-spoke ecosystem (future Shop / Business / City Suit on a shared core).

**Tagline:** *Clarity you can trust.*

---

## Brand personality
Five core traits: **Clear · Honest · Calm · Premium · Dependable.**
- Voice: clear, warm, confident — no hype, no jargon.
- Feeling: transparent, trustworthy, structured, premium-but-approachable.

---

## Approved logo files
Use the **uploaded files exactly as provided**. Do **not** redesign, recolor, distort, rotate, stretch, or alter the gold bars/windows.

| File | The logo's own color | Use on |
|---|---|---|
| `assets/logos/building-suit-logo-dark.png` | navy logo | **light** backgrounds |
| `assets/logos/building-suit-logo-light.png` | white/silver logo | **dark / navy** backgrounds |

The app-icon mark is the **building-B** symbol only (with lit gold windows), derived from the same artwork — not a redraw.

---

## Logo usage summary
- **Variant by background:** navy logo on light; white/silver logo on navy. Never light-on-light or dark-on-dark.
- **Clear space:** ≥ **1X** around the logo, where `X` = the building-B mark height (or 25% of the logo's total height).
- **Minimum size:** keep the gold windows legible; don't go so small they muddy.
- **Never:** recolor, change the gold bars, distort/stretch, rotate, add shadows/effects/outlines, or place on a busy/low-contrast background.
- **RTL:** mirror *placement* (e.g. header logo moves to the right), **never** mirror the artwork itself.

---

## Color palette summary
**Brand core**
| Name | HEX |
|---|---|
| Building Navy | `#16293B` |
| Deep Structure Navy | `#0D1B28` |
| Premium Gold | `#D89B42` |
| Highlight Gold | `#EBB45A` |
| Pearl White | `#F7F8FA` |
| Soft Silver | `#E2E5EA` |
| Cloud Gray | `#CBD2DB` |
| Graphite Text | `#232B33` |

**Dark surfaces:** Midnight `#0A111A`, Navy Surface `#14233A`, Navy Surface Raised `#1B2E47`, Steel Border `#2E3F52`.
**Secondary blues:** Slate Blue `#36506E`, Sky Steel `#7E97B3`, Pale Sky `#DCE6F1`. **Neutrals:** Slate Gray `#5A6573`, Steel Gray `#9AA6B4`.
**Gold ramp:** `#A86C1C · #C8902F · #D89B42 · #EBB45A · #F4CE86`. **Gold gradient:** `135deg #EBB45A → #D89B42 → #A86C1C`. **Navy gradient:** `#16293B → #0D1B28`.
**Semantic:** Success `#2E9E6B` (bg `#E4F4EC`), Warning `#E1841F` (bg `#FBEEDD`), Error `#D14B4B` (bg `#F8E3E3`), Info `#2F77C9` (bg `#DCE6F1`).

**Key color rules**
- **One gold accent** per board section / per page.
- **Primary action flips by mode:** Navy on light, Gold on dark.
- **Never gold for small text/icons on light** (≈2.5:1, fails AA).
- Semantic colors only for true status (paid=green, overdue=red, pending=amber), never decoration.

---

## Typography summary
- **Latin:** Manrope (weights 400/500/600/700/800). Fallback Inter.
- **Arabic:** IBM Plex Sans Arabic (RTL). Fallbacks Cairo / Tajawal.
- **Scale (mobile base):** Display 32/40 (800) · H1 26/34 (700) · H2 22/30 (700) · H3 18/26 (600) · Body L 16/24 · Body M 14/22 · Caption 12/18 (500) · Overline 11/16 (600) · Button 15/20 (600).
- Arabic line-height runs **+10–15%** over Latin; **no caps/tracking** on Arabic; right-aligned, RTL.
- Keep **"Building Suit" in Latin** in every bilingual lockup.

---

## Visual language summary
- **Window-grid motif:** a subtle lit-building grid (echoing the logo's gold windows) — used on cover, splash, and hero backgrounds only.
- **Gradients:** navy → deep-navy for depth; gold gradient for special hero moments.
- **Iconography:** use only the free **[Hugeicons](https://hugeicons.com/) Stroke Rounded** library; do not use Solid, Duotone, Twotone, Bulk, or other paid styles; flat, **2px outline**, consistent stroke and size; neutral by default, gold only for the one emphasized icon; do not mix other icon libraries.
- **Imagery:** lit buildings / community, graded toward the navy-and-gold palette; navy scrim behind text on photos.
- **Spacing:** 8px system (4, 8, 12, 16, 24, 32, 48, 64, 96). **Radius:** chips 8, buttons/inputs 12, cards 16, modals 24. **Shadows (navy-tinted):** `0 2px 8px rgba(13,27,40,.08)` / `0 4px 16px rgba(13,27,40,.12)` / `0 8px 24px rgba(13,27,40,.16)`.

---

## UI style summary
- **Default theme: light.** Background Pearl White, white cards with soft navy-tinted shadows, Graphite text.
- **Dark mode:** Midnight background, Navy Surface cards, Pearl White text, Sky Steel muted text.
- **Primary action:** Navy button on light, Gold button on dark. One gold focus per view.
- **Status:** color + icon + label (never color alone). Bottom nav active = Stroke Rounded icon + Gold + label/indicator.
- Components: buttons (primary/secondary/ghost), inputs with gold focus ring, chips, status badges, cards with balance figures, modals/bottom sheets over a navy scrim.

---

## Marketing style summary
- **Social:** navy base, one gold accent, app-icon mark for avatars, full logo for covers; templates per series; bilingual + alt text.
- **Website hero:** navy gradient + window-grid + faint gold glow; light/silver logo; benefit-led headline with one gold accent word; gold primary CTA; phone mockup with a real on-brand screen.
- **Business card:** front = navy with centered white/silver logo + tagline; back = pearl/white with contact details, small navy logo, one thin gold rule; 85×55mm landscape.
- **Presentation:** 16:9, premium and calm, one idea per slide, one gold accent per slide, navy/light alternation, consistent footer.

---

## Required PDF pages
The **Brand Guidelines PDF** (see `02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`) must contain these pages, in order:
1. Cover
2. Table of contents
3. Brand introduction
4. Mission, vision, promise
5. Brand personality
6. Target audience
7. Logo system
8. Logo usage
9. Logo clear space
10. Logo do / don't rules
11. App icon guide
12. Color system
13. Typography — English
14. Typography — Arabic
15. Visual language
16. Layout and spacing
17. Iconography
18. UI system
19. Components
20. Dark mode
21. Light mode
22. Social media
23. Website hero
24. Business card
25. Presentation style
26. Developer tokens
27. Final checklist

---

## Required exports
Saved under `exports/` (see `04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` for full detail):
- **PDF:** `Building-Suit-Brand-Guidelines-v1.0.pdf` (all pages, in order).
- **PDF (optional):** `Building-Suit-Brand-Board-v1.0.pdf` (single-page board).
- **PNG:** Brand Board `@2x`; one PNG per guidelines page; key previews (app icon set, splash, social, website hero, business card front/back).
- **Source assets:** the two uploaded logo PNGs re-referenced exactly (not redrawn).

---

## Rules Claude Design must follow
1. **Use the uploaded logos exactly** — never redesign, recolor, distort, rotate, stretch, or change the gold bars/windows.
2. **Correct logo variant per background** — navy logo on light, white/silver on navy; maintain ≥1X clear space.
3. **One gold accent** per board section / per page.
4. **Primary action flips by mode** — Navy on light, Gold on dark; never gold for small text on light.
5. **Use only approved tokens** — exact HEX, the 8px spacing system, the defined radii and shadows. Invent no new colors.
6. **Typography fixed** — Manrope (Latin) + IBM Plex Sans Arabic (RTL); follow the scale; keep "Building Suit" in Latin.
7. **Bilingual parity** — Arabic is RTL, right-aligned, no caps/tracking; mirror placement, never artwork.
8. **Accessibility** — meet WCAG AA (4.5:1 text / 3:1 large + UI); status = color + icon + label.
9. **Premium restraint** — generous negative space, one focal point per frame; calm, structured, never cluttered or hype-heavy.
10. **Do not invent visual assets that aren't needed** — only produce what these prompts and the page list call for.
