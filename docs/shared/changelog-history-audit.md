# Released history evidence — 16 October 2026

**Resolution:** The owner subsequently delegated retrospective version selection. [The reviewed production milestone plan](retrospective-shop-history.md) resolves the version-policy decision below; the original evidence audit remains retained for provenance. Retrospective numbering is explicitly labeled and does not represent recovered historical tags.

This audit accompanies the changelog tab correction on top of staging `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50`. It does not authorize a release, deployment or hosted write.

## Observed evidence

- The current protected `main` is `5fb461fe8d74c8aee6bd1bc37962c05080204034`, merged through [PR 215](https://github.com/Building-Suit/building-suit-monorepo/pull/215) on 14 October 2026. Authenticated Vercel inspection confirms [Shop deployment `dpl_5Cggf24PuKZifm9j35moyEbcnBLf`](https://vercel.com/building-suit/shop-suit/5Cggf24PuKZifm9j35moyEbcnBLf), project `prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0`, was built from that exact `main` SHA, targets `production`, is `READY`, and has alias `shop.building-suit.com`. Its provider `ready` timestamp is `1791977356099`, exactly **`2026-10-14T11:29:16.099Z`**. [GitHub deployment `7064077577` status](https://api.github.com/repos/Building-Suit/building-suit-monorepo/deployments/7064077577/statuses) independently reports success at `2026-10-14T11:29:17Z` with description “Deployment has completed” and URL `https://shop-suit-eyjyw9qnn-building-suit.vercel.app`. This establishes the successful production deployment time; it does not establish when every included feature was first introduced or an historical product version.
- `gh release list` and `git tag -l` return no historical releases/tags. `git show origin/main:apps/shop-suit/package.json` has no product version. Shared library package versions are not Shop release versions.
- The GitHub deployments API includes staging SHA `c6774d47` under environment `production`. That label cannot establish that a change shipped from main, nor provide reliable production version provenance.
- The maintained [release publication runbook](release-publication-runbook.md) records the legacy live query with zero published manifests, the private unversioned baseline, and the first upcoming Shop version `0.1.0`. It explicitly rejects manufactured earlier `0.1.0`/`0.1.1` history. `tooling/releases/policy.json` preserves the activation anchor only as private provenance.
- The current main-to-stg inventory has ten bilingual public items. They remain candidate notes, including the shared changelog correction folded into its existing inventory item. No staging item was relabeled released.

## Decision needed before a historical import

There is demonstrably deployed main source and an authoritative successful production deployment timestamp, but no evidenced historical public product version for a compatible released entry. Use the provider readiness time above for any explicitly approved legacy deployment baseline; do not assign a guessed historical version or turn the internal `0.0.0` origin into a customer release.

The remaining minimum product decision is whether to permit a clearly labeled unversioned legacy baseline exception to the normal numeric-version requirement, or supply an authoritative existing version receipt. No date decision remains. Any newly assigned numeric baseline would be a new version policy, not recovered history, and must explicitly address its effect on the current upcoming `0.1.0` target. The current contract requires a real SemVer and release timestamp, so the Released tab truthfully remains empty when its authorized feed has no released entries. The existing empty state is shown; it does not substitute fixture announcements or suppress API failures.

No import path is added before those inputs exist. Once the version-policy decision is resolved, any import must be separately reviewed, immutable and idempotent through the existing CI publisher, preserving its baseline, readiness and provenance checks. Do not manually edit a hosted database or freeze the current staging candidate to fill the tab.

## UI correction

Both public surfaces use Released (default) and Coming Soon tabs. The landing section shows at most three entries from the selected tab, then the full-changelog link in Premium Gold (`#D89B42`) with a direction-aware arrow. Full history has no entry limit. Upcoming versions and timestamps remain in validated contracts and publisher integrity metadata but are omitted from presentation. Released cards show version and actual release date. Equivalent title/summary/detail fields render once; distinct details are preserved. EN/AR copy for document settings, taxes and offline reconciliation now separates summary from detail.
