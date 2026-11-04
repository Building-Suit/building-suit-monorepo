# Company HQ handoff

The current scope is the [4 November 2026 static restart](STATIC-RESTART-20261104.md). The founder asked to clear the prior HQ implementation and begin again with only the attached image's layout, with no offices or functionality. Work runs directly in the primary repository checkout so the founder can watch changes through `pnpm dev:hq --current` on port 3101.

`apps/company-hq/app/pages/index.vue` supplies translated, typed content to the complete shared `BsHqLayoutPage` template. Preserve the header arrangement, large empty canvas, workspace label and empty minimap panel. Controls remain disabled. The previous office scene, room/agent overlays, active-role projections, authentication, server APIs, bridge tools, persistence and viewport interactions have been removed from the runtime.

No Company Brain read, credentials or hosted configuration is required to work on this layout. Shared UI ownership, canonical branding/tokens/fonts and English/Arabic direction handling remain applicable. See [the app README](../../../apps/company-hq/README.md) for current commands and acceptance scope.

The founder retired the Cloud Rule on 3 November 2026; its earlier cloud-only requirements are dated history. The standalone source checkpoint `4a6d6a146747d48fb0410de00f1d827d17db8b11`, original monorepo checkpoint `2d689c6d7ee15c07a089f113e5cae584a950ec2c`, office screenshot/art and deployment reports retain historical provenance. Their office/backend instructions and 1440×1000 zero-pixel acceptance target are superseded by this restart.

Preserve the app's Supabase migration history, environment metadata and private ignored data. This change performs no provisioning, migration, deployment or remote data operation. Previously requested project refs remain unverified; do not infer access or activation from retained metadata. The old ChatGPT Site is historical and does not identify this local preview.
