1. **Scope and assessment requirements**
   - **SCOPE-01:** Target the Ledger Suit application inside `Building-Suit/building-suit-monorepo`.
   - **SCOPE-02:** Assess the current source code, database schema, migrations, accounting functions, interfaces, and tests before determining what must be implemented.
   - **SCOPE-03:** Classify each requirement as **implemented, partially implemented, missing, or unverified**, with supporting repository evidence. Do not assume the screenshots’ historical status labels describe the current implementation.
   - **SCOPE-04:** Limit the functional scope to accounting: account management, journals, opening balances, financial reports, receivables, payables, periods, banking, fixed assets, accounting dimensions, tax/VAT, and inventory accounting.
   - **SCOPE-05:** Include invoices and supplier bills where needed for receivables and payables. Do not expand these into full sales-order, procurement, CRM, HR, payroll, POS, warehouse-management, or manufacturing systems.
   - **SCOPE-06:** Preserve existing functionality and financial history. Extend or complete existing implementations rather than automatically replacing them.
   - **SCOPE-07:** Where the screenshots do not specify an accounting policy or detailed behavior, identify an explicit decision requiring accountant/product-owner approval rather than silently inventing one.
2. **Accounting foundation and preservation requirements**
   - **CORE-01:** Preserve a shared double-entry posting engine through which all accounting modules produce their financial effects.
   - **CORE-02:** Derive authoritative account balances and financial statements from posted journal entries, including applicable reversal and adjustment entries.
   - **CORE-03:** Enforce debit/credit balance and accounting validation in the backend, not exclusively in the interface.
   - **CORE-04:** Preserve the distinction between editable drafts and posted financial records. Corrections to posted records must remain traceable through controlled reversals or adjustments.
   - **CORE-05:** Apply account eligibility, organization isolation, permissions, and accounting-period restrictions consistently across every posting source.
   - **CORE-06:** Prevent duplicate financial posting caused by repeated submissions, retries, imports, or automated processing.
   - **CORE-07:** Preserve existing currency support, audit history, attachments, recurring transactions, imports, exports, and reporting behavior unless an explicitly approved change supersedes it.
   - **CORE-08:** Reconcile financial balances before and after any migration affecting existing accounting data.
3. **Chart of Accounts V2 — P0**
   - **COA-01:** Provide a complete, manageable, hierarchical account tree with explicit parent–child relationships.
   - **COA-02:** Support **Group, Control, and Posting** account node types, with clearly defined posting restrictions for each.
   - **COA-03:** Prevent direct posting to Group accounts and calculate their displayed totals from the appropriate underlying accounts without double counting.
   - **COA-04:** Associate Control accounts with their corresponding subledgers and define controlled rules for any exceptional adjustments.
   - **COA-05:** Support Contra accounts, including their effective debit/credit nature and correct treatment in account balances and financial statements.
   - **COA-06:** Expose account type, financial classification, normal balance, parent, node type, and Contra status in account-management interfaces.
   - **COA-07:** Support current/non-current classifications for applicable assets and liabilities, together with the classifications required by the financial statements.
   - **COA-08:** Provide account creation, editing, and archival rules that preserve existing journal history and prevent invalid hierarchy changes.
   - **COA-09:** Verify that hierarchical totals, Control balances, and Contra presentation agree with the underlying ledger.
4. **Opening balances and accounting migration — P0**
   - **OPEN-01:** Provide an explicit opening-balance workflow rather than requiring users to construct the process manually.
   - **OPEN-02:** Support bulk import of an opening Trial Balance, including source-account mapping to Ledger Suit accounts.
   - **OPEN-03:** Capture the opening date or cut-off date and explicit debit/credit amounts.
   - **OPEN-04:** Validate account references, account eligibility, required values, and debit/credit balance before posting.
   - **OPEN-05:** Present an import-validation result and opening-journal preview, including errors requiring correction.
   - **OPEN-06:** Record accepted opening balances through the shared ledger and make them traceable in the General Ledger, Trial Balance, and financial statements.
   - **OPEN-07:** Provide a controlled cut-off/migration workflow that prevents accidental duplicate opening imports.
   - **OPEN-08:** Define approval, locking, and subsequent correction rules for accepted opening balances. Resolve year-start versus midyear migration treatment explicitly where applicable.
5. **Professional Journal Center — P0**
   - **JRN-01:** Provide one accounting workspace for reviewing journals from all supported posting sources.
   - **JRN-02:** Display journal number, accounting date, description, reference, source, status, and debit/credit totals.
   - **JRN-03:** Provide consistent journal numbering with documented assignment and reuse rules.
   - **JRN-04:** Support searching, sorting, and filtering journals by relevant accounting attributes, including date, account, source, and status.
   - **JRN-05:** Support saved views so accountants can return to frequently used journal filters.
   - **JRN-06:** Display the underlying debit/credit lines and associated source records from the journal workspace.
   - **JRN-07:** Keep original journals, reversals, adjustments, and their relationships visible and traceable.
   - **JRN-08:** Define permission-controlled journal actions and ensure their availability reflects document status and period restrictions.
6. **Six-column Trial Balance — P0**
   - **TB-01:** Provide the following six monetary columns for each account: **Opening Debit, Opening Credit, Period Debit, Period Credit, Closing Debit, and Closing Credit**.
   - **TB-02:** Support a selected reporting period with separately calculated opening balances, period movements, and closing balances.
   - **TB-03:** Ensure each account’s closing balance reconciles to its opening balance plus net period movement.
   - **TB-04:** Ensure opening debit/credit totals, period debit/credit movements, and closing debit/credit totals reconcile appropriately.
   - **TB-05:** Handle account hierarchy and Contra accounts correctly without counting both parent rollups and underlying balances in grand totals.
   - **TB-06:** Provide drill-down from Trial Balance amounts to the account movements and journals that produced them.
   - **TB-07:** Ensure displayed and exported Trial Balance results use the same filters and calculation rules.
7. **Financial statements and report traceability — P0**
   - **FS-01:** Complete the existing financial-statement workflows, including the Income Statement, Balance Sheet/Statement of Financial Position, and Cash Flow Statement.
   - **FS-02:** Present applicable assets and liabilities under current and non-current classifications.
   - **FS-03:** Apply account classifications and Contra treatment consistently throughout financial statements.
   - **FS-04:** Reconcile financial-statement totals to the Trial Balance and underlying General Ledger.
   - **FS-05:** Provide drill-down from statement totals to contributing accounts, account movements, and source journals.
   - **FS-06:** Preserve the report’s selected dates, filters, and navigation context when users inspect underlying records.
   - **FS-07:** Define and document statement-mapping and cash-flow classification policies requiring accountant approval.
   - **FS-08:** Preserve access to historical financial information when accounts are archived or their permitted descriptive attributes change.
8. **Accounts Receivable and customer subledger — P0**
   - **AR-01:** Provide a customer subledger linked to the appropriate Accounts Receivable Control account.
   - **AR-02:** Record customer invoices or accounting obligations with their customer, issue date, due date, original amount, and outstanding amount.
   - **AR-03:** Record receipts and allocate them to the relevant customer invoices or obligations.
   - **AR-04:** Support partial settlement and accurately maintain the remaining outstanding balance.
   - **AR-05:** Define controlled handling for unallocated receipts, customer credits, overpayments, adjustments, and reversed allocations.
   - **AR-06:** Provide customer statements showing opening balance, charges, receipts, adjustments, and closing balance.
   - **AR-07:** Provide receivables-aging reports using documented due-date rules and aging buckets.
   - **AR-08:** Reconcile customer subledger balances to the Accounts Receivable Control account for the selected reporting date.
   - **AR-09:** Ensure invoice recognition and subsequent receipt allocation do not recognize the same revenue twice.
9. **Accounts Payable and supplier subledger — P0**
   - **AP-01:** Provide a supplier subledger linked to the appropriate Accounts Payable Control account.
   - **AP-02:** Record supplier bills or accounting obligations with their supplier, issue date, due date, original amount, and outstanding amount.
   - **AP-03:** Record payments and allocate them to the relevant supplier bills or obligations.
   - **AP-04:** Support partial settlement and accurately maintain the remaining outstanding balance.
   - **AP-05:** Define controlled handling for unallocated payments, supplier credits, overpayments, adjustments, and reversed allocations.
   - **AP-06:** Provide supplier statements showing opening balance, bills, payments, adjustments, and closing balance.
   - **AP-07:** Provide payables-aging reports using documented due-date rules and aging buckets.
   - **AP-08:** Reconcile supplier subledger balances to the Accounts Payable Control account for the selected reporting date.
   - **AP-09:** Ensure bill recognition and subsequent payment allocation do not recognize the same expense or asset twice.
10. **Accounting periods and closing — P0**
    - **PER-01:** Provide an explicit accounting-period management workflow rather than relying only on a basic lock date.
    - **PER-02:** Support **Open, Soft Closed, and Hard Closed** period states.
    - **PER-03:** Define the permitted operations, restrictions, and authorization requirements for each state.
    - **PER-04:** Apply period restrictions consistently to manual journals, imported entries, automated entries, subledger postings, opening balances, and adjustments.
    - **PER-05:** Provide a controlled reopening process requiring appropriate permission and a recorded reason.
    - **PER-06:** Record the actor, timestamp, reason, and relevant state change for closing and reopening actions.
    - **PER-07:** Define the fiscal-year and year-end closing treatment, including retained earnings and subsequent-period reporting, before implementation.
    - **PER-08:** Test concurrent posting and period-closing operations so restricted entries cannot bypass a closing action.
11. **Bank reconciliation — P0**
    - **BANK-01:** Support importing bank statements into a reconciliation workspace.
    - **BANK-02:** Validate imported statement data and detect duplicate imports or statement lines.
    - **BANK-03:** Allow statement lines to be matched against existing ledger transactions without posting those transactions again.
    - **BANK-04:** Clearly distinguish matched, unmatched, and unresolved items.
    - **BANK-05:** Allow authorized users to record necessary accounting adjustments through the shared posting engine.
    - **BANK-06:** Define matching, unmatching, correction, and reconciliation-completion rules.
    - **BANK-07:** Provide a reconciliation result showing how the bank statement balance relates to the ledger balance and outstanding items.
    - **BANK-08:** Preserve links among statement lines, matched transactions, adjustment journals, and reconciliation history.
12. **Fixed assets and depreciation — P0**
    - **FA-01:** Provide a fixed-asset register rather than only an asset-purchase transaction.
    - **FA-02:** Link each registered asset to its acquisition information, relevant ledger accounts, and accounting records.
    - **FA-03:** Capture the information required by the approved depreciation policy, including acquisition cost, relevant dates, useful life, method, and residual value where applicable.
    - **FA-04:** Generate and maintain depreciation schedules under explicitly approved accounting rules.
    - **FA-05:** Post depreciation through the shared ledger and prevent duplicate depreciation for the same asset and period.
    - **FA-06:** Display original cost, accumulated depreciation, and net book value.
    - **FA-07:** Support asset disposal or sale, including the associated gain/loss calculation and accounting entries.
    - **FA-08:** Reconcile the asset register and depreciation totals to the corresponding General Ledger accounts.
    - **FA-09:** Define correction and reversal behavior for acquisition, depreciation, and disposal records.
13. **Cost centers and project accounting**
    - **DIM-01:** Complete cost-center and project support as accounting dimensions rather than treating existing foundation fields as a finished module.
    - **DIM-02:** Provide controlled creation and maintenance of cost centers and accounting projects.
    - **DIM-03:** Associate applicable accounting amounts with their relevant cost center or project.
    - **DIM-04:** Provide accounting reports filtered or grouped by cost center and project.
    - **DIM-05:** Reconcile dimension-level results to the overall ledger totals, including amounts with no assigned dimension.
    - **DIM-06:** Define allocation rules and historical-change behavior where one accounting amount must be distributed across multiple dimensions.
    - **DIM-07:** Keep this scope limited to financial classification and reporting; do not silently introduce operational project-management functionality.
14. **Tax and VAT accounting**
    - **TAX-01:** Define the intended tax/VAT accounting scope for Ledger Suit and identify the jurisdictions and business circumstances to which it applies.
    - **TAX-02:** Specify the tax configuration, transaction information, ledger mappings, calculations, adjustments, and reports required by that approved scope.
    - **TAX-03:** Integrate applicable tax/VAT effects with the relevant accounting documents and shared posting engine.
    - **TAX-04:** Reconcile tax/VAT reports to the corresponding ledger accounts and source transactions.
    - **TAX-05:** Identify unresolved tax policies and obtain accountant review and current authoritative regulatory verification before implementation.
    - **TAX-06:** Treat electronic invoicing, electronic receipts, government submission, and other external compliance integrations as explicit scope decisions; do not assume they are included merely because tax/VAT accounting is required.
    - **TAX-07:** Do not describe the tax module as compliant or complete solely because tax fields, accounts, or calculations exist.
15. **Inventory accounting**
    - **INV-01:** Complete inventory accounting beyond an inventory account classification or other foundation-only implementation.
    - **INV-02:** Define the accounting scope, inventory-control accounts, valuation approach, and cost-of-goods-sold treatment.
    - **INV-03:** Identify the source of inventory movements and valuation data and define how those records produce accounting entries.
    - **INV-04:** Define the accounting treatment for inventory increases, decreases, returns, and valuation adjustments included in the approved scope.
    - **INV-05:** Reconcile inventory valuation and cost-of-goods-sold results to the corresponding ledger accounts.
    - **INV-06:** Preserve traceability between inventory-related accounting entries and their originating records.
    - **INV-07:** Require explicit approval of costing and correction policies rather than silently choosing an inventory accounting method.
    - **INV-08:** Keep inventory accounting separate from a full warehouse-management, purchasing, sales-order, or manufacturing implementation.
16. **Validation and acceptance requirements**
    - **VAL-01:** Define measurable acceptance criteria for every requirement, including expected accounting results and user-visible behavior.
    - **VAL-02:** Test account hierarchy, Group restrictions, Control-account reconciliation, Contra treatment, and financial-statement classification.
    - **VAL-03:** Test opening-balance imports, journal numbering, saved views, report drill-down, and six-column Trial Balance reconciliation.
    - **VAL-04:** Test customer and supplier obligations, partial settlements, allocations, aging, corrections, and reconciliation to Control accounts.
    - **VAL-05:** Test closing/reopening, bank matching, depreciation, disposal, accounting dimensions, and the approved tax and inventory scope.
    - **VAL-06:** Include permission, organization-isolation, duplicate-submission, concurrent-operation, and historical-data-preservation tests.
    - **VAL-07:** Include accountant-reviewed scenarios with independently verified expected balances and reports.
    - **VAL-08:** Distinguish **code implemented**, **tests passed**, **deployed**, and **accountant accepted**. Do not treat these as interchangeable completion states.
17. **Implementation-plan requirements for the analyzing AI**
    - **PLAN-01:** Produce a requirement-by-requirement gap analysis with references to the actual repository files, database objects, interfaces, and tests.
    - **PLAN-02:** Identify existing functionality to retain, partial functionality to extend, missing functionality to introduce, and uncertain behavior to investigate.
    - **PLAN-03:** Preserve the screenshots’ P0 grouping for the accounting core, including bank reconciliation and fixed assets. Identify dependencies and separately propose the sequencing of cost centers/projects, tax/VAT, and inventory accounting.
    - **PLAN-04:** Separate unresolved accounting/product decisions from implementation work and identify which decisions block dependent work.
    - **PLAN-05:** For each proposed implementation work package, specify scope, dependencies, affected components, migration needs, data-preservation risks, acceptance criteria, tests, and review requirements.
    - **PLAN-06:** Identify integration boundaries between accounting modules so the plan does not create conflicting balances, duplicated postings, or disconnected financial records.
    - **PLAN-07:** Include migration rehearsal, reconciliation, rollback/recovery considerations, and regression verification where existing data or behavior is affected.
    - **PLAN-08:** Maintain traceability from each requirement ID to its proposed implementation work, tests, and acceptance evidence.
    - **PLAN-09:** List any additional capabilities considered necessary for the intended accounting product separately as **proposed scope additions requiring approval**, not as requirements silently inferred from the screenshots.
    - **PLAN-10:** Produce the analysis and implementation plan without modifying code, applying migrations, merging changes, or deploying anything unless separately authorized.
