import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'

const snapshot = {
  version: 1, invoiceId: 'sale-1', invoiceNumber: 'SALE-000005', issuedAt: '2026-10-15T10:00:00Z', currency: 'EGP',
  business: { name: 'Actual Merchant', address: null, phone: null }, location: { name: 'Actual Branch', code: '01', address: 'District B', phone: '+201500240770' }, staffName: 'Cashier', customer: { name: 'Customer', phone: null },
  lines: [{ id: '1', itemType: 'service', name: 'خدمة / Service', sku: null, quantity: 2, unitPrice: 50, discount: 0, total: 100 }], payments: [{ id: '1', amount: 100, method: 'cash', reference: 'REF-1', paidAt: '2026-10-15T10:00:00Z' }], subtotal: 100, discount: 0, total: 100, footer: 'Configured merchant footer', paperSize: 'thermal_80',
}

for (const locale of ['en', 'ar']) test(`receipt image clipboard, explicit download and preserved print: ${locale}`, async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.addInitScript(() => { localStorage.setItem('building-suit.theme', 'dark'); window.print = () => { (window as unknown as { printCount: number }).printCount = ((window as unknown as { printCount: number }).printCount || 0) + 1 } })
  await pilotFixture(page, locale, 'owner', name => name === 'get_location_sale_receipt' ? snapshot : undefined)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await fixtureGoto(page, '/sales/sale-1/receipt?origin=pos')
  const receipt = page.locator('[data-receipt-document]')
  await expect(receipt.getByRole('heading', { name: 'Actual Merchant' })).toBeVisible()
  await expect(receipt.getByRole('heading', { name: 'Actual Branch' })).toBeVisible()
  await expect(receipt).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(receipt).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(receipt).toContainText('Configured merchant footer')
  const copyButton = page.getByRole('button', { name: locale === 'ar' ? 'نسخ صورة الإيصال' : 'Copy receipt image', exact: true })
  await copyButton.click()
  await expect(page.getByText(locale === 'ar' ? 'تم نسخ صورة الإيصال. يمكنك لصقها في واتساب.' : 'Receipt image copied. Paste it into WhatsApp.', { exact: true })).toBeVisible()
  const image = await page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const png = await items[0]!.getType('image/png')
    const bitmap = await createImageBitmap(png)
    return { types: items[0]!.types, width: bitmap.width, height: bitmap.height }
  })
  expect(image.types).toEqual(['image/png'])
  expect(image.width).toBeGreaterThanOrEqual(900)
  const height = await receipt.evaluate(node => node.scrollHeight)
  expect(image.height).toBeGreaterThanOrEqual(height * 3)
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError') } }) })
  await copyButton.click()
  const download = page.getByRole('button', { name: locale === 'ar' ? 'تنزيل صورة الإيصال' : 'Download receipt image', exact: true })
  await expect(download).toBeVisible()
  const saved = page.waitForEvent('download')
  await download.click()
  expect((await saved).suggestedFilename()).toBe('SALE-000005.png')
  await page.getByRole('button', { name: locale === 'ar' ? 'طباعة الإيصال' : 'Print receipt', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { printCount: number }).printCount)).toBe(1)
  await page.getByRole('combobox', { name: locale === 'ar' ? 'مقاس ورق الطباعة' : 'Print paper size' }).click()
  await page.getByRole('option', { name: 'A4 / PDF' }).click()
  await expect(page.locator('.bs-printable-document')).toHaveAttribute('data-format', 'a4')
})
