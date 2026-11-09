Activation follow-up: see [LIVE-DISPATCH-ACTIVATION.md](LIVE-DISPATCH-ACTIVATION.md) for the separately prepared forward migration and current deployment gates. The proposal below remains review source.

# Review-only HQ Realtime isolation

Status: source preparation, not activated. `proposed-migrations/hq_live_dispatch.sql`
is deliberately outside the automatic migration directory. A GitHub PR or CI pass
must not activate it. No live SQL, provider setting, credentials, host access,
worker recovery, task rerun or legacy replay is included.

## Evidence and scope

The observed staging claim was canceled at the INSERT inside `realtime.send`,
before HQ checked its publication receipt. The historical source of that INSERT's
latency remains unknown. This change isolates that particular dependency, not all
possible database delays and not the root cause of the incident.

Two synchronous transport calls existed in claim: the job-state invalidation
trigger and the subsequent `worker_presence`. Both now enqueue privately within
the business transaction. Presence preserves observedAt, agentId and taskId. No
lease, qualification, frozen source, model, admission, cancellation or uncertain
outcome guard changes. Queue wake broadcasts elsewhere remain outside this scope.

Deployed send semantics preserve an existing payload.id, otherwise add a generated
UUID; the transport table has its own independent generated ID. The old exact
{kind} equality cannot match its augmented payload. New events carry their outbox
UUID in payload.id and check the full private topic/event/payload before marking
delivery. This records database transport publication, never socket/browser ACK.

## Smaller operational design, no identity expansion

The initial proposal extended the Brain HTTP route/token. That would add capability
to an identity and require a separate access decision. The implemented candidate
does not do that. It uses the existing database owner and pg_cron's documented
CALL support. No Edge route, key, Vault change, public RPC, grant, role membership,
new destination or network transmission is added. All new private routines revoke
PUBLIC, anon, authenticated and service_role execution. The invoker procedure also
checks that current_user owns dispatch state. Existing function ACLs are retained.

The procedure cannot be SECURITY DEFINER or have a SET clause because it commits
between phases. Its object references are qualified, and each transaction sets an
empty local search path. It requires READ COMMITTED and a top-level CALL. Actual
pg_cron execution/transaction compatibility is a native integration gate, not an
assumption from PGlite. Supabase documents CALL and second schedules at
https://supabase.com/docs/guides/cron/quickstart .

## Durable phases and lock order

1. Producer: validate fixed private payload shape, lock dispatch state briefly,
   insert v2 outbox, advance generation and arm the named wake if absent. No
   transport access. Rollback removes the event and scheduler mutation together.
2. Owner tick: state lock, select a due v2 row FOR UPDATE SKIP LOCKED, increment its
   durable attempt count, assign attempt token, rearm retry and COMMIT.
3. Publisher: row lock only, validate the token, send, verify exact receipt and
   mark delivered in one transaction. Ordinary provider warnings cannot fake
   success. Failure persists an allowlisted error. Query cancellation is not caught
   and aborts publication; already committed attempt/wake survive.
4. Reconcile: fresh state lock/snapshot after publication commits. Never hold
   state/cron locks across send. Cancel only when drained and generation still
   matches; a newer generation retains a wake. Otherwise schedule the next due
   event. No idle job remains after a successful drain.

Backoff is 5, 10, 20, 40, 80, 160 seconds. Recurring wakes are capped at 59 seconds;
early ticks preserve next_attempt_at and do not consume a publication attempt.
This avoids stranding a retry when a scheduler outage spans a calendar minute. Six failed reservations open the lane circuit on the next tick. New
producer events do not reset attempts or reopen the circuit. Each tick handles
one publication. New events can still contend on the short state/cron operations;
this does not promise universally nonblocking claims. No statement timeout is
raised or canceled query suppressed. No recurring company snapshots/Drive reads
or idle polling are introduced. Pending retries use a durable self-rescheduling
job, removed when drained or circuit-open.

Existing service recovery `hq_live_flush` keeps its signature, ACL and guard but
now explicitly returns error `HQ_LIVE_OWNER_DISPATCH_REQUIRED`, rather than allowing
service callers to reuse a reserved attempt indefinitely or bypass the circuit.
No production caller was found. This deliberate recovery-contract restriction is
a rollout review item. The private owner can always administer the database;
attempt budgets constrain the automated publisher, not the administrator.

## Legacy, privacy and failure visibility

All preexisting entries remain v1/unknown. Only validated producers explicitly
write v2. Both ordinary dispatch and direct delivery exclude/refuse v1. No old
receipt is forged, replayed or deleted; previous counts are observations, not
proof those broadcasts were missing. No retention deletion is introduced.

Invalidations contain kind plus opaque random ID. Presence retains its existing
private fields plus the opaque ID. Channel RLS, client-send denial and fresh
founder session validation stay unchanged. Consumers still fetch authoritative
snapshots and must tolerate delayed or repeated network frames. Backlogged old
presence timestamps remain old, rather than being stamped as newly observed.

Operators inspect owner-private state/outbox and existing cron run results for
failure and circuit status. No new public status capability is granted. Circuit
recovery must be a separately authorized, reviewed operation; this candidate does
not automatically reopen failures, clear worker uncertainty or retry a task.

## Verification and rollout gates

Native fixture creates an isolated PostgreSQL database and actual pg_cron; it uses
canonical HQ migrations and the observed provider send body. Its realtime table
is synthetic, without hosted partitions, realtime server or browser sockets.

Required checks cover real migrated claim/presence under a held transport lock,
canceled lease rollback before the change, isolated claim afterward, observed
multi-session waits, durable attempts on cancellation, exact one-row publication,
wrong-ID/provider-warning failure, generation wake, legacy refusal, role denial,
bounded circuit and real pg_cron CALL/COMMIT/self-unschedule. Test-created failure
constraints, timestamps, jobs and cancellation target only disposable sessions.

Run only with the documented disposable fixture:
`node --test tooling/hq-agent-host/live-dispatch-native-check.mjs`.
The ordinary unit suite does not auto-discover this native-only file.

Current local evidence: candidate SQL syntax and one commit/deliver/drain flow
pass in PGlite with a mock cron table; separate six receipt/cancellation tests pass.
That is not native or hosted acceptance. Independent source/security review found no remaining blocker after fixing
service-flush retry bypass and stale-token diagnostics. Native CI results
must still be recorded before readiness. The source-only proposal is not auto-applied.

After review, activation requires a separate controlled forward migration through
the existing staging deployer and a fresh assessment of hosted pg_cron mode,
capacity and required approval. No manual hosted SQL. Verify a separately
authorized fresh event and current worker/job state before any Basma recovery.
If this does not remove the actual claim failure, keep investigating rather than
raising timeouts or bypassing safety checks.

Verification checkpoint: workspace boundaries, focused lint, source smoke and
internal release provenance pass. Native PostgreSQL/pg_cron CI and hosted
acceptance remain pending; no operational readiness is claimed.
