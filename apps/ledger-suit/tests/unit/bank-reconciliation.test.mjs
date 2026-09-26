import assert from 'node:assert/strict'
import test from 'node:test'
import { bankStatementTemplate, minorToDecimalInput, parseBankStatementCsv, selectedMinorTotal } from '../../app/utils/bankReconciliation.ts'

const labels = { date: 'التاريخ', amount: 'المبلغ', description: 'الوصف', reference: 'المرجع', example: 'تحصيل' }
test('bank CSV preserves exact signed minor units in English and Arabic', () => {
  const english = parseBankStatementCsv('date,amount,description,reference\n2026-09-01,"1,250.25",Receipt,R-1\n2026-09-02,-20.00,Fee,F-1', 'EGP', labels)
  assert.deepEqual(english.map(row => row.amount_minor), ['125025', '-2000'])
  const arabic = parseBankStatementCsv('التاريخ,المبلغ,الوصف,المرجع\n2026-09-01,١٢٫٥٠,تحصيل,م-١', 'EGP', labels)
  assert.equal(arabic[0].amount_minor, '1250')
})
test('bank CSV requires date, amount, and description columns', () => {
  assert.throws(() => parseBankStatementCsv('date,amount\n2026-01-01,1', 'EGP', labels), /BANK_CSV_COLUMNS_INVALID/)
})
test('selection totals use bigint and templates remain parseable', () => {
  assert.equal(selectedMinorTotal(new Set(['a', 'b']), [{ id: 'a', amount_minor: '9007199254740993' }, { id: 'b', amount_minor: '-3' }]), '9007199254740990')
  assert.equal(parseBankStatementCsv(bankStatementTemplate(labels), 'EGP', labels)[0].amount_minor, '125000')
  assert.equal(minorToDecimalInput('-2500', 'EGP'), '-25.00')
})
