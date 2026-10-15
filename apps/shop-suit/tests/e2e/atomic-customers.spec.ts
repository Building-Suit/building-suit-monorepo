import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`customer directory adapter: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'customer_access') return [{ can_view: true, can_manage: true }]
      if (name === 'list_customers') return { items: [{ id: 'customer-1', name: 'Fixture customer', phone: '0123', email: 'fixture@example.test', is_active: true, updated_at: '2026-01-01T00:00:00Z' }], total: 1, page: 1, pageSize: 20, canManage: true }
      if (name === 'save_customer') return 'customer-created'
      return undefined
    })
    await fixtureGoto(page, '/customers')
    const ar = locale === 'ar'
    await expect(page.getByRole('link', { name: 'Fixture customer', exact: true })).toBeVisible()
    await page.getByRole('searchbox', { name: ar ? 'ابحث بالاسم أو الهاتف أو البريد' : 'Search name, phone, or email', exact: true }).fill('  Fixture  ')
    await expect.poll(() => calls.some(call => call.name === 'list_customers' && call.args.p_search === 'Fixture')).toBe(true)
    await page.getByRole('button', { name: ar ? 'إضافة عميل' : 'Add customer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    await dialog.getByLabel(ar ? 'اسم العميل' : 'Customer name', { exact: true }).fill('New customer')
    await dialog.getByLabel(ar ? 'البريد الإلكتروني' : 'Email', { exact: true }).fill('new@example.test')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/customers-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'حفظ العميل' : 'Save customer', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const command = calls.find(call => call.name === 'save_customer')!
    expect(command.args).toEqual({ p_shop_id: 'shop-1', p_customer_id: null, p_name: 'New customer', p_phone: null, p_email: 'new@example.test', p_address: null, p_notes: null })
  })
}

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`customer profile allocation adapter: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'get_customer') return [{ id: 'customer-1', name: 'Fixture customer', phone: '0123', email: 'fixture@example.test', is_active: true, can_manage: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', archived_at: null }]
      if (name === 'payment_access') return [{ can_receive: true }]
      if (name === 'customer_statement') return { items: [{ event_id: 'event-1', event_type: 'sale', event_at: '2026-01-01T00:00:00Z', invoice_id: 'invoice-1', document_number: 'SALE-FIXTURE', debit: 100, credit: 0, running_balance: 100 }], total: 1, page: 1, pageSize: 20, outstanding: 100 }
      if (name === 'list_outstanding_invoices') return { items: [{ id: 'invoice-1', invoice_number: 'SALE-FIXTURE', total_amount: 100, outstanding: 100, due_date: null, settlement_state: 'unpaid', overdue: false }], total: 1 }
      if (name === 'record_customer_receipt') return 'receipt-created'
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/customers/customer-1')
    await expect(page.getByRole('heading', { name: 'Fixture customer', exact: true })).toBeVisible()
    await page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    await dialog.getByRole('spinbutton', { name: `SALE-FIXTURE ${ar ? 'المبلغ' : 'Amount'}`, exact: true }).fill('25')
    await expect(dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true })).toBeEnabled()
    await expect.poll(() => dialog.evaluate(element => getComputedStyle(element.parentElement!).opacity)).toBe('1')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/customer-profile-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const command = calls.find(call => call.name === 'record_customer_receipt')!
    expect(command.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
    expect(command.args.p_shop_id).toBe('shop-1')
    expect(command.args.p_customer_id).toBe('customer-1')
    expect(command.args.p_amount).toBe(25)
    expect(command.args.p_method).toBe('cash')
    expect(command.args.p_allocations).toEqual([{ invoice_id: 'invoice-1', amount: 25 }])
  })

  test(`receipt adapter print and share: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => {
      localStorage.setItem('building-suit.theme', value)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (items: ClipboardItem[]) => { const image = await items[0]!.getType('image/png'); sessionStorage.setItem('fixture-share', JSON.stringify({ type: image.type, size: image.size })) } } })
      window.print = () => { sessionStorage.setItem('fixture-print', 'printed') }
    }, theme)
    await pilotFixture(page, locale)
    await fixtureGoto(page, '/sales/sale-1/receipt?origin=pos')
    const ar = locale === 'ar'
    const receipt = page.locator('.bs-printable-document')
    await expect(receipt.getByText('SALE-1', { exact: true })).toBeVisible()
    await expect(receipt).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
    await expect.poll(() => receipt.locator('.bs-receipt-lines').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true }).click()
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('fixture-print'))).toBe('printed')
    await expect(page.getByText(ar ? 'نسخة / إعادة طباعة' : 'REPRINT / COPY', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: ar ? 'نسخ صورة الإيصال' : 'Copy receipt image', exact: true }).click()
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-share') || '{}').type)).toBe('image/png')
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-share') || '{}').size)).toBeGreaterThan(1000)
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/receipt-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.emulateMedia({ media: 'print' })
    await expect.poll(() => receipt.locator('.bs-receipt-lines').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/receipt-print-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.emulateMedia({ media: 'screen' })
    await page.getByRole('combobox', { name: ar ? 'مقاس ورق الطباعة' : 'Print paper size', exact: true }).click()
    await page.getByRole('option', { name: 'A4 / PDF', exact: true }).click()
    await expect(receipt).toHaveAttribute('data-format', 'a4')
    await page.emulateMedia({ media: 'print' })
    await expect.poll(() => receipt.locator('.bs-receipt-lines').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.emulateMedia({ media: 'screen' })

  })
}
