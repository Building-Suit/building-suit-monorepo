# Ledger integration check recovery — 2026-10-29

## Observed CI failures and source repairs

At root head `4be53d400b4a789dec01e95b9aa364abeb6724da`, full verify/review/branch-policy pass. Actual decoded logs from website run 40883959527, job 123482573914, show four appointment-access failures waiting for the retired `.bs-appointment-event` disclosure. The current calendar instead emits appointment selection from an accessible button and opens a details dialog. Tests now follow that interaction, retaining issue/rotate/revoke, view-only denial, unusable-phone denial, exact scoped RPC arguments and absence of credentials in persisted state.

Marketing run 40883959594, job 123482574176, shows two missing footer settings interactions and one absent pricing analytics event. The public marketing layout omitted the optional privacy action and LandingPage omitted forwarding its pricing link event. Repairs reconnect the existing Shop-owned consent controller through optional shared UI props/events and reconnect the existing consent-gated analytics callback. The auth/nonpublic pages retain their root consent-reopen control because they have no marketing footer. Existing provider stubs, zero-pre-consent-network, URL/data exclusion, cookie/session preservation, withdrawal and deduplication assertions remain unchanged. Neither analytics configuration nor payment measurement is enabled.

The Shop owner's published head `54515e83853fe2cb047f2bcb8bdc693b4741f622` was inspected. Its recent b23e2016/ff00e807 shell-focus changes address a different shared-navigation defect; importing the electrical feature chain is unnecessary for these repairs. The scoped fix will be published in Ledger root #439 for the Shop owner to inspect/reuse. No duplicate unpublished Shop work is recreated.

## Hosted migration gate: precise missing access and evidence

Ledger staging project: `yqculoltqsyfastmihmu`. The connected Supabase identity's project read returned **You do not have permission to perform this action**. That action was denied; it has not been retried. The existing staging check 120018638314 on `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` reports **Remote migration versions not found in local migrations directory**, without version annotations. Candidate Supabase Preview is skipped because automatic preview branching is off. A skipped check does not prove recovery.

The exact historically applied migration `20261022182716` has been restored from authoritative #440 source, byte-for-byte, and native replay/preservation tests pass. This proves source restoration, not complete live-history equivalence.

To verify recovery, an authorized project administrator must either grant the connected identity project visibility and permission to read applied migration history, or provide an authorized export of applied migration versions and stored statement identities for comparison against repository source. Project metadata alone is insufficient. No write credentials, blind SQL, history deletion, migration repair command or direct hosted mutation is needed for this evidence-gathering step. Do not infer other missing IDs from the single known restored source.

Allowed deployment route remains the configured GitHub/Supabase integration: after source/history comparison, an authorized operator may resume or retry the existing deployment through that integration, or provision an approved preview through its normal project controls. Capture the exact candidate SHA, successful provider check and deployment result. Only then can verified staging support the protected stg-to-main release workflow. This document neither authorizes changing project settings nor substitutes local SQL success for provider success.

GitHub branch-protection required-check inspection also returned 403 Resource not accessible by integration. The workflow's verify/review/branch-policy jobs are observable, but no absence of additional protection requirements is claimed. All observed failing workflows are being repaired and must finish on the published candidate.

## Validation

Local repair qualification: all seven app builds pass, all four appointment-access cases pass, and all nine marketing/privacy cases pass. The original consent assertions were retained; no forwarding-fixture code was changed. Focused consent/signup unit tests pass, as do workspace/tokens and release-provenance checks. Focused lint has zero errors and seven attribute-order warnings. The initial typecheck invocation found a missing generated docs index; the documented generator has run and the bounded-concurrency rerun is pending. Full GitHub checks remain required on the final published SHA. No staging/main merge, review approval, hosted mutation or public Ledger promotion is included.


## Follow-on appointment action qualification

Exact-head website run 40899506532 advanced past credential-access checks and failed its two appointment-action cases at the retired disclosure selector. After replacing that selector, the local EN/AR flows exposed a real focus defect: the editor remembered a control in the closed details dialog. Shared dialogs now accept an optional surviving return-origin resolver; appointment editing captures its calendar button, while creation keeps its own opener. The ordinary dialog default, pending-save exclusion, dirty/discard protection, exact RPC assertions and destructive confirmation checks remain.

The two action/recovery browser cases, four credential-access cases and nine privacy cases pass locally. The focused controller suite passes four cases, including connected/disconnected explicit origins. Shop build/typecheck pass. Other consumers retain the default behavior and require fresh combined CI. The local privacy proxy also encountered explicit ECONNRESET/socket-hang-up failures on synthetic asset forwarding across reload/prefetch; it now closes each source HTTP connection rather than reusing pooled sockets. Request errors are neither retried nor suppressed; all nine original assertions and the fixture-drain test pass.

The old-head Doctor SQL job 123538248168 passed its reported SQL/race/recovery scenarios but failed pulling its pinned PostgreSQL Meta image before schema type generation. The registry diagnostic is not logged, so the reason is unclassified. A same-head rerun request was rejected because companion jobs were still running; it did not execute. This is distinct from the denied hosted Supabase project read. The new published head must qualify this job normally; no schema-generation gate is waived.

## Provider gate distinction

The feature check 123537640698 says the branch is not associated with a Supabase branch. PR CI therefore cannot evaluate hosted recovery with current provider routing. The failed check 120018638314 belongs to old staging source 2efbed85. GitHub CI does not deploy databases; the existing provider integration evaluates its configured deployment branch after source integration. Re-requesting an old-SHA check does not establish acceptance of new source.

A complete history export is an alternative diagnostic input, not an intrinsic GitHub merge-check prerequisite. The default agent workflow nevertheless prohibits the next root merge after a failed staging deployment. The historical root-AGENTS exception is explicitly limited to PR318. Parent must resolve that policy/authorization question for a source-recovery merge, retain Shop-first ordering, then verify actual provider outcomes on the resulting stg SHA before subsequent integration or production release. This thread does not independently apply an exception, retry denied access, change provider settings or perform a merge. If the permitted new-SHA integration check succeeds, no new Supabase read grant is necessary merely to prove recovery. Only if it still fails without identifying the missing history would an authorized export/read grant become the smallest missing diagnostic input.


## Reconciliation with accepted Shop staging

Parent confirmed Shop #441 merged into staging as `97c1f50e76506cb528fa3b9ea689ee820ae1b1d7` at 2026-10-29 15:27:42 UTC. This exact commit is merged history-preservingly into the existing Ledger root. Both ancestry chains and immutable source fragments are retained.

Where overlapping work provided alternative fixes, the accepted staging implementation wins: appointment details stay mounted under the editor, dialog closeBlocked/pending guards remain, and focus waits for finite parent entrance/vendor autofocus before returning. The alternative explicit-return-target API from unpublished local checkpoint 968bba97 is absent from the final tree; its commit/fragments remain historical and its semantic release probes are inactive. Stage's stronger nested-dialog, navigation, current dashboard and electrical-domain tests are retained. Current Shop query error projection and domain permissions are preserved rather than replacing them with older parallel adapters. Release inventory is an ID-preserving union; common rows are identical.

Ledger application/migration/logo bytes are unchanged by reconciliation. Shop's staged business SQL is unchanged. The intentional remaining Shop additions are optional footer/auth consent reopening, shared dependency compatibility, existing root diagnostic support and the synthetic proxy connection lifecycle. No Doctor clinical stack is imported. Fresh combined tests and provider outcomes on this reconciled head supersede both parents' results; the parent retains Shop-first serialized merge coordination.
