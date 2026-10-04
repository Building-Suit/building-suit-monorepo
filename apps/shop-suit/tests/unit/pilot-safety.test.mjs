import assert from 'node:assert/strict'
import test from 'node:test'
import { requireDisposable, validateExportShopId, sql, localStatus } from '../pilot/local-backend.mjs'

test('database and credential access require disposable-local acknowledgement', () => {
  const previous = process.env.SHOP_PILOT_DISPOSABLE
  try {
    delete process.env.SHOP_PILOT_DISPOSABLE
    for (const action of [requireDisposable, localStatus, () => sql('select 1')]) {
      assert.throws(action, /Set SHOP_PILOT_DISPOSABLE=1/)
    }
    process.env.SHOP_PILOT_DISPOSABLE = 'true'
    assert.throws(requireDisposable, /Set SHOP_PILOT_DISPOSABLE=1/)
  } finally {
    if (previous === undefined) delete process.env.SHOP_PILOT_DISPOSABLE
    else process.env.SHOP_PILOT_DISPOSABLE = previous
  }
})

test('database execution refuses arbitrary destinations and roles', () => {
  const previous = process.env.SHOP_PILOT_DISPOSABLE
  try {
    process.env.SHOP_PILOT_DISPOSABLE = '1'
    for (const database of ['production', 'postgres://host/database', 'ss_pilot_restore_injected;']) {
      assert.throws(() => sql('select 1', database), /Invalid disposable database name/)
    }
    assert.throws(() => sql('select 1', 'postgres', 'untrusted-role'), /Invalid local database role/)
  } finally {
    if (previous === undefined) delete process.env.SHOP_PILOT_DISPOSABLE
    else process.env.SHOP_PILOT_DISPOSABLE = previous
  }
})

test('export rejects SQL/connection input and accepts a single tenant UUID', () => {
  for (const shopId of ["'; drop table public.shops; --", 'postgres://host/database', '', '*']) {
    assert.throws(() => validateExportShopId(shopId), /must identify one synthetic local shop/)
  }
  assert.equal(validateExportShopId('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111')
})
