# HQ shield orb — 4 November 2026

Status: latest foundation source adds smoother curves, a wider base, HQ ground/camera bounds, sidebar manual-zoom lock and revised mouse mapping. Founder feedback on earlier refinements was directional; final visual/control/performance acceptance remains pending. Visual, gesture, performance and freshness acceptance remain deferred under the standing no-autonomous-testing instruction. The explicitly requested server restart and bounded cloud connection retry succeeded.

The founder requested a simple shield orb using the Building Suit design system and palette, with a subtle beat, hover/touch-hold vibration, scatter-open shield pieces, a transparent inner orb containing a brain with moving/pulsing nerves, camera focus and a Brain details side panel. Every Brain entry point must trigger the same sequence. Preserve the original design for reversal. This request does not resume offices, characters, staff/model execution, the CEO proposal board or hosted database work.

## Implementation

- Shared UI renders 11 varied seeded spherical fracture pieces with distinct curved polygon silhouettes, travel and rotations, using Building Navy and sparse Premium Gold seams. The broad original-radius base and moving orb aura return. Colors remain canonical tokens, without a new palette, service or rendering dependency.
- Opening scatters the plates around a glass sphere, revealing two folded brain lobes, a stem and branching nerves with a traveling pulse. The beat is small; mouse hover and a stationary 360 ms touch hold add visual vibration only while closed. Opening immediately clamps residual excitement to zero in both the component and renderer. No device vibration permission/API is requested.
- Actual orb activation, header Brain and Company Brain share `openBrain`. The same state drives shield opening, an interruptible camera transition and a read-only nonmodal overlay that slides from the left in English/LTR and right in Arabic/RTL, including the reverse exit transition. The workspace keeps its layout size and never gets pushed aside. Narrow screens leave the zoom strip uncovered, and RTL places the overview opposite the panel. Existing note search, source/version metadata, refresh and escaped Markdown remain app-fed presentation.
- Shared UX owns pointer hover/hold coordination, gesture suppression and camera transitions. Dragging, pinching, modifiers and long-hold release do not activate the orb. Manual camera input interrupts transitions. Closing, Escape or Workspace closes the shield/panel and restores the prior camera. The overview reset and Home/0 close it and restore center, 100% and default camera angle. Reduced motion uses static states without vibration, beat or camera tween.
- The latest founder instruction supersedes the earlier zoom-allowed rule: manual zoom is locked while the Brain sidebar is open across overview buttons, wheel, pinch and keyboard. Opening focus remains a programmatic transition, and reset closes the sidebar before restoring defaults. The panel retains native wheel scrolling. Notes mount in groups of 40; search still covers the entire loaded directory and Show more reveals another group. Panel memoization isolates camera rerenders, and a reused date formatter/stable directory projection avoids repeated full-directory formatting.
- Source rendering costs are bounded with indexed vertices, lower-resolution lobe/sphere/ring/tube geometry, a density target of at least 1.5× on normal-density displays where the budget allows, native device density up to DPR 3, an 8,000,000-pixel backing budget and a maximum dimension of 4096 further bounded by the GPU renderbuffer limit. Open/closed states use the same resolution, and fragment shaders use high precision where supported. These are configured/static limits, not measured frame rates or a performance pass. The former 850,000/1,100,000-pixel caps visibly undersampled the image according to founder feedback; their replacement prioritizes sharpness while retaining the lighter meshes, matrix/DOM caching and idle paint limits. No benchmark or visual check was added.
- Existing route/template ownership and bilingual/RTL copy remain. Shared UI has no Google query, server import or Brain write. The app remains a private local preview with a cloud data source.

The founder’s latest correction supersedes the earlier six matching strips and push-aside panel. They explicitly requested randomized shapes, the earlier larger base/aura/motion, no opened vibration, working zoom, reduced lag and the locale-aware overlay. No runtime, browser or benchmark check was added for this refinement.

## Latest floor, curves and controls

The founder requested another pass on pixelated circles/lines, a slightly bigger base, a real HQ floor and a camera that cannot look below it, plus left/middle drag equivalence and inactive right click. The explicit no-underside goal resolves the contradictory “can go under” wording as an above-floor constraint. This is foundation work only; linking/designing offices remains next.

- Base/ring radii are 12% wider. Base-ring meshes use 128 circumference segments with 8 tube sides; aura rings use 96×6, cylinders use 96 around, neural tubes use 6 sides with denser 28-step Bézier paths, and glass/seam contours are selectively denser. Indexed meshes, caches and bounded high-resolution backing remain. Normal-density screens target 1.5× supersampling; the 8m/DPR3/4096/GPU bounds still apply. These are source configuration changes, not a smoothness measurement.
- An opaque, depth-writing two-triangle world plane sits at `SPATIAL_VIEWPORT_GROUND_Y = -0.69`, below the base bottom at -0.65. Its X/Z center follows the camera target, with extent based on camera distance and far clip, so panning stays over the ground without a large tiled mesh.
- Shared UX exports the same ground, minimum pitch (0.08), baseline target height (0.42) and minimum target height (ground +0.10) used defensively by the renderer. Orbit, pan, zoom and every camera-tween frame constrain pitch and target height; this prevents panning the target below ground as well as rotating below the horizon.
- Left and middle drag both rotate, and Shift modifies either into pan. A stationary left or middle orb click activates it; right click/drag never activates or captures the camera. Context-menu/autoscroll defaults are suppressed on the workspace. Touch rotation/pan and keyboard movement remain.
- A shared zoom policy blocks every manual zoom path while the sidebar is open or still sliding out, with disabled +/− controls. This latest rule supersedes earlier zoom-while-open wording.

No tests, builds, lint/typechecks, boundary/release, browser/API/runtime or benchmark checks ran for this pass. Administrative preflight failed once; targeted Git fetch and live PR528 state fallback succeeded before publication. Prior cloud connection observations below are dated and were not rerun.

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
