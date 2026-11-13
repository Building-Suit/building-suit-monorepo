# HQ ocean/cliff interaction — 5 November 2026

Extend HQ-OPEN-OCEAN-20261105. Preserve the seven-component Gerstner sea, normal ripples, palette, clocks and camera-distance filtering. The island, land meshes/materials, offices, roads, Brain, camera, framing and postprocessing are unchanged. No hosted or staffing action is included.

## Inspected system

Native WebGL 1 canvas, shared material shader, indexed 512×64 water mesh, analytic directional/Brain lighting, bounded bloom, no environment cubemap/reflection targets/depth capture and no existing particle infrastructure. Terrain is a 320-column weathered cliff mesh with actual flat-triangle normals and a small waterline bevel. Sea level remains the viewport ground minus the existing 3.2-unit sea drop. The shared camera provides eye/view/projection/FOV. The existing 8M-pixel budget, Uint16 geometry, context lifecycle, reduced-motion behavior, visibility pausing and 30/60 scheduler remain.

## Shore representation and contact

`islandShoreInteraction.ts` reads the existing cliff geometry at layout rebuild only. Seven horizontal slices give a 320-sample signed coastal lookup with outward normals and slope from the face above the little waterline bevel. Neighboring-segment distance is a local SDF approximation suited to this star-shaped, nearly circular island; it is not a general arbitrary-terrain SDF. Submerged depths outside the mesh use a conservative shelf extrapolation.

Angular triangle bins build exact radial face sections for the 512 water columns and 64 candidate impact angles. Arbitrary crest heights intersect these cached line segments, preserving ledges/overhangs and choosing the outermost visible contact. This is more accurate than interpolating the seven height slices for splash origins. Bed heights at water vertices also use the actual face sections. The per-frame path performs only bounded cached-neighbor/profile queries, never full terrain scans or ocean-wide raycasts.

The same water vertex count is retained, redistributing twelve near-shore bands to resolve the small run-up strip. A single extra vec4 vertex attribute contains coast normal, steepness and wave shadow; existing metadata carries signed distance, offshore fade and bed height. Approximate mask fields interpolate between vertices. GPU dry-terrain masking and a 0.32-unit inland run-up bound complement the existing depth test. Horizontal orbital drift and its derivatives taper to zero at terrain contact, while vertical wave height intersects the cliff. This remains a raster approximation; all-angle clipping and placement have not been visually accepted.

## Wave response

- Existing wavelengths/directions/deep-sea amplitudes remain. A smooth coastal phase-delay integral increases local spatial frequency while preserving temporal frequency, approximating slower propagation/shorter wavelengths without time-dependent expanding fronts. Near-shore amplitude/steepness gain is bounded at 1.18/1.28. Coast normals steer the phase gradient; a modest refraction term varies along the shoreline.
- A silhouette lookup in prevailing-swell coordinates comes from the actual coast. Its smoothly feathered leeward field reduces larger-wave energy, recovers over 22 units and leaves the finest waves/ripples. An inward phase bend approximates diffraction at shadow edges. Secondary wind directions use reduced shadow weights; this is a dominant-direction approximation, not a diffraction solver.
- Four normal-ripple layers and existing distance filtering remain. Original Gerstner/packet/shoaling derivatives are analytic; interpolated shadow/refraction fields and terrain normals are approximations.

## Impact lifecycle

A bounded 64-site sampler evaluates the same shared wave definitions, dispersion, packet/noise basis, phase warp, coastal gains and shadow using the same visible-time clock. It samples at most 20 Hz. Positive-to-negative vertical crest velocity crossings above minimum height/energy trigger an interpolated event time, then the contact is solved again at that time. CPU/GPU floating precision, interpolated fields, detail filtering and low-rate event sampling impose small timing/placement approximation; no claim of bit-identical simulation or rendered acceptance is made. Tiny crests do not emit. Long frame gaps suppress stale bursts; initialization/reduced motion does not spawn events.

Impact energy combines arriving crest amplitude, propagation velocity, incident angle and actual steepness. Spatial separation, site cooldown, a global minimum gap and strongest-first selection keep large splashes uncommon. All reactions share six reusable impact slots, including foam/reflection lifetimes, rather than independent timers/random coastline emitters.

1. At the crest/terrain contact, spray starts just outside the face. Shared launch code combines outward coast normal, upward force, tangential incoming momentum and seeded spread. Steep faces redirect more energy upward; lower slopes favor lateral spread.
2. One static GPU point pool has 36 particles per slot: 10 larger droplets, 20 fine droplets and 6 short-lived soft mist particles, at most 216 points in one additional draw. Vertex shaders integrate gravity from event age, fade and stop below mean sea level. Particles are depth tested, translucent, non-emissive and do not write depth. Cool Navy/Silver foam color avoids pure white/Gold. Fine spray/mist fades before major droplets at distance; point size respects device limits and projected size. Optional spray program allocation/compile failure leaves the ocean/foam/reflection path available.
3. Local foam appears with the event, spreads, drifts, accumulates only through overlapping bounded events and fades over 6.5 seconds. A tiny near-shore compression/crest mask supplies pre-impact foam. There is no permanent coastline outline.
4. A short Gaussian wave packet travels outward in a mildly perturbed reflected incoming direction. Amplitude is weaker and decays, wavelength differs, lifetime is bounded, and its height/gradient combines with incoming geometry/normals.
5. Impact ripple impulses and one selected larger droplet's predicted landing produce expanding, decaying normal rings. The representative droplet and landing helper share the same launch/gravity formula; landing is at mean sea level, without further water/particle collision simulation. At most two impulses per active slot, twelve total, with distance filtering. No recursive secondary particles. Combined reflections/ripples supply localized interference/turbulent normals, not a separate whole-ocean chaos layer.

The water mask permits a short rise/retreat on sloped terrain; no inland flow, erosion, terrain deformation or full fluid solver is introduced.

## Tuning and debug

Central parameters are in `packages/ui/src/utils/islandWaterConfig.ts`, including interaction range, shallow speed/amplitude/steepness, refraction/diffraction, run-up/clearance, splash threshold/strength/direction/spread/gravity, foam threshold/lifetime/spread/drift, reflection strength/decay/speed/wavelength/lifetime, ripple strength/lifetime/speed/wavelength, shadow strength/recovery/edge width, sampling rates, event/particle limits and LOD distances.

In the Nuxt development preview append one query value, then reload:

| Query | View |
| --- | --- |
| `?hqWaterDebug=mask` | Signed shoreline mask |
| `?hqWaterDebug=distance` | Distance to shore |
| `?hqWaterDebug=normals` | Shore outward normals and steepness |
| `?hqWaterDebug=depth` | Shallow region / bed-depth proxy |
| `?hqWaterDebug=impacts` | Active contact points |
| `?hqWaterDebug=strength` | Impact strength |
| `?hqWaterDebug=splash` | Actual 3D splash spawn points |
| `?hqWaterDebug=reflection` | Reflected outgoing direction |
| `?hqWaterDebug=shadow` | Leeward attenuation |

Remove the query or use `off` to disable. The URL control is guarded by `import.meta.dev`, so production starts with debug off and ignores this parameter. No product toolbar or new navigation is added. Debug colors are diagnostic, not a palette change.

## Budget, lifecycle and acceptance

No new textures, render targets, scene reflection capture, CPU vertex animation or full fluid simulation. The added coast attribute is ~0.5 MiB for 32,768 vertices. Cached terrain sections rebuild only with existing island layout changes. Six impact slots and a static ~3.4 KiB point buffer bound effects. Main shader uses six varying vectors, three attributes and eighteen extra vec4 impact uniforms; no vertex-texture-fetch requirement or dynamic uniform-array indexing. All buffers/programs are released on disposal/failure and rebuilt with existing context recovery. Spray is skipped for reduced motion. Existing bloom/pixel/camera budgets are preserved. Source allocations do not establish measured desktop performance.

Manual source/diff review only. The standing founder instruction prohibits tests/builds/lint/typechecks/release/boundary checks, shader compilation and browser/API/runtime/visual/performance verification; none were run. Administrative `pnpm agent:preflight` failed ETIMEDOUT, so fresh GitHub/fetch state is unverified. No commit, push, PR publication, merge or deployment.

References: prior [ocean implementation](HQ-OPEN-OCEAN-20261105.md); [Khronos WebGL 1 specification](https://registry.khronos.org/webgl/specs/latest/1.0/) and [WebGL 1 reference](https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf) for the native rendering constraints. These source methods are not visual acceptance evidence.
