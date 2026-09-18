---
name: materialize-design-system
description: Materialize the approved repository-native Building Suit design system as semantic CSS tokens, Pug component mixins, fixtures, and a component-lab page. Use after indexing and bootstrap are approved and before any product screen is built.
---

# Materialize the Design System

## Workflow

1. Confirm the repository design-system index and prototype scaffold are approved.
2. Read the handoff manifest, component catalogue, discrepancy log, canonical token JSON, and relevant final/dedicated UI documents.
3. Use the dedicated UI/visual-identity guides for component anatomy, visual treatment, density, and imagery. Use canonical JSON for exact token values.
4. Implement semantic plain-CSS token layers, typography, layout primitives, component styles, state styles, utilities, and reduced-motion behavior.
5. Implement reusable Pug mixins/partials for every approved component.
6. Create a component-lab page showing each component, variant, state, theme, and direction represented in the indexed repository design system.
7. Preserve Manrope, IBM Plex Sans Arabic, Hugeicons Stroke Rounded, one gold focal point, light/dark primary-role flipping, logical properties, focus visibility, and minimum target sizing.
8. Do not introduce a new palette, font, icon family, radius, shadow, layout framework, or component style absent from approved sources.
9. Do not create product screens.
10. Run the build check and capture component-lab light, dark, and RTL views.
11. Update the component catalogue, discrepancy log, prototype decisions, visual QA, and Flutter token/widget mappings.
12. Stop for approval of the component lab before screen implementation.
