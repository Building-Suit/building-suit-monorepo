# Finished staging batch — 2026-10-15

Status: combined candidate under verification; parent owns the final single staging merge.

## Authorization and boundary

The owner explicitly requested: “stack your PRs together ... merge it only once into STG ... ignore Vercel deployment, ignore Supabase deployment ... Just merge your PRs together after stacking them, so it merged only once.” This supersedes the prior separate-root and prior-provider-recovery hold for this batch only. Required GitHub security and CI checks are unchanged; no protected-branch bypass is authorized.

Use existing PR318 / `codex/shared/task-release-publication` as the **single integration PR** into `stg`. The parent may perform the final merge only after all applicable checks pass on the exact final combined head. Preserve source history with merge commits, including the final staging PR merge. No manual provider deployment, direct hosted mutation, credential configuration, main/production merge, destructive cleanup or home-network access.

## Pinned inputs

- Verified staging base: `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`.
- Shared PR318: `df4d2c864b262a2929591d0620505b374b422e72` — atomic reviewed task release publication, deployed-only Shop landing/full changelog, semantic batch ordering and complete three-release teaser groups.
- Shop PR316: `cfc13e82debc5039f4225b0d0c9ff85af4a9c9c4` — ETA merchant/B2C support plus its history-preserving integrations of #317 partial returns/refunds, #319 B2B signed submission and #320 SEO/consent/optional analytics.

Both pinned inputs had all applicable checks green. Their passes establish inputs only; the combined head must pass fresh combined checks.

## History and stack metadata

Merge the exact PR316 head into the existing PR318 branch without squashing or rebasing. Verify both pinned SHAs are ancestors of the resulting candidate. Preserve source fragments byte-for-byte; append only an internal batch-integration fragment for documentation/metadata. Once the combined candidate is published, mark PR316 closed/superseded and retain its branch. PR318 stays the sole staging integration root, so the branch-policy checker needs no permissive exception and no cross-stack PR parent. Existing promotion PR312 (`stg` → `main`) is untouched and is not part of this batch.

## Conflict reconciliation

- Shared landing/index retains both deployed changelog discovery/retry and consent-gated pricing-link analytics.
- Public app-root keeps `/changelog` anonymous routing together with privacy presentation and environment-safe SEO.
- UI package exports and route-template registry retain both changelog and ETA/return/privacy additions.
- Account disposable validation retains cached-image reuse and the exact pinned official-publisher mirror fallback.
- All release fragments from both inputs are preserved; source migrations and generated schema contracts remain unchanged.

## Verification and handoff

Run `agent:pr-check 318`, release-fragment coverage/registration/translation validation, strict workspace boundaries, combined unit/type/lint/build checks and affected changelog/privacy/returns/ETA browser regressions. Existing required root CI and every applicable disposable/security workflow run on the combined candidate. Report the integration PR, exact final head and actual check status promptly; do not infer combined acceptance from input checks.

Parent’s final gate: refresh live PR318 head and origin/stg, confirm both pinned inputs remain ancestors, confirm all required GitHub checks/security gates are satisfied on that exact head, then merge PR318 once using a history-preserving merge. Do not execute the earlier separate PR318-then-PR316 staging sequence. Provider recovery is not a Git-merge prerequisite for this authorized batch; do not manually deploy. Runtime publication, ETA/signer/scheduler/official setup, analytics consent/configuration and any hosted activation limits remain real and must not be represented as activated merely because Git merged.
