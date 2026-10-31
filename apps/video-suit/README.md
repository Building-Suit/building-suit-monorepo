# Video Suit

Repository-backed production studio. Nuxt supplies the gallery/editor, Three.js owns the 3D scene, and a single paused GSAP timeline controls camera, receipts and lighting. No account, database, paid API or external asset service is required.

## Run

From the repository root, using the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/video-suit dev
# http://localhost:3016
pnpm --filter @building-suit/video-suit test
pnpm --filter @building-suit/video-suit typecheck
pnpm --filter @building-suit/video-suit lint
pnpm --filter @building-suit/video-suit build
```

English/Arabic UI uses the shared locale shell. The first sample is a silent, five-second vertical film. Paper movement is a visual metaphor, not receipt scanning. There are no characters or simulated product UI.

## Save and reuse

- `videos/<video-name>/project.json`: versioned project definition, output contract and motion parameters.
- `videos/<video-name>/assets/`: video-specific artwork. The first manifest asset supplies the receipt SVG; preparation checks each listed file exists. Output dimensions must be even and the duration must contain a whole number of frames.
- `assets/shared/models/counter-kit.json`: reusable procedural geometry definitions for counter, tablet, boxes and receipts.
- `assets/shared/svg/`: reusable record icons.
- `scene/player.mjs`: reusable `counter-to-tablet-v1` scene and deterministic seek API.
- `assets/PROVENANCE.md`: authorship, commercial reuse and brand ownership records.

The editor changes a temporary preview. **Download project JSON**, replace the corresponding source `project.json`, then rebuild/restart to save and reopen it. The editor does not silently write the repository. To create another project, copy its directory, change `id` to match the new folder, update copy/parameters and rebuild. The gallery discovers every validated manifest. To create another scene, add a new scene implementation and update validation/selection deliberately; unknown versions fail closed.

`assets:prepare` copies sources into ignored public output and bundles the browser player. Never edit generated public copies. Original official wordmark and endorsement are copied from `packages/brand` unchanged.

## Reproducible export

Install FFmpeg and the official Playwright browser (`pnpm exec playwright install chromium`), with a host that supports browser sandboxing and WebGL. Run the dev server above, then in a second terminal:

```sh
pnpm --filter @building-suit/video-suit render shop-suit-from-chaos-to-clarity 1
pnpm --filter @building-suit/video-suit render shop-suit-from-chaos-to-clarity 10
pnpm --filter @building-suit/video-suit render shop-suit-from-chaos-to-clarity
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration apps/video-suit/renders/shop-suit-from-chaos-to-clarity/sample.mp4
ffmpeg -v error -i apps/video-suit/renders/shop-suit-from-chaos-to-clarity/sample.mp4 -f null -
```

`VIDEO_CHROMIUM_PATH` optionally selects a supported installed browser instead of the official Playwright bundle; `VIDEO_BASE_URL` selects the server. The script keeps sandboxing enabled, reports missing WebGL/launch failures, proves repeated seeking yields identical screenshots, captures exactly 150 frames at `frame / 30`, and encodes H.264 MP4 at 720×1280. It does not substitute a different renderer after failure. Renders are ignored: attach verified outputs to PR/release artifacts or your artifact store rather than committing frame sequences. Keep selected approved thumbnails beside project source when actual frames are available.

## Current verification limitation

In the October 31 cloud executor, system Chromium aborts because its SUID sandbox helper is not correctly configured (`chrome-sandbox` requires root ownership and mode 4755). No sandbox security was disabled. Thus the single-frame gate, ten-frame gate, full MP4 and visual QA are pending a supported renderer. This repository contains the real scene, not an invented replacement export.

The official Playwright Chrome 151 and headless shell were also installed and tested with sandboxing enabled and unsafe default flags removed. Both terminate with `No usable sandbox!`. This is a host sandbox capability limitation, not just the system Chromium helper. An administrator must provide a supported browser environment with usable namespace/seccomp sandboxing, or correctly provision the sandbox helper. Changing host security policy or helper ownership/mode requires separate specific approval and was not attempted.
