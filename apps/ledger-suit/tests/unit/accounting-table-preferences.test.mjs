import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readPresentationTree } from '../../../../packages/testing/presentation-source.mjs'
import { accountingTablePreferenceKey, parseAccountingTableDensity } from '../../app/utils/accountingTablePreferences.ts'

const scope = {
  environment: 'http://127.0.0.1:60321',
  userId: 'user-a',
  tenantId: 'organization-a',
  tableId: 'journal-center',
}

test('accounting table preferences are isolated by environment, user, tenant, and table', () => {
  const key = accountingTablePreferenceKey(scope)
  for (const field of Object.keys(scope)) {
    assert.notEqual(accountingTablePreferenceKey({ ...scope, [field]: `${scope[field]}-other` }), key, field)
  }
  assert.doesNotMatch(key, /http:\/\//)
})

test('only supported density values are restored', () => {
  assert.equal(parseAccountingTableDensity('compact'), 'compact')
  assert.equal(parseAccountingTableDensity('comfortable'), 'comfortable')
  assert.equal(parseAccountingTableDensity('malformed'), 'comfortable')
  assert.equal(parseAccountingTableDensity(null), 'comfortable')
})

test('accounting tables retain BsDataTable and existing full-population totals', async () => {
  const root = new URL('../../', import.meta.url)
  const reports = readFileSync(new URL('app/pages/reports.vue', root), 'utf8')
  const journals = readFileSync(new URL('app/pages/transactions.vue', root), 'utf8')
  const workspace = readFileSync(new URL('app/composables/useTransactionWorkspace.ts', root), 'utf8')
  const presentation = await readPresentationTree(new URL('../../../../', import.meta.url).pathname, 'apps/ledger-suit/app/pages/reports.vue')
  assert.match(presentation, /<BsDataTable/)
  assert.match(reports, /trialBalance\.value\.reduce\(\(sum, row\) => sum \+ BigInt\(row\[field\]\), 0n\)/)
  assert.match(reports, /report === 'trial_balance'/)
  assert.match(journals, /useTransactionWorkspace\(\)/)
  const journalPresentation = await readPresentationTree(new URL('../../../../', import.meta.url).pathname, 'apps/ledger-suit/app/pages/transactions.vue')
  assert.match(journalPresentation, /<BsDataTable[^>]+:value="view.rows"/)
  assert.match(workspace, /p_limit: pageSize, p_offset: \(page\.value - 1\) \* pageSize/)
  assert.doesNotMatch(`${reports}\n${journals}`, /virtual(?:-|_)?scroller/i)
})
