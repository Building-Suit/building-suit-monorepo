# Building Suit — Claude Project Instructions

## Outcome

Build a high-fidelity Pug/HTML prototype from approved product documents and the repository-native Building Suit design system, then hand the approved evidence to Claude Code for a greenfield Flutter implementation.

## Responsibility Split

- **Repository brand guidelines:** design-system foundations, canonical tokens, component treatment, typography, imagery rules, assets, and visual language.
- **Claude Cowork:** index the repository design system, regenerate its components, design product screens from UX/PRD requirements, build/review the HTML prototype, and prepare handoff evidence.
- **Claude Code:** implement the production Flutter app from normative documents and approved evidence.

## Design System Source

- Root: `.docs/building-suit-brand-guidelines/`
- Canonical values: `.docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json`
- Component rules: `.docs/building-suit-brand-guidelines/04-ui-system/02_COMPONENT_STYLE_GUIDE.md`
- Final rules: `.docs/building-suit-brand-guidelines/08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md`
- Assets/evidence: `.docs/building-suit-brand-guidelines/assets/` and `exports/`

No Claude Design handoff, Google Drive connector, MCP server, or external design-system export is required. Cowork reads the repository directly and regenerates the component lab.

The HTML prototype is evidence, not production architecture.

## Authority Order

1. `.docs/03. BUILDING_SUIT_UX_SPEC.md` — behavior, presentation, navigation, states, validation, RTL, interruptions.
2. `.docs/01.BUILDING_SUIT_PRD.md` — scope, product rules, permissions, user stories, acceptance criteria.
3. `.docs/02.BUILDING_SUIT_BRD.md` — business context and priority.
4. `.docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json` — exact canonical token values.
5. Final/dedicated brand and UI documents — final brand rules.
6. Indexed control records in `prototype/.design-system-control/` — source mapping, components, decisions, and approvals.
7. `.docs/08.BUILDING_SUIT_IMPLEMENTATION_PLAN.md` — build order and traceability.
8. `.docs/04.BUILDING_SUIT_SYSTEM_ARCHITECTURE.md` — Flutter target and handoff mapping.

Condensed prompts/source packs never override final or dedicated documents.

## Hard Boundaries

- Building Suit is the only active portal to prototype.
- Do not invent internal UI for Shop Suit, Business Suit, City Suit, or Super-Admin.
- Do not prototype live Paymob collection unless scope is explicitly reopened.
- Do not modify product requirements to make implementation easier.
- Do not replace canonical colors, type, icons, spacing, radii, shadows, logo rules, or accessibility rules.
- Use Pug, semantic HTML, plain CSS, fixtures, and minimal JavaScript.
- Do not add React, Vue, Angular, Tailwind, shadcn/ui, Supabase, APIs, real authentication, or production Flutter code to the prototype.
- Do not modify backend, database, shared-core, or production application logic during prototype work.
- Preserve unresolved requirements in a decision log; never infer hidden behavior.

## Confirmed Brand Corrections

- Personality: Trustworthy, Clear, Organised, Warm, Premium.
- Logo clear-space `X`: one gold window-pane height; 25% of total logo height is fallback only.
- Latin type: Manrope. Arabic type: IBM Plex Sans Arabic.
- Icons: Hugeicons Stroke Rounded only.
- Primary action: Building Navy on light, Premium Gold on dark.

## Working Method

1. Index and approve the repository-native design system.
2. Plan and trace one vertical slice.
3. Bootstrap infrastructure only.
4. Materialize and approve the component lab.
5. Build one screen family per task.
6. Review visually before fixing.
7. Update source, state, QA, decision, and Flutter mapping records with every slice.
8. Run the deterministic build check before completion.

Never claim a screen is approved until screenshots pass UX, repository design-system, responsive, RTL, dark-mode, accessibility, and user-approval checks. There is no pre-existing product-screen reference to match.
