# HQ shield orb — 4 November 2026

Status: first shield design rejected by the founder; revised source implements the latest shape/aura/overlay/performance correction for review. Visual, gesture, performance and freshness acceptance remain deferred under the standing no-autonomous-testing instruction. The explicitly requested server restart and bounded cloud connection retry succeeded.

The founder requested a simple shield orb using the Building Suit design system and palette, with a subtle beat, hover/touch-hold vibration, scatter-open shield pieces, a transparent inner orb containing a brain with moving/pulsing nerves, camera focus and a Brain details side panel. Every Brain entry point must trigger the same sequence. Preserve the original design for reversal. This request does not resume offices, characters, staff/model execution, the CEO proposal board or hosted database work.

## Implementation

- Shared UI renders 11 varied seeded spherical fracture pieces with distinct curved polygon silhouettes, travel and rotations, using Building Navy and sparse Premium Gold seams. The broad original-radius base and moving orb aura return. Colors remain canonical tokens, without a new palette, service or rendering dependency.
- Opening scatters the plates around a glass sphere, revealing two folded brain lobes, a stem and branching nerves with a traveling pulse. The beat is small; mouse hover and a stationary 360 ms touch hold add visual vibration only while closed. Opening immediately clamps residual excitement to zero in both the component and renderer. No device vibration permission/API is requested.
- Actual orb activation, header Brain and Company Brain share `openBrain`. The same state drives shield opening, an interruptible camera transition and a read-only nonmodal overlay that slides from the left in English/LTR and right in Arabic/RTL, including the reverse exit transition. The workspace keeps its layout size and never gets pushed aside. Narrow screens leave the zoom strip uncovered, and RTL places the overview opposite the panel. Existing note search, source/version metadata, refresh and escaped Markdown remain app-fed presentation.
- Shared UX owns pointer hover/hold coordination, gesture suppression and camera transitions. Dragging, pinching, modifiers and long-hold release do not activate the orb. Manual camera input interrupts transitions. Closing, Escape or Workspace closes the shield/panel and restores the prior camera. The overview reset and Home/0 close it and restore center, 100% and default camera angle. Reduced motion uses static states without vibration, beat or camera tween.
- Zoom buttons, wheel over the canvas/overview and non-editing panel +/− shortcuts continue using the same camera while the panel is open. The panel retains native wheel scrolling. Notes mount in groups of 40; search still covers the entire loaded directory and Show more reveals another group. Panel memoization isolates camera rerenders, and a reused date formatter/stable directory projection avoids repeated full-directory formatting.
- Source rendering costs are bounded with indexed vertices, lower-resolution lobe/sphere/ring/tube geometry, DPR at most 1.25, a 2048-pixel dimension cap, and backing limits of 850,000 pixels opened / 1,100,000 closed. These are configured/static limits, not measured frame rates or a performance pass.
- Existing route/template ownership and bilingual/RTL copy remain. Shared UI has no Google query, server import or Brain write. The app remains a private local preview with a cloud data source.

The founder’s latest correction supersedes the earlier six matching strips and push-aside panel. They explicitly requested randomized shapes, the earlier larger base/aura/motion, no opened vibration, working zoom, reduced lag and the locale-aware overlay. No runtime, browser or benchmark check was added for this refinement.

## Original design backup

Local lightweight tag `codex/hq-orb-original-20261104` points to existing commit `e59836955363b627e425d15f9eaec3727ba8c54d`, before this redesign. That commit is already in PR528’s history. It preserves the original renderer, scene component, dialog template and viewport controller without creating a worktree or duplicate editable renderer.

If the founder requests restoration, first preserve any later edits and restore only these four design files from the tag (or the exact commit), then reconcile current documentation/copy:

```sh
git restore --source codex/hq-orb-original-20261104 -- packages/ui/src/utils/hologramScene.ts packages/ui/src/organisms/BsHologramScene.vue packages/ui/src/templates/BsHqLayoutPage.vue packages/ux/src/composables/useSpatialViewport.ts
```

Do not reset the branch or restore the whole app: that would discard the independently fixed cloud reader. The tag is local; the original commit is also recoverable through the existing feature history.

## Requested restart and connection evidence

The founder reported corrected Google configuration and explicitly requested another restart/retry. The server was stopped gracefully and restarted with `pnpm dev:hq --current` from `/home/tareq/Dev/building-suit-monorepo`, serving loopback port 3101. No worktree, provider deployment or migration was used.

The bounded diagnosis fixed two implementation issues:

1. Nuxt’s outer development listener proxies to Nitro over a Unix socket, so the worker has no TCP peer. The outer listener now checks the actual loopback peer, removes caller attestation and supplies a per-start private random attestation. The worker permits an absent peer only in development with that matching token. Host/origin/custom-header/no-store and direct production peer checks remain; forwarded client identity is not trusted.
2. The original sequential scan repeatedly fetched every ancestor and expired at 30 seconds despite successful Google authorization. Index scans now process four folders at a time and share metadata observations only inside that scan. Selected-note traversal stops at the established matching descendant and performs fresh uncached parent-chain/version checks before and after download. Existing request/time/size/depth limits remain.

At `2026-11-04T16:13:12.219Z`, GET `/api/brain` returned HTTP 200, `connected`, source `google-drive`, count 330, `partial:false`, in 11,088 ms. A subsequent bounded index request and one HOME note request both returned HTTP 200; content was nonempty, its source version was present and its opaque ID matched. Credential values, tokens and note bodies were not logged. These observations verify one directory scan and one note read, not instantaneous sync, every note or all-agent context refresh.

Initial browser inspection showed the earlier failed state. A later browser-state request timed out, so no rendered pass is claimed. No redesign browser/gesture review, automated tests, builds, lint/typechecks, boundary/release checks or tester/reviewer agents ran. Nuxt’s normal dev startup/hot compilation is separate from a production build check. Its live compiler reported a duplicate renderer variable during editing; the variable was renamed and hot reload resumed without a new transform error in the next log output. Source inspection and targeted connection results do not establish visual/interaction acceptance; the founder/tester agents retain that review.

Work stays on `codex/company-hq/office-design` / [PR528](https://github.com/Building-Suit/building-suit-monorepo/pull/528), base `stg`, in the primary checkout. The last verified staging SHA was `14039a60d9c7e59b1052cca3ee5b97015339c6a1`. Existing child PRs remain untouched. No merge, hosted deployment, Supabase mutation, public release, new staff or spending is claimed. See the [cloud record](HQ-CLOUD-BRAIN-20261104.md) for source/environment boundaries.
