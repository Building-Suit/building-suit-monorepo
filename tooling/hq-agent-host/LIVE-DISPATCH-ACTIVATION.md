# Staging live dispatch activation gate

Status: prepared source, not merged or deployed. Parent source PR559 head
701d1afaf811900b5b0224d147ff902e1d8b5ea0 passed complete workspace CI and native
PostgreSQL/pg_cron in both execution modes. That does not validate this new
activation migration or prove hosted browser delivery.

## Target and verified baseline

Read-only provider inspection on 2026-11-09 confirmed project
`dpruoncalmwicrqhqelu` is linked to Git branch `stg`, with PostgreSQL 17.11,
pg_cron 1.6.4, libpq mode, database postgres and GMT. Existing HQ routines and
outbox are owned by postgres. Existing cron EXECUTE, schema USAGE and Realtime
send/read permissions suffice; no new grant, credential or ownership change is
part of this change. The only visible existing cron job was postgres-owned
hq-brain-watch-renewal. Its latest recorded success was November 6, not a fresh
proof that today's libpq authentication succeeds.

Hosted migration history contains the same 41 version/name pairs as the parent
source through 20261109124713_hq_trial_review_plan_cache. Provider storage splits
newer migrations into statements, so joined statement hashes are not file-byte
parity evidence. Exact current replaced-routine hashes are checked by the new
migration. Existing historical inventory entries are not rewritten as applied.

GitHub stg remains e2b382b24afbc9be0b1931c9cb56fd050f24173f at inspection.
The branch API reported protected=false and the repository ruleset list was
empty. This is not permission to bypass verification: require exact-head native
checks, full workspace checks, source review and coordinated stack before merge.

## Deployment boundary

The CLI-generated forward migration is
apps/company-hq/supabase/migrations/20261109150515_hq_live_dispatch_activation.sql.
Unlike the proposal-only parent, a merge containing this file is intended to
activate through the existing staging deployment integration. Verify the
provider's Git branch/project binding immediately before merge. SQL database
name alone is not project identity; app.settings.project_ref is unset. Do not
invent a project-ref SQL guard or use manual hosted SQL as a fallback.

The migration relies on the documented transaction-per-file path and contains
no authored BEGIN/COMMIT statements. Hosted migration-ledger atomicity and
deployment serialization are not independently proven. It fails closed
on incompatible owner/configuration/source/ACL/collision state, snapshots legacy
rows and checks them unchanged. It adds no initial cron row, but replaces the
producers: the first subsequent valid event arms the durable owner-executed wake.
No worker task is created or retried by the migration.

Merge also triggers existing workspace CI and, when successful, release-catalog
and HQ worker publication. The worker package's five allowlisted modules are
unchanged; a new SHA can nevertheless cause the existing updater to preflight,
drain, restart and resume if its current gates permit. This source change neither
starts that updater nor clears uncertain outcomes. Its current host state must
not be inferred from source.

## Security and delivery limits

The dispatcher uses existing postgres authority; it creates persistent scheduled
work, not a new access grant. If compatibility requires credentials, grants,
role membership, ownership transfers or security/network settings, stop for the
specific additional approval. Do not broaden the migration to make it pass.

All preexisting outbox entries remain v1, including the 2,119 observed at review.
The check uses the transaction's actual legacy snapshot, not a fixed count.
No historical replay, deletion or synthetic delivered marker is allowed. New v2
messages preserve private topic and bounded payload semantics, and correlate by
outbox payload.id. Publication receipt is not a browser ACK.

Six reservations per event, token/generation fences and a lane circuit bound
publication attempts after the dispatcher connects. They do not bound failed cron
authentication/connection launches, which occur before reservation. Existing cron
run diagnostics must be checked after activation. Recurring wake intervals capped
at 59 seconds survive a missed calendar minute; next_attempt_at remains the
authority and early ticks do not consume attempts. This corrects a missed-wake
weakness found during independent activation review, before deployment. They do not impose a total backlog/storage budget. Sustained successful
new events still consume resources, and pg_cron run history also grows. No data
retention deletion is introduced. Producer state/cron locks can still contend.
This isolation does not establish the original reason realtime.messages INSERT
was slow.

## Validation and stop conditions

The native matrix adds official upstream pg_cron v1.6.4 commit
9490f9cc9803f75105f2f7d89839a998f011f8d8 on PostgreSQL 17.11, plus packaged regression
comparison, each in both execution modes. Upstream's SQL extversion is 1.6;
hosted packaging reports 1.6.4. Record implementation provenance separately and
never relabel source or claim a byte-identical hosted binary. Test-only metadata
substitutions, when required by synthetic fixtures, must be explicit and confined
to tests; the untouched production guard must fail closed first.

Before activation: require fresh exact-head green CI, independent review, target
binding, one coordinated deployment and no grant expansion. Supabase documents
a transaction per migration file; the transaction sentinel rejects split
autocommit. Do not infer that the hosted ledger write shares that transaction.
If schema commit succeeds but ledger recording is uncertain, read both ledger
and exact schema/routine/ACL state before any retry. A second execution refuses
existing objects or changed outbox columns rather than resetting state. Concurrent
activation after the bounded outbox lock also fails closed on changed columns.
Never blindly retry, forge history or use manual SQL to reconcile uncertainty. After provider
application: read migration ledger, ownership/ACLs, legacy invariants and scheduler
outcomes; only then consider an explicitly authorized fresh event or task recovery.
No old task rerun is implicit. Stop on failure without timeout increases, swallowed
cancellation, manual SQL or blind migration reruns.

For rollback, do not reinstall old live_flush: it would replay legacy rows and
mishandle v2 presence. A separately reviewed pause sets the lane circuit and
unschedules only the exact owner/name job while preserving schema, outbox,
receipts and service-flush denial. Account for an already-running publisher;
unscheduling does not terminate it. Restoring synchronous producers would restore
the original blocking risk and needs its own review. Do not drop retained data.

Independent revised-source security review found no remaining critical defect.
Reviewed activation SHA256 a69402ef0c3a6931e2441d82447183976324f108605b567714294a80fef2c0d4
and proposal SHA256 0e1f9c3e25ffd53de3208586404ad67bdf59f4da9763c552ced4f3ef178b3162.
The missed-due regression disables a disposable job, advances synthetic due times
and explicitly shortens its test recurrence before reenabling it. This tests
interval mapping, overdue recovery and no early reservations, not an actual
PostgreSQL restart or unchanged 59-second wait. Native activation/publication
runs as genuinely nonsuperuser postgres; a separate fixture administrator only
constructs synthetic infrastructure and controls probes.

Deployment evidence: Supabase [GitHub migration behavior](https://supabase.com/docs/guides/deployment/branching/github-integration#migrations). Upstream CLI [authored transaction path](https://github.com/supabase/cli/blob/1813aa09e1869ff964d412f7cd39d6663fd92b76/apps/cli/src/command-internal/migration-apply.ts#L431-L486) can record history after authored statements; this migration deliberately avoids authored transaction commands. That upstream source does not identify the hosted runner version.
