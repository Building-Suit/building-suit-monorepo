# Founder-to-CEO work path — local verification

Follow-up on `codex/company-hq/living-office`, based on `88c1c25296d7dbfff3510ecb60433811e2a20366`. The existing runner/host-adapter history and both published parent branches are preserved. See [the implementation and runtime plan](CEO-WORK-PATH.md).

## Meaningful behavior verified

- A founder message becomes one explicitly linked proposal, never an automatically approved task. Original message identity/text is bound to later approvals and leases. Duplicate proposals, wrong sources, source changes and bridge bypasses fail closed.
- The private conversation reaches Steve's reply stage only. Noah, Iris and Maya receive the separately reviewed shared brief. HR projections do not expose the source snapshot. Linked message references survive the task display limit.
- The website requires normal plan approval and a separate exact 16-file Brain scope. Drive/Docs links normalize to file IDs. Linked work permits no public tools, Brain writes or daily schedule. Failed saves retain drafts and retry keys; authenticated readback resolves a committed authorization whose response was lost, without resending it.
- Disposal and authentication generation checks prevent a confirmation from a departed page/session from issuing a stale mutation or recreating private drafts.
- The real SQLite dispatcher performs one eligible task per call with the existing four-stage runner. Competing owners, expired leases, cancellation and shutdown remain bounded. Reply, original-message answered state, task completion and outbox receipt commit atomically; reopen/replay yields one correlated reply.
- Completed provider output without its matching checkpoint, ambiguous/dispatched operations and unfinished linked attempts stop before another reservation or inference. Guards repeat inside the writer transactions to close intervening-write races. Result matching includes identity, output, sources and review; no response text or refund is fabricated to resolve uncertainty.
- The test-only browser worker uses one disposable SQLite file and exact synthetic scope. The browser drives actual authenticated routes, task approval, Brain authorization, dispatcher, all four stages and durable inbox delivery. The saved reply explicitly says no live model/Drive request occurred, and live runtime remains unavailable.

## Final checks

Final results and exact commit are retained with the accompanying artifact manifest and command logs. The final repository suite includes all HQ tests; counts must not be added together as independent executions. The browser suite covers the original 12 living-office/security scenarios plus the full correlated work path, including an authorization committed before its response is deliberately lost.

| Check | Final result | Evidence |
| --- | --- | --- |
| Repository `pnpm test` | 2,878 total: **2,855 passed, 23 skipped, 0 failed** | `hq-ceo-root-tests-verified.log` |
| HQ production browser suite | **13 passed, 0 failed (45.3s)**, including committed-authorization/lost-response recovery | `hq-ceo-browser-verified.log` |
| HQ unit coverage in that run | **105 tests passed**; the preceding standalone HQ run passed 104 before the final readback regression | `hq-ceo-unit-final.log`, `hq-ceo-composable-verified.log`, final root log |
| HQ build/typecheck/app lint | Passed | `hq-ceo-build-verified.log`, `hq-ceo-types-verified.log`, `hq-ceo-lint-verified.log` |
| Documentation consumer build/typecheck | Passed | `hq-ceo-docs-build-verified.log`, `hq-ceo-docs-types-verified.log` |
| Shared UI lint | Passed | `hq-ceo-ui-lint-verified.log` |
| Workspace/token/strict atomic checks | Passed | `hq-ceo-check-verified.log`, `hq-ceo-strict-verified.log` |

The production HQ and documentation consumer were built and typechecked, the app/changed shared UI were linted, and workspace/token, strict atomic-template and release-provenance checks were run. An earlier complete browser run passed 13/13 before the additional lost-after-commit recovery assertion. That evidence remains preserved separately from the final rerun.

The recovery rerun initially encountered a test-only selector race during the closing conversation/opening proposal dialog transition. Twelve tests passed; the new test's generic dialog assertion was scoped to its intended proposal. Production behavior and guards were unchanged, and the failed trace is retained separately.

## Independent review

A separate reviewer inspected source privacy, approval/linkage, correlated outbox delivery, journal reconciliation, race guards, cancellation/close and client intent lifecycle, with no remaining blocking findings. Focused link/dispatcher/composable tests passed independently. Another UI review identified stale confirmation execution after disposal; the disposal/session-generation fix and regression tests resolved it. The final reviewer suggested committed-authorization/lost-response coverage; the readback helper and browser regression implement that recovery, and the helper was independently re-reviewed with 12/12 composable tests passing.

## Runtime and scope limits

No real provider, Brain credential, host, schedule or database integration was activated. The ordinary executor remains unconditionally closed, and the production bootstrap defaults remain disabled. The standard Responses protocol is preparation, not proof of included credits or model entitlement. Actual account eligibility, allowance isolation/reconciliation, data authorization and a verified persistent zero-cost host remain necessary before a live trial. No ChatGPT OAuth or Codex-token substitution was introduced.

Brain writing, a transactional remote runner and private hosted Supabase invalidation are not part of this smallest read-only Node/SQLite path. No Supabase project access was retried; no SQL, migration, grants, identities, credentials, billing, other product deployment wiring or personal network was changed. No publication, merge or deployment occurred. The failed Library transfer was not retried; local patches, logs and inspected screenshots remain the available evidence.

The browser outputs are explicitly synthetic. Passing them proves the connected local code path, not model reasoning, hosted availability, API funding, provider-side cancellation, real mobile hardware performance or scheduled delivery. The inherited Doctor Android API 29 failure in run `41721252657` remains separate; no claim is made that all hosted repository CI passed.

Final screenshot `ceo-synthetic-durable-reply.png` shows the actual persisted synthetic reply in the rendered CEO conversation; the worker inspected the pixels. It is local test evidence, not an operational model or hosted-delivery claim. The preceding 13-test pass, the transition-selector failure trace and the final passing rerun are preserved separately.
