# Posted journal sequences (LS-FIX-001)

Status: implemented locally; native database execution remains required before deployment.

V2-D03 is enforced once at the shared `transactions` transition into `posted`:

- The sequence scope is one organization and one configured fiscal year.
- A new successful post receives `JRN-{FY}-{000001}`. `{FY}` is the four-digit calendar year in which that fiscal year ends. For example, an April 2025–March 2026 fiscal year is labeled `2026`.
- The counter is six digits and supports `000001` through `999999`. The next post fails with `JOURNAL_SEQUENCE_EXHAUSTED` instead of widening, wrapping, or reusing a number.
- Draft, pending, failed, and unposted void transactions have no `journal_reference`.
- Equal idempotent retries return the original transaction and reference. Separate posts serialize on the private organization/fiscal-year counter, so they cannot share a number.
- Gaps are permitted. A committed number is never decremented or assigned again.
- Reversals receive their own scoped identity and retain the UUID relationship to the original journal.
- References already stored on posted/reversed transactions before the migration are preserved exactly. They are not parsed, resequenced, or replaced; transaction UUIDs, entries, amounts, and links are not rewritten.

The sequence table and allocator are private to the `app` schema. The public Journal Center continues to read the existing `journal_reference` contract, so sequential and legacy references remain searchable and visible together.

## Verification

Focused database suites:

- `34_journal_center_test.sql`: professional format, sequence start, retry, search, and reversal identity.
- `36_accounting_period_concurrency_test.sql`: post/close serialization, including no number when close wins.
- `47_posted_journal_sequences_test.sql`: assignment timing, retry, tenant/year boundaries, void/failed posting, overflow, immutability, reversal links, and legacy readability.
- `48_posted_journal_sequence_concurrency_test.sql`: independent-session allocation and retry behavior.
- `scripts/verify-v2-reconciliation.sql`: the prepared V2-015 numbering-format probe.

Before an authorized deployment, run the maintained pre/post migration snapshot against an owned disposable database and require unchanged posted-history counts, entry digests, balances, and report outputs. This task does not authorize a hosted migration.
