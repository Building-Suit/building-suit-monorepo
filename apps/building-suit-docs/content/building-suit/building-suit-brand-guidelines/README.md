# Building Suit — Brand Guidelines

This repository holds the complete brand identity and guidelines system for **Building Suit**, a mobile-first operational control platform for self-managed residential buildings.

## Project purpose
To define and document a consistent Building Suit brand — strategy, logo system, visual identity, UI system, marketing applications, and machine-usable design tokens — and to assemble it into a final, shareable guidelines document (web + PDF). The brand should feel transparent, trustworthy, calm, and structured, and must work bilingually (Arabic and English, including RTL).

The work currently starts from a single existing asset: the logo. Everything else is defined here.

## Source logo files
The master logo is provided in two variants in `assets/logos/`:

| File | Use on |
|---|---|
| `building-suit-logo-dark.png` | light backgrounds |
| `building-suit-logo-light.png` | dark backgrounds |

Origin and handling notes are recorded in `assets/logos/logo-source-notes.md`. (Copied from the project source at `.docs/branding/01-logo-source/`.)

## Final deliverables
- **Brand strategy** — `01-strategy/`
- **Logo system** — `02-logo-system/`
- **Visual identity** — `03-visual-identity/`
- **UI system** — `04-ui-system/`
- **Marketing applications** — `05-marketing/`
- **Design tokens** — `07-design-tokens/` (`design-tokens.json` is the source of truth, with `colors.css`, `tailwind.colors.js`, and `flutter_colors.dart` generated from it)
- **Final guidelines** — `08-final-guidelines/` and the exported PDF + assets in `exports/`

## Folder structure
```
building-suit-brand-guidelines/
├── README.md
├── assets/logos/            # master logo files + source notes
├── 00-project/              # brief, workflow, definition of done
├── 01-strategy/             # foundation, positioning, voice, audience
├── 02-logo-system/          # analysis, usage, clear space, do/don't, app icon
├── 03-visual-identity/      # color, type, visual language, layout, icons, imagery
├── 04-ui-system/            # UI + component style, dark/light mode
├── 05-marketing/            # social, web hero, business card, presentations
├── 06-claude-design/        # Claude Design source pack, board + guidelines prompts, refinement, export checklist, review notes, app-screens workflow
├── 07-design-tokens/        # colors.css, tailwind.colors.js, flutter_colors.dart, design-tokens.json
├── 08-final-guidelines/     # structure, full document, PDF copy, PDF checklist
└── exports/                 # generated final outputs (PDF, asset exports)
```

## Workflow order
Work is produced top-to-bottom; each phase depends on the previous one. Full detail is in `00-project/01_BRAND_GUIDELINES_WORKFLOW.md`.

```
Strategy → Logo system → Visual identity → Design tokens → UI system → Marketing → Claude Design → Final guidelines/PDF
```

1. **Strategy** (`01-strategy/`) — the decisions everything else references.
2. **Logo system** (`02-logo-system/`) — anchored to the existing logo.
3. **Visual identity** (`03-visual-identity/`) — color, type, and the visual core.
4. **Design tokens** (`07-design-tokens/`) — encode color/type/spacing once settled.
5. **UI system** (`04-ui-system/`) — apply identity + tokens to the product.
6. **Marketing** (`05-marketing/`) — apply the brand to outward-facing material.
7. **Claude Design** (`06-claude-design/`) — generate the visual brand board and guidelines PDF and export assets.
8. **Final guidelines & PDF** (`08-final-guidelines/`) — assemble and export.

See `00-project/00_PROJECT_BRIEF.md` for the brief and `00-project/02_DEFINITION_OF_DONE.md` for acceptance criteria.

## How Claude Design will be used
**Claude Design** turns the written guidelines into polished visual artifacts (the visual Brand Identity Board and the visual Brand Guidelines PDF). **Claude Coworker** remains responsible for files, text, rules, tokens, checklists, and review notes.
- `06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md` — the condensed brand reference Claude Design consumes.
- `06-claude-design/01_CLAUDE_DESIGN_BRAND_BOARD_PROMPT.md` — prompt to create a single-page **brand identity board**.
- `06-claude-design/02_CLAUDE_DESIGN_BRAND_GUIDELINES_PROMPT.md` — prompt to create the multi-page **visual guidelines PDF**, mapped to the sections in this repository.
- `06-claude-design/03_CLAUDE_DESIGN_REFINEMENT_PROMPTS.md` — section-by-section refinement prompts.
- `06-claude-design/04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` — export requirements and settings.
- `06-claude-design/05_CLAUDE_DESIGN_REVIEW_NOTES.md` — review log (v1.0 approved).
- `06-claude-design/06_CLAUDE_COWORK_HIFI_HTML_PROTOTYPE_WORKFLOW.md` — complete Claude Cowork setup for indexing this repository-native design system, regenerating components, designing/building the Vue/Vite prototype, reviewing screens, and handing evidence to Claude Code for Flutter implementation. No Claude Design handoff is required.

The markdown in this repository remains the source of truth; Claude Design consumes that content and is kept in sync with it.

## How the PDF will be exported
The final guidelines are assembled in `08-final-guidelines/` and exported to PDF:
1. `01_BRAND_GUIDELINES_STRUCTURE.md` defines the table of contents and section mapping.
2. `02_BRAND_GUIDELINES_FULL_DOCUMENT.md` is the consolidated, reviewed document.
3. `03_BRAND_GUIDELINES_PDF_COPY.md` is the print/PDF-optimized version (cover, page breaks, dividers).
4. `04_PDF_EXPORT_CHECKLIST.md` covers page size, margins/bleed, font embedding, color profile, and compression.

The exported PDF (and any Claude Design asset exports) are saved in `exports/`.

---

> **Status:** Project initialized. All section files currently contain placeholders describing what they will hold; the `00-project/` documents and this README are complete.
