import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) {
  test(`issued receipt preserves three-decimal currency through language and paper changes: ${locale}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width: ar ? 390 : 1440, height: 900 })
    await pilotFixture(page, locale, 'owner', name => name === 'get_location_sale_receipt' ? {
      version: 1, invoiceId: 'sale-1', invoiceNumber: 'PRECISION-001', issuedAt: '2026-10-01T12:00:00Z', currency: 'KWD',
      business: { name: 'Issued snapshot business', address: null, phone: null },
      location: { name: 'Issued snapshot location', code: 'MAIN', address: null, phone: null },
      staffName: null, customer: { name: null, phone: null },
      lines: [{ id: 'line-1', itemType: 'service', name: 'Issued service', sku: null, quantity: 1, unitPrice: 1.234, discount: 0, total: 1.234 }],
      payments: [{ id: 'payment-1', amount: 1.234, method: 'cash', reference: null, paidAt: '2026-10-01T12:00:00Z' }],
      subtotal: 1.234, discount: 0, total: 1.234, footer: 'Issued snapshot footer', paperSize: 'thermal_80',
    } : undefined)
    await fixtureGoto(page, '/sales/sale-1/receipt')
    const document = page.locator('.bs-printable-document')
    await expect(document).toContainText(ar ? '١٫٢٣٤' : '1.234')
    // Unit price, line total, subtotal, total and payment retain the issued amount.
    expect((await document.innerText()).split(ar ? '١٫٢٣٤' : '1.234').length - 1).toBe(5)
    await page.getByRole('radio', { name: ar ? 'English' : 'العربية', exact: true }).check()
    await expect(document).toContainText(ar ? '1.234' : '١٫٢٣٤')
    await expect(document).toContainText('Issued snapshot business')
    await expect(document).toContainText('Issued snapshot footer')
    await page.getByRole('combobox', { name: ar ? 'مقاس ورق الطباعة' : 'Print paper size', exact: true }).click()
    await page.getByRole('option', { name: 'A4 / PDF', exact: true }).click()
    await expect(document).toHaveAttribute('data-format', 'a4')
    await expect(document).toContainText(ar ? '1.234' : '١٫٢٣٤')
    await expectNoPageOverflow(page)
  })
}

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`receipt preview and print isolation: ${locale}/${theme}/${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'get_location_sale_receipt') return {
        version: 1, invoiceId: 'sale-1', invoiceNumber: 'CLOUD-001', issuedAt: '2026-10-01T12:00:00Z', currency: 'EGP',
        business: { name: 'Synthetic shop', address: 'Synthetic address', phone: '01000000000' },
        location: { name: 'Synthetic branch', code: 'MAIN', address: null, phone: null }, staffName: 'Synthetic cashier', customer: { name: null, phone: null },
        lines: [{ id: 'line-1', itemType: 'product', name: 'LongUnbrokenCatalogItemNameToVerifyNarrowPaperContainment', sku: 'SKU-001', quantity: 2, unitPrice: 123456.78, discount: 0, total: 246913.56 }],
        payments: [{ id: 'payment-1', amount: 246913.56, method: 'cash', reference: null, paidAt: '2026-10-01T12:00:00Z' }],
        subtotal: 246913.56, discount: 0, total: 246913.56, footer: 'Synthetic receipt footer', paperSize: 'thermal_80',
      }
      return undefined
    })
    await fixtureGoto(page, '/sales/sale-1/receipt?origin=pos')
    const document = page.locator('.bs-printable-document')
    await expect(document).toBeVisible()
    expect(calls.find(call => call.name === 'get_location_sale_receipt')?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_invoice_id: 'sale-1' })
    await expect(page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })).toBeEnabled()
    await expect(document).not.toContainText(ar ? 'نسخة / إعادة طباعة' : 'REPRINT / COPY')
    await expectNoPageOverflow(page)
    await page.getByRole('combobox', { name: ar ? 'مقاس ورق الطباعة' : 'Print paper size', exact: true }).click()
    await page.getByRole('option', { name: 'A4 / PDF', exact: true }).click()
    await expect(document).toHaveAttribute('data-format', 'a4')
    await expectNoPageOverflow(page)
    if ((locale === 'en' && theme === 'light' && width === 1440) || (locale === 'ar' && theme === 'dark' && width === 390)) {
      await page.screenshot({ path: `.local/cloud-evidence/receipt-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
    const dimensions = await document.evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(Math.ceil(dimensions.width) + 1)
    await page.getByRole('radio', { name: ar ? 'English' : 'العربية', exact: true }).check()
    await expect(document).toHaveAttribute('lang', ar ? 'en' : 'ar')
    await expect(document).toHaveAttribute('dir', ar ? 'ltr' : 'rtl')
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.bs-print-actions')).toBeHidden()
    await expect(document).toBeVisible()
    expect(await document.evaluate(el => el.getBoundingClientRect().width)).toBeCloseTo(793.7, 0)
    await page.emulateMedia({ media: 'screen' })
    await fixtureGoto(page, '/sales/sale-1/receipt')
    await expect(document).toContainText(ar ? 'نسخة / إعادة طباعة' : 'REPRINT / COPY')
  })
}

test('unavailable snapshots keep print and share disabled', async ({ page }) => {
  await pilotFixture(page, 'en', 'owner', name => name === 'get_location_sale_receipt' ? null : undefined)
  await fixtureGoto(page, '/sales/sale-1/receipt')
  await expect(page.getByText(/A receipt is available after an issued sale is fully paid/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reprint receipt', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Share receipt', exact: true })).toBeDisabled()
})
