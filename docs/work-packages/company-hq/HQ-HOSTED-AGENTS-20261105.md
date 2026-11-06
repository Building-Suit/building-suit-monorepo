# Private HQ hosted agents — 5 November 2026

This work connects the original HQ workspace to a durable founder conversation and a bounded Amaya → Steve planning chain. Supabase owns messages, ordered work, trusted worker registration and delivery state. The private Oracle host reads the current authorized Google Drive Brain and runs each named employee through its existing personal Codex CLI login. Closing the viewing PC does not remove stored messages or queued work; continued execution requires the independently running Oracle worker and hosted HQ service.

This is an internal HQ capability. It does not activate a public Suit, grant approval authority to an agent or establish that a complete hosted journey has passed acceptance.

## Implemented source flow

1. The founder signs into HQ through the existing trusted founder session. `Talk to CEO` selects the CEO workplace and opens its existing overlay, with the conversation and company-plan board together. Shared presentation receives typed content/state and emits a send command; it does not fetch product data or grant access.
2. `POST /api/hq/ceo/messages` accepts a bounded prompt and stable request UUID. The server checks the current founder, exact environment and same-origin request boundary. The database atomically stores the founder message and two dependent jobs: Amaya's planning assessment, then Steve's founder reply.
3. A private `hq-agent-jobs` Realtime event wakes the single authorized Oracle worker. A successful authenticated channel join and reconnect also permit a catch-up claim. Atomic claims, expiring fenced leases and worker/session checks determine who can execute and finish a job.
4. Before each invocation, the worker reads the explicitly authorized governing Brain and employee-profile documents from Google Drive. It verifies their ancestry under the authorized root and stable source revisions. Missing, moved, changed, oversized or unauthorized sources block execution; no local Brain copy is substituted.
5. Amaya runs a real, bounded planning assessment. After successful completion, a separate Steve invocation receives that exact same-request HR result and independently reads its current Brain scope. Steve's final reply is committed with its job outcome. Amaya's intermediate assessment remains a private dependency rather than an invented visible conversation message.
6. Founder-visible private event invalidations refresh the existing session-scoped snapshot. The UI shows actual runtime freshness, queue state and supplied employee activity. There are no timed idle queue or application-data queries.

The source initial roster is exactly `AG-CEO-001` Steve and `AG-HR-001` Amaya. Documentary departments, unqualified employees or idle avatar motion do not establish additional operating agents. An unavailable runtime shows unavailable/offline state rather than simulated replies or working animations.

## Authority, data and recovery

The migration source is `apps/company-hq/supabase/migrations/20261105035454_hq_agent_messages_worker_queue.sql`. Business queue records use `public.hq_agent_conversations`, `public.hq_agent_messages` and `public.hq_agent_jobs`; trusted roster/worker membership and privileged helpers remain in `hq_private`. Explicit RPCs, RLS, grants, current session checks and private Realtime policies control access. A technical Auth user must be registered separately from the founder through the supported administration interface and owner-only registration helper. The migration does not create a worker login or bootstrap itself into founder authority.

Dedicated project references remain staging `dpruoncalmwicrqhqelu` and production `nkpvskyugnnnozepbwzb`. Their credentials, Auth users, memberships and cookie namespaces remain independent. Founder-visible responses omit technical worker identities, passwords and lease tokens. Hosted Brain reads require founder authorization; Google service-account credentials and private host configuration never enter public Nuxt configuration or the model's child environment.

The source permits one enabled host and sequential execution. Founder requests are idempotent for the same UUID and exact prompt. Interrupted or expired inference becomes blocked rather than silently invoking the model again. A private delivery journal is written before inference and before final delivery; restart/reconnect replays the same idempotent finish operation, not the model invocation. Logs use bounded fixed failure codes rather than raw prompts, output or credentials.

The worker's periodic operations are transport heartbeats, host-presence writes, active-job lease renewal and authentication refresh. A server-provided deadline for actual pending work may arm one wake. None of these is an idle query loop for company/Brain/application data. Runtime freshness expiry is also local display state, not a scheduled browser fetch.

This first executor supports conversation, analysis and proposed plans. It has no model tools for product development, outside research, hiring, skill installation, Brain writes, emails or publication. Current founder approval remains a separate server/database operation. A personal CLI response receipt does not by itself establish every hosted usage entitlement, availability guarantee or a completed PC-off HQ journey. The maintained host contract and operational limits are in `tooling/hq-agent-host/README.md`.

## Original workspace presentation

The shared renderer receives only the actual supplied roster. Assigned working employees occupy their real desk/office and use typing poses. Actual idle activity may use walking, lounging or fishing motion; those movements are cosmetic presentation, with no business state transitions or inference attributed to them. Offline and unknown employees remain hidden. No fixture roster or synthetic work status is added.

The original island retains its inhabited flat support and existing workplace, furniture, Orb and camera contracts. Its land presentation now includes a taller dark rock coast below that support, a sand beach, recreation furniture, a small fishing pier and a shared coastal descent route. Sand/wood/canvas pigments derive from the canonical palette. Cached finite geometry and GPU water waves, analytic normals and moving foam provide motion without a reflected-land render target or per-frame terrain rebuild. Resource disposal and motion reset accompany layout/context lifecycle. Other scene edits already present in the primary checkout are preserved.

## Provider setup receipts at this document's initial handoff

These are configuration receipts, not deployment or acceptance results. Subsequent verified setup outcomes must be appended below rather than inferred from a project's existence.

| Resource | Recorded state |
| --- | --- |
| Vercel staging | Project `company-hq-stg`, ID `prj_d6vsDeXGvUSwewrzUXmRQdWcYA3z`, created with Node 24 and domain `stg.hq.building-suit.com` attached. No deployment receipt yet. |
| Vercel production | Project `company-hq`, ID `prj_F4Z1AhuO9zd0Q6LgFrr6OcQcuojo`, created with Node 24 and domain `hq.building-suit.com` attached. No deployment receipt yet. |
| Hosted origins | Separate intended HTTPS origins are `https://stg.hq.building-suit.com` and `https://hq.building-suit.com`. Source origin checks remain exact and environment-bound; an attached domain alone does not establish configured application secrets, routing or reachability. |
| Cloudflare DNS | DNS records for those HQ hostnames are not configured at this handoff. No target, proxy mode or propagation result is claimed. |
| Supabase migration | Queue migration exists in source; no remote application receipt at this handoff. |
| Oracle worker | Worker and systemd example exist in source; no installation, enabled service or real job-completion receipt at this handoff. |

## Validation and release disposition

Source inspection only. No tests, build checks, lint, typechecks, boundary/release checks, browser/API/runtime acceptance or tester/reviewer agents were run under the standing founder instruction. A necessary provider deployment build, if later performed, must be recorded separately as a deployment operation and must not be presented as behavioral acceptance. The actual founder-message → Amaya assessment → Steve reply → fresh workspace update and PC-off journey remain unverified here.

Private provenance: `release-fragments/hq-hosted-agents-20261105.json`. This task does not grant merge/promotion authorization or public product activation. Provider setup and source implementation remain distinct from successful deployment and release readiness.

## Subsequent operational receipts

The following receipts supersede the initial setup-status table above. They are operational observations and normal queue-delivery evidence; they do not establish browser, PC-off or release acceptance.

| Resource | Subsequent recorded state |
| --- | --- |
| HQ staging database | The queue migration was applied to staging `dpruoncalmwicrqhqelu` as version `20261105035454`. Its maintained source path is now `apps/company-hq/supabase/migrations/20261105035454_hq_agent_messages_worker_queue.sql`, renamed to match the applied remote version. The initial source filename above is historical. No production application is claimed here. |
| Trusted worker | A dedicated technical worker account was registered separately from the founder through the maintained trusted registration boundary. No account credentials, worker grants or lease values are reproduced in this document. |
| Oracle service | The managed Oracle worker was installed, enabled and observed running with Node 24.15 from a pinned, checksum-verified artifact. Operational logs recorded `queue-connected` and two normal `job-started` / `job-delivered` sequences. This task submitted no test job. Job content and request origin were not inspected for this receipt, so it does not independently attribute those jobs to a particular human request or prove a complete founder/browser journey. |
| Vercel domains and DNS | The staging and production projects/domains remain the identities recorded above. Vercel configuration inspection reported `misconfigured: false` for both `stg.hq.building-suit.com` and `hq.building-suit.com`, superseding the earlier missing-DNS state. No unobserved Cloudflare proxy mode, record target or propagation timing is inferred from that result. |
| Vercel deployment | Staging deployment is pending at this receipt update. Project creation, attached domains and a valid DNS configuration are separate from a completed build/deployment. No successful production deployment is claimed. |

Current character rendering uses `HQ_AGENT_CHARACTER_SCALE = 1.28`. Seated poses compensate around the hip anchor so that the larger characters retain their chair position. This remains supplied-activity presentation rather than evidence that an employee executed a job.

The subsequent founder terrain revision `HQ-HILL-STRONG-WAVES-20261105` supersedes the earlier beach/recreation presentation described in this document. The active island currently has high dark cliffs and stronger GPU water waves; beach, sand, recreation furniture and the coastal leisure route were removed from active geometry. This hosted-agents task preserves that newer terrain state and does not restore the earlier beach. Idle character motion remains cosmetic, and a dormant pose/helper does not establish an active recreation location.

The documentation component catalogue also now demonstrates `BsHqCeoChat` in its localized unavailable state, with empty agent/message arrays, zero queued work and an offline runtime. It performs no network request, sends no production command and fabricates no employee activity.

No autonomous test request, test/build check, browser/API acceptance check or tester/reviewer agent was introduced for these updates. Necessary deployment operations and normal service logs remain distinct from acceptance tests; any later deployment build/result must receive its own receipt.


Staging deployment completed on 5 November: Vercel deployment `dpl_FAELEE3c6A6LcoeVgaAro4RZoxtC` reports **READY** with alias `https://stg.hq.building-suit.com` and no alias error. This is the production target of the separate **staging Vercel project**, using the staging Supabase ref, not a company production release. The initial deployment's Nitro bundling failed resolving a relative runtime shared-type path; using Nuxt `#shared` imports in the two client composables resolved that provider build. No source was edited outside the primary checkout; a 10.6-MiB credential-free source artifact was prepared for upload because recursive CLI archiving traversed local worktree folders. `.vercelignore` records local/credential/generated exclusions. The successful provider build is necessary deployment evidence, not an application acceptance suite. No HTTP/browser/model probe was sent by this task. Production DNS and the empty Vercel project are configured, but production database/runtime/app release remain untouched.

The administrative preflight failed with ETIMEDOUT; a later live GitHub read confirms PR528 remains open into stg at remote head a2f8e25f. Concurrent primary-checkout HQ visual/roster work remains preserved. This task does not commit or publish other tasks' dirty edits.
