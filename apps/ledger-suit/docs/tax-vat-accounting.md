# Approved Egyptian VAT accounting (V2-IMP-013)

Status: implemented locally with partial verification on 2026-09-26. Not deployed, hosted-verified, filed with any authority, or accountant-UAT accepted.

## Approved boundary

V2-D11 and the task brief authorize only organizations that explicitly confirm an existing Egyptian VAT registration, EGP books, and standard domestic taxable supplies using an effective-dated 14% code. The module records output VAT and explicitly eligible input VAT, distinct document and tax-point dates, designated VAT-control accounts, exact document-minor-unit rounding, linked full credits/reversals, and source-document → VAT snapshot → journal → GL reconciliation.

It does not decide whether an organization must register. It excludes table tax, special/sector rates, exemptions, zero-rated exports, reverse charge/imported services, foreign currency, partial credits, mixed supplies, input apportionment, refunds, return preparation/filing, e-invoice submission and e-receipt submission. Product wording therefore describes bounded accounting, never statutory compliance.

## Regulatory evidence snapshot

Verified 2026-09-25 against official Egyptian Tax Authority material and rechecked during implementation on 2026-09-26:

- [VAT Law No. 67 of 2016, ETA English publication](https://www.eta.gov.eg/sites/default/files/2024-02/Law-english-no.67-2016.pdf.pdf): Article 3 establishes the standard 14% rate from FY 2017/18; Article 5 addresses taxable domestic sales/services; Article 22 supports deduction of tax on qualifying inputs/returns.
- [Law No. 149 of 2026, Official Gazette copy published by ETA](https://portal.eta.gov.eg/sites/default/files/2026-08/law.no_.149.of_.2026.pdf): the current amendment republishes Article 3 while retaining the 14% standard rate. Its special machinery/medical-device, exemption, credit-balance and table provisions are deliberately excluded.
- [VAT Executive Regulations, ETA English publication](https://www.eta.gov.eg/sites/default/files/2024-02/VAT-Executive-Regulations-English.pdf): invoice data includes issue date, taxable item/value, rate and tax amount; Articles addressing value changes and returns require dated, linked credit/debit-note evidence. This implementation preserves those accounting links but does not claim to produce a statutory invoice or note.
- [ETA tax-type catalogue](https://sdk.invoicing.eta.gov.eg/codes/tax-types/): VAT (`T1`) is distinct from table tax and other levies. Only VAT is in scope, and the catalogue is evidence only—not an external submission integration.
- [ETA VAT legislation index](https://portal.eta.gov.eg/ar/content/qwanyn-aldrybt-ly-alqymt-almdaft): authoritative index used to identify amendments through the verification date.

The rate lives in `vat_regulatory_rules` with effective and evidence dates. Posted documents copy their applied rate, rule, profile, accounts and exact amounts, so a future rule/profile is forward-effective and never recalculates history.

## Contract and invariants

- `organization_vat_profiles` is append-only and is the explicit registration/account-mapping assertion. Configuration requires EGP and previously unused designated accounts; later mappings are new effective-dated rows.
- `post_egypt_vat_document` serializes organization VAT writes, enforces capability, period, tenant and idempotency checks, rounds once using integer minor units, and calls the common posting engine once.
- Output invoices debit a posting asset for gross, credit revenue for base, and credit the configured output-VAT liability. Eligible input invoices debit expense/asset for base and input-VAT asset, then credit a posting liability for gross.
- VAT-control accounts reject generic journal entries. Report source totals and GL movement must therefore reconcile exactly; differences remain visible.
- Credits and reversals are exact, linked, append-only opposites. The original row, rate snapshot and journal remain immutable. Partial/special adjustments are outside this approval.
- RLS and server capabilities protect configuration, posting, adjustment, reversal and reading independently. Tenant switches clear the page composable state.

## Verification assets

- SQL: `45_approved_egypt_vat_test.sql` covers exact/large-value rounding, output/input posting, one-time journal effects, idempotency, protected controls, eligibility, effective dates, linked credit/reversal history, report=GL reconciliation, immutability, permissions and tenant isolation.
- Unit: `egypt-vat.test.mjs` covers exact calculation and reconciliation predicates.
- Browser: `egypt-vat.spec.ts` covers English/Arabic, LTR/RTL, mobile rendering, scope wording, tax/document dates and reconciled report presentation.

No pre-existing transaction or tax account is inferred or migrated. Recovery is a forward rule/profile correction and linked accounting adjustment; posted history must never be deleted or rewritten.

## Checks actually run (2026-09-26)

Passed: focused exact-money tests (3 assertions), complete Ledger unit suite (13 files), focused and complete Ledger ESLint, full Ledger typecheck, production build, workspace boundaries and canonical-token check, English/Arabic JSON parsing, and `git diff --check`.

Native SQL execution was attempted with telemetry disabled, but the disposable database was not running and `supabase start` could not access `/var/run/docker.sock`. The focused Playwright fixture was attempted after a successful production build, but this sandbox denied binding `127.0.0.1:3210` (`EPERM`). Consequently the migration/pgTAP assertions and real browser assertions remain independently runnable but unexecuted here. The environment also uses Node 20.11.1 while the repository requests Node 22+; all passing JavaScript checks carry that engine warning.
