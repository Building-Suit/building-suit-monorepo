# Repository Design System → Cowork Control

This folder records how Cowork indexes the canonical repository design system, regenerates components, and approves newly designed product screens.

## Source of truth

Use `.docs/building-suit-brand-guidelines/` directly. The most important sources are:

- `07-design-tokens/design-tokens.json` for exact canonical values;
- `04-ui-system/01_UI_STYLE_GUIDE.md` for UI direction;
- `04-ui-system/02_COMPONENT_STYLE_GUIDE.md` for component anatomy, variants, and states;
- `04-ui-system/03_DARK_MODE_GUIDE.md` and `04_LIGHT_MODE_GUIDE.md`;
- `03-visual-identity/` for color, typography, visual language, layout, icons, and imagery;
- `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` for the complete final rules;
- `assets/` and `exports/` for approved visual evidence.

No Claude Design export, MCP connector, Google Drive handoff, or external design-system copy is required.

## Authority

- Canonical token values remain in `.docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json`.
- UX behavior remains governed by `.docs/03. BUILDING_SUIT_UX_SPEC.md`.
- The repository brand-guidelines directory governs visual rules and component treatment.
- Cowork creates and proposes product-screen composition from UX/PRD requirements.
- Conflicts are recorded in `04_DISCREPANCY_LOG.md`; they are not silently resolved.

Do not alter canonical source documents or approved assets during prototype generation.
