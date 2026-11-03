# Company HQ — office design checkpoint

The founder replaced the previously approved tower direction with the office layout in the two supplied Bekhruz AI videos. This work package is image/design evidence only. The new office image awaits founder approval before UI code or an interactive preview.

## Current artifact

- [Office layout image](office-layout-v1.png)
- [Exact image prompt](office-layout-v1-prompt.txt)
- [Verified migration record](migration.json)

The design preserves the reference's radial arrangement of eight room positions, central Brain, slim navigation, minimap and zoom controls. Only CEO and HR are active; the other positions are explicitly unassigned architectural placeholders. This does not create new departments or employees. Founder conversations go only to CEO.

The authentic Building Suit logo reference comes from the existing `packages/brand/assets/building-suit-logo-light.png`. The image is generated artwork: source-logo pixel equality and an exact pixel-perfect match are not established. Future implementation must use the canonical logo asset and typography directly.

## Reference evidence

- [Office tour](https://www.youtube.com/watch?v=t0hGE-aaAds&t=10s): actual captured frames near 28.9s, 97.4s and 150.2s establish the radial map, room detail panel and task board.
- [Creative-team build](https://www.youtube.com/watch?v=-14NKNpWr1M&t=85s): an actual frame near 89.4s shows the agent Markdown/tool/model setup. It does not supply the office renderer.
- Both transcripts were inspected through TubeAlfred. Captured frames are research references in `reference-frames/`, not production artwork with a verified source license.
- The creator's [episode-4 template](https://github.com/bekhruztbx/ai-creative-team/tree/episode-4) contains agent instructions, memory and media scripts, not the office frontend, 3D assets or room sprites. Its MIT license does not establish the missing artwork's availability. Original renderer/assets/dimensions remain unavailable; do not claim verified pixel-perfect reproduction.

## Monorepo implementation boundary

All HQ source and project assets now belong in this repository. Current branch: `codex/company-hq/office-design`, based on verified staging commit `14039a60d9c7e59b1052cca3ee5b97015339c6a1`. Read root and scoped instructions before implementation.

- Future app: `apps/company-hq/`, using the maintained new-platform generator after approval.
- Nuxt 4 / Vue 3 / TypeScript / pnpm-Turbo, shared Nuxt layer and PrimeVue through shared UI.
- Every visual composition belongs in `packages/ui` templates; reusable interactions belong in `packages/ux`.
- Canonical assets and tokens remain in `packages/brand` and `packages/design-tokens`.
- GSAP and Three.js are founder-permitted, subject to those shared boundaries, SSR, accessibility and reduced-motion behavior.
- Product-owned identity/data must follow repository contracts. No hosted project, model API, paid fallback or billing is enabled by design work.

## Retired standalone site

`legacy/site-source-v1.zip` preserves the exact tracked source of the original Worker/D1 site at commit `d22317c798663df4a921ac67625aa4a57f3ff8e7`. It is historical evidence, not an app to run or a compliant Nuxt migration. The complete old checkout and its local runtime state were relocated into ignored local migration storage, rather than committing private state.

Earlier tower assets and the unapproved HTML prototype are retained in `history/tower-concepts/` as superseded evidence. Do not reopen that prototype as a design approval or copy it into a live app.

No new app implementation, preview server, deployment, PR or hosted data change was performed at this design checkpoint. A future implementation requires the founder's explicit approval of the new office image.


The founder subsequently approved the office image. The current implementation checkpoint and cloud-only rule are recorded in [CLOUD-HANDOFF.md](CLOUD-HANDOFF.md).
