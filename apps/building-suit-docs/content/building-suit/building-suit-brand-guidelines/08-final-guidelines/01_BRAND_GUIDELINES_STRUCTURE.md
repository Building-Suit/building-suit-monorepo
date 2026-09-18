# Building Suit Brand Guidelines — Final PDF Structure

> **Status:** Final structure for production
> **Document:** Building Suit Brand Guidelines v1.0
> **Master format:** 30 pages, 16:9 landscape, 1920 × 1080 px
> **Primary output:** `exports/pdf/Building-Suit-Brand-Guidelines-v1.0.pdf`
> **Brand promise:** **Clarity you can trust.**

This document is the production blueprint for the final Building Suit Brand Guidelines PDF. It defines the complete page order, required content, visual direction, source mapping, and implementation handoff. It is not the final prose document or the exported PDF; those are produced next in `02_BRAND_GUIDELINES_FULL_DOCUMENT.md`, `03_BRAND_GUIDELINES_PDF_COPY.md`, and `04_PDF_EXPORT_CHECKLIST.md`.

---

## 1. Source governance

### Canonical content order

When sources overlap, use this precedence:

1. Strategy, logo, visual identity, UI, and marketing documents in sections `01`–`05`.
2. `07-design-tokens/design-tokens.json` for machine-readable values.
3. The condensed Claude Design source pack and prompts in section `06`.
4. Project setup documents and downstream placeholders in sections `00` and `08`.

### Resolved production decisions

- **Page count:** this final edition uses the 30-page sequence in this document. It supersedes the earlier 27-page condensed prompt.
- **Master format:** use the screen-first 1920 × 1080 px, 16:9 landscape format defined by the Claude Design production and export documents. An A4 portrait adaptation may be created later, but it is not the master.
- **Logo clear-space unit:** `X` is the height of one gold window pane in the logo. Use `1X` minimum on every side and `1.5X–2X` for hero use. If the pane cannot be measured, use 25% of total logo height as the documented fallback. Do not define `X` as the entire mark height.
- **Brand personality:** the primary five traits are **Trustworthy, Clear, Organised, Warm, Premium**. Honest, calm, and dependable are supporting behaviours, not a competing trait set.
- **Audience hierarchy:** administrators and residents are primary. Owners and platform stakeholders are secondary. Service providers are Future/Post-MVP only.
- **Token authority:** `07-design-tokens/design-tokens.json` is the canonical token file. CSS, Tailwind, and Flutter outputs must stay synchronized with it.
- **Logo asset limitation:** the approved masters are raster PNG files. The vector master and flat/monochrome companion mark remain outstanding and must not be improvised.

---

## 2. PDF master system

### Canvas and grid

- Canvas: **1920 × 1080 px**, 16:9 landscape, one frame per page.
- Grid: **12 columns**, 96 px outer margins, 24 px gutters.
- Spacing: use only the approved scale: **4, 8, 12, 16, 24, 32, 48, 64, 96 px**.
- Optical rule: preserve generous negative space and one dominant focal point per page.
- Page frame naming: `BS / Guidelines / NN — Page Title`.

### Master header and footer

- Cover and final closing page may omit the standard header.
- Interior header: small gold section label, page title in Manrope Bold, thin divider.
- Interior footer: correct contrast logo, section name, page number, and `Building Suit — Brand Guidelines v1.0 — Confidential`.
- LTR pages anchor navigation to the left; Arabic demonstrations mirror placement to the right. The logo artwork is never mirrored.

### Color rhythm

- Navy pages: Building Navy `#16293B` to Deep Structure Navy `#0D1B28` gradient.
- Light pages: Pearl White `#F7F8FA` with White `#FFFFFF` surfaces.
- Use **one gold focal accent per page**. Multiple shades may appear together only when the page explicitly documents the gold ramp.
- Use semantic colors only for real status meaning.
- Use the navy logo on light pages and the white/silver logo on navy pages.

### Typography

- Latin: **Manrope**, weights 400/500/600/700/800; Inter is fallback only.
- Arabic: **IBM Plex Sans Arabic**; Cairo and Tajawal are fallbacks.
- Keep `Building Suit` in Latin script in all languages.
- Arabic is RTL, right-aligned, has no all-caps or tracking, and uses 10–15% more line height than equivalent Latin text.

### Editorial rhythm

- Foundation: pages 03–07.
- Identity: pages 08–19.
- Product experience: pages 20–23.
- Brand applications: pages 24–27.
- Voice, implementation, and governance: pages 28–30.
- Use dark pages at narrative turns, not as decoration. Light pages carry detailed rules and comparison content.

---

## 3. Page-by-page structure

## Page 01 — Cover

**Purpose**
Establish Building Suit as a premium, trustworthy, structured identity and make the approved logo the first focal point.

**Main content**

- Title: **Brand Guidelines**.
- Subtitle: **Building Suit — Visual Identity System**.
- Brand promise: **Clarity you can trust.**
- Version line: **Version 1.0 · Confidential**.
- No explanatory paragraph, navigation, or secondary message.

**Visual elements to include**

- Full-page navy-to-deep-navy gradient.
- Uploaded white/silver logo centered with `1.5X–2X` clear space.
- Low-contrast window-grid motif and one faint gold glow, derived from the lit-window idea.
- Restrained typography with ample empty space.

**Source files used**

- `01-strategy/01_BRAND_FOUNDATION.md`
- `02-logo-system/01_LOGO_ANALYSIS.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `03-visual-identity/01_COLOR_SYSTEM.md`
- `03-visual-identity/03_VISUAL_LANGUAGE.md`
- `06-claude-design/02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`

**Designer notes**

- Use `assets/logos/building-suit-logo-light.png` exactly as supplied.
- The logo is the only dominant object. Do not add a phone mockup, photograph, or decorative icon.
- Keep the gold effect subordinate to the logo's lit windows.

**Developer notes**

- No runtime implementation. Preserve the exact version and confidentiality text in export metadata and filename.

---

## Page 02 — Table of Contents

**Purpose**
Make the 30-page document easy to scan while previewing its five-part narrative.

**Main content**

- Title: **Contents**.
- Two-column numbered list covering pages 03–30.
- Group entries under Foundation, Identity, Product Experience, Applications, and Governance.
- Each entry contains page number, title, and a short descriptor of no more than eight words.

**Visual elements to include**

- Pearl White background with a strict two-column editorial grid.
- Gold section numbers; Graphite titles; Slate Gray descriptions.
- A thin window-grid strip or single vertical gold rule as the only decorative accent.

**Source files used**

- `README.md`
- `00-project/01_BRAND_GUIDELINES_WORKFLOW.md`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`
- `06-claude-design/02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`
- `08-final-guidelines/01_BRAND_GUIDELINES_STRUCTURE.md`

**Designer notes**

- Page numbers must be generated from the final order, not typed from an earlier 27-page draft.
- Avoid thumbnails; the page should read like a premium publication index.

**Developer notes**

- If the PDF workflow supports internal links, link every contents entry to its destination page and verify links after export.

---

## Page 03 — Brand Introduction

**Purpose**
Define what Building Suit is, the category it occupies, and the problem it solves.

**Main content**

- Lead statement: **Building Suit is a mobile-first operational control platform for self-managed residential buildings.**
- Explain that it replaces fragmented messaging, paper records, informal cash handling, and spreadsheets with one transparent, unit-centered system.
- Name the core areas: finance, membership, issues, announcements, governance, and service-provider discovery.
- Position Building Suit as the first active portal in a broader Suit ecosystem, without turning this page into a platform architecture explanation.
- Close with: **The transparent way to run your building, together.**

**Visual elements to include**

- Navy page with a simple `chaos → clarity` editorial composition.
- Left side: restrained symbols for chat, paper, cash, and spreadsheets.
- Right side: one structured building/unit-grid system.
- One gold line connects the fragmented state to the ordered state.

**Source files used**

- `00-project/00_PROJECT_BRIEF.md`
- `01-strategy/01_BRAND_FOUNDATION.md`
- `01-strategy/02_BRAND_POSITIONING.md`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`

**Designer notes**

- The page must communicate operational control, not property sales, social networking, or generic accounting.
- Keep ecosystem references small and future-facing; Building Suit remains the focus.

**Developer notes**

- Product labels shown in any diagram must use approved vocabulary: unit, resident, charge, payment, expense, issue, announcement, and vote.

---

## Page 04 — Brand Story

**Purpose**
Turn the product rationale into a human narrative that explains why the brand exists.

**Main content**

- **Before:** the building depends on group chats, notebooks, cash envelopes, and one person who holds the history.
- **Tension:** residents cannot reliably see where money goes, decisions disappear in chat, and administration is hard to transfer.
- **Change:** Building Suit creates one unit-based, auditable record for money, people, issues, announcements, and decisions.
- **After:** the building becomes transparent, accountable, well-run, and able to continue beyond any one administrator.
- Closing line: **From informal and opaque to structured, visible, and durable.**

**Visual elements to include**

- Four-stage horizontal narrative: Fragmented → Uncertain → Structured → Trusted.
- Use muted gray for the old state, navy for structure, and a single gold-lit window at the trusted end state.
- Optional regionally authentic residential-building image with navy grading and clear text-safe space.

**Source files used**

- `01-strategy/01_BRAND_FOUNDATION.md`
- `01-strategy/02_BRAND_POSITIONING.md`
- `01-strategy/04_TARGET_AUDIENCE.md`
- `03-visual-identity/06_IMAGERY_STYLE.md`

**Designer notes**

- Make the story resident-centered and credible. Avoid startup-origin mythology that is not documented.
- The visual outcome is calm and well-run, not luxurious or exclusive.

**Developer notes**

- No implementation requirement. Do not introduce product capabilities beyond the approved foundation and positioning documents.

---

## Page 05 — Mission, Vision, and Promise

**Purpose**
Present the three strategic statements that every product, marketing, and partnership decision must support.

**Main content**

- **Mission:** “To give every self-managed building a transparent, trustworthy way to run its finances, decisions, and daily operations — together.”
- **Vision:** “A world where managing a shared building is as clear and trusted as checking your bank balance.”
- **Brand promise:** **Clarity you can trust.**
- Promise proof points: Transparency, Trust, Order, Continuity.

**Visual elements to include**

- Three distinct editorial blocks with Mission and Vision on light cards and Promise on a navy statement block.
- Four small proof-point icons below the promise.
- One gold highlight on the word “clarity” or the promise rule—not both.

**Source files used**

- `01-strategy/01_BRAND_FOUNDATION.md`
- `01-strategy/02_BRAND_POSITIONING.md`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`

**Designer notes**

- Use the exact approved wording. Do not shorten, paraphrase, or add a new slogan.
- Keep the mission and vision readable at presentation distance.

**Developer notes**

- The promise string should be maintained as approved copy in localized content resources, with a native Arabic translation reviewed separately.

---

## Page 06 — Brand Personality

**Purpose**
Define how Building Suit should feel in behavior, design, and communication.

**Main content**

- Primary traits:
  - **Trustworthy** — steady, dependable, never alarmist.
  - **Clear** — explains money and decisions in plain language.
  - **Organised** — everything has a place, status, and next step.
  - **Warm** — human and community-minded without becoming casual.
  - **Premium** — considered, polished, and quietly confident.
- Supporting behaviors: honest, calm, dependable.
- Persona statement: a respected building committee head who keeps immaculate records, treats everyone fairly, and explains the accounts clearly.

**Visual elements to include**

- Five evenly weighted trait cards or a five-point spectrum.
- A small “competent, not cold / warm, not casual” balance line.
- Minimal icons; do not turn the page into a colorful personality quiz.

**Source files used**

- `01-strategy/01_BRAND_FOUNDATION.md`
- `01-strategy/03_BRAND_VOICE.md`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`

**Designer notes**

- Treat the five traits from `01_BRAND_FOUNDATION.md` as canonical.
- Supporting words may reinforce the traits but must not replace them with a second five-trait system.

**Developer notes**

- Use these traits as UX review criteria for microcopy, notification severity, motion, and error handling.

---

## Page 07 — Target Audience

**Purpose**
Show who the brand serves, what each audience needs, and whose needs take priority.

**Main content**

- **Primary:** building administrators/committee members—need clean records, transparent collection, simpler communication, and transferable administration.
- **Primary:** residents, including owners and tenants—need visibility, fairness, issue resolution, announcements, and a real say.
- **Secondary:** absentee owners/investors—need remote oversight and confidence.
- **Future/Post-MVP only:** service providers may need a credible, discoverable profile if separately reapproved; no active MVP messaging, navigation, profile, directory, or contact journey is included.
- **Secondary:** platform operator/future portals—need a trusted, extensible identity.
- Shared needs: mobile-first, mixed tech literacy, Arabic/English, RTL-aware, locally appropriate money and date formats.

**Visual elements to include**

- Two larger primary persona cards and three smaller secondary cards.
- Each card shows role, core pain, desired outcome, and message focus.
- Include one bilingual/RTL callout without stereotyping users.

**Source files used**

- `01-strategy/02_BRAND_POSITIONING.md`
- `01-strategy/04_TARGET_AUDIENCE.md`
- `01-strategy/03_BRAND_VOICE.md`

**Designer notes**

- Do not list founders/partners as a primary product audience.
- Use “owner,” “tenant,” and “resident” precisely; never use tenant as a synonym for all residents.

**Developer notes**

- Persona examples must reflect role-aware experiences and RTL parity. Do not imply service-provider transactions that are outside current product scope.

---

## Page 08 — Logo System

**Purpose**
Explain the approved building-shaped “B,” its meaning, its two variants, and its role as the identity anchor.

**Main content**

- The mark is both a letter **B** and a residential building.
- Lit windows represent occupied units, transparency, activity, and care.
- The doorway represents access and joining a building.
- Navy represents trust and stability; gold represents value, warmth, and “lit/active”; white/silver represents clarity.
- Approved variants:
  - Navy/dark logo on light backgrounds.
  - White/silver logo on dark/navy backgrounds.
- Current source format: transparent PNG, 920 × 1245 px, identical geometry across variants.

**Visual elements to include**

- Large side-by-side variant presentation: navy logo on Pearl White and white/silver logo on Building Navy.
- Three annotated callouts: building-B silhouette, window grid, doorway.
- Short “variant by background” rule below the comparison.

**Source files used**

- `02-logo-system/01_LOGO_ANALYSIS.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `assets/logos/logo-source-notes.md`
- `assets/logos/building-suit-logo-dark.png`
- `assets/logos/building-suit-logo-light.png`

**Designer notes**

- Use the supplied logo files exactly. Do not redraw, recolor, relight, or simulate the mark.
- The filename describes the logo color, not the background it belongs on.

**Developer notes**

- Preserve intrinsic aspect ratio and transparency. Never use CSS or widget constraints that distort the asset.

---

## Page 09 — Logo Clear Space

**Purpose**
Define the protected area that keeps the logo legible, isolated, and premium.

**Main content**

- `X` equals the height of one gold window pane in the building façade.
- Minimum clear space is `1X` on all four sides.
- Recommended hero/standalone clear space is `1.5X–2X`.
- The safe area contains no text, icons, rules, container edges, or busy image detail.
- Fallback only when the pane cannot be measured: `X = 25%` of total logo height.
- RTL changes placement, never the artwork.

**Visual elements to include**

- Large annotated clear-space diagram with logo bounding box, dashed safe-area box, and `X` measurements.
- Small examples for header, hero, co-branding, and photography placement.
- Correct versus crowded isolation comparison.

**Source files used**

- `02-logo-system/03_LOGO_CLEAR_SPACE.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `02-logo-system/04_LOGO_DOS_AND_DONTS.md`
- `06-claude-design/03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`

**Designer notes**

- Follow the dedicated clear-space document, not the conflicting shorthand in the older condensed prompt.
- Bake transparent `1X` padding into reusable placement components where practical.

**Developer notes**

- Wrap the logo asset in a responsive container that enforces minimum padding. Reduce logo size before reducing clear space.

---

## Page 10 — Logo Minimum Size

**Purpose**
Protect the architectural details and gold-lit windows across digital and print reproduction.

**Main content**

- Digital full logo minimum: **40 px tall**.
- Digital comfortable size: **64 px tall and above**.
- Print full logo minimum: **12 mm tall**.
- Print comfortable size: **18 mm tall and above**.
- Below 40 px, use the approved simplified/app-icon companion form once available; do not shrink the detailed 3D logo indefinitely.
- Do not enlarge the current raster master beyond its native 920 × 1245 px resolution.
- A matching vector master and flat/monochrome companion remain outstanding.

**Visual elements to include**

- Actual-size digital ladder: 64, 48, 40, 32, and 16 px, with pass/fail labels.
- Print ladder: 18, 12, and sub-12 mm.
- Magnified crop showing where windows and door begin to muddy.

**Source files used**

- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `02-logo-system/05_APP_ICON_GUIDE.md`
- `assets/logos/logo-source-notes.md`

**Designer notes**

- Show true-size samples at 100% export scale and verify in the exported PDF.
- Do not create a new simplified mark merely to complete this page; label it as an outstanding asset.

**Developer notes**

- Use density-specific image assets and prevent upscaling beyond the source raster. Switch to approved small-mark assets when they exist.

---

## Page 11 — Logo Do / Don’t

**Purpose**
Make correct and prohibited logo treatments immediately understandable.

**Main content**

- **Do:** use approved masters; choose the correct contrast variant; lock aspect ratio; preserve gold windows and 3D lighting; keep the logo upright; respect `1X`; place it on calm, high-contrast backgrounds.
- **Don’t:** stretch, squash, skew, crop, rotate, flip, recolor, flatten, change gold bars, add shadows/glows/outlines, place on gold without care, or use screenshots/compressed copies.
- On a gold background, the navy logo is the only acceptable variant and should be used sparingly.

**Visual elements to include**

- Split layout with 3–4 correct examples and 6–8 prohibited examples.
- Red prohibition marks are semantic annotations, not brand decoration.
- Label each failure directly: distorted, recolored, mirrored, extra effect, low contrast, crowded.

**Source files used**

- `02-logo-system/04_LOGO_DOS_AND_DONTS.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `02-logo-system/03_LOGO_CLEAR_SPACE.md`

**Designer notes**

- Keep incorrect examples recognizable but never export them as reusable brand assets.
- Do not overfill the page; use fewer, clearer examples at readable size.

**Developer notes**

- Add automated image-component constraints where possible: `object-fit: contain`, intrinsic ratio, and theme-aware variant switching.

---

## Page 12 — App Icon

**Purpose**
Define how the building-B becomes a platform-ready, small-format brand asset.

**Main content**

- Primary concept: white/silver building-B centered on solid Building Navy, no text.
- iOS: 1024 × 1024 px master, opaque, square, no pre-rounded corners; keep essential detail inside the central ~80%.
- Android: adaptive foreground/background at 108 × 108 dp; central safe zone ~66 dp; 512 × 512 px Play Store master.
- Size-stepped treatment: full detail at ≥180 px, simplified shading at 80–180 px, approved flat companion at 40–80 px, minimal approved mark below 40 px.
- Android 13 monochrome and Android notification icons require the outstanding flat companion mark.
- Favicon outputs: 16, 32, 48, 180, and 512 px maskable.

**Visual elements to include**

- Primary app icon at large scale.
- Circle, squircle, and rounded-square mask tests.
- iOS and Android safe-area diagrams.
- Size row: 1024, 180, 120, 60, 32, 16.

**Source files used**

- `02-logo-system/05_APP_ICON_GUIDE.md`
- `02-logo-system/01_LOGO_ANALYSIS.md`
- `assets/logos/logo-source-notes.md`
- `06-claude-design/01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md`

**Designer notes**

- Derive the icon from the supplied artwork; do not redraw or invent the building-B.
- Clearly flag unavailable monochrome/simplified assets rather than faking them.

**Developer notes**

- Generate native iOS and Android asset sets from approved masters. Test all masks and Android themed-icon behavior before release.

---

## Page 13 — Color Palette

**Purpose**
Present the approved visual palette and give every color a clear name and role.

**Main content**

- Core: Building Navy `#16293B`, Deep Structure Navy `#0D1B28`, Premium Gold `#D89B42`, Highlight Gold `#EBB45A`, Pearl White `#F7F8FA`, Soft Silver `#E2E5EA`, Cloud Gray `#CBD2DB`, Graphite Text `#232B33`.
- Dark surfaces: Midnight `#0A111A`, Navy Surface `#14233A`, Raised `#1B2E47`, Steel Border `#2E3F52`.
- Secondary: Slate Blue `#36506E`, Sky Steel `#7E97B3`, Pale Sky `#DCE6F1`, Slate Gray `#5A6573`, Steel Gray `#9AA6B4`.
- Gold ramp: `#A86C1C`, `#C8902F`, `#D89B42`, `#EBB45A`, `#F4CE86`.
- Semantic: Success `#2E9E6B`, Warning `#E1841F`, Error `#D14B4B`, Info `#2F77C9`, with approved background tints.

**Visual elements to include**

- Large core swatches labeled with name and HEX.
- Smaller dark-surface, secondary, gold-ramp, and semantic rows.
- Navy and gold gradient samples; label them as special-use gradients.

**Source files used**

- `03-visual-identity/01_COLOR_SYSTEM.md`
- `07-design-tokens/design-tokens.json`
- `07-design-tokens/colors.css`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`

**Designer notes**

- Swatch labeling is informational; the gold ramp exception does not invalidate the one-gold-focus rule on other pages.
- Do not sample colors from the PNG logos for production once approved token values exist.

**Developer notes**

- Reference token names, never duplicate raw HEX values in feature code.

---

## Page 14 — Color Usage

**Purpose**
Explain how palette roles change by theme, how gold remains premium, and which pairings meet accessibility requirements.

**Main content**

- Foundation rule: **Navy is the foundation; gold is the jewel.**
- Light mode roles: Pearl background, White surface, Graphite text, Navy primary action, Gold accent.
- Dark mode roles: Midnight background, Navy Surface, Pearl text, Gold primary action, Highlight Gold accent.
- One gold focus per view; no gold body text on light backgrounds.
- Semantic colors communicate status only; status always combines color, icon, and label.
- Key contrast facts:
  - Graphite on Pearl ≈ 13:1, AAA.
  - Navy on Pearl ≈ 12.8:1, AAA.
  - Premium Gold on Navy ≈ 5.7:1, AA.
  - Premium Gold on Pearl ≈ 2.5:1, fail for normal text.

**Visual elements to include**

- Side-by-side light and dark role maps.
- Pass/fail contrast examples.
- A small “one gold focus” screen comparison.
- Semantic status chips with icon + label.

**Source files used**

- `03-visual-identity/01_COLOR_SYSTEM.md`
- `04-ui-system/03_DARK_MODE_GUIDE.md`
- `04-ui-system/04_LIGHT_MODE_GUIDE.md`
- `07-design-tokens/design-tokens.json`

**Designer notes**

- Do not use gold as normal text on Pearl White, even if it looks premium.
- Clearly distinguish brand accent gold from warning amber.

**Developer notes**

- Resolve colors through semantic role tokens. Enforce WCAG AA and test focus rings, disabled states, and semantic pairs in both modes.

---

## Page 15 — Typography: English

**Purpose**
Define the Latin type system for product, web, marketing, and document use.

**Main content**

- Primary family: **Manrope**. Inter is the UI fallback.
- Mobile scale:
  - Display 32/40, 800.
  - H1 26/34, 700.
  - H2 22/30, 700.
  - H3 18/26, 600.
  - Body L 16/24, 400/500.
  - Body M 14/22, 400/500.
  - Caption 12/18, 500.
  - Overline 11/16, 600, +4% tracking, uppercase.
  - Button 15/20, 600.
- Limit each layout to 2–3 weights; body line length is 45–75 characters.
- Show the approved line: **Building Suit — Clarity you can trust.**

**Visual elements to include**

- A full type specimen with labeled hierarchy rows.
- Weight strip from 400 to 800.
- Short product sample showing heading, body, amount, and caption.

**Source files used**

- `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`
- `07-design-tokens/design-tokens.json`
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`

**Designer notes**

- Use live text, not rasterized specimens, during design.
- Marketing scales may be larger, but the hierarchy and weight discipline remain consistent.

**Developer notes**

- Self-host or bundle Manrope; do not depend on a runtime CDN. Map the approved scale to named tokens rather than ad hoc styles.

---

## Page 16 — Typography: Arabic

**Purpose**
Define an equal-quality Arabic system that preserves readability, tone, and RTL behavior.

**Main content**

- Primary family: **IBM Plex Sans Arabic**. Cairo and Tajawal are fallbacks.
- Mirror the English hierarchy with 10–15% additional Arabic line height.
- Use RTL and right alignment; mirror layout, indents, bullets, and directional icons.
- Do not use all-caps, letter spacing, fake bold, or synthetic italic.
- Keep **Building Suit** in Latin script inside Arabic copy.
- Demonstration line: **Building Suit — وضوحٌ يمكنك الوثوق به.**
- Show a mixed-script finance example with unit, amount, and currency.

**Visual elements to include**

- Right-aligned Arabic type specimen matching the English scale.
- Mixed Arabic/Latin/numeral lockup.
- Small correct/incorrect RTL comparison.

**Source files used**

- `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`
- `01-strategy/03_BRAND_VOICE.md`
- `07-design-tokens/design-tokens.json`
- `06-claude-design/03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`

**Designer notes**

- Arabic is not a translated afterthought; it receives equal visual hierarchy and space.
- Review ligatures, diacritics, numerals, and line clipping at export size.

**Developer notes**

- Set locale-aware direction and font fallback. Avoid string concatenation that breaks RTL and mixed-script order.

---

## Page 17 — Visual Language

**Purpose**
Show how the logo's architecture, light, depth, and transparency become a consistent visual world.

**Main content**

- Design words: **structured · premium · transparent**.
- Signature motif: the window grid, used quietly in backgrounds, dividers, loading states, and section devices.
- Depth: layered surfaces, soft navy-tinted shadows, and one consistent top-down light direction.
- Gold: one lit/active focal moment per composition.
- 3D belongs in logo, app icon, hero imagery, splash, and special illustrations; product controls stay flat and clear.
- Photography: warm, real, regionally appropriate residential buildings and communities, with navy shadows and warm gold light.
- Avoid staged corporate stock, empty luxury towers, cluttered frames, clichés, and off-brand color casts.

**Visual elements to include**

- Curated moodboard: lit residential façade, community moment, window-grid pattern, navy/gold material sample, flat UI sample.
- 3D-versus-flat usage comparison.
- Small avoid strip with clearly labeled off-brand examples.

**Source files used**

- `03-visual-identity/03_VISUAL_LANGUAGE.md`
- `03-visual-identity/06_IMAGERY_STYLE.md`
- `02-logo-system/01_LOGO_ANALYSIS.md`
- `06-claude-design/01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md`

**Designer notes**

- Use properly licensed or original images and record source/licensing metadata.
- The window grid is a supporting motif, not wallpaper on every page.

**Developer notes**

- Optimize photography to WebP/AVIF where applicable and provide localized alt text. Preserve image focal points at responsive crops.

---

## Page 18 — Layout and Spacing

**Purpose**
Define the structural rules that make every Building Suit composition feel ordered and consistent.

**Main content**

- Spacing scale: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Product grids: mobile 4 columns/16 dp margins; tablet 8 columns/24 dp; web 12 columns/24–32 px with 1200–1280 px max width.
- PDF grid: 12 columns, 96 px margins, 24 px gutters.
- Radius set: chips 8, buttons/inputs 12, cards 16, modals/large containers 24.
- Typical page spacing: card padding 16–24; section gaps 24–32 mobile and 48–96 web.
- Minimum tap target: 44 × 44 dp; minimum target gap: 8 px.
- RTL mirrors the grid and directional flow, not the logo artwork.

**Visual elements to include**

- Grid overlays for mobile, web, and PDF.
- Labeled spacing scale and radius samples.
- Three-step elevation ladder using the approved shadow tokens.

**Source files used**

- `03-visual-identity/04_LAYOUT_AND_SPACING.md`
- `07-design-tokens/design-tokens.json`
- `04-ui-system/01_UI_STYLE_GUIDE.md`
- `06-claude-design/02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`

**Designer notes**

- Use only approved spacing and radius values. Optical adjustment is allowed for logo alignment but not as a new spacing token.
- Group with whitespace before adding borders.

**Developer notes**

- Expose spacing, radius, and elevation as reusable tokens. Respect device safe areas, keyboard insets, and RTL layout direction.

---

## Page 19 — Iconography

**Purpose**
Define one coherent icon system that is readable, calm, and compatible with the product UI.

**Main content**

- Style: flat, line-first, geometric-humanist, rounded caps and joins.
- Construction: 24 × 24 grid, ~20 px live area, 2 px default stroke.
- All icons remain Hugeicons Stroke Rounded; active/selected icons use Premium Gold plus a label or indicator.
- Status icons use semantic colors, not gold.
- Directional icons mirror in RTL; non-directional icons do not.
- Domain set: unit, building, ledger, charge, payment, expense, issue, announcement, vote; Future/Post-MVP service-provider icons are reserved only for later approved scope.
- Required library: the free [Hugeicons](https://hugeicons.com/) Stroke Rounded set only. Solid, Duotone, Twotone, Bulk, and other paid styles are not permitted until licensed.
- Do not mix Hugeicons with Lucide, Phosphor, or other families. Create custom domain icons only when Hugeicons has no clear equivalent, matching its construction and optical weight.

**Visual elements to include**

- 24 px construction grid with stroke and corner annotations.
- Outline, hover, active, semantic, and disabled state row.
- A representative domain-icon sheet.

**Source files used**

- `03-visual-identity/05_ICONOGRAPHY_STYLE.md`
- `03-visual-identity/03_VISUAL_LANGUAGE.md`
- `04-ui-system/01_UI_STYLE_GUIDE.md`

**Designer notes**

- Use the Hugeicons library consistently; do not mix icon families or use clip-art.
- Gold must indicate active emphasis, never decorate the entire icon set.

**Developer notes**

- Standardize Hugeicons size, stroke, semantic labeling, and mirroring rules in one reusable icon component. Every actionable icon needs an accessible label.

---

## Page 20 — UI Style

**Purpose**
Translate the identity into a premium mobile-first operating interface.

**Main content**

- UI personality: clear, trustworthy, structured, premium, warm.
- Screen anatomy: app bar/context → scrollable card content → bottom navigation or reachable primary action.
- One primary action and one gold focal point per view.
- Cards are the core container: 16 px radius, 16–24 px padding, soft elevation.
- Money is prominent and precise; status always combines color, icon, and label.
- Empty states teach the user; forms keep labels visible; errors are calm and actionable.
- Motion is subtle: 120–200 ms ease.

**Visual elements to include**

- Annotated mobile dashboard skeleton.
- Small examples for navigation, empty state, form, modal, and card hierarchy.
- A callout showing one-handed primary-action placement.

**Source files used**

- `04-ui-system/01_UI_STYLE_GUIDE.md`
- `03-visual-identity/01_COLOR_SYSTEM.md`
- `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`
- `03-visual-identity/04_LAYOUT_AND_SPACING.md`
- `01-strategy/03_BRAND_VOICE.md`

**Designer notes**

- Product UI remains mostly flat; depth comes from surfaces and restrained shadows.
- Do not use the detailed logo as a routine navigation icon or card illustration.

**Developer notes**

- Build theme-aware, token-driven primitives. Ensure 44 × 44 dp targets, accessible focus, safe-area handling, localization, and reduced-motion support.

---

## Page 21 — Components

**Purpose**
Show the core component language, its interaction states, and its application to building operations.

**Main content**

- Core controls: primary, secondary, and ghost buttons; input; select; tabs; chip/badge.
- Navigation: app bar and bottom navigation.
- Feedback: toast and modal/bottom sheet.
- Domain components: payment card, building card, voting card.
- State sequence: default, hover, pressed, focus, disabled, loading, plus component-specific status.
- Primary flips by theme: Navy on light, Gold on dark.
- Finance conventions: paid/credit green, owed/overdue red, pending amber.

**Visual elements to include**

- A disciplined component contact sheet, not a full design-system inventory.
- Full state row for the primary button and input.
- Representative badges and three domain cards.
- Bottom-navigation strip with an active Stroke Rounded Gold icon plus label/indicator.

**Source files used**

- `04-ui-system/02_COMPONENT_STYLE_GUIDE.md`
- `04-ui-system/01_UI_STYLE_GUIDE.md`
- `07-design-tokens/design-tokens.json`
- `07-design-tokens/flutter_colors.dart`

**Designer notes**

- The page demonstrates the system; the component guide remains the complete specification.
- Keep labels realistic and use approved product vocabulary.

**Developer notes**

- Components must consume theme roles and tokenized spacing/radius values. Implement all states, keyboard/focus behavior, semantics, RTL, loading, and disabled behavior.

---

## Page 22 — Dark Mode

**Purpose**
Show dark mode as a native expression of the navy-led brand, not an inverted light theme.

**Main content**

- Layer 0: Midnight `#0A111A`.
- Layer 1: Navy Surface `#14233A`.
- Layer 2/3: Raised `#1B2E47` with subtle borders and restrained shadows.
- Primary text: Pearl White; secondary: Sky Steel; border: Steel Border.
- Primary action: Premium Gold with Deep Navy text.
- Use the white/silver logo on dark surfaces.
- Elevation comes mainly from surface-lightness steps.
- Semantic colors use approved lightened dark variants.

**Visual elements to include**

- Full phone mockup showing dashboard, payment state, bottom navigation, and modal.
- Layer/elevation strip and dark role-token labels.
- One contrast callout for Pearl text and Gold action.

**Source files used**

- `04-ui-system/03_DARK_MODE_GUIDE.md`
- `03-visual-identity/01_COLOR_SYSTEM.md`
- `04-ui-system/02_COMPONENT_STYLE_GUIDE.md`
- `07-design-tokens/design-tokens.json`

**Designer notes**

- Avoid pure black/pure white and excessive glow.
- Gold still appears once as the primary focal action; semantic colors retain their meaning.

**Developer notes**

- Use dark role tokens, including dark semantic variants. Verify contrast, surface separation, system-theme behavior, and screenshot regression tests.

---

## Page 23 — Light Mode

**Purpose**
Define the default theme and show how soft surfaces, navy action, and restrained gold produce clarity.

**Main content**

- Layer 0: Pearl White `#F7F8FA`.
- Layer 1: White `#FFFFFF` cards.
- Primary text: Graphite; secondary: Slate Gray; border: Cloud Gray.
- Primary action: Building Navy with Pearl White text.
- Gold is limited to active states, focus rings, selected borders, and one accent detail.
- Use the navy/dark logo on light surfaces.
- Cards use soft navy-tinted shadows; Graphite replaces harsh pure black.

**Visual elements to include**

- Matching phone mockup to page 22 for direct comparison.
- Light role-token strip and elevation example.
- Gold-on-light pass/fail text example.

**Source files used**

- `04-ui-system/04_LIGHT_MODE_GUIDE.md`
- `03-visual-identity/01_COLOR_SYSTEM.md`
- `04-ui-system/02_COMPONENT_STYLE_GUIDE.md`
- `07-design-tokens/design-tokens.json`

**Designer notes**

- Keep both theme pages structurally aligned so the role mapping is obvious.
- Do not make the light theme visually weaker by removing all brand cues.

**Developer notes**

- Light is the default role set. Do not use Premium Gold for primary buttons or normal text on light surfaces.

---

## Page 24 — Website Usage

**Purpose**
Define the brand's first marketing impression across desktop, mobile, light, dark, English, and Arabic web layouts.

**Main content**

- Hero structure: concise headline, one supporting sentence, one primary CTA, optional secondary CTA, and one real product phone mockup.
- Recommended dark hero: navy gradient, window grid, white/silver logo, Pearl headline, Gold primary CTA.
- Light alternative: Pearl background, navy logo, Graphite headline, Navy primary CTA.
- Preferred headline: **See exactly where your building's money goes.**
- Supporting line: **One transparent app for charges, payments, issues, announcements, and decisions.**
- Header logo size: approximately 32–48 px tall with full clear space.
- Desktop two-column layout stacks to headline → CTA → mockup on mobile; Arabic fully mirrors.

**Visual elements to include**

- Full desktop hero mockup and small mobile/RTL variants.
- Header, hero, CTA, product mockup, and footer annotations.
- Dark and light thumbnail comparison.

**Source files used**

- `05-marketing/02_WEBSITE_HERO_GUIDE.md`
- `03-visual-identity/04_LAYOUT_AND_SPACING.md`
- `03-visual-identity/06_IMAGERY_STYLE.md`
- `01-strategy/03_BRAND_VOICE.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`

**Designer notes**

- Use a real on-brand dashboard screen, not invented product UI.
- Keep the hero to one message and one dominant action.

**Developer notes**

- Implement responsive and RTL layout, semantic headings, keyboard-accessible CTAs, optimized images, theme-aware logo switching, and localized alt text.

---

## Page 25 — Social Media Usage

**Purpose**
Create a recognizable cross-platform social system that remains calm, bilingual, and accessible.

**Main content**

- Formats: Instagram square 1080 × 1080, portrait 1080 × 1350, Story/Reel 1080 × 1920, LinkedIn square 1200 × 1200 or link 1200 × 627, cover 1128 × 191.
- Avatar uses the app-icon mark; covers and posts may use the full logo.
- Visual formula: navy or calm photography, short benefit-led headline, one gold accent, correct logo variant, generous clear space.
- Stories keep content in the central safe zone.
- English and Arabic versions receive native alignment and equal quality.
- Captions repeat essential information and every meaningful image gets localized alt text.

**Visual elements to include**

- Instagram square, Story, LinkedIn, and profile avatar previews.
- One launch-announcement family across formats.
- Safe-zone overlays and a short do/don't comparison.

**Source files used**

- `05-marketing/01_SOCIAL_MEDIA_GUIDE.md`
- `03-visual-identity/06_IMAGERY_STYLE.md`
- `01-strategy/03_BRAND_VOICE.md`
- `02-logo-system/05_APP_ICON_GUIDE.md`

**Designer notes**

- Templates should look related without becoming identical.
- Avoid hashtag walls, excessive on-image copy, salesy hype, and a different aesthetic per channel.

**Developer notes**

- Maintain export presets and filename conventions by format/language. Validate safe zones, compression, captions, and alt text before publishing.

---

## Page 26 — Business Card Usage

**Purpose**
Translate the premium identity into a restrained, print-ready physical application.

**Main content**

- Standard size: 85 × 55 mm landscape; 3 mm bleed; 4–5 mm safe area; 300 dpi minimum.
- Front: Building Navy, centered white/silver logo, optional **Clarity you can trust.** tagline, no contact details.
- Back: Pearl White, small navy logo, name, role, mobile, email, website, optional handle, and one thin gold rule.
- Typography: Manrope for Latin, IBM Plex Sans Arabic for Arabic; 2–3 weights only.
- Production: CMYK, 350–400 gsm stock, matte/soft-touch; optional gold foil or metallic spot treatment after physical proof.
- A vector master is required for print-critical artwork and remains outstanding.

**Visual elements to include**

- Front/back mockup and flat dieline with bleed, trim, and safe-area marks.
- Bilingual/RTL back-side variant.
- Small finish samples for matte, foil, and spot UV, clearly labeled optional.

**Source files used**

- `05-marketing/03_BUSINESS_CARD_GUIDE.md`
- `02-logo-system/02_LOGO_USAGE_RULES.md`
- `02-logo-system/03_LOGO_CLEAR_SPACE.md`
- `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`
- `assets/logos/logo-source-notes.md`

**Designer notes**

- Do not send the raster PNG to large-format or foil production as if it were a vector master.
- Gold foil is a production option, not a mandatory digital color substitution.

**Developer notes**

- No runtime implementation. Store print-ready source, linked assets, font licenses, color profiles, and printer proof with the final deliverables.

---

## Page 27 — Presentation Usage

**Purpose**
Define a consistent deck system for investor, product, partner, and internal presentations.

**Main content**

- Format: 16:9, 1920 × 1080, 12-column grid, 64–80 px slide margins.
- One takeaway and one focal point per slide.
- Alternate navy and light masters; one gold accent per slide; consistent logo/slide-number footer.
- Show cover, problem, solution, product, and metrics layout patterns.
- Chart colors: Navy primary series, Gold single highlighted series, secondary blue/gray ramp; semantic colors only for true positive/negative meaning.
- Label planning assumptions and cite data sources.
- Arabic versions mirror layout and retain `Building Suit` in Latin.

**Visual elements to include**

- Five mini slide masters: cover, statement, two-column, product, metrics.
- One example chart with correct series hierarchy.
- Footer and grid annotations.

**Source files used**

- `05-marketing/04_PRESENTATION_STYLE_GUIDE.md`
- `03-visual-identity/01_COLOR_SYSTEM.md`
- `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`
- `03-visual-identity/04_LAYOUT_AND_SPACING.md`

**Designer notes**

- Avoid dense paragraphs, tiny captions, decorative 3D charts, and multiple gold data series.
- The headline should state the slide's conclusion, not merely name its topic.

**Developer notes**

- If templates are generated programmatically, lock master dimensions, theme fonts, palette, footer positions, and chart-series mapping.

---

## Page 28 — Brand Voice

**Purpose**
Define how Building Suit speaks across product, marketing, support, finance, and urgent situations.

**Main content**

- Constant qualities: **Clear, Trustworthy, Calm, Warm & Respectful.**
- Writing principles: clarity over cleverness; lead with fact/benefit; be exact about money/dates; use plain words; take responsibility; use active voice and short sentences; write bilingually from the start.
- Tone flexes by context:
  - Onboarding: warmer and encouraging.
  - Finance: precise and unemotional.
  - Error: calm, helpful, accountable.
  - Urgent notice: direct without panic.
  - Marketing: confident without hype.
- Preferred terms: unit, resident, owner, tenant, charge, payment, expense, balance, ledger, issue, announcement, vote.
- Avoid jargon, blame, vague amounts/dates, superlatives, exclamation piles, and fear-based urgency.
- Example pair: **“Payment recorded. Unit 4B's balance is now EGP 0.”** / **«تم تسجيل الدفعة. أصبح رصيد الوحدة 4B الآن ٠ ج.م.»**

**Visual elements to include**

- Tone-spectrum diagram and context matrix.
- Three concise do/don't copy pairs.
- Equal English and Arabic example blocks.

**Source files used**

- `01-strategy/03_BRAND_VOICE.md`
- `01-strategy/01_BRAND_FOUNDATION.md`
- `01-strategy/04_TARGET_AUDIENCE.md`
- `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md`

**Designer notes**

- Keep the copy page editorial and readable; do not reduce voice guidance to decorative quote cards.
- Arabic uses natural MSA, not literal word-for-word translation.

**Developer notes**

- Centralize approved terminology and reusable system messages. Do not concatenate localized strings; allow Arabic expansion and mixed numerals.

---

## Page 29 — Developer Tokens

**Purpose**
Connect the brand system to implementation with one canonical token model and platform-specific outputs.

**Main content**

- Source of truth: `design-tokens.json`.
- Generated/synchronized outputs:
  - `colors.css` for web custom properties.
  - `tailwind.colors.js` for Tailwind theme values.
  - `flutter_colors.dart` for Flutter palette and semantic roles.
- Token layers: raw brand values → semantic light/dark roles → component tokens.
- Example raw tokens: `color.brand.buildingNavy`, `color.brand.premiumGold`, `color.brand.pearlWhite`.
- Example role tokens: `color.role.light.primary`, `color.role.dark.primary`, `color.role.light.surface`, `color.role.dark.surface`.
- Key implementation rule: primary action maps to Navy in light mode and Gold in dark mode.
- Also expose typography, spacing, radius, shadow, and component values from the canonical JSON.

**Visual elements to include**

- Flow diagram: canonical JSON → CSS / Tailwind / Flutter.
- Small synchronized code examples in JSON, CSS, Tailwind, and Dart.
- Light/dark role mapping table and token-layer legend.

**Source files used**

- `07-design-tokens/design-tokens.json`
- `07-design-tokens/colors.css`
- `07-design-tokens/tailwind.colors.js`
- `07-design-tokens/flutter_colors.dart`
- `00-project/01_BRAND_GUIDELINES_WORKFLOW.md`
- `00-project/02_DEFINITION_OF_DONE.md`

**Designer notes**

- Code samples must be real excerpts from current files, not invented syntax.
- Keep the page readable; show representative tokens and point to files for the full implementation.

**Developer notes**

- Treat JSON as canonical and generate or validate derivatives in CI. Block raw color literals in feature code where practical and test parity across all outputs.

---

## Page 30 — Final Checklist

**Purpose**
Close the document with a practical approval gate for designers, developers, marketers, and production owners.

**Main content**

- **Logo:** approved asset, correct variant, unchanged gold/3D treatment, `1X` clear space, minimum size, no distortion.
- **Color:** approved tokens only, one gold focus, correct theme roles, semantic colors used only for status.
- **Typography:** Manrope + IBM Plex Sans Arabic, approved hierarchy, limited weights, no tiny text.
- **Arabic/RTL:** natural copy, right alignment, mirrored placement, no caps/tracking, `Building Suit` remains Latin.
- **Layout:** approved grid, spacing, radii, safe areas, and consistent header/footer.
- **Accessibility:** WCAG AA, visible focus, color + icon + label, 44 × 44 dp targets, alt text.
- **Applications:** website, social, print, and presentation examples use the same system.
- **Implementation:** token derivatives match canonical JSON; light/dark and RTL are verified.
- **Export:** 30 pages in order, 1920 × 1080, embedded fonts, sharp assets, sRGB screen PDF, correct filename, fresh-viewer check.
- **Approval:** review log completed; outstanding vector/flat-logo requests recorded; stakeholder sign-off captured.

**Visual elements to include**

- Navy closing page with six concise checklist groups and check icons.
- White/silver logo with full clear space.
- Final line: **Building Suit — Clarity you can trust.**
- Version and confidentiality footer.

**Source files used**

- `00-project/02_DEFINITION_OF_DONE.md`
- `06-claude-design/04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md`
- `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md`
- `06-claude-design/03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`
- `08-final-guidelines/04_PDF_EXPORT_CHECKLIST.md`

**Designer notes**

- Keep checklist text concise and operational. This is the sign-off page, not a decorative summary.
- Do not imply that the vector or flat companion logo already exists.

**Developer notes**

- Attach token-parity, accessibility, theme, RTL, and asset-resolution verification results to the release review.

---

## 4. Source coverage

The page plan above consumes the completed source set as follows:

| Source group | Files | Primary PDF pages |
|---|---|---|
| Project governance | `README.md`; `00-project/00_PROJECT_BRIEF.md`; `01_BRAND_GUIDELINES_WORKFLOW.md`; `02_DEFINITION_OF_DONE.md` | 02, 03, 29, 30 |
| Strategy | `01-strategy/01_BRAND_FOUNDATION.md`; `02_BRAND_POSITIONING.md`; `03_BRAND_VOICE.md`; `04_TARGET_AUDIENCE.md` | 03–07, 15–16, 20, 24–25, 28 |
| Logo system | `02-logo-system/01_LOGO_ANALYSIS.md`; `02_LOGO_USAGE_RULES.md`; `03_LOGO_CLEAR_SPACE.md`; `04_LOGO_DOS_AND_DONTS.md`; `05_APP_ICON_GUIDE.md`; `assets/logos/logo-source-notes.md` | 01, 08–12, 24–26, 30 |
| Visual identity | `03-visual-identity/01_COLOR_SYSTEM.md`; `02_TYPOGRAPHY_SYSTEM.md`; `03_VISUAL_LANGUAGE.md`; `04_LAYOUT_AND_SPACING.md`; `05_ICONOGRAPHY_STYLE.md`; `06_IMAGERY_STYLE.md` | 01, 04, 13–20, 22–27 |
| UI system | `04-ui-system/01_UI_STYLE_GUIDE.md`; `02_COMPONENT_STYLE_GUIDE.md`; `03_DARK_MODE_GUIDE.md`; `04_LIGHT_MODE_GUIDE.md` | 14, 20–23 |
| Marketing | `05-marketing/01_SOCIAL_MEDIA_GUIDE.md`; `02_WEBSITE_HERO_GUIDE.md`; `03_BUSINESS_CARD_GUIDE.md`; `04_PRESENTATION_STYLE_GUIDE.md` | 24–27 |
| Claude Design production | `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`; `01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md`; `02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`; `03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`; `04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md`; `05_CLAUDE_DESIGN_REVIEW_NOTES.md` | Global system, 01–02, 09, 12–18, 28, 30 |
| Design tokens | `07-design-tokens/design-tokens.json`; `colors.css`; `tailwind.colors.js`; `flutter_colors.dart` | 13–16, 18, 21–23, 29–30 |
| Final production chain | `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md`; `03_BRAND_GUIDELINES_PDF_COPY.md`; `04_PDF_EXPORT_CHECKLIST.md` | Downstream outputs governed by this structure |

---

## 5. Required handoff sequence

1. Expand this blueprint into the consolidated reader-ready content in `02_BRAND_GUIDELINES_FULL_DOCUMENT.md`.
2. Reduce and paginate that content into `03_BRAND_GUIDELINES_PDF_COPY.md` without changing approved facts or wording.
3. Complete `04_PDF_EXPORT_CHECKLIST.md` for the final 30-page, 16:9 edition.
4. Build page frames using the naming and master system in this document.
5. Review every page with `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md` and apply only scoped refinements.
6. Export the PDF and page PNGs, then verify page order, fonts, links, contrast, logo fidelity, theme roles, and RTL in a fresh viewer.
7. Save the approved export as `exports/pdf/Building-Suit-Brand-Guidelines-v1.0.pdf` and record stakeholder sign-off.
