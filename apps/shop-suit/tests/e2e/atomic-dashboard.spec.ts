import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`operating dashboard amounts and location source query: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_permission_access') return { 'reports.view': true, 'reports.cost_profit.view': true }
      if (name === 'shop_operating_report') return { locationId: args.p_location_id, period: args.p_period, fromDate: '2026-10-01', toDateExclusive: '2026-10-03', canViewCosts: true, sales: 125, saleCount: 2, averageTicket: 62.5, paymentsIn: 100, salesMix: [{ type: 'service', amount: 125, quantity: 2 }], paymentMix: [{ method: 'cash', collected: 100, refunded: 0, net: 100, count: 1 }], outstanding: { amount: 25, customerCount: 1, customers: [{ customerId: 'customer-1', name: 'Fixture customer', amount: 25 }] }, expenses: { amount: 10, count: 1, operatingBalance: 115 }, appointments: { total: 2, completed: 1, cancelled: 0, noShow: 0, busiestTimes: [{ hour: 10, count: 2 }] }, cash: { closedShifts: 1, expected: 100, counted: 100, variance: 0 }, staff: [{ membershipId: 'member-1', name: 'Fixture staff', sales: 125, saleCount: 2, serviceCount: 2 }], locations: [{ locationId: 'location-1', name: 'First branch', sales: 125, saleCount: 2, collections: 100, expenses: 10, cashVariance: 0 }] }
      if (name === 'shop_operational_report') return { items: [], total: 0, summary: { payable: 20, lowStockCount: 1, inventoryValue: 200, margin: 30 } }
      if (name === 'list_location_sales') return { items: [], total: 0 }
      return undefined
    })
    await fixtureGoto(page, '/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: ar ? 'لوحة التحكم' : 'Operating dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Fixture customer', exact: true })).toHaveAttribute('href', '/customers/customer-1')
    const staffRow = page.getByRole('row').filter({ hasText: 'Fixture staff' })
    await expect(staffRow).toContainText(/125|١٢٥/)
    await page.getByRole('button', { name: ar ? 'أسبوع' : 'Week', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'shop_operating_report').at(-1)?.args.p_period).toBe('week')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/dashboard-shop-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: 'First branch', exact: true }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/sales')
    expect(new URL(page.url()).searchParams.get('from')).toBe('2026-10-01')
    expect(new URL(page.url()).searchParams.get('to')).toBe('2026-10-02')
  })
}
