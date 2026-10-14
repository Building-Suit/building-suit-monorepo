import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

async function profileFixture(page: Page, locale: string, state = 'active') {
  await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), locale === 'ar' ? 'dark' : 'light')
  const customer = { id: 'customer-1', name: 'Fixture customer', phone: '0123', email: 'fixture@example.test', is_active: state !== 'archived', can_manage: state !== 'view-only', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', archived_at: state === 'archived' ? '2026-10-13T08:00:00Z' : null }
  const fixture = await pilotFixture(page, locale, 'owner', name => {
    if (name === 'get_customer') return state === 'not-found' ? [] : [customer]
    if (name === 'payment_access') return [{ can_receive: state !== 'view-only' }]
    if (state === 'empty' && name === 'customer_statement') return { items: [], total: 0, outstanding: 0 }
    if (state === 'empty' && name === 'list_outstanding_invoices') return { items: [], total: 0 }
    if (name === 'customer_statement') return { items: [{ event_id: 'event-1', event_type: 'sale', event_at: '2026-10-13T08:00:00Z', invoice_id: 'invoice-1', document_number: 'SALE-FIXTURE', debit: 100, credit: 0, running_balance: 100 }], total: 1, outstanding: 100 }
    if (name === 'list_outstanding_invoices') return { items: [{ id: 'invoice-1', invoice_number: 'SALE-FIXTURE', total_amount: 100, outstanding: 100, settlement_state: 'unpaid', overdue: true }], total: 1 }
    if (name === 'record_customer_receipt') return 'receipt-1'
    if (name === 'archive_customer') { customer.is_active = false; customer.archived_at = '2026-10-13T08:00:00Z'; return customer.id }
    return undefined
  })
  return { ...fixture, customer }
}

for (const locale of ['en', 'ar'] as const) {
  const ar = locale === 'ar'

  for (const rpc of ['customer_statement', 'list_outstanding_invoices']) {
    test(`profile ${rpc} failure and pending retry ${locale}`, async ({ page }) => {
      await profileFixture(page, locale)
      let fail = true
      let releaseRead!: () => void
      let gate = Promise.resolve()
      await fixtureRoute(page, `**/rest/v1/rpc/${rpc}`, async route => { if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic read failure' } }); await gate; return route.fallback() })
      await fixtureGoto(page, '/customers/customer-1')
      const heading = rpc === 'customer_statement' ? (ar ? 'كشف حساب العميل' : 'Customer statement') : (ar ? 'مبالغ مستحقة من العملاء' : 'Receivables')
      const section = page.locator('section.bs-panel').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
      await expect(section.getByRole('alert')).toBeVisible()
      await expect(section.getByRole('table')).toHaveCount(0)
      const receivables = page.locator('section.bs-panel').filter({ has: page.getByRole('heading', { name: ar ? 'مبالغ مستحقة من العملاء' : 'Receivables', exact: true }) })
      if (rpc === 'customer_statement') await expect(receivables.locator('.bs-text--size-lg')).toHaveCount(0)
      else {
        await expect(receivables.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true })).toHaveCount(0)
        await expect(receivables.getByText(/0 overdue|٠ مستند/)).toHaveCount(0)
      }
      fail = false
      gate = new Promise<void>(resolve => { releaseRead = resolve })
      await section.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
      await expect(section.getByRole('status', { name: heading, exact: true })).toBeVisible()
      await expect(section.getByRole('table')).toHaveCount(0)
      await expect(section.getByRole('alert')).toHaveCount(0)
      releaseRead()
      await expect(section.getByRole('table')).toBeVisible()
      await expect(section.getByText('SALE-FIXTURE', { exact: true })).toBeVisible()
      if (rpc === 'list_outstanding_invoices') await expect(receivables.getByText(ar ? '1 مستند متأخر' : '1 overdue document', { exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
    })
  }

  test(`allocation overpayment recovery and archive ${locale}`, async ({ page }) => {
    const { calls } = await profileFixture(page, locale)
    await fixtureGoto(page, '/customers/customer-1')
    await page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true })
    const allocation = dialog.getByRole('spinbutton', { name: `SALE-FIXTURE ${ar ? 'المبلغ' : 'Amount'}`, exact: true })
    await allocation.fill('101')
    const save = dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true })
    await save.click()
    expect(await allocation.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false)
    expect(calls.filter(call => call.name === 'record_customer_receipt')).toHaveLength(0)
    await allocation.fill('25')
    await fixtureRoute(page, '**/rest/v1/rpc/record_customer_receipt', route => route.fulfill({ status: 400, json: { message: 'PAYMENT_OVERPAYMENT_REJECTED' } }))
    await save.click()
    await expect(dialog.getByRole('alert')).toContainText(ar ? 'المبلغ أكبر من الرصيد المستحق المعتمد.' : 'The amount exceeds the authoritative outstanding balance.')
    await expect(allocation).toHaveValue('25')
    await page.screenshot({ path: test.info().outputPath('allocation-error.png'), fullPage: true, animations: 'disabled' })
    await fixtureUnroute(page, '**/rest/v1/rpc/record_customer_receipt')
    let releaseSave!: () => void
    const gate = new Promise<void>(resolve => { releaseSave = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/record_customer_receipt', async route => { await gate; await route.fallback() })
    await save.click()
    await expect(dialog).toHaveAttribute('aria-busy', 'true')
    await expect(save).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    releaseSave()
    await expect(dialog).toHaveCount(0)
    expect(calls.filter(call => call.name === 'record_customer_receipt').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_customer_id: 'customer-1', p_amount: 25, p_allocations: [{ invoice_id: 'invoice-1', amount: 25 }] })
    const archive = page.getByRole('button', { name: ar ? 'أرشفة' : 'Archive', exact: true })
    await archive.click()
    const confirmation = page.getByRole('dialog', { name: ar ? 'أرشفة' : 'Archive', exact: true })
    await expect(confirmation).toContainText('Fixture customer')
    await confirmation.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
    expect(calls.filter(call => call.name === 'archive_customer')).toHaveLength(0)
    await archive.click()
    await confirmation.getByRole('button', { name: ar ? 'أرشفة' : 'Archive', exact: true }).click()
    await expect(archive).toHaveCount(0)
    await expect(page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true })).toHaveCount(0)
    await expectNoPageOverflow(page)
  })

  for (const state of ['archived', 'view-only', 'not-found', 'denied', 'load-failed']) {
    test(`customer profile ${state} ${locale}`, async ({ page }) => {
      const { calls } = await profileFixture(page, locale, state)
      if (state === 'denied' || state === 'load-failed') await fixtureRoute(page, '**/rest/v1/rpc/get_customer', route => route.fulfill({ status: state === 'denied' ? 403 : 503, json: { message: state === 'denied' ? 'SHOP_PERMISSION_DENIED' : 'Synthetic failure' } }))
      await fixtureGoto(page, '/customers/customer-1')
      for (const label of [ar ? 'تعديل' : 'Edit', ar ? 'أرشفة' : 'Archive', ar ? 'تسجيل تحصيل' : 'Record receipt']) await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
      if (state === 'not-found') await expect(page.getByText(ar ? 'العميل ده مش موجود في المتجر المختار.' : 'This customer was not found in the selected shop.', { exact: true })).toBeVisible()
      if (state === 'denied' || state === 'load-failed') await expect(page.getByRole('alert')).toContainText(state === 'denied' ? (ar ? 'معندكش صلاحية تشوف' : 'permission to view') : (ar ? 'مقدرناش نحمّل بيانات العميل' : 'Could not load this customer'))
      if (state === 'archived' || state === 'view-only') await expect(page.getByRole('heading', { name: 'Fixture customer', exact: true })).toBeVisible()
      expect(calls.filter(call => /^(save_customer|archive_customer|record_customer_receipt)$/.test(call.name))).toHaveLength(0)
    })
  }
  test(`customer profile confirmed empty accounts ${locale}`, async ({ page }) => {
    await profileFixture(page, locale, 'empty')
    await fixtureGoto(page, '/customers/customer-1')
    await expect(page.getByText(ar ? 'مفيش مبالغ مستحقة.' : 'No outstanding documents.', { exact: true })).toBeVisible()
    await expect(page.getByText(ar ? 'مفيش حركات في كشف الحساب لسه.' : 'No statement activity yet.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
