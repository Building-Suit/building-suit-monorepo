import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) for (const failure of ['query', 'access']) {
  test(`report failure ${failure} hides unverified results: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_permission_access') return { 'reports.view': true, 'reports.cost_profit.view': true }
      if (name === 'shop_operational_report') return { report: args.p_report, items: [{ id: 'report-1', invoice_number: 'Synthetic report row', occurred_at: '2026-10-01T10:00:00Z', item_type: 'product', item_name: 'Synthetic stock', quantity: 2, amount: 123.45, location_name: 'First branch', source_path: '/sales' }], total: 1, summary: { sales: 123.45 } }
      return undefined
    })
    let failed = true
    const rpc = failure === 'query' ? 'shop_operational_report' : 'shop_permission_access'
    await fixtureRoute(page, `**/rest/v1/rpc/${rpc}`, route => failed ? route.fulfill({ status: 503, json: { message: 'Synthetic report service failure' } }) : route.fallback())
    await fixtureGoto(page, '/reports')
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل التقرير.' : 'Could not load this report.')
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.locator('#report-results')).toHaveCount(0)
    await expect(page.getByText(ar ? 'معندكش صلاحية تشوف التقارير.' : 'You do not have report access.', { exact: true })).toHaveCount(0)
    const exportAction = page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true })
    await expect(exportAction).toBeDisabled()
    failed = false
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Synthetic report row', exact: true })).toBeVisible()
    await expect(exportAction).toBeEnabled()
    expect(calls.filter(call => call.name === 'shop_operational_report').at(-1)?.args.p_shop_id).toBe('shop-1')
    await expectNoPageOverflow(page)
  })
}
