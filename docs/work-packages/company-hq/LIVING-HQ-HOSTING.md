# Living HQ: local updates and blocked hosted integration

The 3D office consumes authenticated HQ state. Scene rendering does not establish model execution, Brain access, scheduler operation or hosted deployment. No infrastructure was provisioned or enabled for this work.

## Implemented local update contract

`GET /api/hq/updates` is a bounded local Node/SQLite Server-Sent Events endpoint. It requires the existing founder session. It rejects hosted storage before attempting any remote session read and rejects cross-origin/cross-site browser requests. No JWT, provider key, new credential or public database channel is introduced.

The endpoint sends `event: invalidate` with `data: {"revision":"<counter>"}` on connection and when the committed SQLite workspace revision changes. It never sends a workspace document, private HR report, founder message, Brain snapshot or model output. The client must refetch `/api/hq/state`, which applies the existing founder projection and session checks. A revision change means persisted data changed; it must not be displayed as successful work or a Brain write.

The stream checks the local session again before every possible emission, polls the small revision counter at most once every two seconds, and rotates after 30 seconds. Connection budgets permit eight streams per process and two per session. Disconnect, revoked/expired session, store error and response backpressure close the stream and release its budget. No event queue or database writer is held open. The existing SQLite busy timeout still applies to database operations.

Client integration must close EventSource while hidden, signed out or disposed; invalidate older pending state loads; refetch authorized state on invalidation; use at least three seconds between reconnect attempts; and preserve bounded periodic refresh as fallback. Reconnection gets the current revision, so an interrupted stream does not require replaying private historical event payloads. Creating a department or saving a founder command also triggers the existing immediate state refresh.

`LocalInvalidationCursor` is synchronous and local-only. It cannot be supplied a remote asynchronous store by the route. `HqStore.revision()` reads only the existing counter; the schema and stored history remain intact.

## Verified parent inventory — hosted activation remains disabled

The following inventory comes from the parent's authorized inspection. It is not a claim that this cloud worker read either project. Earlier project reads in this worker were denied; no new authorization to retry or mutate a project was supplied here.

| Environment | Requested project ref | Current evidence |
| --- | --- | --- |
| Staging | `lwecnmsosfwovlzxauml` | Existing control-plane project: 36 public tables, private schema and Auth records, including populated admin/integration/release data. GitHub auto-deploy root `./apps/super-admin-suit`, branch `stg`. Free plan; no scheduled backups. |
| Production | `dfeiuxsqhgzontefmrjc` | Existing control-plane project: 36 public tables, private schema and Auth records. GitHub auto-deploy root `./apps/super-admin-suit`, branch `main`. Free plan; no scheduled backups. |

Both projects are populated control-plane environments, not empty dedicated HQ databases. Preserve their mappings, deployment roots/branches, schemas, records, Auth users, grants and policies. The isolated HQ candidate does not transfer ownership or replace that existing wiring. Dedicated HQ authorization, backup/restore readiness and proven zero-cost capacity remain unresolved.

`hqProjects.ts` preserves those requested refs. `hostedRealtimePlan()` returns `enabled:false`, this worker's recorded access denial and unresolved scope/auth/cost prerequisites. An environment boolean does not enable this new Realtime path. Existing backend configuration and execution guards remain unchanged.

No project reads were retried through another connector, API, SQL route or personal network. No remote SQL, migrations, publication changes, data deletion, credential setup or Realtime activation occurred. Existing Super Admin data and all other products remain untouched.

Future reviewed environment configuration must continue to start disabled:

```dotenv
HQ_ENVIRONMENT=staging
HQ_SUPABASE_URL=https://lwecnmsosfwovlzxauml.supabase.co
HQ_BACKEND_SCOPE_VERIFIED=false
HQ_HOSTING_COST_VERIFIED=false
```

Production uses `HQ_ENVIRONMENT=production` and `https://dfeiuxsqhgzontefmrjc.supabase.co`. This is a mapping template, not runnable credential configuration. Do not copy another product's founder identity, session, service key or database contents.

## Additive hosted route after fresh authorized inspection

The existing schema deliberately denies direct browser access to `hq_workspace`. Do not add that full JSON document to a broad public change stream. A safe next implementation should emit only invalidation metadata over a private, company/environment-specific channel and refetch the authorized server projection. HQ's current cookie session is not a Supabase Auth JWT; joining a private channel requires a separately reviewed server-mediated authorization design, including revocation and membership checks. A publishable key alone is not founder authorization.

Before applying any migration, obtain explicit project-specific access and mutation authorization, reconfirm the supplied inventory and immutable project identity, and resolve HQ coexistence, backup/restore readiness, dedicated HQ scope and zero incremental cost. A disabled, isolated local schema candidate is now prepared outside automatic migrations; see [isolated schema review](ISOLATED-HQ-SCHEMA-REVIEW.md). A private Broadcast integration still requires separate authorization design and tests. Preserve all existing data and review the exact staging migration before any remote execution. Test role denial, expired/revoked identities, cross-environment isolation, reconnects, duplicate/missed notices and version reconciliation. Production requires separately verified readiness and authorization. No destructive reset is part of this plan.

Official documentation reviewed on 4 November 2026:

- [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization) requires policies and private channels; authorization must be tied to the intended member and topic.
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) requires explicit table publication and appropriate row access. Neither is enabled here.
- [Realtime schema lockdown](https://supabase.com/changelog/realtime-schema-locked-down-against-modification) prohibits modifying provider-owned Realtime objects while retaining supported policy management. This work changes none of them.
- [TLS deprecation notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) affects obsolete CBC cipher clients from 10 November at the earliest. Keep supported Node/browser TLS and certificate verification; do not weaken transport security.

## Verification and limits

The new unit suite uses actual disposable SQLite files for committed revision, rollback and restart checks, and synchronous synthetic sources for revocation/lifetime/connection budgets. It does not claim hosted Realtime, live Brain read/write or model execution. Final application type/build/browser outcomes are recorded with the parent living-HQ verification evidence. Node-server process persistence, proxy buffering, public URL access, account approval, provider quotas and dedicated hosted identity remain unverified.

The verified parent inventory above establishes existing project content and wiring. It does not establish a usable HQ runtime, a successful live Brain/model call, a tested restore or an approved billing/hosting allowance. No project operation was retried here.
