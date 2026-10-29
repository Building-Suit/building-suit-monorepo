import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Database } from '../../app/types/database.types'
import { backendFixture } from './pilot-backend'

type Functions = Database['public']['Functions']
type Command = 'save_vendor' | 'save_product' | 'configure_product_measurement' | 'create_supplier_purchase'
type Args<K extends Command> = { [P in keyof Functions[K]['Args']]: Functions[K]['Args'][P] | null }

// All setup writes use the same real authenticated public commands as the
// merchant. Admin material is confined to the existing Auth-user bootstrap.
export async function electricalBackendFixture() {
  const fixture = await backendFixture('owner', 'mixed')
  const call = <K extends Command>(name: K, args: Args<K>) => fixture.rpc<Functions[K]['Returns']>(fixture.owner, name, args)
  expect(await fixture.rpc(fixture.owner, 'shop_cash_policy', { p_shop_id: fixture.shopId })).toBe(false)
  // Exercise the published online authority without opening a shift, which
  // selects the separate durable/offline path. Never toggle the merchant policy.
  const vendor = await call('save_vendor', {
    p_shop_id: fixture.shopId, p_vendor_id: null, p_name: 'Native electrical supplier',
    p_contact_name: null, p_phone: null, p_email: null, p_address: null, p_tax_number: null, p_notes: null,
  })
  const products = {} as Record<'cable' | 'copper' | 'breaker', { id: string; name: string; unit: string; revision: number }>
  for (const [key, name, price, unit, increment, units] of [
    ['cable', 'Native blue cable 2.5 mm²', 35, 'm', '0.001', ['m', 'cm']],
    ['copper', 'Native copper material', 200, 'kg', '0.001', ['kg', 'g']],
    ['breaker', 'Native breaker 20A', 150, 'ea', '1', ['ea']],
  ] as const) {
    const id = await call('save_product', { p_shop_id: fixture.shopId, p_product_id: null, p_name: name, p_sku: `NATIVE-${key}`, p_barcode: null, p_sale_price: price })
    await call('configure_product_measurement', { p_shop_id: fixture.shopId, p_product_id: id, p_unit: unit, p_increment: increment, p_sale_units: [...units], p_reason: 'New disposable electrical product' })
    products[key] = { id, name, unit, revision: 1 }
  }
  // FIFO follows the public invoice date, not request arrival. Distinct dates
  // avoid depending on random batch-ID ordering when two batches share noon.
  const purchases: string[] = []
  for (const [key, quantity, unitCost, daysAgo] of [['cable', '100', 25, 1], ['cable', '100', 30, 0], ['copper', '5', 100, 0], ['breaker', '10', 100, 0]] as const) {
    const product = products[key]
    const args: Args<'create_supplier_purchase'> = {
      p_request_id: randomUUID(), p_shop_id: fixture.shopId, p_vendor_id: vendor,
      p_invoice_number: `NATIVE-${purchases.length + 1}`, p_issued_on: new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10), p_notes: null,
      p_items: [{ product_id: product.id, quantity, unit_cost: unitCost, unit_code: product.unit, measurement_revision: product.revision }],
    }
    const id = await call('create_supplier_purchase', args)
    expect(await call('create_supplier_purchase', args)).toBe(id)
    purchases.push(id)
  }
  const stock = () => fixture.read<Array<{ product_id: string; quantity_on_hand: number; inventory_value: number }>>(fixture.owner, 'product_stock', {
    select: 'product_id,quantity_on_hand,inventory_value', order: 'product_id.asc', shop_id: `eq.${fixture.shopId}`, product_id: `in.(${Object.values(products).map(product => product.id).join(',')})`,
  })
  const initial = await stock()
  expect(initial).toHaveLength(3)
  for (const [key, quantity, value] of [['cable', 200, 5500], ['copper', 5, 500], ['breaker', 10, 1000]] as const) {
    const row = initial.find(row => row.product_id === products[key].id)!
    expect(Number(row.quantity_on_hand)).toBe(quantity)
    expect(Number(row.inventory_value)).toBe(value)
  }
  return { ...fixture, products, stock }
}
