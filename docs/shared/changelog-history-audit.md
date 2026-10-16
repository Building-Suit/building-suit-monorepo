# Released history evidence — 16 October 2026

This audit accompanies the changelog tab correction on top of staging `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50`. It does not authorize a release, deployment or hosted write.

## Observed evidence

- The current protected `main` is `5fb461fe8d74c8aee6bd1bc37962c05080204034`, merged through [PR 215](https://github.com/Building-Suit/building-suit-monorepo/pull/215) on 14 October 2026. Its successful `Vercel – shop-suit` commit status was created at `2026-10-14T11:29:16Z`, linking [this deployment](https://vercel.com/building-suit/shop-suit/5Cggf24PuKZifm9j35moyEbcnBLf). This supports that main was deployed; the status creation timestamp is not a proven customer release time.
- `gh release list` and `git tag -l` return no historical releases/tags. `git show origin/main:apps/shop-suit/package.json` has no product version. Shared library package versions are not Shop release versions.
- The GitHub deployments API includes staging SHA `c6774d47` under environment `production`. That label cannot establish that a change shipped from main, nor provide reliable production version provenance.
- The maintained [release publication runbook](release-publication-runbook.md) records the legacy live query with zero published manifests, the private unversioned baseline, and the first upcoming Shop version `0.1.0`. It explicitly rejects manufactured earlier `0.1.0`/`0.1.1` history. `tooling/releases/policy.json` preserves the activation anchor only as private provenance.
- The current main-to-stg inventory has ten bilingual public items. They remain candidate notes, including the shared changelog correction folded into its existing inventory item. No staging item was relabeled released.

## Decision needed before a historical import

There is demonstrably deployed main source, but no evidenced public product version or exact release timestamp for a compatible released entry. A merge date or deployment status creation time must not become a guessed release date, and an internal `0.0.0` origin must not become a customer release.

The product owner must supply existing authoritative version/release receipts, or approve a separate explicit policy for displaying an unversioned legacy baseline. The current contract requires a real SemVer and release timestamp, so the Released tab truthfully remains empty when its authorized feed has no released entries. The existing empty state is shown; it does not substitute fixture announcements or suppress API failures.

No import path is added before those inputs exist. Once evidence is supplied, any import must be separately reviewed, immutable and idempotent through the existing CI publisher, preserving its baseline, readiness and provenance checks. Do not manually edit a hosted database or freeze the current staging candidate to fill the tab.

## UI correction

Both public surfaces use Released (default) and Coming Soon tabs. The landing section shows at most three entries from the selected tab, then the full-changelog link in Premium Gold (`#D89B42`) with a direction-aware arrow. Full history has no entry limit. Upcoming versions and timestamps remain in validated contracts and publisher integrity metadata but are omitted from presentation. Released cards show version and actual release date. Equivalent title/summary/detail fields render once; distinct details are preserved. EN/AR copy for document settings, taxes and offline reconciliation now separates summary from detail.
