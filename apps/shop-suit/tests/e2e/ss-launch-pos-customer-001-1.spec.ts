import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'

const customers = Array.from({ length: 2000 }, (_, index) => ({ id: `customer-${index}`, name: `Customer ${index}`, phone: `010${String(index).padStart(8, '0')}` }))
customers[0] = { id: 'customer-0', name: 'Ada · آدا', phone: '01012345678' }
const service = { id: 'service-1', name: 'Haircut', itemType: 'service', unitPrice: 100, discount: 0, stock: null, sku: null, barcode: null }
const appointment = (customerId: string | null) => ({ id: 'appointment-1', staffId: 'membership-1', customerId, customerName: 'Booked customer', startsAt: '2026-10-09T10:00:00Z', status: 'arrived', service })
const staff = [{ id: 'membership-1', name: 'Pilot barber' }]

for (const locale of ['en', 'ar']) {
  const ar = locale === 'ar'
  const customerLabel = ar ? 'العميل' : 'Customer'
  for (const mobile of [false, true]) for (const theme of ['light', 'dark']) {
    test(`POS bounded customer picker ${locale} ${mobile ? 'mobile' : 'desktop'} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: 1000 })
      await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
        if (name !== 'pos_checkout_context') return undefined
        const query = String(args.p_customer_search ?? '').toLowerCase()
        return { staff, appointments: [appointment('customer-0')], customers: query.length < 2 ? [] : customers.filter(customer => `${customer.name} ${customer.phone}`.toLowerCase().includes(query)).slice(0, 20) }
      })
      await fixtureGoto(page, '/pos')
      const picker = page.getByRole('combobox', { name: customerLabel, exact: true })
      await expect(picker).toBeVisible()
      await page.keyboard.press('F4')
      await expect(picker).toBeFocused()
      await page.keyboard.press('ArrowDown')
      const search = page.getByRole('searchbox', { name: `${ar ? 'بحث' : 'Search'} · ${customerLabel}`, exact: true })
      await expect(search).toBeFocused()
      await search.fill('A')
      await expect(page.locator('[role="option"][aria-selected]')).toHaveCount(0)
      await search.fill('Ada')
      await expect(page.getByRole('option', { name: /Ada/ })).toBeVisible()
      expect(calls.filter(call => call.name === 'pos_checkout_context').at(-1)?.args.p_customer_search).toBe('Ada')
      await page.screenshot({ path: testInfo.outputPath('customer-search.png'), fullPage: false })
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(picker).toContainText('Ada · آدا · 01012345678')
      await expect(picker).toBeFocused()
      await page.screenshot({ path: testInfo.outputPath('customer-selected.png'), fullPage: false })
      await page.getByRole('button', { name: ar ? 'إلغاء اختيار العميل' : 'Clear customer', exact: true }).click()
      await expect(picker).toContainText(ar ? 'بدون عميل' : 'No customer')
      await picker.click()
      await search.fill('01012345678')
      await expect(page.getByRole('option', { name: /Ada/ })).toBeVisible()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(picker).toContainText('01012345678')
      await page.getByRole('button', { name: ar ? 'إلغاء اختيار العميل' : 'Clear customer', exact: true }).click()
      await picker.click()
      await search.fill('Customer')
      await expect(page.locator('[role="option"][aria-selected]')).toHaveCount(20)
      await search.fill('zzzz')
      await expect(page.locator('[role="option"][aria-selected]')).toHaveCount(0)
      await expect(page.getByText(ar ? 'لا يوجد عملاء مطابقون.' : 'No matching customers.', { exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(picker).toBeFocused()
      await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

      await page.getByRole('button', { name: /Haircut/ }).click()
      await page.getByRole('button', { name: ar ? 'بدون عميل — بيع كاونتر مسدد بالكامل' : 'No customer — fully paid counter sale', exact: true }).click()
      await expect(page.getByRole('button', { name: ar ? /^حصّل / : /^Pay / })).toBeEnabled()
      await page.keyboard.press('F8')
      await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(page).toHaveURL(/\/receipt\?origin=pos/)
      expect(calls.find(call => call.name === 'save_pos_sale_draft')?.args.p_customer_id).toBeNull()
      expect(calls.some(call => call.name === 'checkout_pos_sale')).toBe(true)
      expect(calls.filter(call => call.name === 'pos_checkout_context').every(call => call.args.p_customer_search === null || String(call.args.p_customer_search).length >= 2)).toBe(true)
      expect(calls.some(call => call.name === 'clients')).toBe(false)
    })
  }
  test(`Selected customer is sent to checkout ${locale}`, async ({ page }) => {
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => name === 'pos_checkout_context' ? { staff, appointments: [], customers: args.p_customer_search ? [customers[0]] : [] } : undefined)
    await fixtureGoto(page, '/pos')
    await page.getByRole('combobox', { name: customerLabel, exact: true }).click()
    await page.getByRole('searchbox', { name: `${ar ? 'بحث' : 'Search'} · ${customerLabel}`, exact: true }).fill('Ada')
    await page.getByRole('option', { name: /Ada/ }).click()
    await page.getByRole('button', { name: /Haircut/ }).click()
    await expect(page.getByRole('button', { name: ar ? /^حصّل / : /^Pay / })).toBeEnabled()
    await page.keyboard.press('F8')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/receipt\?origin=pos/)
    expect(calls.find(call => call.name === 'save_pos_sale_draft')?.args.p_customer_id).toBe('customer-0')
  })
  for (const customerId of ['customer-0', null]) {
    test(`Appointment customer context locked ${locale} ${customerId ?? 'walk-in'}`, async ({ page }) => {
      const { calls } = await pilotFixture(page, locale, 'owner', name => name === 'pos_checkout_context' ? { staff, appointments: [appointment(customerId)], customers: [] } : undefined)
      await fixtureGoto(page, '/pos?appointment=appointment-1')
      const picker = page.getByRole('combobox', { name: customerLabel, exact: true })
      await expect(picker).toHaveAttribute('aria-disabled', 'true')
      await expect(picker).toContainText('Booked customer')
      await expect(page.getByRole('button', { name: customerId ? (ar ? 'إلغاء اختيار العميل' : 'Clear customer') : (ar ? 'بدون عميل — بيع كاونتر مسدد بالكامل' : 'No customer — fully paid counter sale'), exact: true })).toBeDisabled()
      await page.keyboard.press('F8')
      await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(page).toHaveURL(/\/receipt\?origin=pos/)
      expect(calls.find(call => call.name === 'save_pos_sale_draft')?.args).toMatchObject({ p_customer_id: customerId, p_appointment_id: 'appointment-1', p_staff_membership_id: 'membership-1' })
    })
  }
  test(`Search loading, failure, denied and retry ${locale}`, async ({ page }, testInfo) => {
    await pilotFixture(page, locale)
    await fixtureGoto(page, '/pos')
    let release: (() => void) | undefined
    await fixtureRoute(page, '**/rest/v1/rpc/pos_checkout_context', async route => {
      await new Promise<void>(resolve => { release = resolve })
      await route.fulfill({ json: { staff, appointments: [], customers: [customers[0]] } })
    })
    await page.getByRole('combobox', { name: customerLabel, exact: true }).click()
    const search = page.getByRole('searchbox', { name: `${ar ? 'بحث' : 'Search'} · ${customerLabel}`, exact: true })
    await search.fill('Ada')
    await expect.poll(() => Boolean(release)).toBe(true)
    await expect(page.locator('[role="option"][aria-selected]')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('customer-loading.png'), fullPage: false })
    release!()
    await expect(page.getByRole('option', { name: /Ada/ })).toBeVisible()
    await fixtureUnroute(page, '**/rest/v1/rpc/pos_checkout_context')
    for (const denied of [false, true]) {
      await fixtureRoute(page, '**/rest/v1/rpc/pos_checkout_context', route => route.fulfill({ status: denied ? 403 : 500, json: { message: denied ? 'SHOP_PERMISSION_DENIED' : 'Unavailable' } }))
      await search.fill(denied ? 'Ali' : 'Bob')
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.locator('[role="option"][aria-selected]')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(denied ? 'customer-denied.png' : 'customer-error.png'), fullPage: false })
      await fixtureUnroute(page, '**/rest/v1/rpc/pos_checkout_context')
    }
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
