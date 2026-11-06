# Private HQ agent host

This dependency-free Node worker receives private Supabase queue events, claims one job at a time, reads its authorized Google Drive Brain files and invokes the host's existing Codex CLI. Messages and delivery remain in the dedicated HQ database when a viewing computer disconnects. It exposes no HTTP port. It does not replace the original Nuxt workspace, deploy another office scene or import the older local runner branches.

The executor supports founder conversations and separately approved, bounded research, analysis, planning and drafting tasks. Ten existing canonical employees are synchronized from the Brain registry with current profile/skills, lifecycle and explicit model/effort bindings. Configuration does not establish qualification or online presence. Tasks produce immutable artifacts, optional HR-head review, Steve review, at most two repair rounds and a final founder report. Each founder message runs a real Amaya planning assessment first, then a separate Steve invocation uses that exact completed assessment for the founder reply. Both jobs read the current Brain independently. It cannot hire, approve a company plan, execute code, send emails or publish marketing. Accepted lessons alone may be appended to one owner-created private Brain output file through the separate reviewed-learning writer; source documents remain read-only. The journal retains up to40KB of recent managed entries while preserving human text; full immutable source artifacts and accepted lessons remain in Supabase. It obtains the provider-issued file ETag from Drive v2 metadata, binds it to stable v3 source versions and uses `If-Match` with v2 media PUT, then exact readback. v3 metadata does not expose this validator; no synthetic version-to-ETag fallback is allowed. Missing or weak validators fail closed. The [v2 file resource](https://developers.google.com/workspace/drive/api/reference/rest/v2/files) documents `etag`, and [files.update](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/update) documents the PUT upload endpoint. The exact conditional rejection behavior needs a live stale-validator receipt; mocked conflict tests alone do not establish provider support. Those actions need separately implemented, authorized tools and review. Agent characters should show real job state; leisure motion does not establish agent execution.

## Activation status and authentication

The owner-authorized staging setup applied the queue migration and registered a dedicated technical worker identity on 5 November 2026. Oracle worker activation is maintained separately from source installation; neither step establishes a completed founder-message journey. The founder now authorizes tests for this workforce workflow. Disposable PostgreSQL and mocked CLI checks are recorded separately from actual hosted model/PC-off acceptance. Production activation remains separate.

This worker runs the owner's private Codex CLI on the trusted, self-managed Oracle host using its existing ChatGPT login. [Official Codex automation documentation](https://learn.chatgpt.com/docs/non-interactive-mode#authenticate-in-automation) documents saved CLI authentication and the ChatGPT-managed account path for trusted runners. This implementation does not create a separate Sign in with ChatGPT OAuth service, share the login with public repository jobs or expose an app-server credential endpoint. Keep the account cache private and let the authorized CLI refresh it in place.

The earlier Oracle pilot returned one real reply on Codex `0.160.0`. Its strict qualification remained unsuccessful because of a startup diagnostic; that historical result does not establish this worker's end-to-end acceptance. Current queue, host and founder-message outcomes must be reported from their actual receipts.

The worker forces the OpenAI provider and ChatGPT login method. Its child environment is an allowlist and excludes `OPENAI_API_KEY`, `CODEX_API_KEY`, worker credentials, Google credentials, proxy overrides and alternative provider settings. There is no paid API or model fallback. Subscription limits and host availability still apply; $0 unlimited capacity is not promised.

## Host configuration

Use a supported Linux host with Node **22 or later** providing native `fetch` and `WebSocket`. The rest of this repository retains its own stricter Node requirement; this standalone worker does not run Nuxt, pnpm or repository build tooling. Install a compatible, pinned official Codex CLI and maintain its authorized login on this host. Do not copy a desktop credential cache as an integration shortcut. Run under the same private OS user that owns the authorized CLI cache.

Keep configuration in a host-only, owner-readable file such as `/home/ubuntu/.config/building-suit-hq/worker.env` with mode `0600`, inside a `0700` directory. The file must not be committed, uploaded as an artifact or put in public Nuxt configuration. The example unit reads it without displaying it.

| Variable | Meaning |
| --- | --- |
| `HQ_SUPABASE_URL` | Exact authorized HQ project URL; only staging `dpruoncalmwicrqhqelu` or production `nkpvskyugnnnozepbwzb` is accepted. Their credentials are independent. |
| `HQ_SUPABASE_PUBLISHABLE_KEY` | That project's `sb_publishable_…` key; never a secret/service-role key. |
| `HQ_WORKER_EMAIL` | Dedicated technical Auth account, explicitly bound to this worker by the database. Never the founder account. |
| `HQ_WORKER_PASSWORD` | Private technical-account password, at least 24 characters. |
| `HQ_WORKER_ID` | Stable UUID registered for this host; persist across restarts. |
| `HQ_CODEX_BIN` | Optional CLI executable path; defaults to `codex`. The example uses `/home/ubuntu/.local/bin/codex`. |
| `HQ_WORKER_STATE_DIR` | Optional private delivery-journal directory; defaults to `~/.local/state/building-suit-hq-worker`. Preserve it across upgrades/restarts. |
| `HQ_BRAIN_GOOGLE_CLIENT_EMAIL` | Read-only service account already authorized to read the company Brain. |
| `HQ_BRAIN_GOOGLE_PRIVATE_KEY` | That service account's private key. Escaped `\n` line breaks are supported. Never sent to Codex. |
| `HQ_BRAIN_ROOT_FOLDER_ID` | Exact company Brain Drive folder ID. Every supplied document is verified to descend from it. |
| `HQ_BRAIN_LEARNING_FILE_ID` | Optional owner-created Markdown output file under the Brain. The service account needs Writer only on that file; no folder/root write grant. Accepted lessons append with revision checks and readback receipts. |
| `CODEX_HOME` | Optional existing private Codex auth/cache directory. Defaults to `~/.codex`; never print its credential contents. |

Google configuration is unnecessary for an idle queue connection, but a real job fails closed until all three Brain settings and explicit file scope are present. No local Brain copy is used. A Google access token is cached until expiry, while document metadata/content are read fresh for every job. Documents must remain within the authorized root and unchanged across the read; stale, moved, missing or oversized documents block execution.

After authorized setup, the foreground entry point is:

```sh
node /opt/building-suit-hq-agent-host/worker.mjs
```

The private environment must already be loaded by the trusted host. Do not paste credentials into the command. For managed operation, install an adapted copy of `company-hq-worker.service.example`; its paths are deployment examples rather than repository dependencies. Create the private state directory and the authorized CLI directory before starting the unit, because its filesystem restrictions require those paths to exist. Start one service instance and preserve its state directory. Stopping it terminates the active child process group and records an interruption for later delivery. Do not start another manual worker using the same host identity.

## Database contract

All calls use the technical account's Supabase Auth access token and publishable key. Auth password sign-in and refresh are handled in memory; refreshed access tokens are sent to Realtime. Database authorization must check the current registered worker account/ID and session, rather than user-editable metadata. The worker receives only its private job topic and permitted RPCs; it has no founder approval authority or direct table-write grant.

Private Realtime topic: `hq-agent-jobs`, Phoenix JSON protocol `1.0.0`. A successful private channel join precedes the initial queue drain. Job broadcasts and successful reconnects trigger another serialized drain. [Supabase's protocol documentation](https://supabase.com/docs/guides/realtime/protocol) defines channel joins, token refresh and protocol heartbeats.

```ts
hq_worker_claim({ p_worker_id: uuid, p_lease_seconds: 300, p_meeting_protocol: 1 })
  => {
    job: null | {
      id: uuid,
      conversation_id: uuid,
      agent_id: string,
      prompt: string,
      lease_token: string,
      context: {
        brain_files: { id: string }[], // server-authorized Drive IDs, 1–18
        agent: { id: string, name: string, role: string, model: string, effort: string,
          profileFileId: string, skillFileIds: string[], lifecycle: string },
        mode: 'conversation-hr' | 'conversation-ceo' | 'conversation-intake'
          | 'task-route' | 'task-ack' | 'task-start' | 'task-work'
          | 'head-review' | 'ceo-review' | 'task-report' | 'lesson-extract' | 'lesson-review',
        task: null | {id:uuid,title:string,brief:string,acceptance:string,assigneeId:string|null,attempt:number},
        predecessor: null | {jobId:uuid,agentId:string,kind:string,text:string},
        artifact: null | {id:uuid,text:string,digest:string,agentId:string},
        lesson: null | {id:uuid,summary:string,body:string,sourceType:string,sourceId:uuid,digest:string},
        learned: {id:uuid,summary:string,body:string,sourceId:uuid,digest:string}[],
        meetingResponse?: {
          protocol: 1, scope: 'conversation-only', meetingId: uuid,
          contributionId: uuid, generation: number, agentId: string,
          bindingDigest: string // exact current binding checked by the database
        },
        // bounded server-owned conversation context
      }
    },
    next_wake_at?: string // only an actual pending lease/delayed job
  }

hq_worker_heartbeat({
  p_job_id: uuid, p_lease_token: string, p_worker_id: uuid,
  p_status: 'working'
}) => true | { accepted: true }

hq_worker_presence({ p_worker_id: uuid })
  => unknown

hq_worker_finish({
  p_job_id: uuid, p_lease_token: string, p_worker_id: uuid,
  p_reply: string, p_error: string | null
}) => true | { accepted: true }
```

### Meeting conversation protocol 1 — prepared source

The updated host sends `p_meeting_protocol: 1` on every claim. Apply the prepared meeting migration providing that three-argument RPC **before** starting the updated host. There is no automatic fallback if the new RPC is unavailable. An older two-argument host cannot execute a non-CEO meeting response: those jobs become visibly blocked with `meeting-protocol-required`, while unrelated work and compatible Steve intake retain their existing contracts.

A trusted `meetingResponse` marker permits the actual configured employee to answer in the existing `conversation-intake` stage using that employee's bound profile, model and effort. The host validates the exact marker fields, actor, generation and identifiers; the database checks the current binding digest at claim. This is context-only conversation: native web search and every other tool remain disabled, the provider result must be response-only JSON with `task: null`, and a model-suggested task is a genuine blocked outcome. Conversation configuration does not establish research qualification or observed runtime availability. Research and execution keep their separate qualification and approval gates.

Upgrade the existing service in place after inspecting its actual unit, `ExecStart`, OS user and runtime directory. The paths in the example unit above are examples, not observed deployment values. Preserve the same service identity, private environment file, authorized `.codex` cache and delivery journal; do not start a second worker or clear pending journal entries. This change replaces `worker.mjs` and retains its existing runtime imports (`workforceRoster.mjs` and `brainPublisher.mjs`); it needs no package installation. Back up the installed runtime module before replacement, use the existing service's restart path and retain the prior module for rollback. Installing this source does not itself apply the migration, restart a host or establish successful model/meeting acceptance.

The applied queue foundation is `apps/company-hq/supabase/migrations/20261105035454_hq_agent_messages_worker_queue.sql`; the forward workforce migration is `20261105150500_hq_workforce_tasks_learning.sql`. It installs no Auth user or worker membership. After an authorized administrator provisions a separate, confirmed technical account through the supported Auth Admin API, bind its actual UID to the persistent host UUID using the private database-owner-only helper:

```sql
select hq_private.register_agent_worker(
  '<persisted-host-uuid>'::uuid,
  '<actual-technical-auth-user-uuid>'::uuid
);
```

This is a concrete administrative setup example, not a command to execute merely by reading this document. API roles cannot call this private helper. The founder account is rejected; at most one enabled host is allowed. Disabling the trusted `hq_private.agent_workers.enabled` membership stops new claims and rejects further RPC operations, including still-valid cached JWTs. Each operation checks the current Auth session and membership; a cached Realtime join only provides a content-free wake hint.

Founder entry points are `GET /api/hq/agents`, `POST /api/hq/ceo/messages` with JSON `{prompt,requestKey}` (6,000 characters), `POST /api/hq/tasks` with `{title,brief,acceptance,assigneeId,requestKey}` (180/12,000/6,000 characters), and `POST /api/hq/tasks/:id/cancel`. A null assignee invokes a real Steve routing assignment. Fresh same-origin founder authorization protects all endpoints. Idempotency binds each request UUID to its exact brief. No technical worker identity, credentials or leases enter snapshots.

Conversation replies retain real Amaya → Steve ordering, then queue lesson extraction/review. Tasks have their own IDs and immutable artifact digests: assigned employee → Amaya head review for HR workers → Steve review → founder report → lesson extraction by Amaya → Steve learning review. Rejected task reviews can create at most two new repair jobs; uncertain started jobs never re-enter inference. Canceled tasks fence both heartbeat and late completion. Lessons are source-linked, content-deduplicated, accepted/rejected by an actual review, retrieved on later scoped assignments and published only after acceptance. Up to three relevant accepted lessons enter the next job. Snapshots retain recent tasks/lessons with actual statuses and publication receipts.

Additional scoped worker RPCs:

```ts
hq_worker_roster_sources({p_worker_id}) => {rootId,files:[{id,name,parents,mimeType}]}
hq_worker_sync_roster({p_worker_id,p_agents:[{id,name,departmentKey,profileFileId,skillFileIds,lifecycle,model,effort,managerId}]}) => {accepted:true,count:10}
hq_worker_pending_lessons({p_worker_id}) => [{id,summary,body,source_type,source_id,source_digest,digest}]
hq_worker_publish_lesson({p_worker_id,p_lesson_id,p_reference,p_digest}) => {accepted:true}
```

The current source has a separate department-orchestration eligibility gate. A model tier is configuration evidence only: `task-work` and corrective `task-start` run only for T1 workers with an explicit current qualification receipt bound to the worker's profile, department, reporting head, assigned skill IDs and current Brain file versions. The database also supplies a `headAuthorization` claim only when the exact direct T2 manager completed `task-ack` by delegating to that worker; a direct task assignment cannot skip head scoping even when the worker is otherwise qualified. Receipts require an HR evidence file and separate evaluation by Iris (AG-HR-003); Amaya (AG-HR-001) owns staffing records. The host accepts a head for `task-ack`, exposes only qualified direct reports to that head, blocks all head task execution, and routes a T1 worker's artifact first to its direct T2 manager and then to Steve. A staffing-required task is blocked and gets one durable HR-owned need; it is not hired, retried or externally notified by this code.

The registry projection retains the ten required core IDs and additionally parses explicit T1 entries in the canonical `Agent Registry` (operation column `T1_WORKER policy only`, profile path, and `Role / reports to` field with supervisor ID). It cross-checks the profile's `employee_id` and `reports_to`, exact assigned skill links and department path. The model target comes from the current Workforce Operating Rules. Registry presence, trial configuration, skill membership or static review alone never creates a qualification receipt.

The current canonical roster has thirteen identities. Rania (AG-SOC-002) reports to Layla, Karim (AG-RES-002) to Nadia, and Hadi (AG-SALES-002) to Omar; all three have one existing v1.2.0 core skill assigned. Their canonical state is configured, supervised trial pending, `not_qualified`, runtime unverified and model binding unverified; no canonical qualification receipt exists. The qualification table is introduced by the unapplied migration, so its live staging state is unknown. Therefore none is currently eligible to execute. Email remains without a T1 direct report, and account setup stays deferred. All four pilot departments still fail closed until actual HR trial evidence is recorded and the host/runtime model binding is verified.

The forward SQL migration permits additional canonical T1 direct reports, binds qualification receipts to HR evidence and current Brain source versions, injects that trusted receipt into job context, filters task-ack's eligible roster, and routes qualified worker results through their department head. Actual HQ roster sync, migration application, qualification entry, worker-host rollout and end-to-end operation remain unverified; these changes are source-only and do not activate or deploy the gate.

Roster metadata/profile reads run on initial/reconnect drain and actual Brain-index change hints, never idle polling. Source IDs must remain within the current indexed Brain. Roster sync retains the original ten core identity checks while accepting up to fifty canonical employees total; no identity is hardcoded for the three newly published workers. Per-agent presence comes only from actual claimed/completed assignments and active lease heartbeats, separate from host presence.

The server claims jobs atomically, fences leases, permits only one active assignment per agent, validates worker identity on every call and writes the assistant reply/job outcome atomically. Finish must be idempotent for the same job, worker and lease, including a response lost after commit. Heartbeat and finish must explicitly return `true` or `{accepted:true}`; empty or ambiguous success responses are rejected. Rejected calls return an HTTP error or `false`/`{accepted:false}`. A job with expired/interrupted execution must become blocked rather than automatically invoke the model again; an explicit retry uses a new job ID. Failed jobs do not create a fabricated assistant reply. A late result after lease expiry receives `{accepted:true,discarded:true}` as a terminal delivery receipt while remaining visibly blocked, so its private outbox need not obstruct subsequent work.

Queue payloads must include the current governing Brain documents and the selected employee's authoritative profile as explicit IDs. Never accept a prompt-selected arbitrary URL/file path. The worker reads plain text/Markdown or exports Google Docs, verifies membership under the approved root and includes document IDs/revisions with the bounded prompt. The reader permits at most 128,000 UTF-8 bytes per document and retains the existing 250,000-byte aggregate Brain-text ceiling, with at most 18 explicit source IDs and 245,760 bytes of server context. It requires complete source text rather than truncating standing policy. Declared Content-Length and streamed response bytes both enforce the document bound; oversize content produces `brain-source-too-large`, while the retained aggregate bound produces `brain-context-too-large` before inference. Root ancestry, source format, exact revision and fresh authorization checks remain unchanged.

Queue broadcasts should indicate newly claimable work or real queue changes, not lease/presence maintenance. There are **no timed idle queue or app-data queries**. The only periodic operations are the 20-second WebSocket transport heartbeat, 60-second host presence write, active-job 60-second lease renewal and authentication token refresh. A server-supplied pending-work deadline can arm one wake; a completely idle queue cannot. Reconnects use bounded exponential backoff and one authenticated catch-up claim after joining, covering missed notifications.

## Live conditional metadata receipt

On 5 November 2026, an authorized metadata-only check on the dedicated reviewed-learning file used its current provider-issued v2 ETag with PUT of the unchanged existing title. Google returned HTTP200, preserved the title and advanced the version/ETag. Replaying that actual old ETag returned HTTP412 with reason `conditionNotMet`; subsequent metadata confirmed the rejected request changed neither version nor ETag. No file content was sent or modified. A fabricated quoted validator had previously returned500 and is not a valid stale-validator fixture. This receipt establishes v2 metadata conditional enforcement; exact media-update rejection is a separate path and is not implied by this metadata-only check.

## Execution, recovery and logs

Jobs execute sequentially with a 10-minute deadline and five-minute renewable lease. Each invocation uses a fresh empty directory, ephemeral session, read-only sandbox, ignored user configuration/rules, disabled shell/browser/apps/plugins/delegation and an empty MCP map. Code Mode's host is not deliberately disabled, avoiding the earlier pilot's known startup diagnostic; only native web-search item events are allowed for task-work by Nadia (AG-RES-001) or Noah (AG-HR-002). All other tool item events are rejected. Explicit model and effort come from the current canonical profile binding; unsupported bindings fail instead of switching models. No generic shell, HTTP, browser or MCP tool is granted to the model. Research workers use documented native `web_search="live"`; other stages use `disabled`. Search prompts prohibit leaking private Brain/task text. Observed source URLs are preserved in the immutable deliverable. See [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference). Unknown/error JSONL events, nonzero exit, multiple/missing completed turns and invalid final output fail closed. Final replies are bounded to 32 KB and stdout/stderr together to 4 MiB; raw provider diagnostics, prompts and output are not written to service logs.

Before inference, the worker flushes a `0600` job journal to its `0700` state directory. A completed reply is flushed before delivery. Reconnect/startup replays only the exact idempotent finish operation. An interrupted entry records `worker-interrupted`; it never runs inference a second time for that job ID. Delivered tombstones prevent later accidental re-execution. Journals can contain private replies and lease tokens: keep them private, back them up according to the host retention policy and do not remove pending entries to force retries.

Failures are recorded as fixed, credential-free codes such as `brain-configuration-required`, `brain-scope-required`, `brain-source-changed`, `brain-source-too-large`, `brain-context-too-large`, `provider-error`, `provider-tool-rejected`, `provider-output-invalid`, `provider-timeout`, `lease-lost` or `worker-interrupted`. A transport outage retains the pending journal. Authorization/lease rejection requires operator reconciliation; it cannot justify switching credentials, creating another reservation or retrying inference silently.

Run `node --test tooling/hq-agent-host/workforce-db.test.mjs tooling/hq-agent-host/worker.test.mjs tooling/hq-agent-host/brainPublisher.test.mjs` for disposable database and mocked subprocess checks. These tests perform no real inference, hosted writes or paid API calls. Hosted task, real research/model, reviewed publication and PC-off acceptance require their own observed receipts; source/unit checks do not establish those outcomes.


## Office skill-load observations

HQ-OFFICE-INSPECTOR-20261105 adds one guarded `hq_worker_skill_context` call after successful scoped/versioned role-skill reads and before inference. Apply forward migration `20261105171608_hq_office_observations.sql` before rolling out this worker change. Receipts are idempotent per job and never contain source text or credentials. They measure context loads, not skill application. Telemetry failure is logged as `skill-observation-unavailable`; it must not rerun inference or grant another tool. Missing receipt coverage is shown as unknown, not zero. The UI task did not apply this migration, deploy/restart the worker or perform runtime acceptance.


5 November activation follow-up: migration `20261105171608_hq_office_observations.sql` is now applied to HQ staging. This is the provider-assigned version of the previously generated, unapplied 20261105164121 source; the local filename now matches actual migration history. The new founder observation RPC includes real seven-day task history (up to eight recent records per assignee, 128 overall). Earlier UI-task rollout limitations above describe that earlier checkpoint. This follow-up does not retroactively manufacture load receipts or prove a worker deployment.

## Conversational chat transitions — 5 November

The forward `20261105180148_hq_conversational_chat.sql` migration changes new chat requests to Steve's `conversation-intake` stage. Steve can answer ordinary conversation or create one coherent task within the existing bounded drafting/research host capability. A real handoff records the selected employee's mention and task ID, followed by that employee's actual acknowledgment and plan. A supervisor may transfer that single task to one existing, assignable direct report; the recipient acknowledges before working. This is a queue transition, with no external agent tool, fanout, new hire or expanded permission. Existing historical HR→CEO jobs keep their original predecessor contract.

Actual supervisor review findings remain attached through acknowledgment stages. Rejected reviews produce a visible directed repair message and permit the existing maximum of two repair rounds. The actual task author reports the accepted artifact; the UI receives its real task ID. Provider, authorization and uncertain-execution failures remain truthful durable states and never become completion claims or silent inference retries. Published learning indicators require the recorded publication timestamp and trusted Drive receipt; proposed or merely accepted learning is not a Brain publication.

The founder-authorized staging rollout applied migration `20261105180148` to `dpruoncalmwicrqhqelu` before restarting the existing Oracle service at 18:02:39 UTC on 5 November. Before stopping, all 36 private journal records were delivered and no worker child process was active. The three installed runtime module hashes match the reviewed source; the previous modules are retained privately, the environment is byte-identical and the delivery journal is preserved. The restarted service is active with zero automatic restarts and an observed `queue-connected` event. No inference test request was submitted by this rollout; this service receipt does not establish real-model chat acceptance. Production and provider accounts, capacity, model authentication and grants remain unchanged. Chat snapshots prioritize the owned task details referenced by their bounded transcript, then learning sources, within 32 records and a 384 KiB task-detail budget; unsupported links outside that window are omitted. The disposable database and mocked-worker suites exercise the new transitions without hosted writes, real inference or paid calls.

## Idle liveness without snapshot invalidation — 5 November

The forward `20261105192548_hq_presence_without_snapshot_polling.sql` source changes the existing worker-presence RPC to emit a lightweight private observation instead of an `agents` invalidation. Its timestamp and optional active leased employee/task update freshness without rereading the company, roster or Brain. The existing worker binary needs no change or restart. The BFF still checks fresh founder authorization before forwarding observations; protocol heartbeats remain comment-only.

Actual job state transitions still emit application invalidations, while lease/timestamp renewals and identical roster synchronization do not. The authorized rollout deployed BFF/client support first: staging web deployment dpl_9UNYfTH7rHFMT4x6VwTK2uJXTL1Q reached READY at 2026-11-05T19:14:49.942Z on the exact staging alias. Migration 20261105192548 then applied to dpruoncalmwicrqhqelu with success:true. Read-only checks at 19:26:09 UTC confirmed presence broadcasts without agents invalidation, the actual-job-state trigger and retained RLS/private-helper restrictions. Focused disposable PostgreSQL and mocked SSE tests pass. At 19:30:08.028915 UTC the staging read observed four actual presence messages since 19:25:48 application, worker last-seen 19:29:42.552437 and zero agents/company invalidations since application; the last agents invalidation was pre-change 19:25:42. Liveness therefore continued across four quiet idle heartbeats. No worker restart or inference probe occurred.


## Governing-document size correction — 5 November

A founder intake failed before model invocation when the mandatory Working Agreement grew past the previous 48,000-byte document limit. The new 128,000-byte allowance accommodates the complete governing document while retaining the same total Brain budget and all source/authorization fences. Eleven mocked-worker checks pass, including the full 50 KB agreement, exact per-document and aggregate boundaries, chunked/no-Content-Length responses, UTF-8 byte accounting, 18-source scope, root ancestry and version-change rejection. These are synthetic read tests with no private Brain reads, hosted writes or real inference.

The failed job and delivery journal must remain preserved. This source change adds no automatic retries, new queue reservation or recovery endpoint and performs no deployment. Any separately authorized recovery must use a fresh job identity with a reviewed link to the original pre-inference failure; it cannot clear the old journal or requeue its delivered identity.
