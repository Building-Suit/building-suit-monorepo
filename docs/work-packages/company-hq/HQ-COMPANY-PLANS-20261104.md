# HQ founder login and reviewed company plans — 4 November 2026

> Historical founder-plan foundation checkpoint. Its legacy-HR-only and timed-refresh limits are superseded by [Brain sync](HQ-BRAIN-SYNC-20261105.md) and [live events](HQ-LIVE-EVENTS-20261105.md); the whole-plan founder authority remains.

Status: source implementation with successful staging schema setup on `dpruoncalmwicrqhqelu`, provider migration metadata `20261104194233`; application acceptance unrun. Work stays in the primary checkout. No public product activation or release is created.

## Founder direction

The founder selected the hybrid Company Brain/Supabase direction, then clarified that HQ must review **one complete company plan** recommended by HR and reviewed by the CEO. A plan may contain departments, hiring requests and skill requests. Founder approval happens **inside HQ after adding founder login**, not through a Markdown approval file or a standalone department-only approval screen.

Google Drive Markdown remains the knowledge/policy/profile Brain; Supabase owns trusted operational plan/decision/department records. Reading knowledge does not create departments or run employees. Earlier unfinished offices were reverted before the Brain connection phase. This later scope expressly authorizes empty offices supplied by approved plans.

## Implemented source

The sole route remains a typed `BsHqLayoutPage` adapter. `useHqFounderAccess` owns access commands; `useHqCompanyPlans` owns operational snapshots/decisions; `useCompanyBrain` preserves cloud knowledge reads. Shared UI owns login, plan review/confirmation, office layout/construction, overview and scene. Shared UX owns gestures and overlay coordination. No product/server query enters UI.

The existing CEO role has a reserved workspace with desk/board, opening company plans. It consumes one layout slot without adding a department or employee. Approved departments supply empty offices and roads around the orb. Footprints/spacing determine ring capacity; full rings extend outward with longer roads through gaps. The finite floor and overview grow with that layout. New offices use a 2.4-second road/foundation/wall effect; reduced motion snaps to complete. No characters, employee-desk assignment or workforce execution is added.

Approval records the exact plan revision, authenticated founder/session, request key and decision atomically with all its new departments. The client applies the complete confirmed snapshot before new offices appear. Hiring/skill entries remain documentary approved requests for separate execution. Ready proposals cannot create offices. The client polls while visible/online after completed requests, normally every 15 seconds, with 30/60/120-second failure backoff. Authority/network loss and disposal clear stale projections; epochs/aborts suppress stale responses. Unknown decision outcomes retain a request key for retry within the current component/owner scope. No webhook, instant shared-agent sync or background worker is installed.

## Founder identity

The founder explicitly chose `ceo@building-suit.com`. Registration lets the user enter the password, confirm the email and then log in. No signup, mail or login is performed by this implementation record. Only that configured email may use registration. Current provider email confirmation must be enabled; auto-confirm is not used. A PKCE signup challenge avoids implicit-flow token fragments; confirmation does not automatically log in to HQ.

Server-only configuration is `NUXT_HQ_SUPABASE_URL`, `NUXT_HQ_SUPABASE_PUBLISHABLE_KEY`, `NUXT_HQ_ENVIRONMENT` and `NUXT_HQ_FOUNDER_EMAIL`. Immutable pairs are staging `dpruoncalmwicrqhqelu` and production `nkpvskyugnnnozepbwzb`. Only a publishable/project-matching legacy anon key is accepted. No service-role credential enters the browser or founder APIs. Access/refresh tokens use HQ/environment/project-prefixed HttpOnly SameSite Strict cookies; refresh and local-session logout run on the server.

`/api/hq/access`, `/login`, `/register`, `/logout`, `/company` and `/plans/:id/decision` retain actual loopback/Host/same-origin/custom-header and no-store gates; POST requires actual same-origin Origin. The outer development listener attests checked TCP loopback before Nitro Unix-socket forwarding. Privileged requests verify the fresh Auth user and `hq_founder_access`, which checks a live Auth session plus trusted invitation/membership. The verified Auth UID binds once; deletion/email reuse must not rebind it. Metadata, client flags and email alone grant no authority. Founder login protects operational plan data/decisions, not general public hosting of the private Brain preview.

Inputs, provider responses, timeouts and per-process auth attempts are bounded. Snapshot validation fails closed without dropping approved records. Decision input requires bounded JSON, a UUID plan, exact positive revision, decision and UUID request key. Errors expose no raw SQL or credentials. These are source properties; executed security acceptance remains unrun.

## Schema and historical evidence

New standalone source: `apps/company-hq/supabase/migrations/20261104194233_hq_founder_company_plans.sql`. It defines founder invitations/membership, immutable revisions/decisions, reviewed company plans and departments with guarded RPC access. Founder-facing foundations are `hq_founder_access`, `hq_company_snapshot` and `hq_decide_company_plan`.

The **HQ import seeds only HR & Agent Development**; this is not the current company department count. Its initial approval is historical Brain evidence dated `2026-11-03`. The seed retains date-only precision, null original HR/CEO reviews and no fabricated original Auth approver. It imports an existing department, not a new staffing decision. Steve's reserved workspace represents the existing executive role. This task imports no other department. Fresh parent-task Brain context identified a newer approved company organization/acquisition packet; the HQ projection does not automatically synchronize that packet, because the live publisher remains disconnected. Do not infer the company-wide roster or department count from this legacy seed.

`hq_publish_company_plan` is restricted to service publication with HR/CEO review references for new plans. It is a foundation only: no live CEO/HR execution bridge, autonomous publisher, service credential, scheduler or model runtime is connected. A note mentioning a department cannot publish a new nonlegacy plan. Connecting actual CEO/HR execution remains separately scoped; do not claim that worker is installed.

Historical migration `20261103194908_hq_dedicated_workspace.sql` remains retained/unapplied. The standalone migration does not depend on or restore the retired `hq_workspace` runtime. Necessary staging-only setup is founder-authorized; production, merges, deployments, paid resources and broad provider changes are outside scope. The parent applied the standalone migration to staging with `success:true`; provider migration metadata contains only version `20261104194233` for this new setup. The first attempt failed on a CASE expression inside IF and rolled back; the parenthesized source was applied successfully. The ignored app environment received the staging URL/publishable key/environment/founder values while preserving Google configuration, and the Nuxt watcher was touched for reload. No signup, email, login, application/API/browser verification or production change was performed. Schema application cannot prove login, plan decisions or UI behavior.

The founder reports GitHub is not connected. Integration and Automatic branching dashboard state were not inspected; OFF remains policy only. Review both migration histories before enabling integration. Target policy remains working directory `apps/company-hq`, relative `./supabase`, `stg`/staging, `main`/production and Automatic branching OFF. Preserve dedicated HQ refs and product boundaries.

## Knowledge and acceptance

The orb keeps the private read-only Google Drive Brain under root `1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8`. No filesystem/Insync fallback, connector credential extraction or app Brain-write path is introduced. Earlier founder-requested diagnosis read a complete 330-note directory and one HOME note; that evidence predates this Auth/plan implementation.

The founder prohibits autonomous tests, builds, lint, typechecks, boundary/release checks, browser/API/runtime verification and tester/reviewer agents. All are unrun for this task. No rendered construction, gesture, Auth/registration, authorization, approval/idempotency, freshness, performance or consumer acceptance is claimed. Source/schema/provider observations remain separate from application acceptance.

See [HQ README](../../../apps/company-hq/README.md), [handoff](CLOUD-HANDOFF.md), [prior shield scope](HQ-SHIELD-ORB-20261104.md) and [cloud source record](HQ-CLOUD-BRAIN-20261104.md). Preserve earlier local-reader, office/backend, migration and screenshot history; it is not acceptance of this implementation.
