import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`approved dashboard ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Main shop', business_mode: 'product', status: 'active', created_at: '2026-01-01' }]
      if (name === 'list_shop_locations') return ['Main branch', 'Second branch'].map((name, index) => ({ id: `location-${index + 1}`, shop_id: 'shop-1', name, status: 'active', is_default: index === 0 }))
      if (name === 'shop_permission_access') return { 'reports.view': true, 'reports.cost_profit.view': true }
      if (name === 'shop_operating_report') return { locationId: args.p_location_id, period: args.p_period, fromDate: '2026-10-12', toDateExclusive: '2026-10-13', canViewCosts: true, sales: 24800, saleCount: 64, averageTicket: 387.5, paymentsIn: 23600, salesMix: [{ type: 'product', amount: 18600, quantity: 48 }, { type: 'service', amount: 6200, quantity: 16 }], paymentMix: [{ method: 'cash', collected: 14400, refunded: 240, net: 14160, count: 1 }, { method: 'card', collected: 9600, refunded: 160, net: 9440, count: 1 }], outstanding: { amount: 7200, customerCount: 2, customers: [{ customerId: 'customer-1', name: 'Sample customer A', amount: 4800 }, { customerId: 'customer-2', name: 'Sample customer B', amount: 2400 }] }, expenses: { amount: 2400, count: 12, operatingBalance: 22400 }, appointments: { total: 16, completed: 12, cancelled: 2, noShow: 2, busiestTimes: [{ hour: 8, count: 4 }, { hour: 12, count: 5 }] }, cash: { closedShifts: 2, expected: 14160, counted: 14160, variance: 0 }, staff: [{ membershipId: 'member-1', name: 'Sample staff A', sales: 14800, saleCount: 38, serviceCount: 10 }, { membershipId: 'member-2', name: 'Sample staff B', sales: 10000, saleCount: 26, serviceCount: 6 }], locations: [{ locationId: 'location-1', name: 'Main branch', sales: 14800, saleCount: 38, collections: 14000, expenses: 1400, cashVariance: 0 }, { locationId: 'location-2', name: 'Second branch', sales: 10000, saleCount: 26, collections: 9600, expenses: 1000, cashVariance: 0 }] }
      if (name === 'shop_operational_report') return { items: [], total: 0, summary: { payable: 9800, lowStockCount: 7, inventoryValue: 86400, margin: 6750 } }
      if (name === 'list_location_sales') return { items: [], total: 0 }
      return undefined
    })
    await fixtureGoto(page, '/dashboard')
    await page.locator('input[type=date]').fill('2026-10-12')
    await expect(page.locator('.bs-dashboard-metric')).toHaveCount(10)
    const notice = page.locator('.bs-dashboard-metrics-notice')
    await expect(notice).toContainText(locale === 'ar' ? 'مش حساب للربح' : 'not accounting profit')
    await expect(page.locator('[data-setup-checklist]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Sample customer A', exact: true })).toHaveAttribute('href', '/customers/customer-1')
    if (width === 1440) {
      const heights = await page.locator('.bs-dashboard-metric').evaluateAll(nodes => nodes.slice(0, 4).map(node => node.getBoundingClientRect().height))
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(144)
      expect(new Set(heights).size).toBe(1)
    }
    await expectNoPageOverflow(page)
    await page.locator('input[type=date]').blur()
    await page.screenshot({ path: test.info().outputPath('dashboard.png'), fullPage: true })
    await page.getByRole('button', { name: locale === 'ar' ? 'أسبوع' : 'Week', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'shop_operating_report').at(-1)?.args.p_period).toBe('week')
    await page.getByRole('button', { name: 'Main branch', exact: true }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/sales')
    expect(new URL(page.url()).searchParams.get('from')).toBe('2026-10-12')
    expect(new URL(page.url()).searchParams.get('to')).toBe('2026-10-12')
  })
}
