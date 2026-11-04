# Building Suit HQ workspace

HQ was restarted on 4 November 2026 at the founder's request. The current workspace uses the reference image's header arrangement and a floating 3D holographic orb above a base at the center of the rounded canvas. The bottom-right overview shows an orb icon and camera controls. There are no office scenes, rooms, agents, model connections, authentication, tasks, messages or persistence. Header navigation and business actions remain disabled.

From the monorepo root:

```sh
pnpm dev:hq --current
```

Open `http://127.0.0.1:3101` on the server's computer. `--current` serves the checkout where the command runs; edits there hot-reload. The founder explicitly requested work in the primary repository checkout. No environment variables, credentials or database are needed for this preview.

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

The app route supplies translated `HqLayoutContent` to the complete shared `BsHqLayoutPage` template. `BsHologramScene` and its WebGL renderer live in `packages/ui`; `useSpatialViewport` in `packages/ux` owns rotation, zoom, pan and reset state. The documentation app demonstrates the same template in its component catalogue. English/Arabic and LTR/RTL use the shared infrastructure.

The founder has instructed agents to stop autonomous testing until tester agents are introduced. No tests, builds, lint, typechecks or browser verification are run for this implementation; acceptance is pending. The existing browser suite still describes the earlier empty canvas and disabled viewport controls and needs updating by the future testers. Its previous eight passing static-layout scenarios do not verify the current scene.

See the [current orb scope and handoff](../../docs/work-packages/company-hq/HQ-ORB-20261104.md). The [static restart record](../../docs/work-packages/company-hq/STATIC-RESTART-20261104.md), earlier backend/office records and Supabase migration files remain dated evidence. They do not authorize a hosted operation.
