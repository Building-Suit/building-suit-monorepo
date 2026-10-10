

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerFinancialSystemMapView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const { t } = useI18n()
const open = ref(false)

const manualFlows = [
  'income',
  'expense',
  'transfer',
  'asset',
  'liability',
  'repayment',
  'owner',
  'adjustment',
] as const

const postingChecks = ['access', 'period', 'accounts', 'balance', 'atomic'] as const
const reports = ['profitLoss', 'balanceSheet', 'cashFlow', 'trialBalance', 'generalLedger'] as const

function show() {
  open.value = true
}

function close() {
  open.value = false
}
return { t, open, manualFlows, postingChecks, reports, show, close }
}
