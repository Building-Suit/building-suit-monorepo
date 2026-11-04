# HQ shield orb — 4 November 2026

Status: latest source removes the reserved top header for compact floating logo/navigation/status-account overlays, rounds the overview and replaces the spanning ground with a finite round platform that grows from office-layer count. Canonical coal/charcoal/graphite plus restrained Premium Gold and left-drag rotation/middle-drag panning remain. The smoother curves, wider base, HQ ground/camera bounds and sidebar manual-zoom lock remain. Founder feedback on earlier refinements was directional; final visual/control/performance acceptance remains pending. Visual, gesture, performance and freshness acceptance remain deferred under the standing no-autonomous-testing instruction. The explicitly requested server restart and bounded cloud connection retry succeeded.

The founder requested a simple shield orb using the Building Suit design system and palette, with a subtle beat, hover/touch-hold vibration, scatter-open shield pieces, a transparent inner orb containing a brain with moving/pulsing nerves, camera focus and a Brain details side panel. Every Brain entry point must trigger the same sequence. Preserve the original design for reversal. This request does not resume offices, characters, staff/model execution, the CEO proposal board or hosted database work.

## Implementation

- Shared UI renders 11 varied seeded spherical fracture pieces with distinct curved polygon silhouettes, travel and rotations, using canonical Charcoal and Graphite surfaces with sparse Premium Gold seams, an Ink floor and neutral silver details. The broad original-radius base and moving orb aura return. Colors remain canonical tokens, without a new palette, service or rendering dependency.
- Opening scatters the plates around a glass sphere, revealing two folded brain lobes, a stem and branching nerves with a traveling pulse. The beat is small; mouse hover and a stationary 360 ms touch hold add visual vibration only while closed. Opening immediately clamps residual excitement to zero in both the component and renderer. No device vibration permission/API is requested.
- Actual orb activation, header Brain and Company Brain share `openBrain`. The same state drives shield opening, an interruptible camera transition and a read-only nonmodal overlay that slides from the left in English/LTR and right in Arabic/RTL, including the reverse exit transition. The workspace keeps its layout size and never gets pushed aside. Narrow screens leave the zoom strip uncovered, and RTL places the overview opposite the panel. Existing note search, source/version metadata, refresh and escaped Markdown remain app-fed presentation.
- Shared UX owns pointer hover/hold coordination, gesture suppression and camera transitions. Dragging, pinching, modifiers and long-hold release do not activate the orb. Manual camera input interrupts transitions. Closing, Escape or Workspace closes the shield/panel and restores the prior camera. The overview reset and Home/0 close it and restore center, 100% and default camera angle. Reduced motion uses static states without vibration, beat or camera tween.
- The latest founder instruction supersedes the earlier zoom-allowed rule: manual zoom is locked while the Brain sidebar is open across overview buttons, wheel, pinch and keyboard. Opening focus remains a programmatic transition, and reset closes the sidebar before restoring defaults. The panel retains native wheel scrolling. Notes mount in groups of 40; search still covers the entire loaded directory and Show more reveals another group. Panel memoization isolates camera rerenders, and a reused date formatter/stable directory projection avoids repeated full-directory formatting.
- Source rendering costs are bounded with indexed vertices, lower-resolution lobe/sphere/ring/tube geometry, a density target of at least 1.5× on normal-density displays where the budget allows, native device density up to DPR 3, an 8,000,000-pixel backing budget and a maximum dimension of 4096 further bounded by the GPU renderbuffer limit. Open/closed states use the same resolution, and fragment shaders use high precision where supported. These are configured/static limits, not measured frame rates or a performance pass. The former 850,000/1,100,000-pixel caps visibly undersampled the image according to founder feedback; their replacement prioritizes sharpness while retaining the lighter meshes, matrix/DOM caching and idle paint limits. No benchmark or visual check was added.
- Existing route/template ownership and bilingual/RTL copy remain. Shared UI has no Google query, server import or Brain write. The app remains a private local preview with a cloud data source.

The founder’s latest correction supersedes the earlier six matching strips and push-aside panel. They explicitly requested randomized shapes, the earlier larger base/aura/motion, no opened vibration, working zoom, reduced lag and the locale-aware overlay. No runtime, browser or benchmark check was added for this refinement.

## Floor, curves and controls foundation (prior pass)

The prior foundation pass addressed pixelated circles/lines, a slightly bigger base, a real HQ floor and a camera that cannot look below it, plus inactive right click. Its left/middle rotation equivalence was superseded by the explicit mapping confirmed below. The explicit no-underside goal resolves the contradictory “can go under” wording as an above-floor constraint. This is foundation work only; linking/designing offices remains next.

- Base/ring radii are 12% wider. Base-ring meshes use 128 circumference segments with 8 tube sides; aura rings use 96×6, cylinders use 96 around, neural tubes use 6 sides with denser 28-step Bézier paths, and glass/seam contours are selectively denser. Indexed meshes, caches and bounded high-resolution backing remain. Normal-density screens target 1.5× supersampling; the 8m/DPR3/4096/GPU bounds still apply. These are source configuration changes, not a smoothness measurement.
- The prior opaque, depth-writing two-triangle world plane sat at `SPATIAL_VIEWPORT_GROUND_Y = -0.69`, below the base bottom at -0.65. Its X/Z center followed the camera target. This spanning geometry is superseded by the finite platform below.
- Shared UX exports the same ground, minimum pitch (0.08), baseline target height (0.42) and minimum target height (ground +0.10) used defensively by the renderer. Orbit, pan, zoom and every camera-tween frame constrain pitch and target height; this prevents panning the target below ground as well as rotating below the horizon.
- Left drag rotates; middle drag pans across the map with no modifier, with Shift + left drag retained as an alternative. A stationary primary orb click/tap activates it; middle click is navigation only. Right click/drag never activates or captures the camera. Context-menu/autoscroll defaults are suppressed on the workspace. Touch rotation/pan and keyboard movement remain.
- A shared zoom policy blocks every manual zoom path while the sidebar is open or still sliding out, with disabled +/− controls. This latest rule supersedes earlier zoom-while-open wording.

No tests, builds, lint/typechecks, boundary/release, browser/API/runtime or benchmark checks ran for this pass. Administrative preflight failed once; targeted Git fetch and live PR528 state fallback succeeded before publication. Prior cloud connection observations below are dated and were not rerun.

## Palette and navigation correction

The founder rejected the blue/navy coloring and explicitly requested the existing coal-like palette plus Premium Gold. Their confirmed answer is “Middle drag pans; left drag rotates.” This supersedes the previous left/middle rotation equivalence.

Shared UI now reads canonical Ink, Charcoal, Graphite, neutral Steel Gray, Soft Silver, Pearl White and Premium Gold tokens. The floor is coal, the shields/base layer charcoal and graphite, and metallic/glass details stay neutral. Thin shield seams, emitter, moving aura ribbons, neural pulses and key overview/control accents use restrained Premium Gold. The header, workspace background, controls and Brain panel use the same neutral surfaces. No shared token source or generated token output is changed, and no alternate palette is introduced.

The shared pointer controller reserves middle drag for map panning and primary drag for rotation. Primary click/tap opens the orb; middle click cannot accidentally open it. Right click stays inactive. English/Arabic gesture hints and the shared catalogue follow this mapping. Touch controls, keyboard controls, high-resolution limits, floor bounds, closed-only vibration, overlay direction and sidebar manual-zoom lock remain.

These are source changes in the primary checkout. No app tests, builds, lint/typechecks, boundary/release, browser/API/runtime or benchmark checks were run. Visual and gesture acceptance remains with the founder/tester agents; Git/PR topology observations are administrative evidence only.

## Floating controls and finite platform

The founder requested removal of the top header, absolute logo at top-left, compact centered Workspace/Tasks/Calendar/Brain tabs, a compact left indicator/CEO/account card, a smaller round minimap and a finite circular floor that expands with office layers.

The shared template now fills the viewport with the workspace and positions its controls over the scene. The logo sits at logical start and the status/CEO/account card below it; these mirror for RTL. Navigation stays centered in its own compact charcoal background, stepping down below the logo on narrow layouts. The circular overview is 180px on desktop and 156/144px on narrow screens; its open-panel narrow state becomes a small control capsule so reset remains accessible. Company Brain connection status/open action moves to bottom-left. The read-only Brain overlay still slides over the workspace below the top controls, without layout resize; closed-only vibration, above-floor bounds, all Brain entry actions and sidebar zoom lock remain.

`HqLayoutContent` adds translated Calendar and Login labels. Optional `HqUserPresentation` supplies name, detail and avatar URL; initials are the fallback. The current app supplies no user session and shows disabled Login, truthful no-agent status, and disabled CEO/Tasks/Calendar controls. This is presentation only, not authentication, scheduling or agent activation.

`officeLayerCount` is an optional template/scene numeric input, defaulting to zero. The pure `hologramFloorRadius` helper gives `4.8 + 6 × layers` world units, with integer layers normalized to 0–64 and invalid/nonfinite/negative input treated as zero. A 160-segment disk remains anchored at the world origin at Y −0.69; a graphite edge extends 0.10 below it. X/Z scale and minimap scale share the radius; mesh size stays fixed. Projection far depth grows with floor diameter and camera distance. The current app has no office layers; future office orchestration must provide the real count and reconcile larger footprints with the radial spacing. No offices/roads are generated here.

All edits stay in the primary checkout. No app tests, builds, lint/typechecks, boundary/release checks, browser/API/runtime checks, benchmark or tester/reviewer agents ran. Layout, gestures and performance remain unverified under the standing no-autonomous-testing instruction. Git/PR observations are administrative only.

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
