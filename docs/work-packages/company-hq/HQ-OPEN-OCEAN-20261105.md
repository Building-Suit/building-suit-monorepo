# HQ open-ocean water — 5 November 2026

The founder requests calm-to-moderate open-sea movement with Building Suit stylized realism. This supersedes the temporary heavy-wave restoration, while preserving all non-water systems and presentation. Work stays in the primary checkout on the existing company-hq feature branch; concurrent agent/Brain/Auth work is preserved.

## Inspected implementation

HQ uses a Nuxt/Vue canvas with a native WebGL 1 indexed renderer, not Three.js or a separate fluid engine. `hologramScene.ts` assembles material-specific shader strings from `islandWaterMaterial.ts`. Water is a coastal annulus with 512 angular samples and 64 radial bands: 32,768 nominal shared vertices / 64,512 triangles using Uint16 indices. Its irregular inner boundary follows the existing island footprint; dense near-shore bands tuck under the cliff. Outer radius stays 2.4 times the existing island radius and retains its soft alpha fade. Geometry rebuilds only on layout changes.

Lighting uses the existing analytic directional light and Brain/base illumination, canonical palette uniforms and bounded bloom. There is no environment cubemap, reflected scene target or screen-space depth texture. The existing viewport supplies eye position, FOV and matrices. Shared camera behavior, far clip/framing, island extent and minimap remain untouched. Existing 8M-pixel/DPR limits, visibility pausing, reduced-motion static state and 30/60 scheduling remain.

## Water changes

- Seven Gerstner components travel along related but distinct directions with wavelengths 41.3, 26.7, 14.9, 9.1, 6.3, 4.7 and 3.4 world units. The ~6-unit offices establish scale; the largest swells span multiple offices. Amplitudes are 0.240, 0.145, 0.075, 0.052, 0.033, 0.022 and 0.015, totaling a conservative 0.682 before envelopes. Horizontal chop remains low. Dispersion-based frequencies use a shared art-directed time scale and small per-wave speed differences.
- Smooth travelling wave packets and a slowly drifting, untiled procedural noise field vary local amplitude and slightly warp phase. Fixed directions/wavelengths avoid expanding/contracting wave fronts. Independent frequencies/initial phases and modulation avoid a short synchronized field loop; no frame-wise randomness or tiled water texture is introduced. This is a stylized approximation, not a fluid simulation or a claim of mathematically aperiodic motion.
- Tangents/bitangents include derivatives of amplitude packets, phase warp, coastal taper and geometry detail filtering. Near-shore displacement vanishes at the cliff contact, avoiding land penetration. Coast slope is packed into the existing vertex metadata so taper normals follow the irregular shoreline.
- Four lower-amplitude procedural normal layers (1.53 / 0.87 / 0.49 / 0.29 units) supply small waves and ripples without more vertices. Geometry and shading detail fade smoothly according to projected pixel footprint, including viewing angle and actual backing-buffer resolution. Smaller geometric waves fade while large swells remain at far views.
- Water stays deep Navy with muted blue-gray reflected sky. Schlick Fresnel strengthens grazing reflection; rough, low-energy highlights follow crest normals. Shore distance approximates depth for absorption and modest downward transmission. A very weak local warm reflection uses existing Brain light only. No actual scene-object reflection or refracted scene capture is claimed.
- Sparse crest foam uses surface compression, positive height and a noise mask. More visible broken shoreline wash follows the primary travelling swell phase, changing its reach and receding, instead of radial foam rings or a luminous contour. Noise and tiny foam contrast fade with distance to limit shimmer.
- A separate visible-time water counter uses uncapped RAF elapsed seconds, so low FPS does not slow it down. Existing scene animation/transition timing is unchanged. CPU double-precision time produces individually wrapped angular uniforms; shaders consume whole-turn sine/cosine phases and bounded smooth noise drift. There is no 1,000-second ocean reset, frame counter dependence or per-frame vertex update. Hidden/offscreen state pauses via existing lifecycle handling; reduced motion supplies static zero time.

No textures, dependencies, render passes, geometry allocations per frame or reflection buffers are added. The existing mesh and GPU-only deformation are retained. Source budgets are unchanged; desktop performance has not been measured.

Method reference: [NVIDIA GPU Gems, Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models). Adapted to the current renderer without its generated-normal-map render pass.

## Verification limits

Manual source/diff review only. No tests, build, lint, typecheck, shader compilation, release/boundary checks, browser/runtime/visual or performance acceptance under the standing founder restriction. Administrative `pnpm agent:preflight` failed with ETIMEDOUT, leaving fresh GitHub/fetch state unverified; no publication/base decision is made. No commit, push, merge or deployment.
