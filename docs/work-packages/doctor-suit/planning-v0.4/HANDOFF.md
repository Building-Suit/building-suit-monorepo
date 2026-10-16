# Parent handoff — nine Doctor Suit milestone contracts

Prepared all nine milestones sequentially from the actual Library inputs. No duplicate task inventory, database writes, imports, runtime activation, app implementation, credentials, hosted product migrations, deployment or main promotion occurred. Cloud executor only; the user's network was not used.

Worktree: `/workspace/doctor-planning`. Branch: `codex/doctor-suit/milestone-contracts`. Draft PR: https://github.com/Building-Suit/building-suit-monorepo/pull/345. Stack: `doctor-suit`; root target `stg`, no same-stack parent. Inspected base: `1d0108f85fb8d468f8ad6380c9c6bf60a435ca4d`. M1 was reported and first published at `71b1e59f`; subsequent updates retain the same PR.

## Review inputs

- Each `DOS-Mn.json` contains full requirements, decisions, task packets, allowed paths, exact verification-command proposals, acceptance/scenario mappings, dependencies and evidence obligations.
- Each `DOS-Mn.import-proposal.json` references the canonical packet fingerprint and provides all task/requirement/decision/dependency links plus the atomic transaction contract. It deliberately has `safe_to_apply: false`; no SQL draft guard was removed.
- Each `DOS-Mn.md` renders the task contract for review. Each `DOS-Mn.validation.json` and `validation-summary.json` reports local checks; product verification remains `not-run`.
- `sources/manifest.json` records all five Library IDs, versions, byte counts and hashes. Original source bytes are preserved. The website ZIP's 12 checksum entries passed; duplicate standalone/archive sources matched.

## Remaining parent-owned import prerequisites

Action: reviewed transactional import of M1 through M9 to Automation project `padtxclxwwqvvuiebhte`, project `building-suit` / `f71b3b2b-d56b-4f7e-94f5-0b8c379a1088`. Status: held pending renewed permission and parent review; not attempted, not denied, no uncertain mutation outcome. The parent explicitly cancelled its live-schema fingerprint refresh; this executor has not retried it.

The parent reports that Doctor registrations/tasks/requirements are absent and the project lacks a Doctor app mapping. Supply the live schema/function/trigger/consumer contract and reviewed suit/workstream/app registration, exact model/retry routes, registered verification commands and publication scopes. The inspected creation function requires an active project/workstream; planned task status does not prevent consumers waking.

Use the supported `control.create_task_with_publication_contract` only through the parent's reviewed importer. In one transaction per milestone: create/verify the real OPEN start decision, create every task and all links, attach every task to that decision with `blocking=true`, refresh final contracts and assert zero ready tasks before commit. Any conflict with existing IDs or history aborts instead of overwriting. Dry-run rollback, commit and readback evidence are separate. Keep all nine start decisions open until every milestone is safely saved; implementation remains forbidden until the parent confirms that condition and releases the appropriate gate.

Model policy: the user requested high-capability planning; task proposals require the registered `deep` route. No concrete provider/model or retry ID is invented. Mobile platform commands and provider/clinical/legal/commercial decisions require actual evidence and scoped packet/registration refinement before dependent implementation. Native paths are reservations, not a chosen framework.

All original task IDs, the source dependencies and historical source documents are preserved. Legacy Clinic counts remain unreconciled because no corresponding implementation/maintained source was found; do not manufacture historical tasks or assume absence proves their historical nonexistence.

The user now authorizes eventual implementation of M1–M3 once the parent confirms all nine safely saved. That confirmation has not been received. [REVIEW-2.md](REVIEW-2.md) records the latest requested corrections; [registration-adapter.proposal.json](registration-adapter.proposal.json) provides the concrete, non-executing registration and canonical-metadata adapter proposal. No shared project scope or runtime/model registration has been changed.

## Actual verification

- All nine per-milestone artifact checks and the combined 104-task graph passed against the inspected repository resolver. Packet/source fingerprints, all original edges, 244 total dependency edges, requirement/decision links, open start gates, exact command references, output scopes and proposed database lifecycle passed. Producer tasks link their evidence decisions with `blocking=false`; dependent tasks link them with `blocking=true`, avoiding self-blocking evidence preparation.
- `node tooling/design-tokens/generate.mjs --check` passed.
- `node tooling/checks/workspace.mjs` passed: five discovered Suits, zero local visual components, 80 historical migrations unchanged and 86 complete route templates with zero migration debt.
- `git diff --check`, repository preflight and PR #345 stack/parent checks passed.
- Validation ran on the cloud executor's Node 24.19.0. Repository `.node-version` requests 26.8.1; no product build or runtime compatibility claim is made. The top-level pnpm 10.33.0 invocation was available through Corepack, but its nested `pnpm` resolved to the environment's 11.25.0 wrapper. The two exact underlying `pnpm check` scripts above were therefore run directly using isolated pinned TypeScript/Vue compiler dependencies; the repository lockfile and product packages were not changed.
- Product unit/data/browser/device tests, live database/import validation and independent legal/clinical/provider reviews were not run or claimed as passed.
