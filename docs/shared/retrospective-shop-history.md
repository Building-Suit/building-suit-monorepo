# Retrospective Shop production history

The owner explicitly delegated retrospective version selection from verified GitHub history on 16 October 2026. These numbers are assigned retrospectively, not recovered original tags. The earlier unversioned-baseline decision blocker is resolved by that authorization. Normal released entries still require numeric SemVer and actual release date.

| Assigned version | Production ready time (UTC) | Deployed main SHA | Verified customer-facing milestone |
| --- | --- | --- | --- |
| 0.1.0 | 2026-09-22T12:29:13.607Z | `7df512f7e008dbf47b19b2c425640248a88506cf` | Product/service catalog and stock overview |
| 0.2.0 | 2026-09-27T20:54:27.948Z | `ecb546c0ccfb4c6874884cf8fe87eb27c8b0afb4` | Sales, customer payments, inventory counts and movement history |
| 0.3.0 | 2026-10-04T14:26:40.081Z | `a7a8872ed850ecc0e195498657579611801f2069` | Plan comparison, resource usage and operational reports |
| 0.4.0 | 2026-10-14T11:29:16.099Z | `5fb461fe8d74c8aee6bd1bc37962c05080204034` | Clearer customer feedback and report export readiness |

These dates come from authenticated Vercel `ready` timestamps, not merge dates. All deployments are `shop-suit` project `prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0`, branch `main`, target `production`, state `READY`, with the Shop production alias. Exact provider deployment IDs, URLs, Git trees, GitHub deployment receipts, source probes and curated EN/AR copy are retained in [`tooling/releases/retrospective-shop.json`](../../tooling/releases/retrospective-shop.json). Source proofs establish functionality present in each deployed tree; no claim is made that every feature was first invented on that date. The 6 October production deployment is deliberately omitted: its intervening changes were backend support without a matching customer surface, and do not justify another customer announcement.

The publisher verifies each source SHA is an ancestor of current protected main, confirms exact tree/probe matches, and rereads the corresponding GitHub production deployment and successful environment URL before import. GitHub timestamps have one-second precision, so the provider millisecond readiness receipt is cross-checked within that precision. Deployment IDs alone, environment labels alone, staging commits, failed builds and arbitrary Git logs are not release authority. Current staging work is never imported as historical shipment.

## Version continuity and import

Migration `20261016175503_retrospective_shop_history.sql` creates an RLS-protected immutable import ledger and a service-only import RPC accepting exactly the sealed reviewed plan. The existing CI publisher invokes it after protected-ref checks; no second deployer, personal service, new secret or direct hosted write is introduced. Read-only `deployments: read` permits GitHub receipt verification.

A first import advances only Shop's explicitly private/unversioned `0.0.0` origin to the corrected `0.4.0` production baseline, or initializes that baseline on the production side before its first normal promotion. Existing real version heads are never reset. A collision with any already-published normal/legacy version fails closed; a lower unexplained baseline requires review. The baseline SHA is not rewritten, and old candidate revisions, reservations, digests, publication/readiness clocks and v1 manifests remain immutable. The previously unpublished `0.1.0` target is retained as an obsolete reservation under its old base, not relabeled a shipment.

The same publisher then refreshes from the **actual current main-to-stg net tree difference**, using corrected base `0.4.0`. With current minor changes, the next target is `0.5.0`; no historical feature earns another bump. Future merges refresh the same evolving candidate. Only normal authenticated readiness publishes its preview, and only authorized main CI can freeze it after production deployment readiness. The durable last-good preview policy remains intact during refresh. Tests exercise historical import followed by normal production freeze and staging acknowledgment, plus import retries after advancement, to prevent duplicate credit or rollback.

Each public historical entry shows its numeric version, verified deployment date and **Retrospective version / ترقيم بأثر رجعي** label. `publishedAt` is the actual immutable CI import time; `releasedAt` remains the historical deployment time. Retrospective entries never receive New, even when first imported. Private provenance is not dumped into public copy. Imports are atomic and idempotent; modified plans, suppressed writes, version collisions and unauthorized callers fail without partial baseline/history changes.

The public feed retains the prior verified-feed implementation privately and appends only sanitized historical copy. First-reconciliation, legacy-review, readiness, environment and visibility checks still apply. PostgREST schema reload is notified for the new RPC. Empty-state messages now describe only the selected Released or Coming Soon tab in EN/AR; an empty Released tab never denies that upcoming work exists.

## Verification

Run release/contract/component unit tests, the disposable PostgreSQL protocol suite, and the full migrated SAS/PostgREST suite. The latter runs independent normal and retrospective catalogs with real pg-safeupdate loaded, proving suppressed-head rollback, authenticated import, unauthorized denial, immutable retries and consistent future versions. Generate the public database contract from the disposable migrated schema with pinned postgres-meta `v0.98.0`. Shop browser tests cover retrospective labels/dates/versions/New exclusion, the three-entry teaser cap and both selected-tab empty states in EN/AR. No hosted import or production promotion is claimed by this change.
