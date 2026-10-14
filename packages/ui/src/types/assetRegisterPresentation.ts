export interface BsAssetRegisterCopy {
  assets_account: string
  assets_accumulated: string
  assets_accumulatedAccount: string
  assets_acquisitionDate: string
  assets_acquisitionJournal: string
  assets_actions: string
  assets_asOf: string
  assets_changePolicy: string
  assets_closingNbv: string
  assets_code: string
  assets_cost: string
  assets_costAccount: string
  assets_date: string
  assets_denied: string
  assets_depreciation: string
  assets_dispose: string
  assets_effectiveDate: string
  assets_empty: string
  assets_emptyHint: string
  assets_errors_load: string
  assets_expenseAccount: string
  assets_gainLossAccount: string
  assets_glBalance: string
  assets_history: string
  assets_impair: string
  assets_impairmentAccount: string
  assets_impairmentAmount: string
  assets_journal: string
  assets_life: string
  assets_method: string
  assets_methods_declining_balance: string
  assets_methods_straight_line: string
  assets_name: string
  assets_nbv: string
  assets_noSchedule: string
  assets_periodEnd: string
  assets_periodStart: string
  assets_policy: string
  assets_post: string
  assets_proceeds: string
  assets_proceedsAccount: string
  assets_rate: string
  assets_reason: string
  assets_reconciled: string
  assets_reconciliation: string
  assets_register: string
  assets_registerBalance: string
  assets_registerReplacement: string
  assets_registerTitle: string
  assets_residual: string
  assets_retry: string
  assets_reverse: string
  assets_review: string
  assets_schedule: string
  assets_serviceDate: string
  assets_statusLabel: string
  assets_title: string
  assets_variance: string
  common_cancel: string
  common_save: string
  pageContext_label: string
}
export interface BsAssetRegisterForm { code: string; name: string; description: string; journal: string; acquisitionDate: string; serviceDate: string; cost: string; residual: string; life: string; method: string; rate: string; costAccount: string; accumulatedAccount: string; expenseAccount: string; impairmentAccount: string; gainLossAccount: string; date: string; proceeds: string; proceedsAccount: string; reason: string }
export interface BsAssetRegisterChoice { value: string; label: string }
export interface BsAssetRegisterView { context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canRegister: boolean; registerDisabled: boolean; pending: boolean; failed: boolean; available: boolean; readOnly: boolean; totals: { cost: string; accumulated: string; nbv: string }; assets: { id: string; code: string; name: string; statusLabel: string; cost: string; accumulated: string; nbv: string }[]; selected: { id: string; code: string; name: string; description: string; journalTo: string; actions: { id: string; label: string; primary: boolean; disabled: boolean }[] } | null; schedule: { id: string; periodStart: string; periodEnd: string; amount: string; closing: string; statusLabel: string; canPost: boolean }[]; reconciliation: { id: string; account: string; register: string; gl: string; variance: string }[]; reconciled: boolean; reconciliationLabel: string; events: { id: string; date: string; kind: string; reason: string; journalTo: string; canReverse: boolean }[]; formTitle: string; saving: boolean; dirty: boolean; formError: string; registerForm: boolean; policyForm: boolean; depreciationForm: boolean; disposeForm: boolean; impairmentForm: boolean; actionForm: boolean; rateField: boolean; actionDateLabel: string; constraints: { lifeMin: number; lifeMax: number; rateMin: number; rateMax: number; rateStep: number } }
export interface BsAssetRegisterChoices { journals: BsAssetRegisterChoice[]; cost: BsAssetRegisterChoice[]; accumulated: BsAssetRegisterChoice[]; expense: BsAssetRegisterChoice[]; gainLoss: BsAssetRegisterChoice[]; proceeds: BsAssetRegisterChoice[]; methods: BsAssetRegisterChoice[] }
