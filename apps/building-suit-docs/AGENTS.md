# Documentation app

Root rules apply. Maintained shared specifications live in `docs/shared`; architecture decisions live in `docs/architecture`; product documentation remains with its app.

- Before every task, run the root `pnpm agent:preflight`. Use short-lived `codex/building-suit-docs/*` feature branches, keep fixes on their open PR, and follow `docs/shared/git-workflow.md` for stacks, parallel work and manual GitHub merges. Documentation may have one active root PR into `stg`; its children target only an open documentation parent.
- Original Building Suit material lives in `content/building-suit`. Prototype and original agent guidance under `reference` are historical evidence, not runtime code or active workflow instructions.
- The docs generator indexes maintained and original documents and preserves asset links. Change the source, then run `pnpm docs:generate`; do not hand-edit `app/generated` or `public/sources`.
- Render repository Markdown with raw HTML disabled. Do not add arbitrary filesystem access based on route parameters.
- `/components` demonstrates real shared components. Keep examples free of production mutations and private customer data.
- Update navigation, source links and examples with relevant shared changes. Build and check the documentation app before finishing.
