# Retail MCP instructions: phase 2

Base: stg bba65d19f41ad780b8300c5818e9dcb0f9590195, merged SQL-first PR #569.
This is reconstructed source, not recovery of the lost executor files.

## Scope and identity

Production source is copied byte-for-byte from the committed inert fixture:
worker SHA-256 7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40;
unchanged module bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976.
V1 tests still generate genuine mock-CLI receipts from pinned bb6/e01 workers.
Current-source tests independently pin V2. No receipt hash is rewritten.

The worker describes only the validated original retail task-start assignment,
and requires exactly one exposed fixed discovery MCP invocation with empty
arguments. Missing tools/errors stop without alternative tools, new queries or
model fallback. The finite categories, one-request budget and module remain fixed.

Migration 20261111033000_hq_retail_assignment_context.sql changes one exact
predecessor body after existing current qualification and binding checks. Only
original AG-RES-002 task-start, attempt 0, nontrial work receives descriptive
publicDiscoveryAssignment with toolExecutionAllowed=false. Existing permits stay
in task-work. Repairs and trials get no assignment marker. Exact body/metadata
checks and a queue advisory fence fail closed; OIDs/ACLs/history are preserved.
Migration SHA-256: a7fce2cd130b44ec2c2ec85f8149666c177b4a745d41a57ece4aa60bea02b701.

## Prerequisite evidence

Before preparation, hosted migration 20261111020000, function metadata and ACL
preservation were verified. At 2026-11-11T03:17:32.766507Z the existing Oracle
worker authenticated hq_worker_release_status: unchanged exact V1 capabilities
and the exact V2 pair above. Filtered capability snapshot SHA-256:
abeb8f7f47704c54eb60ab66a4872286d9ada678b46c6cd95138088794d7cbc0.
Worker release was bba65d19 with matching manifest; no restart was performed.
HQ Vercel staging bba65d19 was READY and aliased. These are dated observations,
not proof of later adoption. The separate release-catalog job failed its existing
production baseline acknowledgment guard; that guard is not changed here.

## Current reconstructed local verification

- Full retail PGlite/actual mock-CLI flow: 2/2 passed, including initial assignment,
  ordinary work permit, text-only repair, post-migration trial, stale binding and
  suspended qualification denial, metadata drift and atomic history preservation.
- Discovery worker and strict migration-parity regressions: 132/132 passed.
- Exact V2/legacy qualification separation and source pin: 5/5 passed.
- Repository baseline, repository-worker, V2 and native-workflow source checks: 72/72 passed.
- Native PG17.11 entry reuses the same semantic checks in a fresh, fixed-localhost,
  internal-network-only container. It checks actual advisory blocking, 55P03
  timeout and observer-failure cleanup before applying the exact migration.
  Native execution is unrun locally because Docker is unavailable.
- Token outputs, workspace boundaries and strict template boundaries passed.
- Final scoped lint, complete repository aggregates and independent review remain pending.
  Earlier passing checks on the lost checkout do not verify this reconstructed head.

## Rollout hold and limits

Publication and merging are paused while the owner's new repository-private
request is evaluated. No phase-2 branch or PR has been published. Public GitHub
repository reads and worker release retrieval require separate compatibility
review before resuming; no credentials or broader grants are introduced here.

After the hold is cleared, use only the existing GitHub/stg integration. Recheck
fresh source/base/provider state, all required exact-head CI and five-minute merge
spacing. Observe hosted acknowledgment SQL application and worker publisher/adoption.
The V2 worker is safe with older acknowledgment SQL: it simply lacks the added
description. SQL-first V2 compatibility remains the hard startup prerequisite.

No real customer task, manual hosted SQL, qualification expansion, main/production
promotion, security bypass, credential change or destructive cleanup is included.
Source verification is not live inference, completed customer work or qualification.
