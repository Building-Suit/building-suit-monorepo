export interface BsOpeningBalanceCopy {
  common_retry: string
  common_saving: string
  opening_approve: string
  opening_approver: string
  opening_archived: string
  opening_blocked: string
  opening_chooseAccount: string
  opening_chooseCsv: string
  opening_correctionReason: string
  opening_creator: string
  opening_credit: string
  opening_creditTotal: string
  opening_cutoff: string
  opening_cutoffHint: string
  opening_debit: string
  opening_debitTotal: string
  opening_difference: string
  opening_downloadTemplate: string
  opening_empty: string
  opening_emptyHint: string
  opening_guideChart: string
  opening_guideHint: string
  opening_guideMapping: string
  opening_guidePeriod: string
  opening_guideTitle: string
  opening_history: string
  opening_ledgerAccount: string
  opening_loadFailed: string
  opening_mapping: string
  opening_mode: string
  opening_modes_midyear: string
  opening_modes_year_start: string
  opening_noAccess: string
  opening_openJournal: string
  opening_postedLocked: string
  opening_preview: string
  opening_previewHint: string
  opening_reversal: string
  opening_reversalDate: string
  opening_reverse: string
  opening_reviewChart: string
  opening_reviewPeriods: string
  opening_rowCount: string
  opening_setup: string
  opening_sourceAccount: string
  opening_subtitle: string
  opening_title: string
  opening_upload: string
  opening_valid: string
  opening_validate: string
  opening_validation: string
  opening_validationErrors: string
  opening_validationPassed: string
}
export interface BsOpeningBalanceRow { sourceRow: number; sourceCode: string; sourceName: string; debit: string; credit: string; accountId: string | null; errors: string[] }
export interface BsOpeningBalanceHistory { id: string; status: string; title: string; subtitle: string; journalTo: string | null; validation: { rows: string; debit: string; credit: string } | null; creator: string; approver: string | null; reversalTo: string | null; reversalId: string; correctionReason: string; canCorrect: boolean; pending: boolean; reverseLabel: string }
export interface BsOpeningBalanceView {
  context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canManage: boolean; pending: boolean; loadError: boolean
  reviewChartTo: string; reviewPeriodsTo: string; modes: { value: string; label: string }[]
  posted: boolean; filename: string; fileDisabled: boolean; uploadFailed: boolean; busy: boolean; retryLabel: string; validateLabel: string; approveLabel: string; canApprove: boolean; approveDisabled: boolean; correctionDisabled: boolean
  validation: { valid: boolean; debit: string; credit: string; difference: string; errors: string[]; preview: { id: string; account: string; debit: string; credit: string }[] } | null
  rows: BsOpeningBalanceRow[]; accounts: { value: string; label: string }[]; history: BsOpeningBalanceHistory[]; journalTo: string
}
