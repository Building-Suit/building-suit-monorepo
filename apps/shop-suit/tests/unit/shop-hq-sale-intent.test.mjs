import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveShopHqSaleIntent } from '../../server/utils/shopHqSaleIntent.ts'

const customer = { id: '6b0e9ffc-9147-418a-baa0-f0a47af327c5', name: 'أحمد محمد', phone: 'private' }
const hair = { id: 'e159f0fa-c6c1-403a-b5ba-9d1953102408', name: 'قص الشعر', unitPrice: 100, discount: 0, itemType: 'service' }
const beard = { id: '1f15aede-731b-4a3a-a786-ef5bb6e7d346', name: 'حلاقة الذقن', unitPrice: 50, discount: 5, itemType: 'service' }
const intent = { customerName: 'احمد محمد', services: ['شعر', 'دقن'], paymentMethod: null }

function fixture(customers = [customer], catalog = [hair, beard], additional = 0) {
  const calls = []
  const scope = {
    shopId: 'shop',
    locationId: 'location',
    client: {
      async rpc(name, args) {
        calls.push([name, args])
        assert.equal(args.p_shop_id, 'shop')
        assert.equal(args.p_location_id, 'location')
        if (name === 'pos_checkout_context') {
          const rows = customers.filter(row => row.name.includes(args.p_customer_search))
          return { data: { customers: rows, staff: ['private'], appointments: ['private'] }, error: null }
        }
        assert.equal(name, 'pos_catalog_search_by_category')
        assert.equal(args.p_item_type, 'service')
        assert.equal(args.p_page_size, 20)
        const rows = catalog.filter(row => row.name.includes(args.p_search))
        return { data: { items: rows, total: rows.length + additional }, error: null }
      },
    },
  }
  return { scope, calls }
}

test('matches Arabic orthographic variants against real scoped rows and returns POS service values only', async () => {
  const { scope, calls } = fixture()
  const result = await resolveShopHqSaleIntent(scope, intent)
  assert.deepEqual(result, {
    kind: 'ready',
    selection: {
      customer: { id: customer.id, name: customer.name },
      services: [
        { id: hair.id, name: hair.name, unitPrice: 100, discount: 0 },
        { id: beard.id, name: beard.name, unitPrice: 50, discount: 5 },
      ],
      paymentMethod: null,
    },
  })
  assert.ok(calls.some(([name, args]) => name === 'pos_checkout_context' && args.p_customer_search === 'محمد'))
  assert.ok(calls.some(([name, args]) => name === 'pos_catalog_search_by_category' && args.p_search === 'ذقن'))

  const transferred = await resolveShopHqSaleIntent(scope, { ...intent, paymentMethod: 'transfer' })
  assert.equal(transferred.selection.paymentMethod, 'bank_transfer')
})

test('does not choose between two customers with the same normalized name or proceed to catalog lookup', async () => {
  const duplicate = { ...customer, id: 'e216d657-c499-4543-943b-78c7bdf1b050', name: 'احمد محمد' }
  const { scope, calls } = fixture([customer, duplicate])
  const result = await resolveShopHqSaleIntent(scope, intent)
  assert.equal(result.kind, 'customer_ambiguous')
  assert.equal(result.query, intent.customerName)
  assert.ok(calls.every(([name]) => name === 'pos_checkout_context'))
})

test('a broader service label and a truncated search do not silently choose a service', async () => {
  const missing = await resolveShopHqSaleIntent(fixture().scope, { ...intent, services: ['قص'] })
  assert.deepEqual(missing, { kind: 'service_missing', query: 'قص', options: [hair.name] })
  const truncated = await resolveShopHqSaleIntent(fixture(undefined, undefined, 25).scope, intent)
  assert.equal(truncated.kind, 'service_ambiguous')
})

test('does not treat a different service or a combination as a haircut', async () => {
  for (const name of ['صبغة الشعر', 'قص الشعر وحلاقة الذقن']) {
    const result = await resolveShopHqSaleIntent(fixture(undefined, [{ ...hair, name }]).scope, intent)
    assert.equal(result.kind, 'service_missing')
  }
})

test('does not add the same stored service twice', async () => {
  const result = await resolveShopHqSaleIntent(fixture().scope, { ...intent, services: ['شعر', 'قص الشعر'] })
  assert.equal(result.kind, 'service_ambiguous')
})

test('does not perform a lookup for an invalid action', async () => {
  const { scope, calls } = fixture()
  await assert.rejects(resolveShopHqSaleIntent(scope, { ...intent, services: [], paymentMethod: 'credit' }))
  assert.equal(calls.length, 0)
})
