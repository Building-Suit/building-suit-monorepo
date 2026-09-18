---
name: bootstrap-html-prototype
description: Create the approved Building Suit high-fidelity prototype workspace using Pug, semantic HTML, plain CSS, fixtures, and minimal JavaScript. Use after the prototype plan and repository design-system index are approved and before any product screen is implemented.
---

# Bootstrap the HTML Prototype

## Workflow

1. Confirm the prototype plan and repository design-system index are approved.
2. Create `prototype/` with Pug pages/layouts/components, plain CSS layers, minimal scripts, fixtures, docs, compiled `dist/`, and screenshot folders.
3. Add only the build dependencies needed for Pug compilation, asset copying, local serving, and deterministic checks.
4. Copy approved logo assets from `.docs/building-suit-brand-guidelines/assets/` without alteration and record their source paths.
5. Create infrastructure and an empty component-lab shell only. Do not create product screens.
6. Do not add React, Vue, Angular, Tailwind, shadcn/ui, Supabase, APIs, real authentication, or production Flutter code.
7. Run the deterministic build check.
8. Record created paths, dependency versions, and any blocked tool in the prototype docs.
9. Stop for review before building the design system or screens.

## Required Characteristics

- Mobile base: 390 × 844.
- Light/dark and LTR/RTL foundations.
- Semantic tokens and logical CSS properties.
- Fixture-driven states.
- Readable compiled HTML for Cowork review and Claude Code handoff.
