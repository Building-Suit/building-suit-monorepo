# HQ multilingual meetings — implementation checkpoint

Brief: 5 November 2026. Verification continued into 6 November, Africa/Cairo. **This is a source implementation with an isolated synthetic demonstration. The live multilingual meeting experience is not activated or verified.**

## Current source and scope

The cloud checkout initially lacked HQ. Fresh preflight first identified published root a2f8e25f. The founder then reported local checkpoint4adde130 and failed push. A later fresh fetch resolved that gap: origin/codex/company-hq/office-design reached9df6ff85 and contains4adde130. This feature was reconciled onto9df6ff85 in the primary checkout, without a worktree. Existing Chat, draft dictation, workforce, scene, authority and drafts are preserved; Meeting is a separate additive entry. Subsequent uncommitted PC edits remain outside this checkout and must be preserved when integrating the feature.

The brief authorizes feature implementation and focused synthetic unit/integration/browser checks and independent review. That supersedes older testing restrictions only for this feature. No production/staging deployment, hosted migration, merge into shared branches, Oracle service/network change, new paid service, real microphone recording or external message sending is authorized or performed.

## Capability matrix

| Required capability | Existing implementation | Meeting addition / missing work | Verification / dependency | Activation limit |
|---|---|---|---|---|
| Founder boundary | HQ HttpOnly sessions, live Auth/session/founder RPC, exact origin and header checks | Reused for live adapters; separate opaque synthetic browser token for loopback demo | Cross-owner/grant/Origin tests | Existing hosted credentials not loaded into this cloud |
| Participants | Cloud-only Brain registry, profile/manager/model bindings, founder-safe agent snapshot | Source/version roster parser and dated explicit demo identities | Duplicate/wiki-alias/qualification checks | Configuration never grants qualification/tools |
| Chat/dictation | Current Chat, persistent draft, SSE, draft-only speech controller | Preserved; separate meeting coordinator/audio UI | Additive source comparison; focused chat/dictation regressions | No live chat submission in verification |
| Arabic/English meeting | Shared RTL, design tokens, dialogs and accessibility | Prejoin, founder/agent tiles, transcript, text, chat/links, task/plan/connection views | Actual desktop/mobile browser scenarios | Browser suite uses WebGL-unavailable fallback |
| Stable voices | Installed device voices are device-dependent | Exact localService voice URI per stable ID/language; unique assignments, no fallback | Controller + browser speech mocks | Actual Arabic inventory/dialect/pronunciation untested |
| Audio/interruption | Existing microphone never sends dictation automatically | Explicit consent, installed on-device recognition only, VAD/manual interruption, stale-turn fence, cleanup | Mock permission/recognition/late-chunk/race tests | No real capture or acoustic latency test |
| Turn coordination | Existing Steve-first task/chat workflow | Explicit founder/agent/unassigned floor, direct address, Steve coordination, bounded context | Domain routing/one-speaker/cancel tests | Demo responses are fixed synthetic text, not model output |
| Background research | Existing restricted native research tools and durable HQ worker | Recorded assignment/result/hand/report; disabled bounded public GitHub inspector source | Fixture tasks + mocked fixed-host fetch tests | No live research adapter or new staff activation |
| Versioned execution plans | Existing company-plan approvals cover staffing; business tasks are separate | Exact immutable plan digest/version, explicit decision/start timing, revision/discard/defer | Domain + product SQL bridge tests | Unsupported actions/dependencies/limits fail closed |
| End/disconnect | Browser-independent task records already exist | Intentional end dispatches exact preapproved scope once; disconnect holds | End/reconnect/dedup tests | Ending alone never approves |
| Durable work | Existing hq_business_tasks, queue, technical worker, leases/journal, artifacts/review/report | Meeting receipts bridge to that subsystem; no parallel live queue | Source bridge contract + disposable SQL checks | No meeting migration or host rollout applied |
| Recovery/review | Existing worker→head→Steve→founder and bounded repair | Reused live; independent fixture reviewer/process persistence for demo | Actual synthetic child SIGKILL/restart and separate reviewer | Does not qualify Oracle or live employees |
| Privacy | Fixed-root read-only Brain and server-side credentials | No raw audio retained; reviewed speech drafts; disposable transcript lifecycle | Capture cleanup and owner-bound fixture tests | Live provider data destinations/retention remain a selection gate |

## Architecture and actual functional scope

HQ remains Nuxt with presentation in packages/ui and audio policy in packages/ux. The existing HQ Auth, Brain reader, Chat, task dispatcher, technical worker and review/report chain remain authoritative. New meeting records and execution-plan approval are separate from company staffing plans. Live SQL accepts semantic founder commands rather than full-state replacement. Meeting task dispatch links to existing business-task IDs with deterministic idempotency keys. Unsupported capabilities must remain explicit blockers; no constraint is silently dropped.

The live transport starts disabled. Separate private, evidence-bound meeting qualification records start empty and are rechecked against current canonical bindings. Attendance does not qualify employees or grant tools. The current worker performs bounded research, analysis, planning and drafting; it does not execute downloaded code, run arbitrary repository builds, send campaigns or publish. Meeting approval cannot broaden those tools. The live bridge admits only environment `hq-existing-worker`, timeoutScope `worker-job`, timeLimitSeconds `600`, allowedActions `['read-approved-sources']`, budget0, no dependencies/blockers, a qualified canonical owner and the actual independent workforce review pipeline. Pinned ownership is enforced before routing can enqueue work. Whole-task deadlines, unsupported dependencies, code execution and broader actions are stored as blocked with HQ_MEETING_SCOPE_UNSUPPORTED; no constraint is dropped. Task/review receipts refer to actual hq_business_tasks and artifact IDs/digests. See the migration's exact schema and guards.

The loopback-only demonstration is separately enabled by scripts/meeting-preview.mjs. It uses a disposable SQLite file, an opaque HttpOnly browser token, deterministic marked replies, one synthetic worker process and a separate fixture reviewer process. SQLite is not a second live operational database. File-change SSE invalidates views without recurring application data polling. No application model, hosted speech service, live employee or arbitrary web/repository code is invoked in the demonstration.

The public-repository inspector source makes at most five anonymous fixed api.github.com GETs with redirects blocked, finite time/byte limits and quoted untrusted material. It reports inspected evidence separately from claims, inferences, cost/security unknowns and recommendations. Existing synthetic workers reject its distinct public-read-only mode. It was tested with mocked HTTP only and is not activated.

## How to open the demonstration

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
node apps/company-hq/scripts/meeting-preview.mjs
```

Open http://127.0.0.1:3101 on the host running the command and select **Meeting / الاجتماع**. The cloud localhost used for verification is not the founder PC's localhost. Use `--port 4347` or `--database /absolute/disposable/meetings.sqlite` when needed. The default record is .local/hq-meeting-demo/meetings.sqlite. Workers are bounded to30 minutes; stop/restart the preview for another session.

Start in Arabic with Steve, Amaya, Noah and Nadia selected. Send text to Steve; share one public repository URL in chat; assign Noah a clearly synthetic research question while speaking to another participant. Completion raises his hand only after the worker persists a result. Invite the report, draft a scoped fixture plan owned by Noah, inspect its full scope/digest, confirm that exact version to start on intentional end, then end. Separate worker/reviewer processes persist the marked result and review status for returning to the meeting. In a new meeting, discard a draft before ending: no execution receipt or task should be created.

Optional audio uses exact installed local voices and already-installed on-device recognition packs. Missing voices/packs retain text fallback. Microphone consent and a separate explicit capture action are required. Recognition remains a draft, displays uncertainty and never approves a plan. Remote browser recognition is not enabled by this integration. No Egyptian dialect or natural code-switching quality is claimed.

Stop the preview before deleting its disposable directory to remove its retained synthetic records. This is lifecycle cleanup, not a forensic secure-erasure guarantee for SQLite/WAL/backups. Existing live transcript deletion is not introduced by this fixture. Raw audio is never recorded.

## Provider and hosting findings

The refreshed published source already includes the private Oracle HQ host worker, documented technical Auth and persistent job journal. Current source receipts describe authorized staging worker activation and completed tasks, superseding a claim that only the early pilot exists. Those source receipts were supplemented by a read-only HQ staging query at2026-11-05 22:29:38UTC: one enabled host, latest heartbeat22:29:05UTC, zero current leased jobs, zero queued jobs, latest completed business task20:50:37UTC. This verifies recorded presence/queue state, not SSH health, current CPU/RAM, quota or meeting latency. Existing workloads and credentials were not changed.

The worker reuses the owner's authenticated private Codex CLI on its trusted host, with exact configured model/effort, OpenAI provider, ChatGPT login and no API/model fallback. Official Codex documentation describes advanced ChatGPT-managed authentication on trusted CI/CD runners; this does not grant generic hosted API credentials or unlimited quota. No desktop authentication cache was copied. Existing ChatGPT/Codex account privacy controls must be verified for meeting transcripts; API-default retention/training statements must not be assumed to govern CLI account traffic. No new API key is required merely to preserve this existing supported private worker route. Current allowance, role qualification, meeting latency/concurrency and Oracle speech capacity still require focused acceptance before live meetings.

Official API documentation also describes a possible API-credit benefit for eligible paid Pro/Business plans. Eligibility/claim/balance/expiry and prevention of purchased-credit fallback are unverified here. No claim, key creation, upgrade, API request or paid fallback occurred. API speech is not selected or enabled. See HQ-MEETING-PROVIDERS-20261105.md for official links, retention and device constraints.

This cloud environment has no configured Oracle identity or TCP grant and no HQ service secrets; it did not modify or freshly inspect the host. The web preview/fixture processes ran only inside this task environment. No hosted deployment or physical PC-off test occurred.

## Verification receipts

Final verification uses the reconciled9df6ff85 source and existing task/worker contract. No result from the superseded parallel SQL worker design is used as acceptance of the final live bridge.

| Check | Observed result | Scope and limits |
| --- | --- | --- |
| Focused meeting unit/integration batch |109/109 passed | Domain20, registry1, bounded public inspector13, demo service6, durable fixture14, live SQL24, live projection/request16, audio15. Disposable data and mocked providers only. |
| Existing Chat/dictation regressions |7/7 passed | Existing speech-dictation and agent-snapshot-version tests; no live submission. |
| Actual browser meeting suite |8/8 passed | Seven actual demo UI/BFF/SQLite/process scenarios; one separately labelled live-protocol fixture with intercepted Auth/API/SSE. The last does not verify a live backend or provider. |
| HQ app typecheck |Passed | Full app/shared dependency types; no claim about unrelated app checks. |
| Scoped ESLint |Passed, existing docs warnings retained | Meeting/shared files checked; the unchanged dynamic-header deletion in the inherited Nuxt configuration is outside this focused pass. |
| Strict shared UI boundary check |Passed |174 Vue files across8 discovered Suits, zero violations. |
| HQ production build |Passed |44.0 seconds;12.9MB server output,4.2MB gzip. Nuxt shared alias fixes the production-only adapter import resolution failure found during verification. |
| Built-server local smoke |Passed |Root200; availability200 with both modes false; demo/live endpoints503. No hosted request, model, speech or SQL invocation. |
| Independent review |Completed, scoped defects repaired | Approval/owner boundaries, generation cancellation, idempotent dispatch, recovery, exact review verdict/artifact correlation and bounded context. This is source/fixture review, not staff qualification. |
| Full committed release classification |Blocked by inherited main-to-stg inventory |`pnpm release:check` stops at `Unreviewed main-to-stg net path: CLAUDE.md`. That file is unchanged by this feature and already differs between origin/main and9df6ff85. No unrelated release classification or check bypass is added. |

The combined batch command is `node --test apps/company-hq/tests/unit/meetings-*.test.mjs packages/ux/tests/meeting-audio.test.mjs`. Browser configuration is `apps/company-hq/playwright.meetings.config.ts`; run against the loopback preview with the documented Chromium executable. Raw test/build receipts and screenshots accompany the private review package. The feature-delta fragment/path inventory is checked separately from9df6ff85; it does not replace or waive the blocked full release gate. Neither is a deployed-release claim.

Verified independently: exact approval and no transcript approval, revision/discard, one speaking floor, stale speech generations, real fixture task completion before handraise, link attribution, failure/timeout, owner isolation, idempotent dispatch, cancellation races, actual child-process crash/restart, separate fixture review and tamper rejection. A recorded synthetic recovery batch observed155ms child restart wall time,14.38ms fixture execution and34.75MiB process RSS/maxRSS. These are cloud fixture measurements, not Oracle model or speech capacity.

Interruption unit tests include an injected2.5ms cancellation-call duration. The final browser fixture observed0.1ms from the click capture event to mocked speechSynthesis.cancel, using synthetic local voices, no microphone and the scene's WebGL fallback. Neither measurement is audible stopping latency. Real microphone/acoustic interruption remains unverified. Oversized recognition/drafts reject new input and preserve the previous exact draft rather than truncating it.

Focused checks exclude unrelated scene acceptance and broad product suites. Actual browser meeting tests intentionally use the existing WebGL-unavailable fallback because headless GPU work stalls unrelated scene controls. They verify actual shared meeting UI→BFF→durable fixture→separate worker/reviewer with synthetic content, no external browser requests and zero real microphone calls.

The demonstrated Arabic scenario records a marked Steve response, a shared repository link, Noah's fixture research while discussion continues with another head, founder interruption/direct address to Amaya, a persisted finding and raised hand, invited report, exact-version plan confirmation, intentional end, one dispatch and independent fixture reviews/report after browser return. The rejection scenario discards the plan and ends with zero execution receipts. Separate child-process SIGKILL/restart verifies fixture durability. These results establish browser-independent synthetic execution in this cloud workspace; they are not a real repository investigation by Noah, Oracle deployment or physical PC-off test. Ambiguous recent links now require clarification before assignment, and draft plans do not inherit unrelated links.

Live source uses qualified canonical roster bindings, the existing event hub, actual persisted contribution/task/artifact IDs and digests, and actual true/false review verdicts. Meeting model replies cannot create suggested work. Bounded prompts preserve the exact current utterance and current plan/decision references; ambiguous links supply candidate event IDs with clarification required, not arbitrarily selected URLs. Oversized mandatory context fails before enqueue. Arabic/English reversible stop/pause/continue and unique canonical names are interpreted by SQL; ordinary approval language remains discussion. Approval requires the visible exact-version control. Live transcript records have no automated deletion/retention job in this change; policy and an authorized deletion workflow remain a rollout gate.

## Publication and private review package

The source branch is codex/company-hq/multilingual-meetings, based on verified9df6ff85 and containing the founder's4adde130 checkpoint. The founder reports Automatic branching OFF for both HQ Supabase projects in this conversation; the connector independently showed no branches but could not inspect that toggle. GitHub metadata reports the repository PUBLIC. The brief expressly excludes public sharing, so no push or PR is made without explicit publication authorization. A verified Git bundle, patch and report are prepared privately; importing them must preserve the founder's newer uncommitted PC edits. No shared branch is merged.

## Remaining live acceptance and rollout

1. Review subsequent PC uncommitted edits when integrating this additive feature; current published4adde130/9df6ff85 is reconciled.
2. Qualify the exact meeting role/tool scope, current subscription allowance and bounded Oracle capacity using existing supported authentication. Do not enable paid/model fallback or copy caches.
3. Review the exact new source-only migration and its supported existing-task contract. Unsupported bounds/actions remain blocked. Obtain separate authorization for any staging migration/web/worker rollout; this brief grants no hosted deployment or production change.
4. Verify the real existing queue/worker/review path with meeting receipts, actual PostgreSQL contention, browser disconnection and worker restart. No synthetic or PGlite result establishes those live outcomes.
5. Test real Arabic/English installed voices, recognition, echo/noise and audible interruption only after explicit user microphone action. No physical PC-off acceptance is claimed.
