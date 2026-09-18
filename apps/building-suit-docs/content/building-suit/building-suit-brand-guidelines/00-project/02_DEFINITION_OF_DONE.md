# 02 — Definition of Done

A deliverable is "done" only when it meets the criteria below. Use this as the acceptance checklist for each phase and for the project as a whole.

## Per-document criteria
- [ ] All placeholder text and headings are replaced with real, final content.
- [ ] Content is consistent with the strategy (`01-strategy/`) and does not contradict upstream documents.
- [ ] Decisions are specific and actionable (exact values, not vague guidance).
- [ ] Visual examples / diagrams are included where the document calls for them.
- [ ] Bilingual (Arabic / English, RTL) implications are addressed where relevant.
- [ ] Accessibility requirements (contrast, legibility) are stated and met where relevant.

## Logo system criteria
- [ ] Correct variant rules defined (dark logo on light, light logo on dark).
- [ ] Clear space and minimum sizes specified.
- [ ] Do's and don'ts illustrated.
- [ ] App icon specs cover iOS and Android requirements.

## Visual identity & tokens criteria
- [ ] Color palette has HEX/RGB values and passes WCAG contrast for its intended use.
- [ ] Typography scale defined for headings, body, and UI, with Arabic + Latin fonts.
- [ ] `design-tokens.json` is filled with final values and is the source of truth.
- [ ] `colors.css`, `tailwind.colors.js`, and `flutter_colors.dart` match `design-tokens.json`.

## UI & marketing criteria
- [ ] Core components specified with states (hover/pressed/focus/disabled).
- [ ] Dark and light mode both fully covered.
- [ ] Marketing applications (social, web hero, business card, presentation) have concrete specs and templates.

## Final delivery criteria
- [ ] `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` assembles all sections into one reviewed document.
- [ ] PDF exported following `04_PDF_EXPORT_CHECKLIST.md` and saved in `exports/`.
- [ ] Claude Design assets exported per `06-claude-design/04_CLAUDE_DESIGN_EXPORT_CHECKLIST.md` and saved in `exports/`.
- [ ] Stakeholders have reviewed and approved the final guidelines.

## Definition of "project done"
The project is complete when every section (`01`–`08`) meets its criteria above, the design tokens are consistent across all four formats, and an approved brand guidelines PDF exists in `exports/`.
