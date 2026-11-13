import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const selection = {
  customer: { id: 'customer-1', name: 'أحمد محمد' },
  services: [
    { id: 'service-hair', name: 'قص الشعر', unitPrice: 100, discount: 0 },
    { id: 'service-beard', name: 'حلاقة الذقن', unitPrice: 100, discount: 0 },
  ],
  paymentMethod: null,
}
const prompt = 'عميل اسمه احمد محمد عمل شعر ودقن'

test('an HQ reply prefills POS, waits for payment, and opens one printable receipt', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { calls } = await pilotFixture(page, 'en')
  await page.route('**/api/assistant/hq/access', route => route.fulfill({ json: { enabled: true, agentName: 'Shop Suit Agent' } }))
  await page.route('**/api/assistant/hq/requests', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      shopId: 'shop-1', locationId: 'location-1', messages: [{ role: 'user', content: prompt }],
    })
    return route.fulfill({ status: 202, json: { jobId: 'synthetic-hq-sale' } })
  })
  await page.route('**/api/assistant/hq/result', route => route.fulfill({
    json: { state: 'completed', sale: { kind: 'ready', selection } },
  }))

  await fixtureGoto(page, '/assistant')
  const composer = page.getByRole('textbox', { name: 'Your message' })
  await composer.fill(prompt)
  await composer.press('Enter')
  await expect(page).toHaveURL(/\/pos$/)
  const cart = page.getByRole('region', { name: 'Current sale', exact: true })
  await expect(cart.getByText(selection.services[0]!.name, { exact: true })).toBeVisible()
  await expect(cart.getByText(selection.services[1]!.name, { exact: true })).toBeVisible()
  expect(calls.some(call => ['save_pos_sale_draft', 'checkout_pos_sale'].includes(call.name))).toBe(false)

  await cart.getByRole('button', { name: 'Continue to payment' }).click()
  const pay = cart.getByRole('button', { name: /^Pay / })
  await expect(pay).toBeDisabled()
  await cart.getByText('Optional details', { exact: true }).click()
  await expect(cart.getByRole('combobox', { name: 'Customer', exact: true })).toContainText(selection.customer.name)
  await cart.getByRole('radio', { name: 'Cash', exact: true }).check()
  await expect(pay).toBeEnabled()
  await pay.click()

  await expect(page).toHaveURL(/\/sales\/sale-1\/receipt\?origin=pos$/)
  await expect(page.getByRole('button', { name: 'Print receipt', exact: true })).toBeEnabled()
  expect(calls.filter(call => call.name === 'save_pos_sale_draft')).toMatchObject([{
    args: {
      p_customer_id: selection.customer.id,
      p_location_id: 'location-1',
      p_lines: selection.services.map(service => ({ item_type: 'service', source_id: service.id, quantity: 1 })),
    },
  }])
  expect(calls.filter(call => call.name === 'checkout_pos_sale')).toMatchObject([{
    args: { p_invoice_id: 'sale-1', p_method: 'cash', p_amount: 200 },
  }])
})
