# Multilingual HQ meeting implementation — 5 November 2026

Status: implementation and focused synthetic verification in progress. Live-provider operation and current-PC source reconciliation are not verified.

## Baseline and authorized scope

The selected cloud checkout originally pointed to 5fb461fe and lacked HQ. Fresh administrative preflight completed with errors=[]; GitHub confirmed PR528 OPEN at a2f8e25f90eb8d12d4a750056d25a4e4b81263f4. The current published HQ root is newer than and diverges from the retired experimental runtime in PR529/530. This task uses the published HQ root in the primary checkout, without creating a worktree or restoring the retired runtime.

The founder subsequently identified the current-PC checkpoint as 4adde130 on codex/company-hq/office-design. Its push failed; the verified bundle is on the PC and is not readable in this cloud. Three local commits and later uncommitted PC edits are excluded here. The additive UI/composable integration must be reconciled against that checkpoint before claiming integration with the current running HQ.

The pasted brief authorizes this feature, synthetic/unit/integration/browser checks and independent review. It supersedes the older HQ testing restriction only within this scoped feature. No production deployment, merge, production migration, provider activation, spending, broader grants, public sharing, real microphone recording or external messaging is authorized or performed.

## Capability matrix

| Required capability | Existing implementation | Added / missing | Dependency / verification | Blocker |
|---|---|---|---|---|
| Founder boundary | HQ HttpOnly cookies, live Auth user/session + trusted founder RPC, loopback/Origin/header gate | Reused for live semantic adapters; isolated synthetic session for demo | Owner/cross-owner SQL and fixture tests | Live app credentials absent |
| Canonical participants | Scoped cloud-only Brain reader and current Drive registry | Bounded roster parser, source/version references; dated demo identity snapshot | Alias-pipe, duplicate-ID and qualification tests | Live roles/worker qualification not verified |
| Meeting and Arabic/English UI | Shared UI tokens, RTL, complete HQ template | Shared prejoin/meeting panel, captions/text/chat/tasks/plan/connection | Focused actual-component/browser checks | Current-PC checkpoint unavailable |
| Voices | Current-PC draft-only dictation exists but absent from published source | Exact installed local voice URI profiles, no fallback | Mock voice/language/fence tests | Actual Arabic voices/dialect quality untested |
| Audio lifecycle | Published HQ microphone policy disabled | Explicit click/consent; strict installed on-device recognition, VAD/manual interruption, no recording | Mock permission/cleanup/late audio tests | Real device/packs/acoustic latency untested |
| Turn control | Published HQ has no active conversation runtime | Founder priority, one floor, direct address, Steve coordination, bounded context | Domain tests | Model generation unavailable; demo replies explicit synthetic |
| Research | Current task can inspect code; no qualified app research worker | Durable assignments/results/hands; disabled public-repository adapter source | Mocked read-tool and fixture execution checks | No live worker activation |
| Plan decisions | Existing whole-company plans concern staffing | Separate exact-version execution-plan approval, deferred/discarded/revised states | Domain + SQL semantic tests | New meeting migration source-only |
| End/disconnect | No active meeting lifecycle | Intentional end dispatches preapproved work once; disconnect holds by default | Dedup/end/disconnect tests | Hosted lifecycle untested |
| Durable work | HQ Supabase authoritative; prior separate runner retired | New Supabase semantic tables/RPC source, bounded leases/retries/reviews; SQLite only disposable fixture | PGlite and real child-process crash/restart tests | Hosted migration/service not activated |
| Review/report | Worker→head→Steve→founder policy | Ordered independent receipts and durable report; separate synthetic reviewer process | Author rejection, direct-report chain, tamper tests | No real staff review invocation claimed |
| PC independent hosting | Isolated Oracle Micro pilot, one CLI probe recorded | Browser-independent fixture worker/reviewer demonstrated in cloud environment | Browser disconnect/process restart, local memory/time observations | Oracle SSH/capacity/hosted entitlement not freshly accessible |
| Privacy | Brain fixed-root/read-only access | Raw audio never stored; transcript retained in disposable DB until removal, no secure-erasure claim | Cleanup and scope tests | Live provider selection/retention review outstanding |

## Selected architecture

Keep HQ in its Nuxt/shared UI/shared UX monorepo architecture. Live identity and operational persistence remain product-owned Supabase. Meeting records, execution plans and approvals are separate from staffing/company-plan approvals. New SQL accepts semantic commands; it never exposes a founder-controlled full-state replacement or permits attendees to grant tools/qualification. Live executor flags start disabled and the service-managed runtime registry starts empty. New live API adapters require current HQ founder authority and a separate disabled flag; they do not invoke a model.

The explicitly enabled local demonstration has a separate endpoint, opaque HttpOnly per-browser token, disposable SQLite file and deterministic replies. Worker and independent fixture reviewer run as separate bounded processes. File-change SSE provides invalidations without recurring data polling. A demo cannot activate the live database or a paid provider. It does not prove independent employees or genuine research.

## Provider and infrastructure feasibility

Current environment readiness reports no secret bindings, runtime variables or outbound identities. Official OpenAI documentation now describes API credits for eligible paid Pro/Business plans; this is a possible no-incremental-cost route, not a verified founder entitlement. Ownership/link/claim/balance/expiry/model/voice access and prevention of purchased-credit fallback remain unverified. No claim, key creation, paid fallback or API call occurred. A ChatGPT subscription or personal Codex CLI cache is not copied into the app.

The current maintained Oracle record describes a Toronto Always Free E2.1.Micro (1GB,46.6GB) with narrowed administration SSH only, no HQ daemon/HTTP service. One personal synthetic CLI probe returned ORACLE_CODEX_OK; strict acceptance remained false. This task has no configured Oracle identity/TCP grant and did not inspect or mutate the VM. Existing workloads/network are unchanged. Cloud fixture measurements do not qualify Oracle.

Browser audio is optional: only exact localService synthesis voices and installed on-device recognition packs are admitted by the app integration. No Egyptian Arabic, natural code-switching, voice quality or real acoustic latency claim is made. Text remains available when audio is unavailable.

## Remaining activation steps

1. Make source checkpoint4adde130 accessible, reconcile only the feature integration with it, preserve subsequent PC edits, then rerun affected focused checks.
2. Verify a supported application authentication route, exact model/voice access and existing zero-spend allowance with an enforceable no-paid fallback.
3. Review and explicitly authorize the exact staging/hosting activation only after source reconciliation and provider qualification. No production action is authorized by this report.
4. Apply the new migration only to an authorized verified environment, populate qualified runtime bindings through service-only control, provision server-side credentials, and run real cross-process PostgreSQL, worker-restart and browser-disconnect checks.
5. Qualify Arabic/English voices and microphone behavior through an explicit user microphone action. No physical PC-off test has occurred.
