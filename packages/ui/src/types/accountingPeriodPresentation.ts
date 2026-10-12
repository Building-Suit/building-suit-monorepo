export interface BsAccountingPeriodCopy {
  common_cancel: string
  common_saving: string
  periods_closingJournal: string
  periods_create: string
  periods_empty: string
  periods_emptyHint: string
  periods_endDate: string
  periods_fiscalHint: string
  periods_fiscalMonth: string
  periods_fiscalYear: string
  periods_fiscalYearStart: string
  periods_hardClose: string
  periods_history: string
  periods_loadFailed: string
  periods_netResult: string
  periods_noAccess: string
  periods_reason: string
  periods_reasonHint: string
  periods_reopen: string
  periods_softClose: string
  periods_startDate: string
  periods_subtitle: string
  periods_title: string
  periods_yearEnd: string
  periods_yearEndComplete: string
  periods_yearEndReason: string
}
export interface BsAccountingPeriodCreateForm { start: string; end: string }
export interface BsAccountingPeriodCloseForm { fiscalYearStart: string; reason: string }
export interface BsAccountingPeriodRow {
  id: string; status: string; start: string; title: string; fiscalRange: string; statusLabel: string; statusTone: 'success' | 'warning' | 'neutral'; reason: string
  actions: { id: string; label: string; primary: boolean; disabled: boolean }[]
  close: { net: string; journalTo: string } | null
  history: { id: string; transition: string; description: string }[]
}
export interface BsAccountingPeriodView {
  context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canManage: boolean; canCloseYear: boolean; pending: boolean; loadError: boolean
  createDirty: boolean; createPending: boolean; createError: string; closePending: boolean; closeDisabled: boolean; closeLabel: string; periods: BsAccountingPeriodRow[]
}
