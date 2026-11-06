# HQ camera and overview correction — 4 November 2026

Current scope is navigation/overview only. The founder stopped the previous work and requested this correction in the primary checkout on PR #528. Do not resume office design, Auth, database or plan development, or write the Brain under this task.

- Left mouse drag pans; middle drag rotates; right click/drag stays inactive. Primary click/tap still activates the orb. Touch and keyboard controls remain unchanged.
- Rotation keeps the current world X/Z camera target, so orbiting after a pan stays centered on that target.
- Default/reset 100% is a farther overview fitted to finite-floor radius and actual canvas aspect.
- The circular minimap is larger and always includes the whole finite floor, approved office markers and the existing CEO marker. Its viewport rectangle follows actual rendered width/height, including ultrawide resize. The projected floor-frustum footprint is a separate calculation.

Shared UX owns gesture policy and the canonical spatialViewportGeometry camera/frustum model; shared UI consumes it for rendering and the overview. Its 100% framing fits the finite floor at the default angle, while rotation retains orbit distance and the world target. Additional magnification preserves the existing close Brain focus from the farther overview. Product/catalogue copy reflects the mapping in English/Arabic. Existing orb activation, above-floor constraints, side-panel zoom lock, office data and business behavior remain governed by their existing scope.

Source correction only; no measured visual, gesture, projection or performance acceptance is claimed. Tests, builds, lint, typechecks, boundary/release checks, browser/API/runtime verification and tester/reviewer agents are prohibited and unrun. No provider calls, app Brain writes, migrations, new office/staff records, deployments or public product activation are part of this correction. Earlier accepted fragments and dated evidence are preserved.
