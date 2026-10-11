import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { posCustomerOptions } from '../../app/utils/posCustomer.js'

const ada = { id: 'ada', name: 'Ada', phone: '01012345678' }
const ali = { id: 'ali', name: 'Ali', phone: null }
const base = { search: 'Ad', resolvedSearch: 'Ad', pending: false, customers: [ada], selected: null }
test('bounded server results are shown only for the settled current search', () => {
  assert.deepEqual(posCustomerOptions(base), [{ ...ada, identity: 'Ada · 01012345678' }])
  for (const override of [{ search: 'A' }, { search: '' }, { search: 'Ali' }, { pending: true }, { resolvedSearch: undefined }]) {
    assert.deepEqual(posCustomerOptions({ ...base, ...override }), [])
  }
  assert.equal(posCustomerOptions({ ...base, search: ' Ad ' }).length, 1)
})
test('selected identity survives unrelated, empty and pending results without duplicates', () => {
  assert.deepEqual(posCustomerOptions({ ...base, selected: ada }), [{ ...ada, identity: 'Ada · 01012345678' }])
  for (const override of [{ pending: true }, { search: '' }, { customers: [] }]) {
    assert.equal(posCustomerOptions({ ...base, selected: ali, ...override })[0].identity, 'Ali')
  }
  assert.equal(posCustomerOptions({ ...base, selected: ali }).length, 2)
})
test('page retains bounded RPC, shared keyboard picker, appointment guard and customerless contract', () => {
  const page = readFileSync(new URL('../../app/pages/pos.vue', import.meta.url), 'utf8')
  assert.match(page, /<BsSelect\s+input-id="pos-customer"/)
  assert.match(page, /:filter-fields="\['name', 'phone'\]"/)
  assert.match(page, /p_customer_search: debouncedCustomerSearch.value.length >= 2 \? debouncedCustomerSearch.value : null/)
  assert.match(page, /function clearCustomer\(\) \{\s*if \(appointmentId.value/)
  assert.match(page, /p_customer_id: customerId.value \|\| null/)
  assert.match(page, /event.key === 'F4'.*role="combobox"/)
  assert.doesNotMatch(page, /ref="customerInput"|v-for="customer in context.customers"/)
  const migration = readFileSync(new URL('../../supabase/migrations/20260928223000_counter_pos_checkout.sql', import.meta.url), 'utf8')
  assert.match(migration, /order by lower\(client.name\), client.id limit 20/)
})
