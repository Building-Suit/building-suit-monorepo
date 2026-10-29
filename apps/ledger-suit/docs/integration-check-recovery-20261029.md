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
