import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inventoryReconciles } from '../../app/utils/inventoryAccounting.ts'

const matched = { status: 'reconciled', inventory_variance_minor: '0', cogs_variance_minor: '0', source_inventory_variance_minor: '0', source_cogs_variance_minor: '0' }
test('inventory reconciliation requires GL and source snapshots to match independently', () => {
  assert.equal(inventoryReconciles(matched), true)
  for (const field of Object.keys(matched).filter(key => key !== 'status')) {
    for (const difference of ['1', '-1', '9007199254740993', null, 'invalid']) {
      assert.equal(inventoryReconciles({ ...matched, [field]: difference }), false)
    }
  }
  assert.equal(inventoryReconciles({ ...matched, status: 'awaiting_source' }), false)
})
test('bilingual inventory report and all accounting movement labels have identical keys', () => {
  const en = JSON.parse(readFileSync(new URL('../../i18n/locales/en.json', import.meta.url))).inventory
  const ar = JSON.parse(readFileSync(new URL('../../i18n/locales/ar.json', import.meta.url))).inventory
  const keys = value => Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item).map(child => `${key}.${child}`) : [key]).sort()
  assert.deepEqual(keys(en), keys(ar))
  assert.equal(Object.keys(en.kinds).length, 8)
})
