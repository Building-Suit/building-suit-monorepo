# Company HQ

Read root repository rules and [the current HQ README](README.md). The founder restarted HQ on 4 November 2026 as a static layout preview. This supersedes the previous office, active-role, backend and exact office-screenshot acceptance requirements. The current request explicitly places edits in the primary repository checkout so the founder can watch hot reload; use `pnpm dev:hq --current` for that checkout.

Keep only the reference image's header arrangement and empty rounded workspace, with an empty minimap and disabled visual controls. Do not add offices, rooms, agents, company-brain artwork, functionality, authentication, network calls or persistence without a new request. Do not show a fabricated connection or activity status.

The app route renders one registered `BsHqLayoutPage` from `packages/ui` with typed `HqLayoutContent`. Keep `BsAppRoot`, canonical branding, fonts, design tokens, bilingual content and the root lockfile. No app-local presentation, CSS or Vue components are permitted. Keep the component catalogue and canonical route registry in sync.

Earlier files under `docs/work-packages/company-hq` are dated evidence unless identified as current. Preserve migration history, ignored environment/data files and unrelated products. The static preview needs no Company Brain connection, credentials, database, hosted activation or deployment. Run relevant source checks, HQ and catalogue typechecks/builds, and browser verification of the empty layout and disabled controls. Report actual results and limitations.
