---
name: index-design-system
description: Index the canonical Building Suit design system directly from .docs/building-suit-brand-guidelines, inventory foundations/components/rules/assets, and create controlled records for Cowork screen design. Use before Cowork builds the component lab or designs any product screen, and whenever the repository guidelines change.
---

# Index Repository Design System

Treat the dedicated repository brand-guidelines directory and canonical token JSON as design-system authority.

## Fixed Sources

- Root: `.docs/building-suit-brand-guidelines/`
- Canonical tokens: `07-design-tokens/design-tokens.json`
- UI rules: `04-ui-system/`
- Visual identity: `03-visual-identity/`
- Final rules: `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md`
- Assets/evidence: `assets/` and `exports/`

## Workflow

1. Confirm the selected folder is the Building Suit repository and the fixed sources exist.
2. Read `design-system-control/00_START_HERE.md` and the dedicated source files relevant to foundations/components.
3. Treat `07-design-tokens/design-tokens.json` as canonical for exact values. CSS, Flutter, and other platform files are derivative checks, not competing authority.
4. Treat `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` and dedicated topic guides as final rules. Treat `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md` as orientation only.
5. Inventory:
   - design-system foundations and tokens;
   - component names, anatomy, variants, states, and responsive/RTL behavior;
   - reusable assets and their source file paths/URLs;
   - missing dark, RTL, interaction, responsive, or accessibility rules.
6. Preserve the confirmed personality traits: Trustworthy, Clear, Organised, Warm, Premium.
7. Preserve the logo clear-space rule: `X` is one gold window-pane height; 25% of total logo height is fallback only.
8. Update `design-system-control/01_DESIGN_SYSTEM_MANIFEST.md`, `02_COMPONENT_CATALOGUE.md`, and `04_DISCREPANCY_LOG.md` from repository evidence. Initialize `03_SCREEN_DESIGN_APPROVAL_INDEX.md` as Cowork-owned work.
9. Distinguish:
   - approved visual decisions;
   - canonical token values;
   - implementation interpretation;
   - unresolved conflicts.
10. Do not generate prototype code, design product screens, or overwrite source documents during indexing.
11. Stop for user approval of the indexed design-system contract.

## Completion Gate

Report indexed source paths, foundations/components/rules/assets, completed control records, conflicts, missing repository evidence, and the approval required before Cowork plans product screens.
