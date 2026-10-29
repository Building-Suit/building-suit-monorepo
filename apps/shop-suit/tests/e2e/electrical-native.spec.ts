import { expect, test } from '@playwright/test'
import { electricalBackendFixture } from './electrical-native-fixture'
import { login } from './pilot-backend'
import { addElectricalItem } from './electrical-native-controls'
import { apiUrl } from '../pilot/local-backend.mjs'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

type Receipt = { currency: string; total: number; lines: Array<{ name: string; measurement: { enteredQuantity: string; enteredUnitCode: string; baseQuantity: string; baseUnitCode: string } }>; payments: Array<{ amount: number; method: string }> }
type Movement = { quantity_change: number; unit_cost_snapshot: number; batch_id: string }

// No page.route, mocked Auth or fabricated financial response. Missing native
// setup fails the fixture; this suite has no skip/hosted fallback or reset path.
for (const locale of ['en', 'ar']) {
  test(`real Auth, measured payment, FIFO and frozen receipts: ${locale}`, async ({ page }) => {
    const fixture = await electricalBackendFixture()
    const ar = locale === 'ar'
    const location = fixture.locations[0]!
    await page.setViewportSize({ width: 1440, height: 1000 })
    await login(page, fixture.owner, locale)
    await page.goto('/pos')
    const cart = page.locator('.bs-pos-cart')

    const add = (product: { name: string }, quantity: string, gram = false) => addElectricalItem(page, locale, product, quantity, gram)

    async function checkout(total: number) {
      await page.keyboard.press('F4')
      await page.getByRole('button', { name: ar ? 'بدون عميل — بيع كاونتر مسدد بالكامل' : 'No customer — fully paid counter sale', exact: true }).click()
      await expect(cart.getByRole('button', { name: ar ? /^حصّل / : /^Pay / })).toBeEnabled()
      const saved = page.waitForResponse(response => response.url() === `${apiUrl}/rest/v1/rpc/save_pos_sale_draft` && response.request().method() === 'POST')
      const paid = page.waitForResponse(response => response.url() === `${apiUrl}/rest/v1/rpc/checkout_pos_sale` && response.request().method() === 'POST')
      await page.keyboard.press('F8')
      await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      const savedResponse = await saved
      expect(savedResponse.ok()).toBe(true)
      const payment = await paid
      expect(payment.ok()).toBe(true)
      // Inspect only a boolean; credentials must never appear in assertion logs.
      expect(payment.request().headers().authorization?.startsWith('Bearer ')).toBe(true)
      const invoiceId = await payment.json() as string
      expect(invoiceId).toMatch(/^[0-9a-f-]{36}$/)
      expect(await savedResponse.json()).toBe(invoiceId)
      const args = payment.request().postDataJSON() as Record<string, unknown>
      expect(args).toMatchObject({ p_shop_id: fixture.shopId, p_location_id: location.id, p_invoice_id: invoiceId, p_amount: total, p_method: 'cash' })
      await expect(page.getByRole('dialog').locator('[data-receipt-document]')).toBeVisible()
      expect(await fixture.rpc(fixture.owner, 'checkout_pos_sale', args)).toBe(invoiceId)
      const receiptArgs = { p_shop_id: fixture.shopId, p_location_id: location.id, p_invoice_id: invoiceId }
      const receipt = await fixture.rpc<Receipt>(fixture.owner, 'get_location_sale_receipt', receiptArgs)
      expect(receipt.currency).toBe('EGP')
      expect(Number(receipt.total)).toBe(total)
      expect(receipt.payments).toHaveLength(1)
      expect(Number(receipt.payments[0]!.amount)).toBe(total)
      expect(receipt.payments[0]!.method).toBe('cash')
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-receipt-document]')).toBeHidden()
      return { invoiceId, args, receipt, receiptArgs, savedArgs: savedResponse.request().postDataJSON() as Record<string, unknown> }
    }

    await add(fixture.products.cable, '12.5')
    await add(fixture.products.copper, '250', true)
    await add(fixture.products.breaker, '2')
    await expectNoPageOverflow(page)
    const first = await checkout(787.5)
    expect(first.savedArgs.p_lines).toEqual([
      { item_type: 'product', source_id: fixture.products.cable.id, quantity: '12.5', unit_code: 'm', measurement_revision: 1 },
      { item_type: 'product', source_id: fixture.products.copper.id, quantity: '250', unit_code: 'g', measurement_revision: 1 },
      { item_type: 'product', source_id: fixture.products.breaker.id, quantity: '2', unit_code: 'ea', measurement_revision: 1 },
    ])
    const cableLine = first.receipt.lines.find(line => line.name === fixture.products.cable.name)!
    const copperLine = first.receipt.lines.find(line => line.name === fixture.products.copper.name)!
    expect(cableLine.measurement).toMatchObject({ enteredQuantity: '12.5', enteredUnitCode: 'm', baseQuantity: '12.5', baseUnitCode: 'm' })
    expect(copperLine.measurement).toMatchObject({ enteredQuantity: '250', enteredUnitCode: 'g', baseQuantity: '0.25', baseUnitCode: 'kg' })
    const afterFirst = await fixture.stock()
    for (const [key, quantity, value] of [['cable', 187.5, 5187.5], ['copper', 4.75, 475], ['breaker', 8, 800]] as const) {
      const row = afterFirst.find(row => row.product_id === fixture.products[key].id)!
      expect(Number(row.quantity_on_hand)).toBe(quantity)
      expect(Number(row.inventory_value)).toBe(value)
    }
    const movements = (invoice: string) => fixture.read<Movement[]>(fixture.owner, 'inventory_movements', { select: 'quantity_change,unit_cost_snapshot,batch_id', shop_id: `eq.${fixture.shopId}`, reference_id: `eq.${invoice}`, product_id: `eq.${fixture.products.cable.id}`, movement_type: 'eq.out' })
    const firstMoves = await movements(first.invoiceId)
    expect(firstMoves.map(row => ({ quantity: Number(row.quantity_change), cost: Number(row.unit_cost_snapshot) }))).toEqual([{ quantity: -12.5, cost: 25 }])

    // Cross the first batch boundary:87.5m at25 plus12.5m at30, COGS2562.5.
    await add(fixture.products.cable, '100')
    const second = await checkout(3500)
    expect(second.invoiceId).not.toBe(first.invoiceId)
    const crossed = await movements(second.invoiceId)
    expect(crossed.map(row => ({ quantity: Number(row.quantity_change), cost: Number(row.unit_cost_snapshot) })).sort((a, b) => a.cost - b.cost)).toEqual([{ quantity: -87.5, cost: 25 }, { quantity: -12.5, cost: 30 }])
    expect(new Set(crossed.map(row => row.batch_id)).size).toBe(2)
    expect(crossed.reduce((sum, row) => sum - Number(row.quantity_change) * Number(row.unit_cost_snapshot), 0)).toBe(2562.5)
    const finalCable = (await fixture.stock()).find(row => row.product_id === fixture.products.cable.id)!
    expect(Number(finalCable.quantity_on_hand)).toBe(87.5)
    expect(Number(finalCable.inventory_value)).toBe(2625)

    // Keep historical quantities/prices immutable after a subsequent catalog edit.
    await fixture.rpc(fixture.owner, 'save_product', { p_shop_id: fixture.shopId, p_product_id: fixture.products.cable.id, p_name: fixture.products.cable.name, p_sku: 'NATIVE-cable', p_barcode: null, p_sale_price: 99 })
    expect(await fixture.rpc(fixture.owner, 'get_location_sale_receipt', first.receiptArgs)).toEqual(first.receipt)
    expect(await fixture.rpc(fixture.owner, 'get_location_sale_receipt', second.receiptArgs)).toEqual(second.receipt)
    expect(await fixture.rpc(fixture.owner, 'get_location_sale_receipt', { ...first.receiptArgs, p_location_id: fixture.locations[1]!.id })).toBeNull()
    const beforeDenial = await fixture.stock()
    const outsider = await fixture.account('electrical-outsider')
    await fixture.rpc(outsider, 'create_owner_shop', { p_shop_name: 'Separate native tenant', p_business_mode: 'product' })
    await expect(fixture.rpc(outsider, 'get_location_sale_receipt', first.receiptArgs)).rejects.toThrow(/failed \(403\)/)
    expect(await fixture.read(outsider, 'product_stock', { select: 'product_id', shop_id: `eq.${fixture.shopId}` })).toEqual([])
    await expect(fixture.rpc(outsider, 'configure_product_measurement', { p_shop_id: fixture.shopId, p_product_id: fixture.products.cable.id, p_unit: 'm', p_increment: '0.001', p_sale_units: ['m', 'cm'], p_reason: 'Forbidden cross-tenant write' })).rejects.toThrow(/failed \(403\)/)
    expect(await fixture.stock()).toEqual(beforeDenial)
    await page.reload()
    await expectNoPageOverflow(page)
    expect(await fixture.rpc(fixture.owner, 'get_location_sale_receipt', first.receiptArgs)).toEqual(first.receipt)
  })
}
