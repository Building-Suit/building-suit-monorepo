import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { addOrIncrementCartLine, captureBarcodeKey, cartTotal, emptyScanState } from '../../app/utils/pos.js'

const migration = await readFile(new URL('../../supabase/migrations/20260928223000_counter_pos_checkout.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/pos.vue', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_pos_checkout.sql', import.meta.url), 'utf8')

test('keyboard-wedge scans require a fast sequence and terminate on Enter', () => {
  let state = emptyScanState()
  for (const [index, key] of [...'6221234567890'].entries()) state = captureBarcodeKey(state, key, 100 + index * 10).state
  assert.equal(captureBarcodeKey(state, 'Enter', 240).code, '6221234567890')
  state = captureBarcodeKey(emptyScanState(), '1', 100).state
  state = captureBarcodeKey(state, '2', 500).state
  assert.equal(captureBarcodeKey(state, 'Enter', 510).code, null)
})

test('repeat scans increment one deterministic cart line and totals stay decimal-safe', () => {
  const item = { id: 'p1', itemType: 'product', name: 'Wax', unitPrice: 12.25, discount: 0, stock: 4 }
  const once = addOrIncrementCartLine([], item)
  const twice = addOrIncrementCartLine(once, item)
  assert.equal(twice.length, 1)
  assert.equal(twice[0].quantity, 2)
  assert.equal(cartTotal(twice), 24.5)
})

test('POS page covers scanner recovery, locked context, keyboard and bilingual responsive states', () => {
  for (const evidence of ['scanBarcode', 'unknownBarcode', 'locationChanged', "event.key === 'F2'", "event.key === 'F8'", 'min-h-11', 'xl:grid-cols', 'role="alert"', 'aria-live="polite"', 'checkout_pos_sale']) assert.match(page, new RegExp(evidence))
  assert.match(page, /save_pos_sale_draft/)
  assert.match(page, /pos_catalog_search/)
  assert.match(page, /pos_checkout_context/)
  assert.match(page, /refreshNuxtData/)
})

test('POS database contract composes existing atomic sale, payment and appointment commands', () => {
  assert.match(migration, /shop_private\.checkout_customerless_sale/)
  assert.match(migration, /shop_private\.issue_sale/)
  assert.match(migration, /shop_private\.record_customer_receipt/)
  assert.match(migration, /shop_private\.link_appointment_sale/)
  assert.match(migration, /POS_CHECKOUT_REQUIRES_FULL_PAYMENT/)
  assert.match(migration, /remaining_quantity/)
  assert.match(migration, /CROSS_LOCATION_STOCK/)
  for (const evidence of ['repeat checkout duplicated the sale', 'mixed checkout did not preserve product and service lines', 'known barcode was not resolved exactly', 'unknown barcode unexpectedly resolved', 'appointment checkout did not preserve staff and sale context']) assert.match(databaseTest, new RegExp(evidence))
})
