# Release reconciliation — protected-branch adoption

Status: code repair under verification; live configuration/authorization remains blocked.

PR318 merged into staging as `ecd74b1f5e3f6758bb618e67ca930b5f5f3eadd4`. Run 38727331823 failed staging at `Verified catalog environment binding required` and production at the absent `tooling/releases/publisher.mjs` on main. The staging failure is the expected fail-closed configuration boundary; the production invocation is repaired by the branch-adoption workflow guard.

The guard inspects only the checked-out protected branch’s tracked history. Never-adopted branches skip Node setup and publication with an explicit notice; an untracked/stale publisher cannot activate them. Adopted branches execute the unchanged publisher and its existing readiness checks. Removing an adopted publisher fails instead of silently skipping. Tests execute the actual workflow guard against disposable Git histories and verify that empty/missing binding or credentials still fail for adopted branches.

The immutable release policy anchor remains `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`, verified as the first parent of the adoption merge. No manifests, consumed fragments, version heads, history, source fragments, migration files or publication clocks are changed or reset. A new internal fragment describes this CI-only repair.

Owner-provided configuration evidence: GitHub staging and production environments currently have no variables or secrets; environment branch-restriction approval is pending. Production’s SAS ref remains blank/unverified in the repository. Existing server-auth material, approved environment branch admission, verified refs/bindings, catalog migration/configuration, evidence-based baselines and exact readiness contexts are activation prerequisites described in the release runbook. No settings, credentials, hosted database state or provider deployment were changed. Main is untouched and no production promotion is performed.

## Authorized receipt/reconciliation staging batch

The owner authorized PR322 as the single combined candidate targeting `stg`, incorporating receipt PR321 at `72626f3fb8e7ccc3ed3cf1753868c1a8d6f04cbc` and the independently reviewed reconciliation repair at `42513b56f29d6852c9e0c121c9766a6de7f66955`. The source heads and their release fragments are preserved through a history-preserving merge; PR321's branch is unchanged. This specific authorization supersedes separate-stack integration for this batch only. No source history is rewritten and no gates are weakened.

Full aggregate CI must validate the combined exact head. The parent performs the one final history-preserving merge into staging after reviewing that evidence; this work does not merge staging, promote main, manually deploy, mutate hosted databases or configure security/secrets. User manual testing follows staging. Receipt behavior and automated baselines are verified by the maintained tests; exact pixel-perfect fidelity to the reference images is not certified and is not an added manual pre-merge gate. Runtime release activation remains blocked by the separately documented configuration prerequisites.
