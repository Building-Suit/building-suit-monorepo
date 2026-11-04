# HQ static restart — 4 November 2026

The founder requested removal of the previous HQ work and a fresh start using only the layout of the newly attached 1600×900 reference image. They explicitly excluded offices and functionality and requested edits in the primary repository checkout for live server feedback. This supersedes the office/backend acceptance described in the 3 November records.

The current layout consists of Building Suit HQ branding at the start of the header, centered Workspace/Tasks/Brain labels, a disconnected status and disabled CEO/profile actions, a large empty rounded workspace, a workspace label and an empty minimap with disabled view controls. No room, person, company-brain artwork, connection, task, conversation, authentication, persistence or interactive viewport is included.

The runtime is `apps/company-hq`; the complete page template and typed presentation contract are `packages/ui/src/templates/BsHqLayoutPage.vue` and `packages/ui/src/types/hqLayoutPresentation.ts`. The documentation catalogue consumes the same template. The app retains the existing shared Nuxt layer, canonical brand assets/fonts/tokens and bilingual direction support.

The previous HQ APIs, bridge/runtime utilities, authentication route, composable, office scene, office/access templates and viewport controller are removed. Supabase migration history, historical design evidence, private ignored environment/data files and unrelated products remain preserved. No hosted operation or deployment is part of this work.

Verify the production layout in a browser on desktop and mobile, English/LTR and Arabic/RTL. Confirm the main canvas and minimap are empty, controls are disabled, no HQ API requests occur and no horizontal page overflow occurs. Run the app/catalogue typechecks and builds, strict ownership checks, release checks and diff checks. Actual validation results are recorded by the implementing task; this scope record does not itself claim acceptance.

## Local verification — 4 November 2026

Completed in the primary checkout `/home/tareq/Dev/building-suit-monorepo`, branch `codex/company-hq/office-design`, adjusting the existing open review PR528. No new worktree was created. Existing downstream PR529/PR530 were inspected and preserved; they are not included in this reset and must be reconciled before any later integration that could restore retired HQ behavior.

Passing checks:

- HQ and documentation app typechecks and production builds.
- HQ lint and shared template/icon/type/UX export lint; catalogue lint passed with five existing warnings in the unchanged catalogue examples.
- Eight production browser scenarios: 1600×900 English/dark, 1440×1000 English with light preference, 390×844 English/dark, 390×844 Arabic with light preference, 375×812 Arabic/dark, 320×568 English with light preference, 1600×900 Arabic/dark, and retired-route HTTP checks. The reference chrome deliberately remains dark with either saved theme preference.
- Empty canvas/minimap, disabled controls, no application API requests or browser errors, no page overflow, no clipped header elements, contained minimap controls. Removed HQ state/bridge/auth/action/MCP endpoints, login and office artwork return 404.
- `pnpm check`: canonical tokens and workspace boundaries pass; 150 complete route templates, zero migration debt, 80 historical migrations unchanged.
- `node tooling/checks/suit-template-boundaries.mjs --require-strict`: 174 Vue files across eight discovered applications, zero violations.
- `pnpm release:check`, frozen offline lockfile validation, and `git diff --check`.

Actual production captures are generated under `apps/company-hq/test-results/hq-layout-*.png`. Desktop, mobile, Arabic 375px and Arabic desktop captures were visually inspected. Representative runtime captures are committed as [desktop](design/hq-static-layout-desktop.png) and [Arabic mobile](design/hq-static-layout-mobile-ar.png). The dev server is running from this primary checkout on loopback port 3101 and the actual page was also reviewed in the in-app browser. There was no running HQ server available before replacement; the earlier implementation was inspected from source.

The full `pnpm agent:preflight` failed while scanning the repository/worktree inventory. Documented fallback commands subsequently refreshed origin/stg, confirmed this branch at the exact open PR528 head and upstream divergence 0/0, and inspected all six live open PRs. Publication uses the existing HQ root, preserving its children. Full workspace unit/e2e suites and database tests were not rerun: the replacement removes HQ business/runtime behavior, and affected consumers are HQ and the shared component catalogue. No hosted deployment, database operation, model connection or staging/main merge was performed.
