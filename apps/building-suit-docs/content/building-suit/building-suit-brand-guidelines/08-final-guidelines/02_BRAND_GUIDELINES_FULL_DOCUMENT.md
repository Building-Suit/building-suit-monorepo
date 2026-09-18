# Building Suit Brand Guidelines

> **Version:** 1.0<br>
> **Status:** Complete master document<br>
> **Brand promise:** **Clarity you can trust.**<br>
> **Primary use:** Brand, product, marketing, and implementation guidance<br>
> **PDF structure:** `01_BRAND_GUIDELINES_STRUCTURE.md`

Building Suit is a mobile-first operational control platform for self-managed residential buildings. These guidelines define how the brand looks, sounds, and behaves across product interfaces, marketing, print, presentations, and implementation.

The system is designed to feel transparent, trustworthy, calm, structured, warm, and quietly premium. Every application should make a complicated shared-building task feel easier to understand and safer to trust.

## Document authority

- Strategy, logo, visual identity, UI, and marketing documents in sections `01`–`05` are the canonical content sources.
- `07-design-tokens/design-tokens.json` is the canonical machine-readable token source.
- The Claude Design files in section `06` govern visual production and review, but do not override upstream brand decisions.
- The approved logo masters are the two PNG files in `assets/logos/`. A vector master and approved flat/monochrome companion mark are still outstanding and must not be improvised.
- Where abbreviated source packs conflict with dedicated documents, the dedicated document governs. In particular, logo clear space uses one window-pane height as `X`, and the primary personality traits are Trustworthy, Clear, Organised, Warm, and Premium.

---

# 1. Cover Content

## Cover copy

**Building Suit**<br>
**Brand Guidelines**<br>
Visual Identity System<br>
**Clarity you can trust.**<br>
Version 1.0 · Confidential

The cover introduces the brand through restraint. It should communicate quality and confidence before the reader encounters any rules.

## Practical usage rules

- Use the approved white/silver logo on the Building Navy to Deep Structure Navy background.
- Center the logo optically and protect it with `1.5X–2X` clear space.
- Keep the cover free from product screenshots, secondary messages, contact details, or decorative icon collections.
- Use one faint gold glow or lit-window accent only.
- Keep version and confidentiality text small and subordinate.

## Visual placeholders

[Insert final cover visual]

[Insert approved white/silver logo on navy gradient]

## Designer notes

- The logo is the sole focal point.
- Use the window-grid motif at very low contrast so it reads as texture, not content.
- The overall feeling should be premium, architectural, calm, and editorial.

## Developer notes

- Preserve the exact title, version, and confidentiality wording in the PDF metadata and export filename.
- The final file name is `Building-Suit-Brand-Guidelines-v1.0.pdf`.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use the supplied white/silver logo unchanged | Rebuild or recolor the logo |
| Protect generous negative space | Fill the cover with features or screenshots |
| Use one restrained gold moment | Add multiple glows, flares, or gold elements |
| Keep the title concise | Add an unapproved slogan |

---

# 2. Table of Contents

The final PDF should follow this content order. Page numbers are assigned during PDF typesetting against `01_BRAND_GUIDELINES_STRUCTURE.md`.

1. Cover Content
2. Table of Contents
3. Brand Introduction
4. Brand Foundation
5. Brand Positioning
6. Brand Voice
7. Target Audience
8. Logo System
9. Logo Usage Rules
10. Logo Clear Space
11. Logo Do / Don’t Rules
12. App Icon Guide
13. Color System
14. Typography System
15. Visual Language
16. Layout and Spacing
17. Iconography
18. Imagery
19. UI Style Guide
20. Component Style Guide
21. Dark Mode Guide
22. Light Mode Guide
23. Social Media Guide
24. Website Hero Guide
25. Business Card Guide
26. Presentation Style Guide
27. Developer Design Tokens
28. Final Brand Checklist

## Practical usage rules

- Present the contents in two balanced columns.
- Group entries into Foundation, Identity, Product Experience, Applications, and Governance.
- Link every item to its destination when the PDF tool supports internal links.
- Rebuild page numbers only after the final pagination is locked.

## Visual placeholders

[Insert table of contents layout]

## Designer notes

- Use gold only for section numbers or one navigation rule.
- Keep descriptions short and avoid page thumbnails.

## Developer notes

- Verify all internal PDF links after export in a fresh PDF viewer.

---

# 3. Brand Introduction

## What Building Suit is

Building Suit is a mobile-first operational control platform for self-managed residential buildings. It replaces fragmented coordination—messaging groups, paper records, informal cash handling, and spreadsheets—with one transparent, unit-centered system.

The platform brings building finance, membership, issues, announcements, governance, and service-provider discovery into a clear and accountable operating model. Residents can understand what they owe, where money goes, what decisions are open, and what is happening in the building. Administrators can maintain clean records, coordinate work, and hand over responsibility without losing history.

Building Suit is the first active portal in a wider hub-and-spoke Suit ecosystem. Future portals may extend the same principles to shops, businesses, and cities, but Building Suit must always remain focused on the needs of self-managed residential communities.

## The change the brand represents

**From:** informal, opaque, fragmented, and dependent on one person.<br>
**To:** structured, visible, accountable, and durable.

The brand is not selling property, luxury real estate, or social networking. It is presenting a trusted operational layer for the shared financial and civic life of a residential building.

## One-line brand statement

**Building Suit — the transparent way to run your building, together.**

## Short description

Building Suit is the transparent way to run a self-managed building. Track charges, payments, and expenses on one clear ledger, manage residents and units, raise and resolve issues, post announcements, and vote on decisions—all in one trusted, mobile-first app.

## Practical usage rules

- Lead with transparency, trust, and operational clarity.
- Describe the unit as the platform’s operational anchor.
- Explain benefits before listing modules or technical features.
- Keep ecosystem references secondary to the active Building Suit product.
- Use precise product vocabulary and avoid claims beyond the approved scope.

## Visual placeholders

[Insert brand introduction visual]

[Insert fragmented-to-structured transformation diagram]

## Designer notes

- Show a recognizable residential-building context, not commercial towers or property-sales imagery.
- The transformation should feel calm and credible, not dramatic or alarmist.

## Developer notes

- Product examples should use approved terms: unit, resident, owner, tenant, charge, payment, expense, balance, ledger, issue, announcement, vote, and join request. Use service-provider terms only when explicitly marked Future/Post-MVP.

## Do / Don’t

| Do | Don’t |
|---|---|
| Position Building Suit as an operating system for self-managed buildings | Position it as a generic chat app or accounting tool |
| Emphasize visibility, accountability, and continuity | Promise unsupported automation or payment capabilities |
| Keep the unit-centered model clear | Treat people or chat threads as the system of record |

---

# 4. Brand Foundation

## Brand mission

**To give every self-managed building a transparent, trustworthy way to run its finances, decisions, and daily operations—together.**

Building Suit replaces guesswork, cash in an envelope, and endless group chats with a clear, auditable, unit-based system that residents can understand and administrators can hand over with confidence.

## Brand vision

**A world where managing a shared building is as clear and trusted as checking your bank balance.**

Building Suit aims to become the default operating system for community-managed property and the foundation of a wider Suit ecosystem that brings the same transparency and structure to other domains.

## Brand promise

**Clarity you can trust.**

The promise has four practical dimensions:

- **Transparency:** residents can see where money goes and how decisions are made.
- **Trust:** the ledger is the source of truth; corrections are recorded rather than hidden.
- **Order:** clear roles, states, and workflows replace chat-driven ambiguity.
- **Continuity:** responsibility can be shared and transferred without losing the building’s history.

## Brand values

1. **Transparency first.** Information is open by default within the user’s rights and role.
2. **Trust is earned by accuracy.** Financial history is auditable and corrections are honest.
3. **The unit comes first.** Finance, occupancy, and governance stay anchored to a clear real-world unit.
4. **Structure over chaos.** Defined roles, statuses, and workflows make shared operations understandable.
5. **Shared responsibility.** No building should depend on one irreplaceable person.
6. **Premium, but accessible.** Quality and polish must remain approachable across technology-literacy levels.

## Brand personality

Building Suit behaves like a trusted building manager who is calm, organised, and quietly premium—competent without being cold, warm without being casual.

- **Trustworthy:** steady, dependable, never alarmist.
- **Clear:** explains money, rules, and decisions in plain language.
- **Organised:** gives every item a place, state, and next step.
- **Warm:** respects the people and community behind the records.
- **Premium:** considered, polished, and quietly confident.

Supporting behaviours are honest, calm, and dependable. They reinforce the five primary traits rather than replace them.

## Brand keywords

Transparent · Trustworthy · Clear · Organised · Premium · Accountable · Calm · Unit-centered · Community · Secure

## Practical usage rules

- Every major brand decision should support at least one value and must not undermine another.
- Premium means trustworthy and well-made, not expensive, exclusive, or ornamental.
- Warmth appears through respectful language, comfortable space, and the gold “lights on” metaphor.
- Transparency never means ignoring privacy, permissions, or role boundaries.

## Visual placeholders

[Insert mission, vision, and promise visual]

[Insert brand values and personality visual]

## Designer notes

- Present mission, vision, and promise as distinct levels of the same system.
- Give the promise the strongest visual emphasis.
- Use the five personality traits consistently throughout the guidelines.

## Developer notes

- Use the values as review criteria for data visibility, corrections, status design, handover flows, and error messages.
- Store approved brand statements in localization resources rather than duplicating them in view code.

## Do / Don’t

| Do | Don’t |
|---|---|
| Make financial information precise and understandable | Hide corrections or imply records silently change |
| Use structure to reduce uncertainty | Add workflow complexity without a clear benefit |
| Make quality accessible to all residents | Use “premium” to imply exclusivity |

---

# 5. Brand Positioning

## Market category

Building Suit belongs to property operations and proptech software for self-managed residential buildings. It spans three practical subcategories:

- Building financial management: charges, payments, expenses, ledger, and balances.
- Community and operations management: membership, issues, announcements, and governance.
- Local service discovery: a directory that helps residents find providers.

The long-term platform framing is a multi-domain operational infrastructure layer, but the current brand must first win trust as the system for running a residential building.

## Positioning statement

> For residents and administrators of self-managed buildings who struggle with opaque finances, scattered chats, and one-person dependency, Building Suit is a transparent, unit-based building operations platform that turns finances, decisions, and daily operations into one clear, auditable, trusted system. Unlike group chats, paper records, and spreadsheets, Building Suit makes every charge, payment, and decision visible and accountable—so the whole building can trust how it is run.

## Positioning territory

Building Suit aims to own one idea: **transparency you can trust**.

- **Emotional territory:** trust, fairness, relief, and peace of mind.
- **Functional territory:** one auditable source of truth for a building’s money, people, and decisions.
- **Quality territory:** premium and polished, but simple enough for every resident.

The brand sits between two extremes: serious enough to trust with money and governance, and warm enough for everyday community use.

## Differentiation

1. The unit is the operational anchor.
2. The ledger is auditable and correction-honest.
3. Structured workflows replace chat ambiguity.
4. Governance includes normal, money, and election votes.
5. Administration can be transferred without losing history.
6. The system works manual-first and remains gateway-ready.
7. The experience is premium, bilingual, RTL-aware, and mobile-first.
8. The product is the first expression of an extensible platform core.

## Competitive contrast

| Alternative | Common appeal | Main weakness | Building Suit advantage |
|---|---|---|---|
| Messaging groups | Familiar and instant | No ledger, roles, or durable decisions | Structured workflows and permanent records |
| Paper notebooks and receipts | Tangible and simple | Hard to share, verify, or transfer | Available, shareable, auditable history |
| Cash envelopes | Familiar habit | Untraceable and dispute-prone | Recorded payments and per-unit balances |
| Spreadsheets | Flexible and inexpensive | Error-prone, one-person-owned, weak permissions | Purpose-built, role-aware, multi-user operation |
| Generic accounting/property software | Powerful | Complex and not community-shaped | Unit-centered, simple, governance-aware experience |

## Why the brand feels premium

Premium perception comes from restraint, accuracy, strong contrast, generous space, the crafted 3D logo, deep navy, precious gold accents, clean light surfaces, and consistent execution. Premium must never depend on excessive effects or luxury clichés.

## Practical usage rules

- Lead with the outcome: visible money, fair decisions, transferable administration.
- Contrast Building Suit with informal behaviours rather than attacking named competitors.
- Use evidence-based claims and label assumptions clearly.
- Keep local practicality and bilingual access visible in positioning.

## Visual placeholders

[Insert positioning framework visual]

[Insert competitive contrast visual]

## Designer notes

- Use a confident editorial hierarchy rather than an aggressive competitor chart.
- Show “structured versus fragmented” without depicting users as careless or incompetent.

## Developer notes

- Avoid UX labels or data models that weaken the unit-centered positioning.
- Do not display unsupported claims in onboarding, app-store copy, or marketing surfaces.

## Do / Don’t

| Do | Don’t |
|---|---|
| Own transparency, structure, and continuity | Compete on hype or novelty |
| Describe real operating outcomes | Present Building Suit as a social network |
| Keep premium approachable | Use luxury-property language or imagery |

---

# 6. Brand Voice

## Voice definition

Building Suit sounds like a calm, competent building manager people trust: clear, respectful, reassuring, and precise. The voice is never bureaucratic, theatrical, or over-familiar.

Four qualities remain constant:

- **Clear:** plain language and direct explanations.
- **Trustworthy:** accurate, honest, and consistent.
- **Calm:** steady around money, errors, overdue balances, and urgent notices.
- **Warm and respectful:** human, inclusive, and considerate of different technology-literacy levels.

## Tone by context

| Context | Increase | Reduce |
|---|---|---|
| Onboarding and empty states | Warmth and encouragement | Jargon and formality |
| Financial messages | Precision and clarity | Emotion and exclamation |
| Errors and failures | Helpfulness and ownership | Blame and technical detail |
| Urgent announcements | Directness and importance | Panic and drama |
| Marketing | Confidence and benefit | Hype and buzzwords |

## Writing principles

1. Choose clarity over cleverness.
2. Lead with the fact, result, or user benefit.
3. Use exact amounts, units, dates, and states.
4. Prefer plain human language over internal terminology.
5. Take responsibility; never blame the user.
6. Stay calm under pressure.
7. Use agreed vocabulary consistently.
8. Write in active voice with short, mobile-friendly sentences.
9. Write for Arabic and English from the start.
10. Translate meaning and tone, not words mechanically.

## Approved vocabulary

**Use:** unit, building, resident, owner, tenant, charge, payment, expense, balance, ledger, issue, announcement, vote, join request. Use service provider only in explicitly marked Future/Post-MVP context.

**Avoid in user-facing copy:** entity, persisted, endpoint, transaction when a more precise word applies, revolutionary, magical, world-class, or any vague internal jargon.

## English examples

- Welcome: “Welcome to Building Suit. Let’s get your building set up.”
- Empty state: “No payments yet. Once you record one, it’ll appear here with the unit balance updated.”
- Balance: “Unit 4B has an outstanding balance of EGP 1,200 across 2 charges.”
- Confirmation: “Payment recorded. Unit 4B’s balance is now EGP 0.”
- Error: “We couldn’t save that just now. Please check your connection and try again.”
- Urgent notice: “Water will be shut off Saturday, 9 AM–1 PM, for tank maintenance. Please store water in advance.”
- Reassurance: “Every change is recorded, so the building’s history stays accurate.”

## Arabic examples

- ترحيب: «أهلًا بك في Building Suit. لنبدأ بإعداد مبناك.»
- حالة فارغة: «لا توجد مدفوعات بعد. بمجرد تسجيل أول دفعة ستظهر هنا مع تحديث رصيد الوحدة.»
- ملخّص الرصيد: «الوحدة 4B عليها رصيد مستحق قدره ١٬٢٠٠ ج.م على دفعتين.»
- تأكيد الدفع: «تم تسجيل الدفعة. أصبح رصيد الوحدة 4B الآن ٠ ج.م.»
- رسالة خطأ: «تعذّر علينا الحفظ الآن. يُرجى التحقق من الاتصال والمحاولة مرة أخرى.»
- طمأنة: «يتم تسجيل كل تغيير، حتى يبقى سجل المبنى دقيقًا.»

Arabic uses natural Modern Standard Arabic. Keep `Building Suit` in Latin script and test mixed Latin, Arabic, numerals, and currencies carefully.

## Product copy rules

- Buttons use verbs: Record payment, Post announcement, Open vote.
- Labels use nouns: Balance, Units, Expenses.
- Empty states explain what will appear and the next action.
- Confirmations state both the result and new state.
- Errors explain what happened and what the user can do next.
- Financial or destructive actions explain the effect before confirmation.

## Marketing copy rules

- Lead with the outcome, not the feature name.
- Sell trust and clarity with credible scenarios.
- Use one clear promise per asset.
- Keep copy restrained and let the visual system carry premium perception.

## Visual placeholders

[Insert tone spectrum visual]

[Insert English and Arabic voice examples]

## Designer notes

- Give English and Arabic examples equal prominence.
- Do not place long paragraphs over imagery.

## Developer notes

- Centralize terminology, reusable system messages, and status labels.
- Do not concatenate localized strings.
- Allow for Arabic expansion and locale-specific currency/date formatting.

## Do / Don’t

| Scenario | Do | Don’t |
|---|---|---|
| Payment success | “Payment recorded. Balance updated.” | “Transaction successfully persisted.” |
| Error | “We couldn’t save that. Please try again.” | “Error 500: invalid input.” |
| Overdue balance | “Unit 4B has EGP 1,200 outstanding.” | “Unit 4B is a bad payer.” |
| Marketing | “See exactly where your building’s money goes.” | “The world’s most revolutionary building app!” |
| Urgent notice | “Water off Saturday, 9 AM–1 PM.” | “EMERGENCY!! READ NOW!!!” |

---

# 7. Target Audience

## Primary audience

Building Suit serves self-managed residential buildings. Within each building, two groups drive adoption and long-term use.

### Building administrators and committee members

They collect charges, record expenses, coordinate maintenance, manage members and units, post notices, and run votes. They need clean records, lower administrative burden, fewer disputes, and a handover process that does not depend on personal memory.

**Brand message:** Your records are clear, your building can trust them, and responsibility no longer depends on one person.

### Residents: owners and tenants

Residents want to know what they owe, why they owe it, where shared money goes, what issues are open, and how decisions are made. They need transparency, fairness, and simple participation.

**Brand message:** See exactly where your money goes and have a real say in how the building is run.

Owner and tenant are distinct roles. Use each term precisely and never imply that tenants are lesser members of the community.

## Secondary audience

### Building owners and investors

Owners who do not live on site need remote visibility into finances, decisions, and their unit’s position.

### Future/Post-MVP service providers

Local tradespeople and maintenance businesses are not an MVP audience. A credible directory presence, discovery, contact, profile management, or Services navigation can return only through a separate Future/Post-MVP scope decision.

### Platform operator and future portals

The wider Suit ecosystem needs Building Suit to establish a credible, extensible trust standard.

## Shared audience context

- Mobile-first use.
- Mixed technology literacy.
- Primarily Arabic-speaking audiences with full English support.
- RTL-aware layouts and local money/date formats.
- Informal, cash-heavy, dispute-prone management practices.

## Emotional needs

- Trust: “I believe the building’s money is handled honestly.”
- Peace of mind: “I do not need to chase for basic information.”
- Fairness: “Everyone follows the same clear rules.”
- Belonging: “I am part of a community that works well together.”
- Pride: “My building feels well managed and respectable.”
- Relief for administrators: “I am no longer carrying this alone.”

## Practical usage rules

- Prioritize administrator and resident needs in primary messaging.
- Keep tasks understandable for users with limited software experience.
- Use inclusive, regionally appropriate imagery and examples.
- Show both owner and tenant perspectives where rights or occupancy matter.
- Present service providers only as Future/Post-MVP scope, not as active MVP discovery participants or transaction users.

## Visual placeholders

[Insert primary audience personas]

[Insert audience needs matrix]

## Designer notes

- Use two large primary persona cards and smaller secondary cards.
- Avoid stereotypes based on age, language, occupation, or technology literacy.

## Developer notes

- Design role-aware flows and permissions.
- Verify Arabic, RTL, currency, dates, and mixed-script content with real data.
- Do not infer identical rights for owners and tenants where product rules differ.

## Do / Don’t

| Do | Don’t |
|---|---|
| Design for administrators and residents first | Treat founders or partners as the primary product audience |
| Use precise role names | Use “tenant” to mean every resident |
| Show locally relevant building contexts | Use generic Western HOA imagery as the only reference |

---

# 8. Logo System

## Logo overview

The Building Suit logo is a three-dimensional letter **B** that is also a residential building. The mark combines brand initial, product category, and brand promise in one object.

The left spine reads as a multi-storey façade. Gold-lit window panes represent units and the people inside them. The ground-floor doorway suggests access and the act of joining a building. The rounded bowls complete the B while keeping the silhouette approachable and software-native.

## Logo meaning

- Solid form communicates stability and permanence.
- Lit windows communicate occupation, care, and transparency.
- The ordered window grid communicates structure and unit-centered operations.
- The doorway communicates access and welcome.
- Navy communicates trust, seriousness, and financial responsibility.
- Gold communicates warmth, value, activity, and premium care.
- White/silver communicates clarity, modernity, and transparency.

## Approved logo variants

| File | Logo appearance | Approved background |
|---|---|---|
| `assets/logos/building-suit-logo-dark.png` | Navy/dark body with gold windows | Light backgrounds |
| `assets/logos/building-suit-logo-light.png` | White/silver body with gold windows | Dark/navy backgrounds |

The filename refers to the logo’s own color, not the background it should appear on.

Both current masters are transparent PNG files at 920 × 1245 px and share identical geometry.

## Outstanding logo assets

- Exact vector/SVG master for crisp scaling and print.
- Approved simplified flat companion mark for small sizes.
- Approved monochrome mark for notification icons, engraving, embossing, and one-color production.
- Confirmed original designer/tool provenance.

These are open production requirements. Do not create unofficial substitutes.

## Practical usage rules

- Use the supplied master files unchanged.
- Preserve geometry, 3D rendering, material, light direction, and gold windows.
- Choose the variant that provides strong background contrast.
- Maintain aspect ratio, clear space, and minimum size.
- Reserve the detailed 3D mark for brand moments and adequately large placements.

## Visual placeholders

[Insert logo system visual]

[Insert dark and light logo variants]

[Insert logo anatomy visual]

## Designer notes

- Treat the building-B and lit window grid as the identity’s primary visual equities.
- The supplied PNGs are approved assets; this document does not authorize redesign.

## Developer notes

- Preserve transparency and intrinsic aspect ratio.
- Use theme-aware asset switching and `contain` behavior.
- Do not upscale beyond the native source resolution.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use the correct supplied master | Trace, rebuild, or approximate the mark |
| Preserve the gold windows and 3D material | Recolor, relight, or flatten the logo |
| Use the building-B as a premium brand moment | Use the detailed logo as a routine small UI icon |

---

# 9. Logo Usage Rules

## Variant by background

| Background | Use | Notes |
|---|---|---|
| White, Pearl White, light gray | Navy/dark logo | Default light-context pairing |
| Building Navy, Deep Navy, charcoal | White/silver logo | Default dark-context pairing |
| Calm dark photography | White/silver logo | Add a restrained navy scrim if needed |
| Calm light photography | Navy/dark logo | Confirm separation across the full mark |
| Solid gold | Navy/dark logo only | Use rarely; gold windows lose distinction |
| Busy image or mid-tone field | Avoid or add a controlled scrim | Never depend on the windows alone for contrast |

## Minimum sizes

| Context | Minimum | Comfortable |
|---|---:|---:|
| Digital full logo | 40 px tall | 64 px tall or more |
| Print full logo | 12 mm tall | 18 mm tall or more |
| Below 40 px | Use approved simplified/app-icon asset when available | Do not keep shrinking the 3D master |

## Digital usage

- Use original transparent PNGs, not screenshots or compressed copies.
- Serve density-appropriate assets.
- Keep the logo upright and uncropped.
- Do not apply CSS filters, blend modes, effects, or non-uniform dimensions.

## Print usage

- Use the navy logo on light stock and the white/silver logo on dark stock.
- Request the vector master for print-critical or large-format work.
- Confirm navy and gold reproduction with the printer.
- Use an approved flat mark for one-color processes only after it exists.

## Mobile and website usage

- App icon: use the app-icon construction in section 12.
- Splash and about screens: use the theme-appropriate full logo.
- Website header: approximately 32–48 px tall with full clear space.
- Favicon: use the approved simplified app-icon mark, not the detailed tall master.

## Visual placeholders

[Insert logo placement examples]

[Insert logo size ladder]

## Designer notes

- Reduce logo size before compromising clear space.
- Test real-size reproduction rather than judging only on a zoomed artboard.

## Developer notes

- Use responsive containers that preserve ratio and clear space.
- Provide `@1x`, `@2x`, and `@3x` or equivalent density assets.

## Do / Don’t

| Do | Don’t |
|---|---|
| Select the variant based on contrast | Use white/silver on light or navy on navy |
| Use native-resolution assets | Upscale or re-export screenshots |
| Place over calm image areas | Drop the logo on visual clutter |

---

# 10. Logo Clear Space

## Clear-space rule

The logo must be surrounded by a protected area free from text, graphics, other logos, container edges, folds, trim, or busy imagery.

**`X` equals the height of one gold window pane in the building façade.**

- Minimum clear space: `1X` on all four sides.
- Recommended hero or standalone clear space: `1.5X–2X`.
- Fallback when a pane cannot be measured: `X = 25%` of total logo height.
- Use one definition consistently within a project and record it in the source file.

## Placement rules

- Anchor the logo to a grid corner or center.
- In LTR layouts, the default navigation placement is top-left.
- In RTL layouts, move placement to top-right but never mirror the artwork.
- Align optically; the tall building spine can shift the perceived center.
- Keep at least `1X` between the logo and a partner mark, plus a divider where appropriate.

## Visual placeholders

[Insert logo clear-space diagram]

[Insert logo safe-area visual]

[Insert LTR and RTL placement comparison]

## Designer notes

- Use the window-pane definition from the dedicated clear-space source.
- Consider building the `1X` padding into reusable logo components.

## Developer notes

- Enforce responsive padding around the asset.
- Keep logo placement clear of device notches, system bars, and safe-area insets.

## Do / Don’t

| Do | Don’t |
|---|---|
| Maintain at least `1X` around every placement | Let text, borders, or trim enter the safe area |
| Use `1.5X–2X` for hero moments | Crowd the logo to make it appear larger |
| Mirror placement in RTL | Mirror or flip the logo artwork |

---

# 11. Logo Do / Don’t Rules

## Correct use

- Use approved masters at original proportions.
- Choose navy on light and white/silver on dark.
- Preserve the full building, windows, doorway, and letterform.
- Keep the gold windows unchanged.
- Preserve the supplied 3D effect and light direction.
- Keep the logo upright, isolated, and high contrast.

## Prohibited use

- Stretching, squashing, skewing, or non-uniform scaling.
- Recoloring the body, windows, doorway, or highlights.
- Rotating, flipping, or mirroring the artwork.
- Cropping or masking part of the mark.
- Adding shadows, glows, outlines, bevels, gradients, badges, or containers.
- Flattening or simplifying the 3D mark by hand.
- Using a low-resolution, recompressed, or screenshotted copy.
- Placing the logo on a low-contrast or busy background.

## Visual placeholders

[Insert logo do and don’t visual]

[Insert distortion, recolor, and low-contrast examples]

## Designer notes

- Keep incorrect examples inside the guidelines file only. Never include them in an exportable asset library.
- Label each error directly and make examples large enough to understand.

## Developer notes

- Lock aspect ratio in shared logo components.
- Avoid runtime filters and theme tinting on the PNG assets.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use exact supplied colors and material | Change the gold bars/windows |
| Use a calm background or scrim | Add effects to compensate for a busy background |
| Request the proper companion mark | Improvise a flat or monochrome version |

---

# 12. App Icon Guide

## Icon concept

The app icon uses the building-B mark without text, centered and optically balanced on a solid Building Navy field. The recommended primary icon is the white/silver building-B with gold windows on navy.

The full tall logo should never be squeezed into a square. The framing changes; the supplied mark itself does not.

## iOS requirements

- Master: 1024 × 1024 px.
- No transparency.
- No pre-rounded corners; iOS applies the mask.
- Keep essential detail within the central ~80%.
- Test at 180 × 180, 120 × 120, and smaller system sizes.

## Android requirements

- Adaptive foreground and background layers at 108 × 108 dp.
- Keep the mark within the central ~66 dp safe zone.
- Play Store master: 512 × 512 px.
- Supply legacy fallback assets for older devices.
- Android 13 themed icons and notification icons require an approved monochrome companion mark.

## Size-stepped treatment

| Size | Treatment |
|---|---|
| 180 px and above | Full detailed building-B |
| 80–180 px | Approved simplified shading when available |
| 40–80 px | Approved flat building-B companion |
| Below 40 px | Approved minimal silhouette with one gold accent |

The simplified and monochrome companions are outstanding. Do not fabricate them from the 3D logo.

## Splash screen

- Use a solid navy or navy-gradient background.
- Center the white/silver logo with generous clear space.
- Respect device safe areas.
- Keep animation subtle and non-blocking; a short fade is sufficient.

## Favicon and notification icons

- Favicon sizes: 16, 32, and 48 px; Apple touch icon 180 px; maskable PWA icon 512 px.
- Android notification icon: flat white silhouette on transparent background, system tinted.
- iOS notifications use the app icon.

## Visual placeholders

[Insert app icon preview]

[Insert iOS and Android safe-area visual]

[Insert app icon size grid]

## Designer notes

- Test circle, squircle, and rounded-square masks.
- Center optically; the building spine may make mathematical centering look off.
- Do not place a busy pattern behind the mark.

## Developer notes

- Generate platform-native icon sets from approved masters.
- Validate maskable zones, themed icons, notification rendering, and splash safe areas on real devices.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use the building-B mark without text | Put the full lockup or a tagline inside the icon |
| Use a solid navy field | Use photography or complex patterns |
| Flag missing simplified assets | Invent a new symbol to fill the gap |

---

# 13. Color System

## Color concept

The palette extends directly from the approved logo:

- **Navy:** trust, stability, finance, structure.
- **Gold:** warmth, value, activity, and the “lights on” moment.
- **White and silver:** clarity, openness, and modern surfaces.

The central rule is simple: **navy is the foundation; gold is the jewel.**

## Core palette

| Name | HEX | RGB | Primary role |
|---|---|---|---|
| Building Navy | `#16293B` | 22, 41, 59 | Primary brand and light-mode action |
| Deep Structure Navy | `#0D1B28` | 13, 27, 40 | Depth, footer, pressed state |
| Premium Gold | `#D89B42` | 216, 155, 66 | Primary accent and dark-mode action |
| Highlight Gold | `#EBB45A` | 235, 180, 90 | Hover, highlight, glow |
| Pearl White | `#F7F8FA` | 247, 248, 250 | Light background and dark-mode text |
| Soft Silver | `#E2E5EA` | 226, 229, 234 | Muted light surface |
| Cloud Gray | `#CBD2DB` | 203, 210, 219 | Light border and divider |
| Graphite Text | `#232B33` | 35, 43, 51 | Primary light-mode text |

## Dark surfaces and secondary colors

| Name | HEX | Use |
|---|---|---|
| Midnight Background | `#0A111A` | Dark-mode base |
| Navy Surface | `#14233A` | Dark card/surface |
| Navy Surface Raised | `#1B2E47` | Dark raised surface |
| Steel Border | `#2E3F52` | Dark border |
| Slate Blue | `#36506E` | Links and supporting blue |
| Sky Steel | `#7E97B3` | Muted dark-mode text |
| Pale Sky | `#DCE6F1` | Light informational background |
| Slate Gray | `#5A6573` | Secondary light-mode text |
| Steel Gray | `#9AA6B4` | Disabled light-mode text/icons |

## Gold ramp

| Step | HEX | Use |
|---|---|---|
| Gold 700 | `#A86C1C` | Edge, pressed, shadow |
| Gold 600 | `#C8902F` | Strong gold border or solid |
| Gold 500 | `#D89B42` | Premium Gold default |
| Gold 400 | `#EBB45A` | Highlight Gold |
| Gold 300 | `#F4CE86` | Light tint |

Gold gradient: `#EBB45A → #D89B42 → #A86C1C`. Use only for special hero and icon moments, never behind body text.

## Semantic colors

| Meaning | Base | Light background | Dark-mode base | Dark background |
|---|---|---|---|---|
| Success | `#2E9E6B` | `#E4F4EC` | `#46B383` | `#18352A` |
| Warning | `#E1841F` | `#FBEEDD` | `#F09A3C` | `#3A2A14` |
| Error | `#D14B4B` | `#F8E3E3` | `#E26A6A` | `#3A1E1E` |
| Info | `#2F77C9` | `#DCE6F1` | `#4F92DD` | `#15263A` |

Finance convention: paid or credit is green, owed or overdue is red, pending is amber. Gold is not a finance-status color.

## Theme roles

| Role | Light | Dark |
|---|---|---|
| Background | Pearl White | Midnight Background |
| Surface | White | Navy Surface |
| Raised surface | White + shadow | Navy Surface Raised |
| Primary text | Graphite Text | Pearl White |
| Secondary text | Slate Gray | Sky Steel |
| Border | Cloud Gray | Steel Border |
| Primary action | Building Navy | Premium Gold |
| Accent | Premium Gold | Highlight Gold |

## Accessibility

- Graphite on Pearl White: approximately 13:1, AAA.
- Building Navy on Pearl White: approximately 12.8:1, AAA.
- Pearl White on Building Navy: approximately 12.8:1, AAA.
- Premium Gold on Building Navy: approximately 5.7:1, AA for normal text.
- Highlight Gold on Building Navy: approximately 7.5:1, AAA.
- Premium Gold on Pearl White: approximately 2.5:1, fail for normal text.

Target WCAG 2.1 AA: 4.5:1 for normal text and 3:1 for large text and UI components. Never rely on color alone.

## Practical usage rules

- Use one gold focal point per view or composition.
- Use gold for selected, active, key CTA, and special premium moments.
- Do not use gold for body text on light surfaces.
- Use semantic colors only for real state.
- Use tints for status backgrounds and full color for icons/text.
- Reference tokens instead of raw values in product code.

## Visual placeholders

[Insert color palette visual]

[Insert light and dark role mapping]

[Insert accessibility contrast examples]

## Designer notes

- Keep swatches large and label every color with name and HEX.
- Do not confuse Warning amber with Premium Gold.

## Developer notes

- Consume semantic role tokens from `design-tokens.json` derivatives.
- Run contrast checks on any new pairing.
- Keep dark semantic variants distinct from light variants.

## Do / Don’t

| Do | Don’t |
|---|---|
| Lead with navy and neutrals | Flood layouts with gold |
| Use one intentional gold focus | Scatter gold across every component |
| Pair status color with icon and label | Communicate state through color alone |
| Use token roles by theme | Hard-code arbitrary HEX values |

---

# 14. Typography System

## Type families

### English and Latin

**Manrope** is the primary family. It combines geometric structure with human warmth and supports the premium, clear tone. **Inter** is the accepted fallback and may be used for especially dense UI contexts.

### Arabic

**IBM Plex Sans Arabic** is the primary Arabic family. It pairs naturally with Manrope and provides strong legibility and a modern, trustworthy tone. Cairo and Tajawal are fallbacks.

## Font stacks

```css
/* Latin */
font-family: "Manrope", "Inter", -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

/* Arabic */
font-family: "IBM Plex Sans Arabic", "Cairo", "Tajawal",
             "Segoe UI", Tahoma, Arial, sans-serif;
```

Self-host or bundle fonts. Do not depend on a runtime CDN for the production app.

## Mobile typography scale

| Token | Size / line height | Weight | Use |
|---|---|---:|---|
| Display | 32 / 40 | 800 | Splash, big balances |
| H1 | 26 / 34 | 700 | Screen title |
| H2 | 22 / 30 | 700 | Section title |
| H3 | 18 / 26 | 600 | Card title |
| Body L | 16 / 24 | 400/500 | Primary body |
| Body M | 14 / 22 | 400/500 | Default UI text |
| Caption | 12 / 18 | 500 | Metadata and labels |
| Overline | 11 / 16 | 600 | Latin eyebrow/tag, +4% tracking |
| Button | 15 / 20 | 600 | Button labels |

## Website typography scale

| Token | Size / line height | Weight | Use |
|---|---|---:|---|
| Hero | 56 / 64 | 800 | Hero headline |
| H1 | 40 / 48 | 700 | Page title |
| H2 | 32 / 40 | 700 | Section title |
| H3 | 24 / 32 | 600 | Subsection |
| H4 | 20 / 28 | 600 | Card/feature title |
| Body L | 18 / 28 | 400 | Lead copy |
| Body | 16 / 26 | 400 | Body copy |
| Small | 14 / 22 | 400 | Caption/footnote |

Use responsive scaling so web type steps down toward the mobile scale on smaller viewports.

## Marketing typography scale

| Token | Approximate size | Weight | Use |
|---|---:|---:|---|
| Mega | 72–96 pt | 800 | Cover or poster statement |
| Headline | 48–64 pt | 700/800 | Slide and campaign title |
| Subhead | 28–36 pt | 600 | Supporting line |
| Body | 18–22 pt | 400/500 | Presentation copy |
| Caption | 12–14 pt | 500 | Legal, source, credit |

## Weight and line-height rules

- 800: display and hero statements.
- 700: H1 and H2.
- 600: H3, buttons, labels, emphasis.
- 500: UI text and captions.
- 400: body copy.
- Limit each surface to 2–3 weights.
- Headings use approximately 1.1–1.3 line height.
- Body uses approximately 1.5 line height.
- Long-form line length is 45–75 characters.

## Arabic and RTL rules

- Use RTL direction and right alignment.
- Increase Arabic line height by approximately 10–15% over Latin.
- Do not use all-caps or tracking.
- Use real font weights and avoid synthetic italics.
- Mirror lists, indents, layout, and directional icons.
- Keep `Building Suit` in Latin script.
- Test diacritics, ligatures, mixed numerals, and currency strings.

## Samples

**English**<br>
Building Suit — Clarity you can trust.<br>
See exactly where your building’s money goes.

**Arabic**<br>
Building Suit — وضوحٌ يمكنك الوثوق به.<br>
اطّلع بدقّة على أوجه إنفاق أموال مبناك.

## Visual placeholders

[Insert typography system visual]

[Insert English type specimen]

[Insert Arabic RTL type specimen]

## Designer notes

- Use live text and verify fonts before export.
- Arabic receives equal visual scale and space, not a smaller translated block.

## Developer notes

- Bundle fonts in Flutter and self-host them on the web.
- Apply locale-aware families and direction.
- Map the scale to named text-style tokens.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use Manrope and IBM Plex Sans Arabic | Mix unrelated font families |
| Build hierarchy with size, weight, and color | Use size alone or too many styles |
| Give Arabic additional line height | Apply caps or tracking to Arabic |
| Use real weights | Fake bold or italic |

---

# 15. Visual Language

## Core idea

Building Suit looks like a well-run building: solid, structured, visible, and warm from within. The visual system is **premium, architectural, and calm**.

Three design words govern the system: **structured · premium · transparent**.

## Architectural depth

- Use layered surfaces to create a clear order: background, card, raised element, modal.
- Use subtle elevation rather than heavy effects.
- Keep geometry rectilinear and ordered, softened by consistent rounded corners.
- Maintain one top-down light direction, aligned with the logo’s rendering.

## Window-grid motif

The square window pane is the key supporting motif. It may appear as:

- A low-contrast background grid.
- A section divider or loading pattern.
- A structural unit in illustration and iconography.
- A pattern with one or a few gold “lit” squares.

The motif should remain quiet. It is not a decorative texture for every surface.

## Premium contrast

- Use decisive contrast between deep navy and light surfaces.
- Reserve gold-on-navy for the single premium focal point.
- Avoid muddy mid-tones and low-contrast gray-on-gray compositions.
- Use generous negative space as a quality signal.

## 3D versus flat

| Use 3D/dimensional treatment | Use flat/simplified treatment |
|---|---|
| Approved logo and app icon | Product UI icons |
| Hero and campaign imagery | Buttons, inputs, lists, tables |
| Splash and app-store art | Favicons and notification icons |
| Selected brand illustrations | Data-dense product screens |

## Shadow system

- Elevation 1: `0 2px 8px rgba(13, 27, 40, 0.08)`.
- Elevation 2: `0 4px 16px rgba(13, 27, 40, 0.12)`.
- Elevation 3: `0 8px 24px rgba(13, 27, 40, 0.16)`.
- Dark mode relies more on surface-lightness steps than visible shadows.

## Practical usage rules

- Keep one focal point and one gold emphasis per composition.
- Group with space before adding borders.
- Use 3D only where it creates a meaningful brand moment.
- Make transparency visible through open layouts, clear states, and readable data.

## Visual placeholders

[Insert visual language moodboard]

[Insert window-grid motif examples]

[Insert 3D versus flat comparison]

## Designer notes

- Premium means restraint, not visual complexity.
- Avoid loud effects, heavy glassmorphism, neon, or novelty motion.

## Developer notes

- Use shared elevation, radius, spacing, and surface tokens.
- Respect reduced-motion preferences and avoid animation that delays task completion.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use layered, ordered surfaces | Create depth with heavy or inconsistent shadows |
| Use the window grid sparingly | Cover every background with a pattern |
| Reserve 3D for brand moments | Add faux-3D controls to product UI |

---

# 16. Layout and Spacing

## Grid system

| Platform | Columns | Margin | Gutter |
|---|---:|---:|---:|
| Mobile, ≤599 dp | 4 | 16 dp | 16 dp |
| Tablet, 600–1023 dp | 8 | 24 dp | 24 dp |
| Desktop/web, ≥1024 px | 12 | 24–32 px | 24 px |
| Web max content width | — | Centered, 1200–1280 px | — |
| Guidelines PDF | 12 | 96 px | 24 px |

## Spacing scale

| Token | Value | Typical use |
|---|---:|---|
| `space-0` | 0 | Reset |
| `space-1` | 4 px | Tight inline gap |
| `space-2` | 8 px | Small padding or chip gap |
| `space-3` | 12 px | Compact gap |
| `space-4` | 16 px | Default padding and mobile margin |
| `space-5` | 24 px | Card padding and inner section gap |
| `space-6` | 32 px | Group separation |
| `space-7` | 48 px | Section separation |
| `space-8` | 64 px | Large section break |
| `space-9` | 96 px | Hero and marketing whitespace |

## Radius system

| Element | Radius |
|---|---:|
| Chip/tag | 8 px or approved pill |
| Button/input | 12 px |
| Card | 16 px |
| Small tile | 12 px |
| Modal/bottom sheet | 20–24 px |
| Large hero panel | 24 px |
| Avatar/FAB | Circular where appropriate |

## Page and section spacing

- Mobile page edge: 16 dp.
- Tablet: 24 dp.
- Web: 24–32 px within a centered max width.
- Card interior: 16–24 px.
- Mobile section spacing: 24–32 dp.
- Web section spacing: 48–96 px.
- Heading-to-content: 16–24 px.
- Card-list gap: 12–16 px.

## Interaction geometry

- Minimum tap target: 44 × 44 dp.
- Minimum gap between targets: 8 px.
- Respect notches, system bars, home indicators, and keyboard insets.
- Keep primary actions reachable for one-handed mobile use.

## RTL layout

Mirror columns, content flow, alignment, navigation, and directional icons. Keep margins and gutters identical. Never mirror the logo artwork.

## Visual placeholders

[Insert responsive grid visual]

[Insert spacing and radius scale]

[Insert PDF master grid]

## Designer notes

- Use only approved scale values; avoid arbitrary gaps and radii.
- Optical logo alignment is allowed but must not create a new spacing token.

## Developer notes

- Expose spacing, radius, and grid values as reusable tokens.
- Use safe-area APIs and locale-aware direction rather than manual offsets.

## Do / Don’t

| Do | Don’t |
|---|---|
| Align content to a consistent grid | Place elements by eye without a shared structure |
| Use the approved spacing scale | Introduce one-off values per screen |
| Group with proximity before borders | Divide every item with a line |

---

# 17. Iconography

## Icon style

Building Suit uses a flat, line-first icon system with a geometric-humanist feel. Icons are calm, modern, and consistent with Manrope and the rounded UI geometry.

- Base grid: 24 × 24 px.
- Live area: approximately 20 px.
- Default stroke: 2 px at 20–24 px size.
- 16 px icons: 1.5 px stroke.
- 32 px and above: 2–2.5 px stroke.
- Use rounded line caps and joins.
- Use approximately 2 px corner rounding on the 24 px grid.

The required library is the free **[Hugeicons](https://hugeicons.com/) Stroke Rounded** set only. Solid, Duotone, Twotone, Bulk, and other paid styles are out of scope and must not be used until a paid license is approved. Do not substitute or mix Lucide, Phosphor, or any other icon family. Create a custom domain icon only when Hugeicons has no clear equivalent, and match the Hugeicons grid, stroke, rounding, and optical weight.

## State rules

| State | Style | Color |
|---|---|---|
| Default/inactive | Stroke Rounded | Slate Gray or Sky Steel |
| Hover | Stroke Rounded | Graphite or Pearl White |
| Active/selected | Stroke Rounded + label/indicator | Premium Gold |
| Semantic | Stroke Rounded, optionally contained | Approved status color |
| Disabled | Stroke Rounded | Cloud/disabled token |

Every state keeps the same Hugeicons Stroke Rounded style. Premium Gold plus a label, underline, rail, dot, or selected container signals the active state; color must not carry meaning alone.

## Navigation icons

- Bottom navigation: 24 px Stroke Rounded; inactive muted; active Gold + label/indicator.
- App bar: 24 px Stroke Rounded icons inside 44 × 44 dp targets.
- Directional icons mirror in RTL.
- Non-directional icons such as search, settings, and home do not mirror.
- Pair navigation icons with text labels where space permits.

## Domain icons

- Unit: window square.
- Building: simplified façade, not the logo.
- Ledger/balance: book or list with currency.
- Charge/payment/expense: receipt, wallet, and directional money movement.
- Issue: wrench or alert in a rounded square.
- Announcement: megaphone or bell.
- Vote: ballot/check; election vote: ballot box.
- Future/Post-MVP service provider: toolbox or handshake; do not use in MVP navigation or active screens.

## Visual placeholders

[Insert iconography system visual]

[Insert icon state examples]

[Insert domain icon set]

## Designer notes

- Keep stroke, corner treatment, and visual weight consistent.
- Use gold only for the emphasized or selected icon.

## Developer notes

- Implement one shared wrapper around the Hugeicons library for size, color, semantics, and RTL mirroring.
- Every actionable icon needs an accessible name and adequate target size.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use free Hugeicons Stroke Rounded consistently | Use paid Solid, Duotone, Twotone, or Bulk styles |
| Use Stroke Rounded + Gold + label/indicator for selected state | Make every icon gold or rely on color alone |
| Mirror only directional icons in RTL | Mirror buildings, settings, or the brand logo |

---

# 18. Imagery

## Photography direction

Photography should feel premium, warm, calm, and real. It should show buildings and communities that are cared for, not staged or aspirationally remote from the product’s users.

- Use warm natural light, dusk, golden hour, and lit windows.
- Grade shadows toward navy and highlights toward warm gold.
- Keep architectural lines clean and provide negative space for copy.
- Show residential façades, entrances, shared spaces, residents, and administrators.
- Represent Arabic-speaking contexts naturally and inclusively.
- Prefer candid, credible scenes over posed stock photography.

## Illustration direction

- Clean, geometric, line-led, and primarily flat.
- Use subtle depth rather than cartoonish volume.
- Base palette: navy and neutrals with one gold accent.
- Use the window grid and simplified building forms.
- Keep people warm and inclusive without exaggeration.
- Maintain one consistent illustration system.

## Abstract visual direction

- Low-contrast window-grid patterns.
- Subtle blueprint or architectural line work.
- Navy gradients with a restrained gold glow.
- Quiet dividers and section devices that support content.

## Image handling

- Use licensed, commissioned, or original imagery and record the source.
- Use navy scrims behind text where needed for contrast.
- Provide localized alt text for meaningful imagery.
- Export web images as WebP or AVIF at appropriate responsive sizes.
- Never upscale low-resolution images.

## Imagery to avoid

- Generic handshakes and staged corporate meetings.
- Empty luxury skyscrapers or real-estate-sales imagery.
- Piggy banks, raining money, coin piles, or financial clichés.
- Harsh saturation, heavy filters, or off-brand green/purple casts.
- Busy compositions with no text-safe area.
- Culturally mismatched or non-inclusive casting.

## Visual placeholders

[Insert photography moodboard]

[Insert illustration style examples]

[Insert imagery do and don’t examples]

## Designer notes

- Every image should reinforce home, trust, fairness, order, or community.
- Keep source and license details with the asset library.

## Developer notes

- Use responsive image formats, preserve focal points, and provide localized alt text.
- Avoid embedding essential information only inside an image.

## Do / Don’t

| Do | Don’t |
|---|---|
| Show real residential buildings and communities | Show luxury towers unrelated to self-managed buildings |
| Use warm light and navy/gold grading | Apply inconsistent filters per campaign |
| Preserve space for readable copy | Place text over visual clutter |

---

# 19. UI Style Guide

## UI personality

The interface behaves like a calm, trusted, premium building manager.

- **Clear:** simple hierarchy and one primary action.
- **Trustworthy:** money and status are precise and visible.
- **Structured:** repeatable cards, lists, roles, and states.
- **Premium:** strong contrast, generous space, and soft depth.
- **Warm:** rounded geometry and respectful copy.

## Mobile-first direction

- Design for Flutter/mobile first and scale to web.
- Keep primary actions within comfortable one-handed reach.
- Use 44 × 44 dp minimum targets.
- Respect safe areas and keyboard insets.
- Mirror full layout and directional controls in RTL.
- Reserve 3D visuals for splash, onboarding, and brand moments.

## App layout

Default anatomy:

1. App bar with title, context, and limited actions.
2. Scrollable content grouped into clear cards and sections.
3. Bottom navigation or a reachable primary action.

Use 16 dp screen padding, 24–32 dp section spacing, and a single-column mobile flow.

## Cards

- White in light mode; Navy Surface in dark mode.
- 16 px radius; 16–24 px padding.
- Soft navy-tinted shadow in light mode.
- Surface-lightness separation in dark mode.
- One focal value or action per card.

## Navigation

- Bottom navigation: 3–5 labeled destinations.
- Active item: Stroke Rounded Gold icon plus label and/or indicator.
- App bar: one title, optional building switcher, and no more than two trailing actions.
- Tabs: 2–5 items with a clear Gold indicator.

## Empty states

Use a calm illustration, a short headline, one line of guidance, and one primary action. Explain what will appear and how to begin.

## Forms

- One-column flow.
- Associated floating label inside every text-entry field.
- 12 px radius and minimum 48 dp height.
- Gold focus ring.
- Error state uses Signal Red plus icon and helpful message.
- Money fields show currency and formatting clearly.

## Modals and sheets

- Use bottom sheets for focused mobile tasks.
- Use centered dialogs for confirmations.
- State the effect of financial or destructive actions.
- Avoid stacked modals.

## Dashboard

The dashboard should show building context, the most relevant balance, quick actions, and current activity. Outstanding balances, urgent announcements, active votes, and open issues receive clear priority without making the page feel alarming.

## Visual placeholders

[Insert UI style overview]

[Insert dashboard layout visual]

[Insert form, empty state, and modal examples]

## Designer notes

- Use one gold focal element per screen.
- Group with space before cards and cards before dividers.
- Make key amounts prominent and precise.

## Developer notes

- Build UI from shared, token-driven primitives.
- Support focus, keyboard, screen-reader semantics, reduced motion, RTL, and localization.

## Do / Don’t

| Do | Don’t |
|---|---|
| Keep one primary action per screen | Present several competing primary buttons |
| Show status with color, icon, and label | Rely on color alone |
| Use clear cards and whitespace | Nest heavy cards or crowd the screen |

---

# 20. Component Style Guide

## Shared component conventions

- Spacing comes from the approved 8 px-based scale.
- Minimum target size is 44 × 44 dp.
- Focus uses a 2 px Gold ring with offset.
- Motion uses 120–200 ms ease.
- Disabled states use reduced emphasis and remain readable.
- Status is always color + icon + label.
- Components define default, hover, pressed, focus, disabled, loading, and relevant domain states.

## Component specifications

| Component | Core treatment | Key states and rules |
|---|---|---|
| Primary button | 12 px radius, ≥48 dp; Navy/Pearl in light, Gold/Deep Navy in dark | One per view; hover, pressed, focus, disabled, loading |
| Secondary button | Transparent or outlined; Navy on light, Pearl on dark | Must remain visibly secondary; no Gold border |
| Ghost button | No border; low-emphasis action | Use for tertiary actions only |
| Input | Surface, 12 px radius, 1 px border, visible label | Gold focus; Signal Red error + icon + text; read-only and disabled states |
| Select | Input styling with trailing chevron | Mobile long lists open in a picker or bottom sheet |
| Card | 16 px radius, 16–24 px padding, soft elevation | Tappable cards add hover/pressed/focus; selected uses Gold border |
| Badge | Semantic tint + full semantic icon/text; 8 px or pill | Never use Gold as a generic status color |
| Tabs | Muted inactive; Gold active indicator | Use 2–5 items; use another pattern for more |
| Bottom navigation | 3–5 labeled destinations | Active = Stroke Rounded Gold icon + label/indicator; inactive = muted Stroke Rounded |
| App bar | Clear title, optional back, ≤2 actions | Back icon mirrors in RTL |
| Toast | Deep Navy surface, Pearl text, optional semantic icon | One line, 3–4 seconds, optional single action |
| Modal/sheet | 20–24 px radius, navy scrim | Single purpose; state consequences clearly |
| Payment card | Precise amount, currency, unit, date, status | Green paid/credit, Red owed/overdue, Amber pending |
| Building card | Building name, role, key figure, optional image | Selected = Gold border; pending = Warning badge |
| Voting card | Title, options, deadline, eligibility, status/results | Open, voted, closing soon, closed, ineligible |

## Primary button details

- Light: Building Navy background, Pearl White text.
- Dark: Premium Gold background, Deep Structure Navy text.
- Label: 15/20, SemiBold.
- Full width on mobile when it completes the current task.
- Loading replaces the label with a centered progress indicator while preserving width.

## Finance and status rules

- Always show amount + currency + unit + relevant date.
- Do not use Gold for positive or negative finance states.
- Pair every status color with a label and icon.
- Use consistent status vocabulary throughout the product.

## Visual placeholders

[Insert UI components preview]

[Insert component state matrix]

[Insert payment, building, and voting card examples]

## Designer notes

- The preview page is representative; the specifications above govern the complete set.
- Use realistic Building Suit copy and data.

## Developer notes

- Implement components as reusable, theme-aware, locale-aware primitives.
- Use semantic role tokens rather than direct palette values.
- Cover keyboard, focus, loading, disabled, validation, and screen-reader states in tests.

## Do / Don’t

| Do | Don’t |
|---|---|
| Define every interaction state | Ship only the default visual state |
| Use semantic tokens and consistent vocabulary | Hard-code colors and status labels per feature |
| Keep components accessible in both themes | Treat dark mode as a color inversion |

---

# 21. Dark Mode Guide

## Dark-mode principle

Dark mode is a first-class expression of the navy-led brand. It uses layered navy surfaces, soft light text, and a Gold primary action. It is not a simple inversion of light mode.

## Surface hierarchy

| Layer | Color |
|---|---|
| Background 0 | Midnight `#0A111A` |
| Surface 1 | Navy Surface `#14233A` |
| Raised 2 | `#1B2E47` |
| Modal 3 | `#1B2E47` over dark scrim |

Elevation is communicated mainly through surface lightness and Steel Border `#2E3F52`. Shadows remain subtle.

## Text and actions

- Primary text: Pearl White `#F7F8FA`.
- Secondary text: Sky Steel `#7E97B3`.
- Disabled text: `#4A5A6E`.
- Primary action: Premium Gold `#D89B42` with Deep Navy text.
- Hover/accent: Highlight Gold `#EBB45A`.
- Logo: white/silver variant.

## Component behavior

- Cards use Navy Surface and Steel Border.
- Inputs use Navy Surface, Steel Border, and Highlight Gold focus.
- Bottom navigation uses Navy Surface with muted inactive Stroke Rounded icons and a Gold Stroke Rounded active icon plus label/indicator.
- Semantic colors use the approved dark variants.
- Modals use Raised surface over a deep scrim.

## Accessibility

- Pearl White on Midnight is approximately 12.8:1, AAA.
- Gold on Navy Surface is approximately 5:1 or higher, AA.
- Avoid pure black and pure white to reduce harsh halation.
- Maintain visible focus and non-color status cues.

## Visual placeholders

[Insert dark mode UI preview]

[Insert dark surface elevation visual]

## Designer notes

- Use Gold as the one primary focal action, not as ambient decoration.
- Avoid excessive glow, transparency, or pure-black fields.

## Developer notes

- Map all surfaces and semantic states through dark role tokens.
- Test system-theme selection, manual overrides, contrast, screenshots, and chart colors.

## Do / Don’t

| Do | Don’t |
|---|---|
| Build elevation with navy surface steps | Use heavy shadows to separate every element |
| Use the white/silver logo | Place the navy logo on dark surfaces |
| Use approved lightened semantic colors | Reuse low-contrast light-theme status values blindly |

---

# 22. Light Mode Guide

## Light-mode principle

Light mode is the default theme. It uses Pearl White as a soft base, White cards for elevation, Graphite text for comfort, Navy for primary actions, and Gold as a restrained accent.

## Surface hierarchy

| Layer | Treatment |
|---|---|
| Background 0 | Pearl White `#F7F8FA` |
| Surface 1 | White `#FFFFFF` |
| Raised 2 | White + stronger approved shadow |
| Modal 3 | White over navy scrim |

## Text and actions

- Primary text: Graphite `#232B33`.
- Secondary text: Slate Gray `#5A6573`.
- Disabled text: Steel Gray `#9AA6B4`.
- Links: Slate Blue `#36506E`.
- Primary action: Building Navy `#16293B` with Pearl White text.
- Accent/focus: Premium Gold `#D89B42`.
- Logo: navy/dark variant.

## Gold on light surfaces

Gold is not the light-mode primary button color and must not be used for normal text. Its contrast against Pearl White is approximately 2.5:1. Use Gold for focus rings, selected borders, active indicators, and limited decorative emphasis.

## Component behavior

- Cards use White on Pearl with a soft navy-tinted shadow.
- Bottom navigation uses White, a top divider, muted inactive Stroke Rounded icons, and a Gold Stroke Rounded active icon plus label/indicator.
- Inputs use White, Cloud Gray border, and Gold focus.
- Payment states use semantic colors, not Gold.

## Visual placeholders

[Insert light mode UI preview]

[Insert light surface elevation visual]

## Designer notes

- Use Graphite instead of pure black for a softer premium feel.
- Keep light and dark examples structurally aligned for comparison.

## Developer notes

- Light roles are the default token mapping.
- Prevent Gold from being used as normal text or the primary light-theme button.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use Navy for the primary light-mode action | Use Gold buttons or text that fail contrast |
| Lift White cards from Pearl with subtle shadow | Put every surface on pure white with no hierarchy |
| Use the navy logo on light surfaces | Use the white/silver logo on white |

---

# 23. Social Media Guide

## Format reference

| Asset | Size |
|---|---:|
| Instagram square | 1080 × 1080 px |
| Instagram portrait | 1080 × 1350 px |
| Story/Reel cover | 1080 × 1920 px |
| LinkedIn square | 1200 × 1200 px |
| LinkedIn link image | 1200 × 627 px |
| Profile avatar | 320 × 320 px or larger |
| LinkedIn cover | 1128 × 191 px |

## Social style

- Use navy or a calm, on-brand photograph as the base.
- Use one short, benefit-led headline.
- Use one Gold accent word, line, or icon.
- Keep the logo in a corner with full clear space.
- Use the app-icon mark for avatars and the full logo for covers and larger placements.
- Apply a navy scrim behind text on photography.
- Create native English and Arabic/RTL versions.

## Platform guidance

### Instagram

Use strong visual hierarchy, short copy, generous negative space, and consistent carousel templates. The first slide hooks; the final slide carries the CTA.

### LinkedIn

Use a more professional, evidence-led tone for product value, transparency stories, milestones, hiring, and thought leadership. Data and quote cards should remain restrained.

### Stories and Reels

Keep content in the central safe zone, away from platform UI. Use one idea per frame and subtle motion only.

### Launch announcement

Use the navy gradient, white/silver logo, one Gold accent, a concise launch line, one supporting value statement, and one action. Produce matched Instagram, Story, and LinkedIn variants.

## Accessibility and publishing

- Repeat essential information in the caption.
- Add localized alt text.
- Use a small, consistent hashtag set.
- Keep handles and brand naming consistent.
- Verify compression, safe zones, and contrast after platform upload.

## Visual placeholders

[Insert social media templates]

[Insert launch announcement set]

[Insert social safe-zone examples]

## Designer notes

- Templates should feel related without being identical.
- Keep each post to one message and one Gold focus.

## Developer notes

- Maintain export presets and naming conventions by platform, size, and language.
- Preserve captions and alt text in the content workflow.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use the app-icon mark for avatars | Squeeze the full tall logo into a profile circle |
| Use short, readable on-image copy | Put paragraphs inside posts |
| Create Arabic layouts natively | Mirror the logo or mechanically reverse an English layout |
| Repeat essential information in captions | Make the image the only source of information |

---

# 24. Website Hero Guide

## Hero purpose

The hero is the brand’s largest digital first impression. It should communicate one clear benefit, establish trust, and present one action.

## Recommended structure

- Slim header with the correct logo variant.
- One short benefit-led headline.
- One supporting sentence.
- One primary CTA and an optional secondary action.
- One phone mockup showing a real on-brand product screen.

Desktop uses a 12-column, two-column layout: copy on the left and product visual on the right. Arabic mirrors the structure. Mobile stacks headline, supporting copy, CTA, then mockup.

## Approved example copy

**Headline:** See exactly where your building’s money goes.<br>
**Supporting line:** One transparent app for charges, payments, issues, announcements, and decisions.<br>
**Primary CTA:** Get started<br>
**Secondary CTA:** See how it works

## Dark hero

- Navy-to-deep-navy gradient.
- Subtle window grid and faint Gold glow.
- White/silver logo.
- Pearl White headline and Sky Steel support text.
- Gold primary CTA with Deep Navy text.
- Dark-mode product screen or a controlled light-screen contrast.

## Light hero

- Pearl White background.
- Navy logo.
- Graphite headline and Slate Gray support text.
- Navy primary CTA with Pearl text.
- Gold limited to one accent detail.
- Light-mode product screen.

## Responsive and accessibility rules

- Header logo: approximately 32–48 px tall.
- Use semantic heading order.
- Make CTAs keyboard accessible with visible focus.
- Optimize the phone mockup and photography.
- Provide localized alt text.
- Verify contrast over all responsive crops.

## Visual placeholders

[Insert website hero preview]

[Insert dark and light hero variants]

[Insert mobile and Arabic RTL hero]

## Designer notes

- Use a real dashboard or approved product screen.
- Keep one message and one dominant action.
- Do not crop key UI or crowd the phone mockup.

## Developer notes

- Implement theme-aware logos, responsive layout, localized content, semantic headings, focus states, and image optimization.
- Mirror layout in RTL while preserving the logo artwork.

## Do / Don’t

| Do | Don’t |
|---|---|
| Lead with a user outcome | Lead with an internal module name |
| Use one strong product mockup | Crowd the hero with many devices |
| Use Gold CTA on navy and Navy CTA on light | Reuse Gold CTA on light without contrast checks |

---

# 25. Business Card Guide

## Specifications

| Specification | Value |
|---|---|
| Standard size | 85 × 55 mm landscape |
| Alternatives | 90 × 50 mm or US 3.5 × 2 in |
| Bleed | 3 mm each side |
| Safe area | 4–5 mm inside trim |
| Resolution | 300 dpi minimum |
| Color | CMYK; optional spot/Pantone for navy and gold |
| Stock | 350–400 gsm |

## Front

- Building Navy background.
- White/silver logo centered or optically aligned.
- Full logo clear space.
- Optional `Clarity you can trust.` line.
- No contact details.

## Back

- Pearl White or White background.
- Small navy logo in a corner.
- Name, role, mobile, email, website, and optional social handle.
- One thin Gold rule or small Gold accent.
- Left-aligned in English and mirrored/right-aligned in Arabic.

## Typography

| Element | Approximate size | Weight |
|---|---:|---:|
| Name | 10–11 pt | 700 |
| Role | 8–9 pt | 500 |
| Contact details | 7–8 pt | 400/500 |
| Tagline | 8–9 pt | 600 |

Use Manrope for Latin and IBM Plex Sans Arabic for Arabic. Keep to 2–3 weights.

## Print production

- Use a vector master for print-critical logo reproduction; it is currently outstanding.
- Do not treat the raster PNG as a large-format or foil-ready master.
- Gold foil, metallic Pantone, spot UV, or soft-touch lamination are optional premium finishes.
- Proof a physical sample before full production, especially when using Gold.
- Export printer-ready PDF/X with correct profiles and embedded/outlined fonts as required.

## Visual placeholders

[Insert business card front and back]

[Insert business card dieline]

[Insert Arabic RTL card variant]

## Designer notes

- Keep the front minimal and logo-led.
- Gold finishing is optional; it must not change the digital color standard.

## Developer notes

- Keep print source, linked assets, color profiles, font licenses, and printer proof together in the handoff package.

## Do / Don’t

| Do | Don’t |
|---|---|
| Respect bleed and safe area | Place the logo or details near trim |
| Use a physical proof | Approve Gold reproduction from screen alone |
| Request the vector master | Upscale the PNG for print production |

---

# 26. Presentation Style Guide

## Presentation system

- Format: 16:9, 1920 × 1080.
- Grid: 12 columns.
- Margins: approximately 64–80 px.
- Alternate navy and light masters.
- Use one takeaway and one focal point per slide.
- Use one Gold accent per slide.
- Keep a consistent footer with logo, slide number, and confidentiality where relevant.

## Core slide types

### Cover

Navy gradient, subtle window grid, white/silver logo, clear title, one supporting line, and date/context.

### Problem

One concrete problem statement with 2–4 evidence points or one simple visual. Use Warning or Error colors only where they have real meaning.

### Solution

Present Building Suit as the calm, transparent answer with one product visual and three concise benefits.

### Product

Use one to three focused screens with short icon-led callouts. Do not create a wall of screenshots.

### Metrics

Use one headline metric, one clean chart or table, labeled axes/units, and cited sources. Label planning assumptions clearly.

## Presentation typography

| Element | Size | Weight |
|---|---:|---:|
| Slide title | 32–40 pt | 700/800 |
| Big metric | 60–96 pt | 800 |
| Subhead | 20–24 pt | 600 |
| Body | 16–20 pt | 400/500 |
| Caption/source | 11–13 pt | 500 |

## Chart colors

- Primary series: Building Navy.
- Single highlighted series or point: Premium Gold.
- Secondary series: Slate Blue, Sky Steel, Cloud Gray.
- Verified Green and Signal Red only for real positive/negative meaning.
- Limit charts to approximately 3–4 series.
- Avoid 3D chart effects and heavy gridlines.

## Bilingual presentations

Provide separate, properly composed English and Arabic decks where needed. Arabic is RTL and right-aligned. Keep `Building Suit` in Latin.

## Visual placeholders

[Insert presentation master layouts]

[Insert cover, product, and metrics slides]

[Insert chart color example]

## Designer notes

- The headline should state the conclusion, not merely the topic.
- Use fewer elements and more space.

## Developer notes

- Programmatic slide generation must lock canvas, master grid, fonts, palette, footer, and chart-series mapping.

## Do / Don’t

| Do | Don’t |
|---|---|
| Put one idea on each slide | Use dense pages of bullets |
| Highlight one key series in Gold | Make every series Gold or equally prominent |
| Cite sources and label assumptions | Present planning estimates as confirmed facts |

---

# 27. Developer Design Tokens

## Token architecture

Building Suit uses a three-layer token model:

1. **Raw tokens:** fixed brand values such as Building Navy or Premium Gold.
2. **Role tokens:** semantic light/dark assignments such as background, surface, text, primary, accent, and border.
3. **Component tokens:** component-specific references for buttons, cards, inputs, chips, and modals.

Feature code should consume semantic or component tokens rather than raw color values.

## Source files

| File | Role |
|---|---|
| `07-design-tokens/design-tokens.json` | Canonical, platform-agnostic source of truth |
| `07-design-tokens/colors.css` | Web CSS custom properties and theme roles |
| `07-design-tokens/tailwind.colors.js` | Tailwind palette and role values |
| `07-design-tokens/flutter_colors.dart` | Flutter raw palette and light/dark role classes |

The JSON file also defines typography, spacing, radius, shadow, and component tokens. All derivative files must remain synchronized with it.

## Key raw tokens

```json
{
  "color": {
    "brand": {
      "buildingNavy": { "value": "#16293B" },
      "premiumGold": { "value": "#D89B42" },
      "pearlWhite": { "value": "#F7F8FA" }
    }
  }
}
```

## Key role rule

```text
Light mode primary action → Building Navy
Dark mode primary action  → Premium Gold
```

Example CSS consumption:

```css
.primary-action {
  color: var(--bs-text-on-primary);
  background: var(--bs-primary);
  border-radius: 12px;
}
```

Example Flutter consumption:

```dart
final colors = Theme.of(context).brightness == Brightness.dark
    ? const BuildingSuitDark()
    : const BuildingSuitLight();
```

## Naming and usage rules

- Raw tokens describe what a value is: `buildingNavy`, `premiumGold`.
- Role tokens describe why it is used: `primary`, `surface`, `textMuted`.
- Component tokens describe a stable component decision.
- Use camelCase in JSON/Dart conventions and established CSS custom-property naming on web.
- Do not create feature-local aliases for existing roles.
- Do not copy raw HEX values into components.

## Synchronization and validation

- Treat `design-tokens.json` as canonical.
- Generate or compare derivative outputs in CI.
- Validate JSON syntax and required keys.
- Check raw palette parity across JSON, CSS, Tailwind, and Flutter.
- Run light/dark screenshot tests for core components.
- Run automated contrast checks for supported role pairings.
- Review any token change across design, web, Flutter, marketing, and documentation before release.

## Visual placeholders

[Insert developer token architecture visual]

[Insert JSON to CSS, Tailwind, and Flutter flow]

[Insert light and dark token mapping]

## Designer notes

- Design files should use variables/tokens matching canonical names where the design tool allows.
- Do not create visually identical but differently named local styles.

## Developer notes

- Enforce token use in shared primitives first.
- Block raw color literals in feature code where practical.
- Keep the token source and generated files in the same reviewed change.

## Do / Don’t

| Do | Don’t |
|---|---|
| Use role tokens in components | Hard-code raw palette values in feature code |
| Keep all platform outputs synchronized | Patch one platform file independently |
| Review token changes across both themes | Assume a light-theme change is safe in dark mode |

---

# 28. Final Brand Checklist

Use this checklist before approving any major product surface, campaign, template, or final guidelines export.

## Brand foundation

- [ ] The work supports transparency, trust, order, continuity, and shared responsibility.
- [ ] Premium is expressed through quality and restraint, not exclusivity.
- [ ] Claims are accurate and within approved product scope.
- [ ] The primary audience remains administrators and residents.

## Brand voice

- [ ] Copy is clear, calm, precise, warm, and respectful.
- [ ] Money, dates, units, and states are explicit.
- [ ] Approved vocabulary is used consistently.
- [ ] Errors take responsibility and provide a next step.
- [ ] Marketing avoids hype, superlatives, and unsupported claims.
- [ ] English and Arabic copy have equal quality.

## Logo

- [ ] An approved master file is used.
- [ ] Navy logo appears on light; white/silver logo appears on dark.
- [ ] Gold windows and 3D treatment are unchanged.
- [ ] Aspect ratio is locked; the logo is not cropped or mirrored.
- [ ] At least `1X` clear space is present.
- [ ] Minimum size is respected: 40 px digital or 12 mm print.
- [ ] No shadows, glows, outlines, badges, or added effects are applied.
- [ ] Missing vector or flat assets are flagged rather than improvised.

## Color

- [ ] Only approved tokens are used.
- [ ] Navy and neutrals carry the composition.
- [ ] One Gold focus is used per view or page.
- [ ] Gold is not used for normal text on light backgrounds.
- [ ] Semantic colors represent genuine status only.
- [ ] Status uses color + icon + label.
- [ ] All required pairings meet WCAG AA.

## Typography

- [ ] Manrope is used for Latin and IBM Plex Sans Arabic for Arabic.
- [ ] The approved hierarchy and weights are used.
- [ ] No surface uses unnecessary font families or too many weights.
- [ ] Arabic is RTL, right-aligned, and has additional line height.
- [ ] Arabic has no caps or tracking.
- [ ] `Building Suit` remains in Latin script.

## Layout and imagery

- [ ] Layout uses the approved grid, spacing, and radius values.
- [ ] The composition has one primary focal point.
- [ ] Negative space is sufficient.
- [ ] Imagery is licensed, regionally appropriate, and on-brand.
- [ ] Text over imagery has a controlled scrim and adequate contrast.
- [ ] Meaningful imagery has localized alt text.

## UI and components

- [ ] Core components use role/component tokens.
- [ ] Default, hover, pressed, focus, disabled, loading, and error states are defined.
- [ ] Tap targets are at least 44 × 44 dp.
- [ ] Focus is visible and keyboard behavior is complete.
- [ ] Light and dark themes are both verified.
- [ ] RTL and localization are verified with real content.
- [ ] Financial amounts show currency, unit, date, and status precisely.

## Applications

- [ ] Website uses one message, one primary action, and a real product screen.
- [ ] Social assets use correct formats, safe zones, captions, and alt text.
- [ ] Business cards include bleed, safe area, and print proof requirements.
- [ ] Presentations use one takeaway and one Gold accent per slide.
- [ ] Every application uses the correct logo variant.

## Developer tokens

- [ ] `design-tokens.json` remains canonical.
- [ ] CSS, Tailwind, and Flutter outputs match the canonical values.
- [ ] Feature code avoids raw color literals.
- [ ] Theme-role mapping is correct: Navy primary on light, Gold primary on dark.
- [ ] Token changes pass parity, contrast, and screenshot validation.

## PDF and delivery

- [ ] The document follows the final structure in `01_BRAND_GUIDELINES_STRUCTURE.md`.
- [ ] All required visual placeholders are replaced with approved visuals.
- [ ] The final PDF is 1920 × 1080, 16:9, with pages in the approved order.
- [ ] Headers, footers, version, confidentiality, and page numbers are consistent.
- [ ] Fonts are embedded or outlined as required.
- [ ] Logo and image assets are sharp at 100%.
- [ ] The screen PDF uses sRGB; print applications use appropriate CMYK/spot specifications.
- [ ] Internal links work.
- [ ] English and Arabic have been proofread.
- [ ] The PDF has been opened and reviewed in a fresh viewer.
- [ ] Review notes are resolved and stakeholder approval is recorded.

## Visual placeholders

[Insert final brand checklist visual]

[Insert final approved logo lockup]

## Designer notes

- Treat this as a release gate, not a decorative closing page.
- Keep open asset requests visible until the vector and flat companion marks are approved.

## Developer notes

- Attach token-parity, accessibility, theme, RTL, and asset-resolution verification results to the release review.

## Final statement

**Building Suit — Clarity you can trust.**

Every expression of the brand should make shared building operations feel more visible, more ordered, and easier to trust.

---

## Production source map

This master document consolidates the complete source set:

| Source group | Files used |
|---|---|
| Project governance | `README.md`; `00-project/00_PROJECT_BRIEF.md`; `00-project/01_BRAND_GUIDELINES_WORKFLOW.md`; `00-project/02_DEFINITION_OF_DONE.md` |
| Strategy | `01-strategy/01_BRAND_FOUNDATION.md`; `01-strategy/02_BRAND_POSITIONING.md`; `01-strategy/03_BRAND_VOICE.md`; `01-strategy/04_TARGET_AUDIENCE.md` |
| Logo system | `02-logo-system/01_LOGO_ANALYSIS.md`; `02-logo-system/02_LOGO_USAGE_RULES.md`; `02-logo-system/03_LOGO_CLEAR_SPACE.md`; `02-logo-system/04_LOGO_DOS_AND_DONTS.md`; `02-logo-system/05_APP_ICON_GUIDE.md`; `assets/logos/logo-source-notes.md` |
| Visual identity | `03-visual-identity/01_COLOR_SYSTEM.md`; `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md`; `03-visual-identity/03_VISUAL_LANGUAGE.md`; `03-visual-identity/04_LAYOUT_AND_SPACING.md`; `03-visual-identity/05_ICONOGRAPHY_STYLE.md`; `03-visual-identity/06_IMAGERY_STYLE.md` |
| UI system | `04-ui-system/01_UI_STYLE_GUIDE.md`; `04-ui-system/02_COMPONENT_STYLE_GUIDE.md`; `04-ui-system/03_DARK_MODE_GUIDE.md`; `04-ui-system/04_LIGHT_MODE_GUIDE.md` |
| Marketing | `05-marketing/01_SOCIAL_MEDIA_GUIDE.md`; `05-marketing/02_WEBSITE_HERO_GUIDE.md`; `05-marketing/03_BUSINESS_CARD_GUIDE.md`; `05-marketing/04_PRESENTATION_STYLE_GUIDE.md` |
| Production direction and review | `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md`; `06-claude-design/01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md`; `06-claude-design/02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md`; `06-claude-design/03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md`; `06-claude-design/04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md`; `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md` |
| Developer implementation | `07-design-tokens/design-tokens.json`; `07-design-tokens/colors.css`; `07-design-tokens/tailwind.colors.js`; `07-design-tokens/flutter_colors.dart` |
| Final production chain | `08-final-guidelines/01_BRAND_GUIDELINES_STRUCTURE.md`; `08-final-guidelines/03_BRAND_GUIDELINES_PDF_COPY.md`; `08-final-guidelines/04_PDF_EXPORT_CHECKLIST.md` |

The next production artifact is `03_BRAND_GUIDELINES_PDF_COPY.md`, which paginates and condenses this master without changing approved facts, rules, or values.
