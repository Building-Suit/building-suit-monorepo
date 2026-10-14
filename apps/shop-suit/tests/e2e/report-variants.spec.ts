import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

const kinds = ['sales', 'collections', 'receivables', 'suppliers', 'expenses', 'inventory', 'margin', 'activity']
const snapshots = ['receivables', 'inventory']
const sources: Record<string, string> = { sales: '/sales/sale-1', collections: '/customers/customer-1', receivables: '/customers/customer-1', suppliers: '/purchases/purchase-1', expenses: '/expenses', inventory: '/inventory', margin: '/sales/sale-1', activity: '/sales/sale-1' }
const summaries = { sales: { sales: 123.45 }, collections: { netCollections: 123.45 }, receivables: { outstanding: 100 }, suppliers: { payable: 50 }, expenses: { expenses: 123.45 }, inventory: { inventoryValue: 80 }, margin: { margin: 20 }, activity: { activityCount: 1 } }
async function reportFixture(page: Page, locale: string, mode = 'ready') {
  await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), locale === 'ar' ? 'dark' : 'light')
  return pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shop_operating_report') return { locationId: args.p_location_id, period: args.p_period, fromDate: '2026-10-13', toDateExclusive: '2026-10-14', canViewCosts: false, sales: 0, saleCount: 0, averageTicket: 0, paymentsIn: 0, salesMix: [], paymentMix: [], outstanding: { amount: 0, customerCount: 0, customers: [] }, expenses: { amount: null, count: null, operatingBalance: null }, appointments: { total: 0, completed: 0, cancelled: 0, noShow: 0, busiestTimes: [] }, cash: { closedShifts: 0, expected: 0, counted: 0, variance: 0 }, staff: [], locations: [] }
    if (name === 'shop_permission_access') return { 'reports.view': mode !== 'denied', 'reports.cost_profit.view': mode !== 'restricted' }
    if (name === 'shop_operational_report') {
      const kind = String(args.p_report)
      return { report: kind, items: mode === 'empty' ? [] : [{ id: `row-${kind}`, invoice_number: `REF-${kind}`, customer_name: `REF-${kind}`, supplier_name: `REF-${kind}`, title: `REF-${kind}`, name: `REF-${kind}`, label: `REF-${kind}`, occurred_at: '2026-10-13T08:00:00Z', oldest_due_date: '2026-10-13', last_movement_at: '2026-10-13T08:00:00Z', item_type: 'product', item_name: '=protected', direction: 'in', method: 'bank_transfer', status: 'posted', event_type: 'customer_payment', quantity: 2, amount: 123.45, purchase_amount: 200, payable: 50, invoice_count: 1, outstanding: 100, sku: 'SKU-1', quantity_on_hand: 2, inventory_value: 80, reorder_threshold: 3, low_stock: true, movement_count: 2, revenue: 100, fifo_cost: 80, margin: 20, margin_percent: 20, location_name: 'First branch', source_path: sources[kind] }], total: mode === 'empty' ? 0 : 1, summary: mode === 'empty' ? {} : summaries[kind as keyof typeof summaries], page: 1, pageSize: args.p_page_size }
    }
    return undefined
  })
}

for (const locale of ['en', 'ar'] as const) {
  const ar = locale === 'ar'
  test(`all report kinds preserve sources filters and raw CSV ${locale}`, async ({ page }) => {
    test.setTimeout(90000) // Eight complete route/export journeys; per-assertion limits are unchanged.
    const { calls } = await reportFixture(page, locale)
    for (const kind of kinds) {
      await fixtureGoto(page, `/reports?report=${kind}&location=location-1&from=2026-10-01&to=2026-10-31`)
      await expect(page.getByRole('link', { name: `REF-${kind}`, exact: true })).toHaveAttribute('href', sources[kind])
      for (const label of [ar ? 'من' : 'From', ar ? 'إلى' : 'To']) {
        if (snapshots.includes(kind)) await expect(page.getByLabel(label, { exact: true })).toBeDisabled()
        else await expect(page.getByLabel(label, { exact: true })).toBeEnabled()
      }
      if (kind === 'sales') await expect(page.getByRole('cell', { name: ar ? 'منتج' : 'Product', exact: true })).toBeVisible()
      if (kind === 'collections') {
        await expect(page.getByRole('cell', { name: ar ? 'تحويل بنكي' : 'Bank transfer', exact: true })).toBeVisible()
        await expect(page.getByRole('cell', { name: ar ? 'المحصل' : 'Collected', exact: true })).toBeVisible()
        await page.screenshot({ path: test.info().outputPath('collections.png'), fullPage: true, animations: 'disabled' })
      }
      if (kind === 'suppliers') await expect(page.getByRole('cell', { name: ar ? 'مرحّل' : 'Posted', exact: true })).toBeVisible()
      if (kind === 'inventory') await expect(page.getByRole('cell', { name: ar ? 'نعم' : 'Yes', exact: true })).toBeVisible()
      if (kind === 'activity') await expect(page.getByRole('cell', { name: ar ? 'تحصيل' : 'Receipt', exact: true })).toBeVisible()
      const promise = page.waitForEvent('download')
      await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
      const download = await promise
      expect(download.suggestedFilename()).toBe(`shop-${kind}-${snapshots.includes(kind) ? 'all-all' : '2026-10-01-2026-10-31'}.csv`)
      const csv = await readFile((await download.path())!, 'utf8')
      expect(csv).toContain(`REF-${kind}`)
      expect(csv).toContain(sources[kind])
      if (kind === 'collections') expect(csv).toContain('bank_transfer')
      if (kind === 'sales' || kind === 'margin') expect(csv).toContain("'=protected")
      expect(calls.filter(call => call.name === 'shop_operational_report').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_report: kind, p_page: 1, p_page_size: 500, p_from: snapshots.includes(kind) ? null : '2026-10-01', p_to: snapshots.includes(kind) ? null : '2026-10-31' })
      await expectNoPageOverflow(page)
    }
  })

  for (const mode of ['denied', 'restricted', 'empty']) {
    test(`reports ${mode} ${locale}`, async ({ page }) => {
      const { calls } = await reportFixture(page, locale, mode)
      for (const kind of mode === 'restricted' ? ['suppliers', 'expenses', 'inventory', 'margin'] : ['sales']) {
        await fixtureGoto(page, `/reports?report=${kind}`)
        await expect(page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true })).toBeDisabled()
        if (mode === 'empty') await expect(page.getByText(ar ? 'مفيش نتايج للاختيارات دي.' : 'No results match these filters.', { exact: true })).toBeVisible()
        else {
          await expect(page.getByRole('table')).toHaveCount(0)
          await expect(page.locator('#report-results')).toHaveCount(0)
          await expect(page.getByText(mode === 'denied' ? (ar ? 'معندكش صلاحية تشوف التقارير.' : 'You do not have report access.') : (ar ? 'محتاج صلاحية عرض التكلفة والربح عشان تشوف التقرير ده.' : 'Cost and profit permission is required for this report.'), { exact: true })).toBeVisible()
          expect(calls.filter(call => call.name === 'shop_operational_report')).toHaveLength(0)
        }
      }
    })
  }

  test(`report pending retry and export failure recovery ${locale}`, async ({ page }) => {
    await reportFixture(page, locale)
    let fail = true
    let releaseRead!: () => void
    let gate = Promise.resolve()
    await fixtureRoute(page, '**/rest/v1/rpc/shop_operational_report', async route => { if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic failure' } }); await gate; return route.fallback() })
    await fixtureGoto(page, '/reports')
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل التقرير.' : 'Could not load this report.')
    fail = false
    gate = new Promise<void>(resolve => { releaseRead = resolve })
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: ar ? 'بنحمّل التقرير' : 'Loading report' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('table')).toHaveCount(0)
    releaseRead()
    await expect(page.getByRole('link', { name: 'REF-sales', exact: true })).toBeVisible()
    await fixtureUnroute(page, '**/rest/v1/rpc/shop_operational_report')
    let releaseExport!: () => void
    const exportGate = new Promise<void>(resolve => { releaseExport = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/shop_operational_report', async route => { await exportGate; await route.fulfill({ status: 503, json: { message: 'Synthetic export failure' } }) })
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    await expect(page.getByRole('button', { name: ar ? 'بنصدّر…' : 'Exporting…', exact: true })).toBeDisabled()
    releaseExport()
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نصدّر التقرير.' : 'Could not export this report.')
    await expect(page.getByRole('link', { name: 'REF-sales', exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('export-failed.png'), fullPage: true, animations: 'disabled' })
    await fixtureUnroute(page, '**/rest/v1/rpc/shop_operational_report')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    await download
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expectNoPageOverflow(page)
  })

  test(`report multi-page CSV and stale filter cancellation ${locale}`, async ({ page }) => {
    await reportFixture(page, locale)
    await fixtureGoto(page, '/reports')
    const exports: Array<{ p_page: number; p_page_size: number }> = []
    const downloads: string[] = []
    page.on('download', download => downloads.push(download.suggestedFilename()))
    await fixtureRoute(page, '**/rest/v1/rpc/shop_operational_report', route => {
      const args = route.request().postDataJSON()
      if (args.p_page_size !== 500) return route.fallback()
      exports.push(args)
      return route.fulfill({ json: { report: 'sales', total: 501, items: Array.from({ length: args.p_page === 1 ? 500 : 1 }, (_, index) => ({ invoice_number: `Export row ${(args.p_page - 1) * 500 + index}`, item_name: '=protected', amount: 123.45, source_path: '/sales/sale-1' })) } })
    })
    const first = page.waitForEvent('download')
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    const csv = await readFile((await (await first).path())!, 'utf8')
    expect(csv.trim().split('\r\n')).toHaveLength(502)
    expect(csv).toContain('Export row 500')
    expect(csv).toContain("'=protected")
    expect(exports.map(args => args.p_page)).toEqual([1, 2])
    expect(exports.every(args => args.p_page_size === 500)).toBe(true)
    await fixtureUnroute(page, '**/rest/v1/rpc/shop_operational_report')
    let releaseExport!: () => void
    const gate = new Promise<void>(resolve => { releaseExport = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/shop_operational_report', async route => {
      if (route.request().postDataJSON().p_page_size !== 500) return route.fallback()
      await gate
      await route.fulfill({ json: { report: 'sales', total: 1, items: [{ invoice_number: 'Stale row', source_path: '/sales/sale-1' }] } })
    })
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    await expect(page.getByRole('button', { name: ar ? 'بنصدّر…' : 'Exporting…', exact: true })).toBeDisabled()
    await page.getByRole('combobox', { name: ar ? 'التقارير التشغيلية' : 'Operational reports', exact: true }).click()
    await page.getByRole('option', { name: ar ? 'التحصيلات والمدفوعات' : 'Collections & payments', exact: true }).click()
    await expect(page.getByRole('link', { name: 'REF-collections', exact: true })).toBeVisible()
    releaseExport()
    await expect(page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true })).toBeEnabled()
    expect(downloads).toHaveLength(1)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
