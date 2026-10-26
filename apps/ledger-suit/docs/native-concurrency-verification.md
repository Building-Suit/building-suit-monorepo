# Native financial concurrency verification

LS-REL-CONC-001, 2026-10-22. This follows critical dependency PR #444 at `248608c3` and the native 63-file / 1,927-assertion SQL verification in PR #443. This package exercises the existing independent-session module runners; it does not certify the whole release.

**Result: 13 distinct paired races passed, plus all three classification races on a repeat run. Both synthetic organizations and four classification rows remained after the repeat.**

## Preparation and boundaries

Use [the pinned native image preparation](native-financial-verification.md) first when the standard PostgreSQL image cannot fit on managed Docker storage. The same real PostgreSQL 17.6 and provider initialization images were used here. Each module project received the complete unchanged 105-migration chain and seed, with a separate project ID, ownership label, workdir and database port. The migration content-manifest SHA-256 is `93e6f6c11b6eaa54b3bc9e427bbc3c665f46d493062eecfb91db4a4bcd31a9e6`.

The [preparation command](../scripts/prepare-native-concurrency-project.mjs) creates only a whitelisted local source copy. It accepts no database URL and starts, resets or deletes no database. It rejects unowned existing directories, changed copied configuration/seed, incomplete migrations and differing migration bytes. Unknown profiles, extra connection arguments and a deliberately changed migration copy were rejected in the actual preparation checks. The altered owned copy was restored exactly before use. The FX project also exercised preparation from an absent directory; other profiles exercised verification of existing owned copies.

Profiles are `customer-subledger`, `supplier-subledger`, `fixed-assets`, `inventory-accounting`, `fx-cross-currency` and `statement-classification`. Example for one module:

```sh
node apps/ledger-suit/scripts/prepare-native-concurrency-project.mjs customer-subledger
SUPABASE_INTERNAL_IMAGE_REGISTRY=ledger.local pnpm exec supabase \
  --workdir .local/verification/customer-subledger start \
  -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
LEDGER_AR_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-customer-subledger-concurrency.mjs
pnpm exec supabase --workdir .local/verification/customer-subledger stop
```

These explicit ephemeral workdirs intentionally differ from the normal product selector. Runners verify the exact expected project/workdir and applied migration versions before mutation; the five original non-FX runners also compare all migration bytes, and preparation checks byte parity for every profile. The printed preparation result gives each runner and opt-in variable. Use a Docker endpoint known to be the intended local daemon. If a port is occupied, inspect it and leave unrelated services alone. On constrained `vfs` storage, run projects sequentially and stop only each owned test project, preserving its database volume. `stop` is not an off-site backup or restore drill.

## Scope of the checks

Each race holds a real transaction open, starts a competing PostgreSQL session, observes an actual lock wait, commits the winner, and verifies the competing result and resulting data. Sequential replay is also checked where the runner specifies it.

| Runner | Assertions made by the native race |
|---|---|
| AR | Invoice retry produces one document; receipt retry produces one receipt; competing allocations reject overpayment. One invoice/two receipts leave 20 minor units open and zero control variance. |
| AP | Bill retry produces one document; payment retry produces one payment; competing allocations reject overpayment. One bill/two payments leave 20 minor units open and zero control variance. |
| Assets | Duplicate depreciation requests produce one asset-period event and one shared-ledger journal. |
| Inventory | Duplicate ingestion produces one source fact and one shared-ledger journal. |
| FX | Competing 6,000-minor-unit settlements against a 10,000-minor-unit item reject overpayment; 4,000 remain open and control variance is zero. |
| Classification | Competing stale edits reject; duplicate request returns the same revision; a competing books-lock update is observed and blocks the classification. |
| Manual payment | Two approval sessions contend on the same request; exactly one activation/approval history record and one monthly extension result. Replays preserve the period and produce the expected operator audit outcomes. |

Classification previously modified the shared seed organization, reused fixed request IDs and implicitly reset its database after the race. It now creates its own actor/organization and request IDs, runs classification commands as `authenticated`, and preserves all committed evidence. Only its competing administrative books-lock fixture uses privileged row setup; that is not a claim about a customer-facing settings API.

The manual-payment runner used the already-created, explicitly disposable native SQL project on loopback port 60322. The host lacks `psql`; an ignored forwarding adapter checked the loopback port, database/user, exact container ownership workdir and port binding before forwarding each independent `psql` process through `docker exec`, retaining `PGAPPNAME` and the real lock observation. It did not emulate SQL results. This fixture uses synthetic receipt metadata; it does not prove Storage upload/download bytes or an external bank transfer.

The [dated evidence record](accountant-system/v2-acceptance/native-concurrency-verification-2026-10-22.json) records actual outcomes and source identities. The source copies, committed fixture volumes and logs remain local; no hosted database, Automation row, customer record, deployment or accountant verdict was changed.

## Remaining acceptance

The later [public source-versus-close matrix](native-period-close-verification.md) supplies 20 actual close/post cases across ten sources and a separate annual-close retry.

These module retries and overlapping allocations supplement the native SQL period-close/posting, quota and sequence races. They do not establish a separate close-versus-post race for every module, a pre/post migration preservation pair, real Auth/Storage HTTP journeys, backup restoration, live provider configuration, full browser acceptance or accountant UAT. Those release gates remain explicit in [LS-READY-001](accountant-system/work-packages/LS-READY-001.md).
