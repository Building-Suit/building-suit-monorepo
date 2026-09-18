---
name: prepare-flutter-handoff
description: Prepare the approved repository design system and high-fidelity Cowork HTML prototype as a controlled evidence package for Claude Code to implement the production Flutter app. Use after prototype screen families and visual QA are approved.
---

# Prepare the Flutter Handoff

## Workflow

1. Run the prototype build check and confirm readable compiled HTML exists.
2. Confirm every implemented screen has exact normative sources, an approved Cowork design brief/composition decision, relevant design-system rules, roles, states, screenshots, QA status, and component mappings.
3. Reconcile canonical tokens with indexed repository design records. Keep unresolved conflicts explicit.
4. Complete `prototype/docs/FLUTTER_HANDOFF.md` with:
   - authority order;
   - CSS token to Flutter theme mapping;
   - component to widget mapping;
   - state to Riverpod/domain-state mapping;
   - navigation and overlay behavior;
   - accessibility and RTL requirements;
   - screenshot acceptance references;
   - open decisions and non-goals.
5. Verify the handoff against architecture §7 and §19 plus the implementation-plan sequence.
6. State explicitly that HTML/Pug/JavaScript are evidence, not production architecture. Do not recommend WebView or mechanical code conversion.
7. Produce a ready-to-paste Claude Code kickoff prompt that starts with foundations and one vertical slice.
8. Do not implement Flutter in this skill.

## Completion Gate

Report build status, screen coverage, missing evidence, unresolved decisions, and readiness for Claude Code.
