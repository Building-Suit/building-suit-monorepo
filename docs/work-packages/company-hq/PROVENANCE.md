# HQ source and design provenance

Historical record from 3 November 2026. The [4 November static restart](STATIC-RESTART-20261104.md) supersedes the runtime office scene, backend and exact office-screenshot baseline described below. The original checkpoints and design evidence remain preserved; current source ownership is documented in the [app README](../../../apps/company-hq/README.md).

Current source: `apps/company-hq`, with presentation in `packages/ui` and interactions in `packages/ux`. The founder’s return-to-monorepo directive supersedes the earlier separation. Completed runtime/backend/tests were migrated from the preserved standalone checkpoint `4a6d6a146747d48fb0410de00f1d827d17db8b11`; original monorepo checkpoint `2d689c6d7ee15c07a089f113e5cae584a950ec2c` retains the approved reference history and Windows generator normalization fix.

Runtime logo, fonts and tokens are inherited directly from canonical shared packages. The page does not ship an independent token/font/logo fork. The clean scene at `apps/company-hq/public/hq-assets/office-scene.png` is the approved generated art. The founder-attached actual capture at `design/office-acceptance-1440x1000.png` is the exact visual baseline. Zero-pixel parity refers to that still at 1440×1000, Chromium, dark theme and 100% zoom; it does not claim an interactive 3D renderer or fidelity to unseen video frames.

Original video links, frames, prompts, generated mockup and historical tower/Worker experiments are preserved as private research evidence under `design`. These are not runtime pages or current instructions. Previous standalone reports are archived under `history/standalone-20261103` and are explicitly superseded for source placement and package dependencies.
