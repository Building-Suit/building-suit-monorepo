# Building Suit HQ workspace

HQ was restarted on 4 November 2026 at the founder's request. The current workspace uses the reference image's header arrangement and a floating 3D holographic orb above a base at the center of the rounded canvas. The bottom-right overview shows an orb icon and camera controls. Clicking/tapping the actual orb, using Brain navigation or choosing the Company Brain button opens a read-only note browser for the local Insync Brain mirror. Department offices and roads are postponed; no characters, agents, authentication, tasks, messages, LLM calls or Brain writes are added. Tasks, Talk to CEO and profile controls remain disabled.

From the monorepo root:

```sh
pnpm dev:hq --current
```

Open `http://127.0.0.1:3101` on the server's computer. `--current` serves the checkout where the command runs; edits there hot-reload. The founder explicitly requested work in the primary repository checkout. No database, OAuth setup or cloud provider activation is needed.

The orb scene can be shown without configuration. To enable local note access, copy `.env.example` to the app's ignored `.env` and set the private server variable `NUXT_HQ_BRAIN_PATH` to the absolute path of the local Insync-synchronized folder named `building-suit-brain`. Keep that personal path out of source and public runtime configuration. Restart the dev server after changing this setting. A missing, unavailable or ineligible folder produces an unavailable state. The current implementation uses a local mirror rather than a direct Google Drive API connection; Insync owns synchronization independently.

The Brain dialog supports title/path search, manual refresh, note selection and escaped raw Markdown text. Relative note paths and local file modification times are shown; the server's observed timestamp records when it read the local mirror. Neither timestamp proves that Insync has synchronized the latest cloud data. Notes are selected by opaque IDs rather than a client-supplied filesystem path. No note content is included in SSR payloads or persisted in a client cache.

The local GET routes `/api/brain` and `/api/brain/notes/:id` use a loopback socket/Host guard with same-origin checks and the HQ request header. They do not trust forwarded host/IP headers or add remote identity/authentication. Reads stay under the configured folder, do not follow symlinks and exclude hidden entries, script directories and secret/private-key-like path names. The scanner caps results at 2,000 notes, traversal at 20 levels and 20,000 inspected entries, and individual Markdown files at 512 KiB; a partial-result state indicates omitted or unavailable entries. Name-based exclusions do not classify the contents of every otherwise eligible note. No write endpoint is provided.

The workspace supports these camera controls:

| Input | Action |
| --- | --- |
| Left mouse drag or one-finger touch drag | Rotate the view around the orb |
| Right/middle mouse drag or Shift + drag | Move the view horizontally or vertically |
| Mouse wheel or touch pinch | Zoom |
| Two-finger touch drag | Move the view |
| First/second overview button | Zoom out/in |
| Third overview button | Restore center, 100% zoom and default camera angle |
| Focused workspace arrow keys / Shift + arrow keys | Rotate / move the view |
| Focused workspace + or − / Home or 0 | Zoom / restore the default view |

The app route supplies translated `HqLayoutContent`, including `HqBrainContent`, and a typed `HqBrainPresentation` to the complete shared `BsHqLayoutPage` template. Shared UI owns the `BsDialog` note browser, `BsHologramScene`, WebGL renderer and orb picking. `useSpatialViewport` in `packages/ux` owns camera gestures, activation coordination and reset state. The app's `useCompanyBrain` composable owns the read-only API lifecycle, while app server utilities own local filesystem access. Shared UI does not query Brain or import server infrastructure. The documentation app demonstrates the same template in its component catalogue. English/Arabic and LTR/RTL use the shared infrastructure.

The founder has instructed agents to stop autonomous testing until tester agents are introduced. No tests, builds, lint, typechecks, browser/runtime verification or API requests are run for this implementation; acceptance and the local Brain connection are unverified. The existing browser suite still describes the earlier empty canvas and disabled viewport controls and needs updating by the future testers. Its previous eight passing static-layout scenarios do not verify the orb, camera interaction or Brain access.

See the [current Brain scope and handoff](../../docs/work-packages/company-hq/HQ-BRAIN-20261104.md) and the preceding [orb record](../../docs/work-packages/company-hq/HQ-ORB-20261104.md). The [static restart record](../../docs/work-packages/company-hq/STATIC-RESTART-20261104.md), earlier backend/office records and Supabase migration files remain dated evidence. They do not authorize a hosted operation.
