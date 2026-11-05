# HQ conversational Chat — 5 November 2026

The founder requests a conventional Chat UI and a visible CEO → head → worker conversation process, with supervisor-led recovery, exact task links and real Brain learning summaries. This extends the existing private workforce workflow in the primary checkout. Preserve concurrent terrain/office work, original founder authority, actual role/tool limits, review evidence and the $0 additional-spend boundary.

## Presentation

The independent Chat sidebar opens without calling scene selection or changing the camera. Its state preserves an underlying office/Brain selection. Chat is removed from the CEO Office tabs and actions. Founder messages remain physically right, agent messages left, including Arabic. Steve uses the existing navy/Gold identity and user icon; other employees have named initial placeholders pending their future avatar work. Recognized roster mentions are blue; text remains escaped, with only a small inline bold/code vocabulary.

Task actions open the exact selected task in a separate sidebar. A published, source-linked lesson with a timestamp and actual receipt produces a Brain indicator after its related message. Its sidebar shows the saved summary, provenance and receipt. Proposed, rejected and accepted-but-unpublished lessons never assert a Brain write. Desktop can keep Chat beside the detail; narrow layouts hide/inert Chat until detail close. Escape and focus return preserve the composer draft.

## Real conversation stages

Forward migration `20261105180148_hq_conversational_chat.sql` adds structured message kinds, task/job references and named mention identities, preserving previous message/artifact history. New founder messages enqueue Steve first. His actual intake either answers ordinary conversation or creates one bounded, source-linked drafting/research/analysis task with a reviewed handoff. The real recipient acknowledges understanding and a plan, optionally passing that one task to an eligible direct report. The actual author returns the accepted result with the real task link after supervisor/Steve review.

Rejected work retains immutable evidence. The supervisor posts its actual repair findings and the author acknowledges the remedy before resuming. Existing maximum repair rounds, task budgets, cancellation, fenced leases and independent artifact-digest review remain. Successful delivery is the required target; neither a message nor a UI style manufactures completion. Missing external execution tools, access or capacity remain actual prerequisites. This change supplies no unrestricted code execution, account access, external messaging, publication or unbounded retries.

The snapshot includes bounded exact task details referenced by its returned conversation. Normal private event invalidations update the existing session-scoped client; no polling or new provider is added. Historical queued conversation stages remain compatible.

## Brain receipt

The process decision was saved through the authenticated Drive connector, preserving file IDs, parents, sharing and existing contents. Fresh prewrite reads and complete postwrite comparisons confirmed the changes (apart from a final newline):

- `Company/Current Working Agreement.md`, section “CEO-first Chat and supervisor recovery — 5 November 2026”, decision saved `2026-11-05T17:45:39.496Z`; the founder’s specific staging approval was appended and read back at `2026-11-05T18:27:11.351Z`.
- `Company/Workforce Operating Rules.md`, section “CEO-first shared conversation and recovery”, version 1.2.0, modified `2026-11-05T17:46:08.510Z`.
- `Sources/Conversation Learning.md`, entry `FOUNDER-2026-11-05-HQ-CHAT-PROCESS`, decision saved `2026-11-05T17:46:26.884Z`; verified local outcomes appended and read back at `2026-11-05T17:58:55.432Z`.

These are verified saved founder instructions, separate from runtime deployment and model qualification. The instruction calls for persistence through supervisor-led fixes; it does not authorize fabricated success or conceal actual prerequisites.

## Verification and rollout

Focused verification passed under the existing workforce-workflow test authorization:

- `node --test tooling/hq-agent-host/workforce-db.test.mjs tooling/hq-agent-host/worker.test.mjs`: 21/21 pass, repeated after the provider-version filename alignment.
- Three new Chat browser tests pass against the current development server, covering camera/selection preservation, physical message sides, safe mentions/escaped HTML, exact task/learning details, published-only indicators, draft retention, Escape/focus return and Arabic mobile layout.
- Six workforce browser scenarios pass. The existing office assertion was updated from its retired capacity region/status to the current complementary inspector, measured-metrics region and actual Offline label. Initial compile errors from an inline keydown handler were repaired; initial failures are not reported as passes.
- HQ and documentation-app typechecks and targeted product/shared/catalogue ESLint pass. The first root-level product lint invocation ignored app files; the scoped app invocation was then run and passed.
- Actual desktop English and 390×844 Arabic screenshots were inspected. The fixture disables WebGL and supplies synthetic private API/SSE snapshots; it verifies conversation presentation, not live inference or 3D performance.
- The browser check exposed a pre-existing scoped RTL selector that rotated the whole document. The corrected selector rotates only the office agent chevron.

Repository-wide build/release/boundary suites are unrun. No Git commit/push/merge or production operation is authorized or performed. The founder subsequently explicitly approved the staging migration, existing worker and web-app rollout; the observed receipts below supersede the earlier source-only state.

Administrative preflight succeeded at `2026-11-05T17:44:43.366Z`, with `errors: []`; primary branch `codex/company-hq/office-design`, HEAD `e1608fb9f733d67b977fe9911de6192225b2b9e0`, origin/stg `14039a60d9c7e59b1052cca3ee5b97015339c6a1`. Live PR528 remains open into stg at remote `a2f8e25f90eb8d12d4a750056d25a4e4b81263f4`, local ahead two. Unrelated dirty source belongs to its existing tasks and is preserved.

Private provenance: `release-fragments/hq-conversational-chat-20261105.json`.

## Authorized staging rollout receipts

The immutable target is HQ staging `dpruoncalmwicrqhqelu`, organization `pmrcnkldnnemyfbryybn`; live inspection reported ACTIVE_HEALTHY. Applied history ended at `20261105171608` before this change. New migration source was created with the maintained CLI selector and then aligned to the provider-recorded version **20261105180148_hq_conversational_chat.sql**, applied with `success:true`. No historical migration was edited. Post-apply reads confirm the four new message columns, messages RLS enabled and no anonymous/authenticated execution grant on the private chat helper. Public database types were regenerated from the actual staging schema. Security advisors have the same pre-existing findings: deny-by-default RLS/no-policy information and the existing leaked-password-protection warning; this task did not broaden policies or alter Auth configuration.

The Oracle worker was safely stopped with no active child/inference, no queued/working database job and 36 delivered journal records. Three checksum-verified modules replaced the existing service files; prior modules were retained privately. The environment and credentials were byte-preserved and the journal retained. Restart at **18:02:39 UTC** returned active/running, zero automatic restarts and a real `queue-connected` event. Worker SHA256 is `522e03a84a5bc5f77f19dc57c8f0a078c910fe7062ef65a328f86b661882ca8e`. No inference probe was submitted.

The web target is the existing `company-hq-stg` project `prj_d6vsDeXGvUSwewrzUXmRQdWcYA3z`, with staging URL/environment binding checked and production target used only for its staging alias. A bounded credential-free current-source artifact excludes env files, secrets, generated outputs and worktrees. Archive-format deployment `dpl_3KmKtcBHaCBgsvXCYst7tWesa9xZ` failed because the provider install could not see the monorepo root lockfile. It did not replace the alias. The same source was deployed through the previously successful normal file-upload path as **dpl_BzpJo8hRZ7TQaJ1aXQs7ddVaBXsk**, which reached **READY at18:28:59.735UTC**. The exact staging alias is assigned, with no alias error. Public staging HTML returns200, contains Chat and no Talk to CEO button, and serves the new bubble/mention/independent-sidebar CSS; client CSS and JS also return200. Provider logs confirm the root lockfile, install4.5s, Nuxtbuild28.9s and providerbuild38s. Before compilation, provider source retrieval took14m41s; it recovered without another redeploy. An isolated prebuilt contingency was prepared successfully but remained unpublished. No second service/project, new credentials, paid capacity or production HQ deployment is introduced.

Rollout administrative preflight succeeded at `2026-11-05T18:03:33.621Z`, same local/upstream/staging identities and `errors: []`. Provider reads encountered a local resolver conflict; command-scoped DNS lookups were used for status inspection without changing system network settings.

No live-model task or chat probe was submitted during rollout. Existing browser automation could not bind the authenticated Chrome tab because of host request-policy/network errors; the live checks above are deployment/public-asset checks, separate from the nine fixture browser flows. Production HQ, main/stg Git history, provider permissions and paid capacity remain unchanged.
