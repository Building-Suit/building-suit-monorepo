---
name: plan-html-prototype
description: Plan the Building Suit high-fidelity Pug/HTML prototype from approved PRD/UX requirements, canonical tokens, the indexed repository design system, and implementation order. Use before scaffolding or when Cowork must create a design brief for a new screen family.
---

# Plan the HTML Prototype

## Preconditions

- The repository design-system index is approved.
- `design-system-control/01_DESIGN_SYSTEM_MANIFEST.md` is complete enough to govern implementation.

## Workflow

1. Read the handoff manifest, component catalogue, Cowork screen design/approval index, discrepancy log, and only the relevant normative product headings.
2. Preserve this authority order:
   1. UX specification for behavior and presentation;
   2. PRD for product rules and permissions;
   3. canonical token JSON for exact values;
   4. approved repository design-system records for components and visual language, not screen composition;
   5. implementation plan for sequence;
   6. architecture for later Flutter mapping.
3. Create or update:
   - `prototype/docs/PROTOTYPE_PLAN.md`;
   - `prototype/docs/PROTOTYPE_SOURCE_MAP.md`;
   - `prototype/docs/SCREEN_STATE_CATALOGUE.md`;
   - `prototype/docs/DECISIONS.md`.
4. Map each screen family to exact UX/PRD headings, roles, states, relevant design-system components/rules, a Cowork-owned design brief, and acceptance screenshots.
5. Keep Building Suit as the only active portal. Keep Paymob collection and future portal UIs out of scope.
6. Surface missing behavior or missing design-system rules. The repository does not provide product screens; Cowork owns screen composition.
7. Propose the smallest vertical slice and stop for approval before scaffolding or code changes.

## Completion Gate

The plan must identify every required source, state, role, component, design constraint, Cowork design decision, open decision, and verification view for the first slice.
