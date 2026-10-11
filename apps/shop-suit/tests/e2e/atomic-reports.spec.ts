import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`report table filters, pagination and CSV values: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_operating_report') return { locationId: args.p_location_id, period: args.p_period, fromDate: '2026-10-01', toDateExclusive: '2026-10-02', canViewCosts: false, sales: 0, saleCount: 0, averageTicket: 0, paymentsIn: 0, salesMix: [], paymentMix: [], outstanding: { amount: 0, customerCount: 0, customers: [] }, expenses: { amount: null, count: null, operatingBalance: null }, appointments: { total: 0, completed: 0, cancelled: 0, noShow: 0, busiestTimes: [] }, cash: { closedShifts: 0, expected: 0, counted: 0, variance: 0 }, staff: [], locations: [] }
      if (name === 'shop_permission_access') return { 'reports.view': true, 'reports.cost_profit.view': true }
      if (name === 'shop_operational_report') return { report: args.p_report, items: [{ id: `row-${args.p_page}`, invoice_number: `Fixture invoice ${args.p_page}`, occurred_at: '2026-10-01T10:00:00Z', item_type: 'product', item_name: '=protected', quantity: 2, amount: 123.45, location_name: 'First branch', source_path: '/sales' }], total: args.p_page_size === 500 ? 1 : 21, summary: { sales: 123.45, costBasis: 'FIFO' } }
      return undefined
    })
    await fixtureGoto(page, '/reports')
    await expect(page.getByRole('link', { name: 'Fixture invoice 1', exact: true })).toHaveAttribute('href', '/sales')
    await page.getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Fixture invoice 2', exact: true })).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    const download = await downloadPromise
    const csv = await readFile((await download.path())!, 'utf8')
    expect(csv).toContain('Fixture invoice 1')
    expect(csv).toContain('123.45')
    expect(csv).toContain("'=protected")
    expect(calls.filter(call => call.name === 'shop_operational_report').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_report: 'sales', p_location_id: null, p_from: null, p_to: null, p_page: 1, p_page_size: 500 })
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/reports-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
