# BS-CHANGELOG-VERSION-001 — automatic publication

Status: implementation complete; draft review/required final-head CI and external activation pending.

Requirement BS-LAUNCH-R15; decisions BS-VERSION-D01 and BS-CHANGELOG-NEW-D01. Worktree `/workspace/release-versioning`, branch `codex/shared/task-release-publication`, draft PR318 into `stg`. Verified staging base/activation boundary: `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`. No same-stack parent existed. Shop ETA PR316 stays an independent root; parent owns integration and manual staging acceptance. SEO/analytics and partial returns remain separate.

## Delivered

- Agent-curated, reviewed EN/AR task fragments, internal disposition, impact classification, path/dependency coverage and duplicate/provenance checks in required `review`.
- Environment-specific SAS catalog with atomic per-Suit allocation, immutable request/manifest/digest, consumed-fragment/version keys, ordered cursor, replay/recovery and sanitized trusted-clock public RPC.
- Protected stg reconciliation and post-verify deployment gates; exact staged-content production import, multiple-release batches, explicit hotfix/rollback/ref refusal, no production allocator or second migration deployer.
- Optional shared “What’s new” section after Shop landing pricing, latest three deployed Shop releases, full public `/changelog`, EN/AR loading/empty/error/retry states and existing 48-hour New badge. Anonymous route registration, canonical shared template/exports/ownership/catalogue are included. No unrelated landing redesign.
- Agent guidance, workflow, specification and [release/activation runbook](../shared/release-publication-runbook.md) updated together.

## Verification

Saved cloud environment only, with pinned Node26.8.1 and pnpm10.33.0 for final checks:

- Full `pnpm test`: 1,468 passed, 23 environment-dependent skips, zero failures (1,491 tests).
- All six app typechecks passed with `pnpm typecheck --concurrency=1`.
- All six production builds passed with `pnpm build --concurrency=1` and synthetic loopback Supabase build inputs.
- `pnpm check`: five dynamically discovered Suits, strict zero local-component debt, 83 canonical full route templates; historical migrations unchanged.
- Full `pnpm lint` passed (three existing attribute-order warnings); changed release/UI/Shop source lint passed.
- `pnpm test:built-assets` passed.
- Six fragment/promotion/readiness tests, three actual server-read-adapter tests and seven existing changelog contract tests passed.
- `node tooling/releases/catalog-disposable.mjs` passed against this actual forward migration on isolated PostgreSQL17. Covers existing 2.7.4 baseline progression, concurrent identical retries, duplicate/digest conflicts, ordered cursor, wrong environment/ref, missing baseline/staging manifest, malformed translations, internal no-op, service/browser authorization, failed-write recovery, immutable first publication, private-data exclusion and exact batch promotion to a separate disposable database. No hosted input/connection is accepted.
- New Shop public-changelog browser executable: five passed across EN/AR, light/dark and mobile, including full-history navigation, internal/future/planned/other-Suit exclusion, exact 48-hour boundary, wall-clock independence, error/retry and empty feed. Existing changelog browser executable: all four passed (filters, keyboard, states, responsive and bilingual themes). Mobile screenshots inspected. Tests disable decorative motion when freezing Date.now; production motion was not changed.
- `agent:pr-check 318` passed after opening. Preflight refreshed actual stg and live PR state before publication.

Initial parallel local build/typecheck attempts exhausted memory; serial pinned-runtime reruns above passed. Initial missing docs generation/Chromium were resolved. A full local SAS image extraction exceeded workspace disk; its task-owned pull was stopped and temporary space released. Existing SAS disposable CI run38674671997 passed the complete migration chain, SQL regressions and actual Auth/private Realtime isolation. It stopped only at the expected generated schema diff. The exact CLI-generated delta was incorporated from its schema-step log after the artifact blob download was unavailable; no hand-written database types. Account provisioning CI run38674671935 and required review/branch-policy for checkpoint5b62af30 passed. Final-head required CI must be checked on PR318, not inferred from this earlier checkpoint.

## Activation boundary

Not activated; no hosted mutations, credential creation/configuration, privileged live grants, provider changes, purchases, main merge or production promotion. Existing GitHub secret/variable listings returned403, so server publishing credentials and environment variables are unverified. SAS staging reference is `lwecnmsosfwovlzxauml`; production remains intentionally blank/unverified in the maintained environment map. Vercel provider state includes build-rate-limit failures.

External setup is exactly the runbook prerequisites: existing provider/Git migration deployment, reviewed historical version baselines and matching anchor/cursor configuration, verified production ref, existing server-only SAS credentials, per-environment provider readiness contexts and product public-read configuration. Missing configuration/deployment success fails closed. No release numbers/types are requested from the owner. Real historical evidence must establish baselines; synthetic UI examples are not historical releases.

Parent: preserve the PR316 stack and obtain its curated ETA fragment before integration under the new rule; perform the separately authorized stg integration only after final checks and provider readiness, then manual EN/AR acceptance. This implementation does not authorize main/production promotion.
