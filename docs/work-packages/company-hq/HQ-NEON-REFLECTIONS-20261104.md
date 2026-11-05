# HQ neon materials and floor reflections — 4 November 2026

> Historical reflection prototype. The latest [matte terrain requirement](HQ-ISLAND-LIGHTING-20261105.md) removes its mirrored pass, reflection sampler and render targets entirely; only bounded bloom remains. The dated implementation description below is not current runtime guidance.

The founder's latest supplied reference explicitly supersedes the earlier all-coal/no-navy direction. Mix Coal, canonical Building Navy and Premium Gold using existing tokens, with metallic detail, neon emission and a reflective finite floor. This is a visual refinement in the primary checkout on PR #528.

Preserve the accepted camera/mouse/overview correction, including left-drag pan, middle-drag rotation around the panned world target, the farther default overview and full-floor minimap. Preserve office design, founder access, company plans and all data boundaries; this request adds no functional or staffing work.

Source implementation is confirmed by the parent, with no runtime acceptance:

- `hologramScene.ts` mirrors geometry at the fixed shared ground plane using `uMirrored`, a mirrored eye and matching winding. Base, shield, offices and neural animation use the same current poses in both passes. The floor samples the reflection with five taps, Fresnel and roughness; localized Gold spill and contact shadow keep the light near the emitter.
- Materials combine softbox/cool Navy environment and warm Gold specular response, metallic rims, hot neon cores and mixed Coal/Navy shield coatings. Canonical `navy`/`navyDeep` bindings remain the palette source.
- `hologramEffects.ts` copies the native antialiased canvas on the GPU, extracts luminance with `smoothstep(0.34, 0.70)`, applies two quarter-resolution nine-tap Gaussian blur passes and composites alpha-correct bloom at strength `0.60`. There is no `readPixels`/CPU readback path.
- Reflection uses RGBA8/DEPTH16 at half native resolution, capped at 1536 on the long side. Quarter-resolution bloom caps at 768. Targets allocate only on resize and release on disable/disposal. The caller's native 8-million-pixel/DPR-3 budget, existing 30/60 scheduler and reduced-motion static state remain. The helper has an explicit `./utils/hologramEffects` package export.

Describe this as WebGL raster mirrored-geometry reflection and GPU bloom. No hardware RTX/ray-tracing or measured visual/performance quality is claimed.

Shared UI owns scene materials/lighting/reflection rendering and palette/chrome. Product documentation/catalogue describes the approved direction without introducing product-local CSS or another token source. Original accepted fragments and dated design history remain preserved; the latest reference governs current colors.

Tests, builds, lint, typechecks, boundary/release checks, browser/API/runtime verification, profiling and tester/reviewer agents are prohibited and unrun. No provider calls, Brain writes, migrations, Auth/plan mutations, office/staff records, deployments, spending or public product activation are part of this refinement. Visual/performance acceptance remains unrun.
