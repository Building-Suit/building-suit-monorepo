---
name: build-prototype-screen
description: Design and build one Building Suit prototype screen family from exact UX/PRD headings, canonical tokens, the indexed repository design system, and existing prototype components. Use when Cowork must create or revise login, onboarding, home, finance, community, governance, services, notifications, or profile screens.
---

# Build One Prototype Screen Family

## Required Input

Require the screen family, page names, roles, states, exact normative headings, relevant repository design-system components/rules, a design brief, and verification viewports. Do not require an external screen reference.

## Workflow

1. Read the prototype source map, state catalogue, decisions, indexed design manifest, relevant component records, and only the named normative headings.
2. Inspect the existing Pug layouts/mixins, CSS components, fixtures, and component lab before editing.
3. Restate the implementation scope and source coverage concisely.
4. Stop and record a discrepancy when the design brief or system conflicts with UX behavior or canonical tokens.
5. Reuse shared components. Add a new reusable component to the component lab before consuming it in a screen.
6. Implement only requested states with fixtures, semantic HTML, `data-state`, and appropriate ARIA attributes.
7. Cowork owns screen composition. Create a clear hierarchy, balanced density, intentional imagery/motif use, and coherent layout while obeying approved components, tokens, and visual-language rules.
8. Preserve light/dark, English/Arabic RTL, keyboard focus, reduced motion, safe areas, 44 × 44 targets, and one primary/gold focal point.
9. Do not add APIs, Supabase, persistence, real auth, production business logic, or unsupported portals.
10. Record the screen design brief, composition rationale, reused components, and user approval in `design-system-control/03_SCREEN_DESIGN_APPROVAL_INDEX.md`, then update the source map, state catalogue, decisions, visual QA record, and Flutter handoff mapping.
11. Build, open the compiled page, and capture the required verification views.
12. Report changed files, implemented states, checks, screenshots, and unresolved gaps.
