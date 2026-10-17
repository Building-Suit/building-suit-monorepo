# Doctor Suit M1-only staging aggregate

The latest user instruction is **stack and integrate M1 before starting M2**. The existing [PR345](https://github.com/Building-Suit/building-suit-monorepo/pull/345) is prepared as the sole Doctor staging root; its original planning commit `4ca7110f4d6efa828e0b41213e5c059bf02ba9db` and all nine immutable plans remain intact. This preserves every M1 source commit and avoids introducing a second same-stack staging root. No merge action is performed by the implementing agent; the prior PR345 merge-tool denial remains in force for the parent to resolve against the fresh exact aggregate target/head.

- Target: `stg`, verified baseline `4441c7dd5a3b2d7ed53ae227229fc05ced64388a`.
- Aggregate root: `codex/doctor-suit/milestone-contracts`, PR345. Resolve the exact current aggregate head and check-run SHA from GitHub; no self-referential commit hash is embedded here.
- Included implementation: DOS-M1-001 through DOS-M1-020 and their focused PR history below; the final task also supplies aggregate evidence tooling and this packet.
- Excluded: PR366 `f2df37d031a8192da8b7a23afc83f0977debec6b`, its M2-001 review packet/fragment, and all M2 implementation. PR366 is preserved on hold. M2/M3 planning artifacts already present in pinned PR345 planning are preserved, not treated as implementation or approval.
- Lifecycle: M1 implementation and focused checks are distinct from independent automated C03/C04 evaluation, reviewed integration, deployment and clinical approval. This document grants none of those approvals.

## Included task/source history

| Task | Focused PR | Source head |
|---|---|---|
| DOS-M1-001 | [PR348](https://github.com/Building-Suit/building-suit-monorepo/pull/348) | `52c42b6ca1516bdf6dd6db45957c698924bb69b4` |
| DOS-M1-002 | [PR349](https://github.com/Building-Suit/building-suit-monorepo/pull/349) | `d81525ffcdc6ab316fd504e7c6541fe220885aa5` |
| DOS-M1-003 | [PR350](https://github.com/Building-Suit/building-suit-monorepo/pull/350) | `3a7958a187828a39951e5bb416fa7cd790a1aa2a` |
| DOS-M1-004 | [PR351](https://github.com/Building-Suit/building-suit-monorepo/pull/351) | `a0723e33d40b541ba0d8b7e6f54c999cd5763bcb` |
| DOS-M1-005 | [PR351](https://github.com/Building-Suit/building-suit-monorepo/pull/351) | `a0723e33d40b541ba0d8b7e6f54c999cd5763bcb` |
| DOS-M1-006 | [PR352](https://github.com/Building-Suit/building-suit-monorepo/pull/352) | `8fdc6bef7e774a6b66c1bd8074818c0ba4fd12a1` |
| DOS-M1-007 | [PR353](https://github.com/Building-Suit/building-suit-monorepo/pull/353) | `ed1bad51a220f7d75fdef0dabdc96ad5f887ddda` |
| DOS-M1-008 | [PR354](https://github.com/Building-Suit/building-suit-monorepo/pull/354) | `f4bbfb3ea5abd67099e155d344cd5051fac139b8` |
| DOS-M1-009 | [PR355](https://github.com/Building-Suit/building-suit-monorepo/pull/355) | `fa4732cfe8214ace8d55cfa689b1131a8b8958a5` |
| DOS-M1-010 | [PR355](https://github.com/Building-Suit/building-suit-monorepo/pull/355) | `fa4732cfe8214ace8d55cfa689b1131a8b8958a5` |
| DOS-M1-011 | [PR356](https://github.com/Building-Suit/building-suit-monorepo/pull/356) | `a43ae003af9b875c861369cee69ae5222bb65558` |
| DOS-M1-012 | [PR357](https://github.com/Building-Suit/building-suit-monorepo/pull/357) | `bbb32f7bf736be66ea28bd31c4084f0032e2a3e8` |
| DOS-M1-013 | [PR358](https://github.com/Building-Suit/building-suit-monorepo/pull/358) | `54f91a987a7ef9dba86290190b63e8775d315a5a` |
| DOS-M1-014 | [PR359](https://github.com/Building-Suit/building-suit-monorepo/pull/359) | `1ed57a4c9c842cd8459462bec8d4d77302919c88` |
| DOS-M1-015 | [PR360](https://github.com/Building-Suit/building-suit-monorepo/pull/360) | `125a5def646d97747f7540d2205da2d522438889` |
| DOS-M1-016 | [PR361](https://github.com/Building-Suit/building-suit-monorepo/pull/361) | `36797466dc3980d3d2e2c70b3e0c980318e7fc15` |
| DOS-M1-017 | [PR362](https://github.com/Building-Suit/building-suit-monorepo/pull/362) | `3da424cdd9fb7bca61dedf8593ae25386546a019` |
| DOS-M1-018 | [PR363](https://github.com/Building-Suit/building-suit-monorepo/pull/363) | `3ecccbf8172196a2518eaae93ce41d54b5f87117` |
| DOS-M1-019 | [PR364](https://github.com/Building-Suit/building-suit-monorepo/pull/364) | `e53cc7bcd8b0f07c2c2287de0867c942e480d85c` |
| DOS-M1-020 | [PR365](https://github.com/Building-Suit/building-suit-monorepo/pull/365) | `a4757572763bf243c8b3f064e9f7baa8a11b34d7` |

PR345's pinned planning source precedes these implementation commits. The aggregate must retain each listed source as an ancestor. The source for DOS-M1-020 also includes the later reviewed evidence/configuration commits on PR365; the current aggregate manifest records its frozen implementation source before aggregation. No history is rewritten and no M2 commit is merged into this root.

## Exact aggregate verification

The root CI actually executes all-seven typechecks/builds, lint, root units, boundary/tokens/release provenance, built assets, the permitted aggregate workspace browsers, shared Shop regressions and changelog browsers. The Doctor workflow actually executes SQL/RLS and concurrency, public/auth/stress/shared-consumer browsers and actual disposable GoTrue/Storage/Functions/Realtime. Both workflows bind the exact requested head for this M1 candidate.

The permitted aggregate configuration executes the maintained compatible cases without altering their assertions. The n8n-only Automation adapter suite remains **unrun** under the user's explicit no-n8n constraint. The separate Shop backend case remains **skipped** unless its explicitly initialized disposable monorepo backend exists; it is never counted as passed. The working-tree diagnostic executed111compatible cases and exposed this one skip. It is prior-source support; the exact aggregate must execute its own run and retain the actual JSON summary. Optional root infrastructure skips are likewise separate from executed M1 assertions.

`doctor-m1-evidence` independently reads official GitHub job/step results for the exact head, reconciles command argv/times/conclusions and immutable log links, checks the current staging base, hashes the evaluated input artifacts, verifies all20task source ancestors, and confirms unchanged planning and M2 exclusion. It evaluates C03/C04 and publishes `doctor-m1-exact-candidate-<SHA>` with a hashed sanitized receipt and workspace summary. Missing/failed/skipped/unavailable required evidence fails that evaluation. It never promotes a domain decision, merge, deployment or product activation. The parent can inspect this automated evidence without an additional human acknowledgement for routine tests.

The no-n8n scope is limited to this PR and the first stg commit introducing this aggregate marker. Ordinary workspace coverage is preserved outside that scope. The existing original root aggregate command is not relabeled as passed; held obligations remain visible in the evaluation artifact.

## Integration handoff

Before the parent resolves a merge action, verify fresh PR345 target/base/head, all required exact-head results including non-skipped aggregate `verify` and `doctor-m1-evidence`, the source-ancestor/exclusion checks, and any active denial/authorization state. Supply the exact candidate SHA, source/task list and immutable artifact/log references. Do not merge via another route to bypass the denied PR345 action. Preserve all unrelated stg work. No main promotion, manual deployment, hosted migration, credentials, provider connections, real patients, prescribing, commercial activation, Automation activation or n8n/home-service access is authorized here.


## Closing the actual Shop/Ledger backend coverage gap

The recorded earlier backend success in `atomic-template-unification-acceptance.md` is prior-source support, not proof for this aggregate. The new root `doctor-m1-shop-backend` job executes the existing `shop-backend.spec.ts` assertions on this exact candidate, with the maintained backend-only configuration and privacy-only trace/screenshot overrides. It must record **one actual pass and zero skips** before independent C03 evaluation can succeed.

The runner is restricted to explicitly authorized GitHub-hosted execution. It copies the complete Shop and Ledger migration chains byte-for-byte to new temporary project roots, assigns unique owned project IDs and loopback API/mail ports57321/58321, retains the current synthetic Shop seed, and disables the unnecessary Ledger development-identity seed. Original config, migrations, generated types and hosted databases are unchanged. Public keys are read from the owned CLI status in memory; no generated keys, OTP, Auth responses, browser trace or raw provider output is published. The real browser journey covers Shop signup/email OTP, product creation and persistence after reload, then confirms the same browser has no Ledger session or Ledger cookie. Local copied-project cron is unscheduled so no provider, reminder or delivery activation is performed. Only the owned projects and test output are removed.

The ordinary UI sweep still reports its backend case as skipped; it is not relabeled as a pass. Its distinct actual backend execution, exact-head receipt and migration digests are required in `doctor-m1-exact-candidate-<SHA>`. Until that cloud run succeeds, this consumer coverage remains a pending gap. Shop staging wildcard/runtime configuration and reminder activation continue to await their specific user inputs and are outside this local acceptance; they do not block executing the authorized M1 checks.

## Combined Shop launch regression

At aggregate `b2c7a3499a8af9bc47ff431364665947bb5a8bfb`, the root verification, all five Doctor jobs, actual Shop/Ledger backend case and independent C03/C04 evaluation passed. The separate [Shop launch job117353326461](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/39017785407/job/117353326461) failed four public-changelog cases and skipped its final launch qualification. That failure blocks integration regardless of the other results.

Each failing case reran the complete disposable release SQL suite inside a synchronous 45-second subprocess. The same suite completed locally in 34.6 seconds and in the separate root review in 35.5 seconds; the launch job retained its full Supabase stack throughout subsequent builds and synthetic browsers. All four subprocesses hit their 45-second deadline before a browser assertion. The unrelated landing plans request also inherited the 60321 build endpoint, whereas the maintained local Shop API uses 61321; refused plan requests did not cause the ten passing browser cases to fail.

The repair prepares both actual anonymous release RPC projections once in a dedicated bounded asynchronous global setup, waits for the complete SQL suite and container cleanup to succeed before exposing either feed, and shares those projections across EN/AR. All prior SQL and 14 browser assertions remain. Failed, timed-out, missing or malformed setup results fail closed; termination cleans only the uniquely owned catalog container. A narrow loopback fixture supplies the unrelated empty public-plan catalogue and rejects every other provider route. The launch workflow stops its owned full backend after completing the unchanged real SQL matrix, and cleans it after failure. Hosted configuration and product logic are unchanged. Fresh exact-head combined checks are required after this repair; prior `b2c7a349` successes are supporting history only.

The repaired working tree passed all 14 changelog cases in 49.0 seconds, with 35.3 seconds for one complete actual SQL replay and no refused requests/timeouts. A separate actual SIGTERM probe exited 143 and removed its uniquely owned disposable container. Five new focused harness/evidence regressions cover early/failed/timed-out feed setup, malformed projections, narrow transport scope, and failed/skipped/missing/wrong-source Shop launch evidence. The independent evaluator now requires the exact-head Shop launch workflow, its unchanged SQL matrix, all 14 changelog cases and all 12 final launch journeys in addition to the Doctor/root/backend checks. It cannot clear C03/C04 when those launch steps fail or skip.

At repair head `bd1355794b3eee143a5974a09f32044d57aa9268`, all runtime jobs passed, including the full Shop launch job (14 changelog plus 12 launch journeys, one complete SQL setup in 36.7 seconds, no refused requests/timeouts), all five Doctor jobs, the actual Shop/Ledger backend and the full root aggregate verification. The independent evaluation correctly failed closed before producing an acceptance receipt: its input-path allow-list had not been extended for the six newly bound Shop test/release-harness files. The follow-up adds only those six exact paths, retains traversal and unrelated-file rejection, and adds a regression requiring every current manifest input to satisfy that policy. Failure logging exposes fixed diagnostic categories only. Fresh exact-head checks and a successful independent receipt remain required; the failed evaluation is never relabeled as passed.
