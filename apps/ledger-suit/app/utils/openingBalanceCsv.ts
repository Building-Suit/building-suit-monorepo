import { parseCsv, serializeCsv } from './csv.ts'

export interface OpeningSourceRow {
  source_row: number
  source_code: string
  source_name: string
  debit: string
  credit: string
  account_id: string | null
}

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '')

export function parseOpeningBalanceCsv(text: string, labels: Record<string, string>): OpeningSourceRow[] {
  const parsed = parseCsv(text)
  const label = (key: string) => labels[key] ?? key
  const aliases: Record<string, string[]> = {
    source_code: ['sourceaccountcode', 'accountcode', 'code', label('sourceCode')],
    source_name: ['sourceaccountname', 'accountname', 'name', label('sourceName')],
    debit: ['debit', label('debit')],
    credit: ['credit', label('credit')],
  }
  const matched = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [
    field,
    parsed.headers.find(header => names.map(normalize).includes(normalize(header))),
  ]))
  if (!matched.source_code || !matched.source_name || !matched.debit || !matched.credit) {
    throw new Error('OPENING_CSV_COLUMNS_INVALID')
  }
  return parsed.rows.map((row, index) => ({
    source_row: index + 1,
    source_code: row[matched.source_code!] ?? '',
    source_name: row[matched.source_name!] ?? '',
    debit: row[matched.debit!] ?? '',
    credit: row[matched.credit!] ?? '',
    account_id: null,
  }))
}

export function openingBalanceTemplate(labels: Record<string, string>) {
  const label = (key: string) => labels[key] ?? key
  return serializeCsv([
    [label('sourceCode'), label('sourceName'), label('debit'), label('credit')],
    ['1000', label('cashExample'), '10000.00', ''],
    ['3000', label('equityExample'), '', '10000.00'],
  ])
}
