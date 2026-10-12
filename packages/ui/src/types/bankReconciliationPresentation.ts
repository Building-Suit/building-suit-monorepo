export interface BsBankReconciliationCopy {
  bank_actions: string
  bank_active: string
  bank_adjust: string
  bank_amount: string
  bank_auditHistory: string
  bank_bankAccount: string
  bank_closing: string
  bank_complete: string
  bank_correct: string
  bank_date: string
  bank_denied: string
  bank_description: string
  bank_difference: string
  bank_empty: string
  bank_emptyHint: string
  bank_end: string
  bank_equation: string
  bank_equationPolicy: string
  bank_errors_load: string
  bank_file: string
  bank_import: string
  bank_journal: string
  bank_ledgerBalance: string
  bank_ledgerCandidates: string
  bank_markOutstanding: string
  bank_matchExact: string
  bank_matchHistory: string
  bank_noCandidates: string
  bank_noLines: string
  bank_noMatches: string
  bank_noOutstanding: string
  bank_offsetAccount: string
  bank_opening: string
  bank_outstanding: string
  bank_outstandingTotal: string
  bank_policy: string
  bank_reason: string
  bank_reconciliation: string
  bank_reference: string
  bank_remove: string
  bank_reopen: string
  bank_retry: string
  bank_select: string
  bank_selectedTotals: string
  bank_start: string
  bank_state: string
  bank_statementBalance: string
  bank_statementLines: string
  bank_statementMismatch: string
  bank_template: string
  bank_title: string
  bank_unmatch: string
  bank_unmatched: string
  common_cancel: string
  common_save: string
  pageContext_label: string
}
export interface BsBankReconciliationForm { date: string; amount: string; description: string; reference: string; reason: string; offset: string; account: string; start: string; end: string; opening: string; closing: string }
export interface BsBankReconciliationChoice { value: string; label: string }
export interface BsBankStatementRow { id: string; date: string; description: string; reference: string; amount: string; status: string; statusLabel: string; error: string; selectable: boolean; selectionLabel: string; canCorrect: boolean; canAdjust: boolean }
export interface BsBankCandidateRow { id: string; date: string; description: string; reference: string; amount: string; selectable: boolean; selectionLabel: string; canOutstanding: boolean }
export interface BsBankReconciliationView { context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canImport: boolean; readOnly: boolean; failed: boolean; pending: boolean; saving: boolean; dirty: boolean; formError: string; formTitle: string; importForm: boolean; correctionForm: boolean; adjustmentForm: boolean; reasonField: boolean; current: { title: string; detail: string; canComplete: boolean; canReopen: boolean; editable: boolean; mismatch: boolean } | null; equation: { statement: string; outstanding: string; ledger: string; difference: string } | null; states: { status: string; label: string; count: number; amount: string }[]; lines: BsBankStatementRow[]; candidates: BsBankCandidateRow[]; lineTotal: string; transactionTotal: string; canMatch: boolean; matchDisabled: boolean; outstanding: { id: string; journal: string; reason: string; amount: string; canRemove: boolean }[]; matches: { id: string; date: string; amount: string; statusLabel: string; reason: string; canUnmatch: boolean }[]; events: { id: string; time: string; label: string; reason: string }[] }
export interface BsBankReconciliationChoices { reconciliations: BsBankReconciliationChoice[]; banks: BsBankReconciliationChoice[]; offsets: BsBankReconciliationChoice[] }
