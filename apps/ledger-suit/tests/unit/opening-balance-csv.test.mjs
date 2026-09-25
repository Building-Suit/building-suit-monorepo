import assert from 'node:assert/strict'
import test from 'node:test'
import { openingBalanceTemplate, parseOpeningBalanceCsv } from '../../app/utils/openingBalanceCsv.ts'

const en = { sourceCode: 'Source Account Code', sourceName: 'Source Account Name', debit: 'Debit', credit: 'Credit', cashExample: 'Cash', equityExample: 'Retained Earnings' }
const ar = { sourceCode: 'كود الحساب المصدر', sourceName: 'اسم الحساب المصدر', debit: 'مدين', credit: 'دائن', cashExample: 'النقدية', equityExample: 'الأرباح المرحلة' }

for (const [locale, labels] of Object.entries({ en, ar })) {
  test(`${locale}: opening Trial Balance template round-trips source identity and explicit sides`, () => {
    const rows = parseOpeningBalanceCsv(openingBalanceTemplate(labels), labels)
    assert.deepEqual(rows.map(row => [row.source_code, row.source_name, row.debit, row.credit, row.account_id]), [
      ['1000', labels.cashExample, '10000.00', '', null],
      ['3000', labels.equityExample, '', '10000.00', null],
    ])
  })
}

test('opening CSV requires code, name, Debit, and Credit columns', () => {
  assert.throws(() => parseOpeningBalanceCsv('code,name,amount\n1,Cash,10', en), /OPENING_CSV_COLUMNS_INVALID/)
})
