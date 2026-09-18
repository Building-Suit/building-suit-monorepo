# 01 — Brand Guidelines Workflow

This document defines the order in which the Building Suit brand guidelines are produced. Each phase builds on the previous one, so work top to bottom.

## Workflow order

### Phase 0 — Project setup (`00-project/`)
Confirm the brief, this workflow, and the definition of done. Verify the source logo files are present in `assets/logos/`.

### Phase 1 — Strategy (`01-strategy/`)
Define the brand foundation, positioning, voice, and target audience. **Everything downstream references these decisions**, so complete this first.

### Phase 2 — Logo system (`02-logo-system/`)
Analyze the existing logo and define usage rules, clear space, do's/don'ts, and the app icon. The logo anchors color and visual decisions.

### Phase 3 — Visual identity (`03-visual-identity/`)
Define color, typography, visual language, layout & spacing, iconography, and imagery. This is the visual core that feeds both the UI system and the design tokens.

### Phase 4 — Design tokens (`07-design-tokens/`)
As soon as color, type, and spacing are settled in Phase 3, encode them as tokens (`design-tokens.json` as the source of truth, then `colors.css`, `tailwind.colors.js`, `flutter_colors.dart`). Tokens are produced here so the UI system can reference real values.

### Phase 5 — UI system (`04-ui-system/`)
Apply the visual identity and tokens to the product: UI style guide, components, and dark/light mode guides.

### Phase 6 — Marketing (`05-marketing/`)
Apply the brand to social media, the website hero, business cards, and presentations.

### Phase 7 — Claude Design production (`06-claude-design/`)
**Claude Design** generates the visual brand identity board and the visual brand guidelines PDF from the source pack and prompts, then exports assets per the Claude Design export checklist into `exports/`. **Claude Coworker** stays responsible for the files, text, rules, tokens, checklists, and review notes.

### Phase 8 — Final guidelines & PDF (`08-final-guidelines/`)
Assemble the structure, write the full document, prepare the PDF copy, and export the final PDF following the PDF export checklist. Final files land in `exports/`.

## Dependency summary
```
Strategy → Logo system → Visual identity → Design tokens → UI system → Marketing → Claude Design → Final guidelines/PDF
```

## Working rules
- `design-tokens.json` is the single source of truth for token values; the CSS/Tailwind/Flutter files are kept in sync with it.
- Each document should reference upstream decisions rather than restating them.
- Nothing is "final" until it meets `02_DEFINITION_OF_DONE.md`.
