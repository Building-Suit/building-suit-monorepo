export const STATEMENT_LINES = [
  'current_assets', 'property_equipment', 'other_non_current_assets', 'unclassified_asset',
  'current_liabilities', 'non_current_liabilities', 'unclassified_liability',
  'equity', 'unclassified_equity', 'unclosed_profit',
] as const

export function statementLinesFor(type: string): string[] {
  if (type === 'asset') return ['current_assets', 'property_equipment', 'other_non_current_assets']
  if (type === 'liability') return ['current_liabilities', 'non_current_liabilities']
  return type === 'equity' ? ['equity'] : []
}

export function sumStatementAmounts(rows: ReadonlyArray<{ amount_minor: string, section: string, statement_line: string }>, key: string, field: 'section' | 'statement_line' = 'section'): string {
  return rows.filter(row => row[field] === key)
    .reduce((sum, row) => sum + BigInt(row.amount_minor), 0n).toString()
}
