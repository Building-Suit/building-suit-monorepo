export type AccountingTableDensity = 'compact' | 'comfortable'

export interface AccountingTablePreferenceScope {
  environment: string
  userId: string
  tenantId: string
  tableId: string
}

export function accountingTablePreferenceKey(scope: AccountingTablePreferenceScope) {
  return ['ledger-suit', 'accounting-table', scope.environment, scope.userId, scope.tenantId, scope.tableId]
    .map(value => encodeURIComponent(value))
    .join(':')
}

export function parseAccountingTableDensity(value: string | null): AccountingTableDensity {
  return value === 'compact' ? 'compact' : 'comfortable'
}
