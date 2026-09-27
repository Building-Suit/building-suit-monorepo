# LS-EG-001 — Egypt tax-localization gap and decision record

Status: **RESEARCH COMPLETE / IMPLEMENTATION NOT AUTHORIZED**, 2026-09-27.

Subsequent decision: LS-D-ETA-SCOPE separately authorized only the bounded ETA domestic B2B eInvoice adapter implemented by LS-EG-002. See the [adapter contract and verification record](eta-b2b-einvoice-adapter.md). This historical gap record does not itself authorize that work, and every other gap below remains unchanged.

This record compares the bounded V2-IMP-013 VAT implementation with the stated target profile: Egyptian small and medium service or trading businesses. It is a product-scope record, not tax advice, an accountant approval, a filing specification, or evidence that any organization is compliant. No tax rule, rate, return, withholding behavior, government submission, or external integration is authorized by LS-EG-001.

## Preserved implemented boundary

The existing [V2-IMP-013 VAT module](tax-vat-accounting.md) remains the only implemented tax calculation and posting scope: an organization explicitly confirms an Egyptian VAT registration and EGP books, then records standard domestic taxable supplies under the effective-dated 14% rule. It preserves exact integer-minor-unit amounts, output and explicitly eligible input VAT, document and tax-point dates, immutable rule/account snapshots, full linked credits or reversals, one shared-posting-engine journal, protected VAT-control accounts, and source-document → VAT report → GL reconciliation.

The following V2-IMP-013 exclusions remain exclusions: registration decisions, table tax or special rates, exemptions, zero-rated exports, reverse charge/imported services, foreign currency, partial credits, mixed supplies, input apportionment, refunds, statutory return preparation or filing, e-invoice submission, and e-receipt submission. This task does not reopen or repeat that VAT engine.

The existing assets should be reused in any separately approved follow-up:

- VAT effective-dated configuration, immutable source snapshots, protected controls, shared journal posting, correction links, workspace report, and exact reconciliation.
- Existing customer/supplier counterparties and source-to-journal navigation; a new regime should add only the facts that its legal/accounting treatment genuinely requires.
- The Inventory ingress and report remain valuation/COGS evidence only. Its contract deliberately rejects undeclared tax instructions, so inventory tax must be an explicit source/document integration rather than an inferred amount or a second valuation calculation.
- Existing Trial Balance, General Ledger, financial statements, CSV, `.xlsx`, and print/PDF exports remain accounting reports. They may supply reconciled totals, but their layouts must not be relabelled as ETA returns or upload files.

## Official-source snapshot

Sources were rechecked on **2026-09-27**. Future implementation must repeat the check on its implementation date because ETA publishes amended laws, corrections, templates, and phased onboarding decisions.

| Official ETA source | Dated observation relevant to the gap | Product conclusion |
|---|---|---|
| [VAT legislation index](https://portal.eta.gov.eg/ar/content/qwanyn-aldrybt-ly-alqymt-almdaft) | Checked 2026-09-27. The index lists Law 149/2026, a correction concerning Laws 149–151/2026, Law 157/2025, Ministerial Decisions 417/2025 and 418/2025, Law 6/2025 support material, and the underlying law/regulations. | Never freeze this research snapshot into runtime rules. A follow-up must identify the consolidated provision and applicable effective date, including the published correction. |
| [VAT Law 67/2016, ETA English publication](https://www.eta.gov.eg/sites/default/files/2024-02/Law-english-no.67-2016.pdf.pdf) and [Executive Regulations](https://www.eta.gov.eg/sites/default/files/2024-02/VAT-Executive-Regulations-English.pdf) | The law distinguishes standard VAT, the attached goods-and-services table, exemptions, imports and other treatments; the regulations contain separate table-tax and invoice/adjustment rules. | Table tax, exemptions, zero rating, imports/reverse charge, deduction restrictions and adjustments are different regimes or treatments—not extra codes to add to the standard-domestic workflow without approval. |
| [Law 149/2026](https://portal.eta.gov.eg/sites/default/files/2026-08/law.no_.149.of_.2026.pdf) | Published 2026-07-28. It retains the 14% general rate while amending machinery/medical-device treatment, exemptions, credit-balance timing, and the attached table. | The implemented 14% boundary can remain preserved, but customers with affected goods/assets or credit balances require a current, separately reviewed treatment. |
| [Law 6/2025](https://portal.eta.gov.eg/sites/default/files/2025-02/law_no.6.of_.2025.pdf) | Published 2025-02-12. Eligible projects with annual turnover not exceeding EGP 20 million may request the simplified regime, subject to conditions/exclusions. Article 11 removes withholding/prepayment treatment for participating projects; Article 12 changes VAT reporting to every three months. | Simplified-regime participation is a customer fact, not a default inferred from size. It changes withholding and reporting decisions, so ordinary and simplified profiles cannot share an assumed calendar or applicability flag. |
| [ETA income-tax legislation index](https://portal.eta.gov.eg/ar/content/qwanyn-aldrybt-ly-aldkhl) | Checked 2026-09-27. It lists Law 151/2026 and its correction, Law 30/2023, Law 6/2025, Income Tax Law 91/2005, and their supporting instruments. | Withholding/collection applicability, payer/payee class, transaction category, rate, remittance and evidence must be verified against the then-current consolidated law before implementation. This record intentionally does not encode rates. |
| [ETA withholding/collection forms](https://portal.eta.gov.eg/ar/content/nmadhj-aqrarat-alkhsm-walthsyl) and [ETA notice on Form 41](https://portal.eta.gov.eg/ar/news/aqrar-drybt-almrtbat-alrb-snwy-wnmwdhj-41-khsm-wthsyl) | The official forms page currently publishes Form 41 and other distinct workbooks. The 2024-04-15 ETA notice describes Form 41 as a quarterly withholding/collection obligation for relevant private-sector payments. | A reconciled withholding register and an effective-dated Form 41 export are distinct deliverables. The generic GL/VAT report is not the statutory workbook. |
| [ETA VAT forms](https://portal.eta.gov.eg/en/content/value-added-tax-forms) | Checked 2026-09-27. ETA publishes separate purchase, sales, and new-commodity/goods spreadsheet templates. | A future return-preparation scope must version and validate ETA template mappings. Existing VAT register data can be reused, but an ordinary `.xlsx` export is not an ETA upload template. |
| [ETA current FAQ](https://portal.eta.gov.eg/ar/alasylt-alshayt) | Checked 2026-09-27. ETA distinguishes B2B e-invoices from B2C e-receipts and conditions e-receipt onboarding on an ETA decision; it also describes simplified-regime relief separately. | Organization onboarding evidence and channel matter. E-invoice/e-receipt generation or submission remains a separate external-integration decision under TAX-06. |

## Universal safeguards versus customer-specific scope

These are universal product safeguards for any later Egypt-tax work:

- Require an explicit organization tax profile with evidence date, effective date, regime, currency, account mappings, and the approving accountant/product decision. Do not infer a registration, simplified-regime election, withholding role, exemption, or ETA onboarding status.
- Snapshot the applied rule, classification, rate, accounts, source facts, and official-source version on every posted tax effect. Changes are prospective; posted journals and source evidence remain immutable.
- Use the shared posting engine once, separate control accounts/registers by tax obligation, and reconcile source documents/registers to GL before generating any return dataset.
- Preserve exact decimal strings/integer minor units. Never derive tax or withholding through JavaScript `Number` coercion.
- Treat a return workbook, portal upload, e-invoice, e-receipt, refund pack, and payment/remittance as separate outputs with separate authorization and execution evidence.
- Keep wording bounded to the exact verified jurisdiction, regime, dates, transactions, and outputs. A field, account, workbook, or successful calculation is not a compliance claim.

The following facts must be collected per customer before selecting any additional scope:

| Customer fact | Why it changes scope |
|---|---|
| Legal form, tax registrations, registration/effective dates, and current ETA notices | Determines which taxpayer obligations and electronic systems actually apply. |
| Annual turnover, application/acceptance under Law 6/2025, and exclusion conditions | Determines whether the ordinary or simplified reporting/withholding path is relevant. Turnover alone is insufficient. |
| Activities and exact goods/services, including professional/consultancy, construction, regulated or table-listed items | Determines standard VAT, table tax, special treatment, or sector-specific review. |
| Domestic/export/import transactions, imported services, currency, and place/customer status | Determines whether standard domestic VAT is the wrong treatment and whether zero rate, exemption, reverse charge or FX evidence is needed. |
| B2B/B2C channels, branches/devices, and e-invoice/e-receipt onboarding decisions | Determines document schema and integration channel; accounting journals alone cannot satisfy it. |
| Supplier/customer taxpayer identity and classification, payment category, certificates, and whether the organization is payer or payee | Determines withholding/collection applicability and whether the balance is payable, recoverable, or outside the regime. |
| Mixed supplies, restricted inputs, credit balances, refund intention, partial adjustments, and inventory/asset purchases | Determines apportionment, deduction, refund, adjustment, and source-link requirements. |

## Gap register and bounded follow-up decisions

| Candidate gap | Universal requirement? | Reuse versus genuine difference | Decision before any implementation |
|---|---|---|---|
| Table tax and activity/item-specific VAT treatment | No; depends on the supplied/imported item or service and effective law. | Reuse effective dates, exact money, immutable snapshots, posting, controls and reconciliation. Add a separately approved classification and accounting model only where table-tax incidence/deduction differs. | Named customer/activity dataset; current consolidated-law review including the 2026 correction; accountant examples and mappings; product-owner approval. |
| Zero-rated, exempt, imported/reverse-charge, mixed-supply and restricted-input VAT | No; transaction and organization specific. | Reuse source document identity, journal engine and VAT report traceability. Genuine differences include evidence, tax point, recoverability/apportionment, FX, counterparty/place facts and return boxes. | One separately scoped regime at a time with official-source verification, exact examples, correction/refund policy and accountant approval. |
| Withholding/collection when Ledger's organization pays a supplier | No; payer, payee, payment and simplified-regime facts control it. | Reuse supplier, bill/payment source links and shared posting. Genuine difference is a withholding-payable register, remittance status, certificate/reference evidence, adjustments and Form 41 reconciliation. | Confirm ordinary versus Law 6 profile; approve categories/rates/effective dates, gross/net settlement entries, remittance/correction behavior, Form 41 mapping and permissions. |
| Amounts withheld from Ledger's organization by customers | No; transaction and customer evidence specific. | Reuse customer invoice/receipt allocation and posting. Genuine difference is a recoverable withholding balance and certificate/credit reconciliation without reducing revenue or duplicating cash. | Approve evidence, allocation, recoverability, credit/refund/write-off policy and reconciliation examples. Do not net VAT or revenue merely because cash received is lower. |
| Nonresident-payment withholding and payroll withholding | No; separate taxpayer/payee/employment and treaty facts. | Only generic journal/report infrastructure is reusable. Treaties, residency, payroll calculations, declarations and remittance are different domains. | Separate research and approval tasks; explicitly excluded from a domestic supplier/customer withholding implementation. |
| Ordinary VAT return support | Only for organizations with the applicable filing obligation; frequency/profile varies. | Reuse the VAT source register and GL reconciliation. Genuine difference is an effective-dated return-box mapping plus official purchase/sales template validation and amendment workflow. | Accountant-approved mapping against current ETA templates; filing period/profile; locked reconciliation; correction workflow. Preparation does not authorize portal filing. |
| Simplified-regime records and quarterly VAT output | No; only after a valid Law 6/2025 participation decision. | Reuse VAT source data and accounting reports. Genuine differences are the simplified profile, calendar, prescribed records/forms and ordinary-regime transition. | Evidence of participation/effective date, Decision 420/2025 template review, accountant mapping, exit/transition policy and product approval. |
| E-invoice and e-receipt | The legal duty may apply, but the product integration is never implicit. | Reuse accepted document/journal IDs only after defining a safe boundary. Government schemas, signing, coding, UUID/status lifecycle, rejection/retry, cancellation and credentials are genuine external-integration work. | Separate TAX-06 integration approval, current ETA SDK/schema verification, credential/security design, sandbox execution, operational recovery and explicit deployment authorization. |
| Refund packages and government submission/payment | No; depends on balances and customer intent. | Reuse reconciled source/control totals. Supporting documents, portal workflow, attestation, payment and refund status are distinct. | Separate approval and genuine portal/environment evidence; never claim filing or refund from a prepared report. |

Recommended sequencing is deliberately conditional: first obtain the customer profile and accountant decision; then choose one regime/output. For an ordinary-regime customer with relevant supplier/customer withholding, the smallest coherent candidate is a withholding subledger plus source/payment integration and Form 41 preparation. For an approved Law 6 customer, begin with the simplified profile and prescribed records instead; do not build ordinary withholding behavior that Article 11 may make inapplicable.

## TAX-01–TAX-07 disposition for LS-EG-001

| Requirement | Research disposition |
|---|---|
| TAX-01 | Preserves the implemented Egypt/EGP/explicit-registration/standard-domestic-14% boundary and identifies the business facts that gate every additional regime. No broad Egypt scope is asserted. |
| TAX-02 | Identifies configuration, source facts, mappings, calculations/adjustments, registers and statutory-format differences that would require later approval; no behavior is specified as implemented. |
| TAX-03 | Requires reuse of the shared posting engine and existing source documents while identifying genuine payer/payee, table-tax, reverse-charge, apportionment and external-document differences. |
| TAX-04 | Requires each future register to reconcile source → tax/withholding register → designated GL controls before a return dataset; existing VAT and financial reports are reused, not relabelled. |
| TAX-05 | Records dated official sources and leaves every unresolved rate, applicability rule, mapping and policy pending current verification plus named accountant/product approval. |
| TAX-06 | Keeps ETA return uploads, filing/payment, e-invoice, e-receipt and refund submission as separate approval-required external integrations. |
| TAX-07 | Retains scoped wording: V2-IMP-013 is bounded VAT accounting with partial verification, not Egypt-tax compliance or completion. This research adds no compliance claim. |

## Verification and limitations

This was a documentation/research task. Source inspection confirms the existing VAT, inventory, journal and report contracts named above; it is not runtime, database, portal, or accountant evidence. Official spreadsheet landing pages were identified, but their current workbook schemas were not adopted or mapped in this task. No customer tax profile, ETA onboarding notice, accountant identity/approval, portal sandbox, or filing sample was supplied.

| Local command/check actually run | Result |
|---|---|
| `pnpm agent:preflight` | **Failed before reporting live state** (exit 1 wrapping preflight exit 255); fetch/GitHub state is unverified. The command also warned that `node_modules` is absent. No publication decision relies on this result. |
| `git merge-base --is-ancestor 2e3c26b… HEAD` plus scoped tree comparison | The literal ancestor check returned 1. The integrated commit `07dd278` has no `apps/ledger-suit` diff from reviewed tip `2e3c26b…`, and all later Ledger commits descend from `07dd278`; this is the task brief's locally verified equivalent integrated history. |
| `pnpm check` | **Passed**: canonical design-token outputs match, workspace boundaries pass, and 80 protected historical migrations are unchanged. |
| `git diff --check` | **Passed**. |
| Focused Node documentation check | Final run **passed**: every local Markdown link resolves, TAX-01–TAX-07 and the no-implementation/no-compliance boundaries are present, and every changed path is under `apps/ledger-suit/docs/`. The first run's boundary-string assertion failed only because the check expected lowercase `separate` while the document used `Separate`; the corrected assertion passed without a document change. |

No application test, SQL test, browser test, or build was run because this task changes documentation only and the dependency tree is absent. No application code, migration, hosted database, external provider, filing, payment, push, merge, deployment, or commit was created by LS-EG-001.
