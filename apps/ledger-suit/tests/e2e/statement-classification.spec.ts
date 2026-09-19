import { expect, test, type Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

async function signIn(page: Page, email = 'owner@alpha.test') {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('ledgersuit')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

for (const locale of ['en', 'ar']) {
  test(`${locale}: schedule presentation, retain previous report and export the dated classification`, async ({ page, browser }) => {
    await signIn(page)
    await page.goto('/accounts')
    await expect(page.getByLabel('Search accounts', { exact: true })).toBeEnabled()
    const ar = locale === 'ar'
    if (ar) {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    const name = `${ar ? 'معدات التصنيف' : 'Classification equipment'} ${Date.now()}`
    const title = ar ? 'العرض في القوائم' : 'Statement presentation'
    const schedule = ar ? 'جدولة التصنيف' : 'Schedule classification'
    await page.getByRole('button', { name: ar ? 'إضافة حساب' : 'Add account', exact: true }).first().click()
    let dialog = page.getByRole('dialog')
    await dialog.locator('#account-name').fill(name)
    await dialog.locator('#account-subtype').selectOption('equipment')
    const created = page.waitForResponse(r => r.url().endsWith('/rpc/create_account'))
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    const response = await created
    expect(response.ok()).toBe(true)
    const accountId = await response.json() as string
    const organizationId = response.request().postDataJSON().p_organization_id as string
    const requestHeaders = await response.request().allHeaders()
    const headers = { apikey: requestHeaders.apikey!, authorization: requestHeaders.authorization! }
    const backend = new URL(response.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:64321']).toContain(backend)
    async function rpc(method: string, data: Record<string, unknown>) {
      return page.request.post(`${backend}/rest/v1/rpc/${method}`, { headers, data })
    }
    await expect(dialog).toBeHidden()
    await page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true }).fill(name)
    const row = page.getByRole('table').getByRole('row').filter({ hasText: name })
    const contextLoaded = page.waitForResponse(r => r.url().endsWith('/rpc/account_statement_classification_context'))
    await row.getByRole('button', { name: title, exact: true }).click()
    const context = await (await contextLoaded).json() as { today: string, min_effective_date: string }
    const effective = context.min_effective_date
    const capital = await rpc('create_account', { p_organization_id: organizationId, p_name: ar ? `رأس مال ${Date.now()}` : `Classification capital ${Date.now()}`, p_type: 'equity', p_subtype: 'owner_capital' })
    expect(capital.ok()).toBe(true)
    const journal = await rpc('create_adjustment', { p_organization_id: organizationId, p_transaction_date: context.today,
      p_description: ar ? 'تجربة التصنيف' : 'Classification test', p_reason: 'Local disposable verification',
      p_lines: [{ account_id: accountId, side: 'debit', amount_minor: 23000 }, { account_id: await capital.json(), side: 'credit', amount_minor: 23000 }],
    })
    expect(journal.ok()).toBe(true)
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('#statement-effective')).toHaveValue(effective)
    await dialog.locator('#statement-line').selectOption('property_equipment')
    await dialog.locator('#statement-reason').fill(ar ? 'معدات مستخدمة في العمليات لعدة سنوات' : 'Equipment used in operations over several years')
    await mkdir('docs/evidence/as-s2-01b', { recursive: true })
    await page.screenshot({ path: `docs/evidence/as-s2-01b/${locale}-schedule.png`, fullPage: true })
    const scheduled = page.waitForResponse(r => r.url().endsWith('/rpc/schedule_account_statement_classification'))
    await dialog.getByRole('button', { name: schedule, exact: true }).click()
    const saved = await scheduled
    expect(saved.ok()).toBe(true)
    const revisionId = await saved.json() as string
    await expect(dialog).toBeHidden()
    const retry = await rpc('schedule_account_statement_classification', saved.request().postDataJSON())
    expect(retry.ok()).toBe(true)
    expect(await retry.json()).toBe(revisionId)
    const tampered = await rpc('schedule_account_statement_classification', {
      ...saved.request().postDataJSON(), p_request_id: crypto.randomUUID(), p_effective_from: context.today,
    })
    expect(tampered.ok()).toBe(false)
    expect((await tampered.json()).message).toContain('CLASSIFICATION_DATE_NOT_FUTURE')
    await row.getByRole('button', { name: title, exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('table')).toContainText(ar ? 'الممتلكات والمعدات' : 'Property and equipment')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true }).click()
    await page.goto('/reports?tab=balance-sheet')
    await page.locator('#asof').fill(context.today)
    let reportRow = page.getByRole('table').getByRole('row').filter({ hasText: name })
    await expect(reportRow).toContainText('230.00')
    await expect(reportRow).not.toContainText(effective)
    await expect(page.getByRole('table')).toContainText(ar ? 'أصول غير مصنفة' : 'Unclassified assets')
    const reported = page.waitForResponse(r => r.url().endsWith('/rpc/report_classified_balance_sheet') && r.request().postDataJSON().p_as_of_date === effective)
    await page.locator('#asof').fill(effective)
    const rows = await (await reported).json() as Array<{ account_id: string, amount_minor: string, classification_id: string }>
    expect(rows.find(r => r.account_id === accountId)).toMatchObject({ amount_minor: '23000', classification_id: revisionId })
    await expect(page.getByRole('table')).toContainText(ar ? 'الممتلكات والمعدات' : 'Property and equipment')
    reportRow = page.getByRole('table').getByRole('row').filter({ hasText: name })
    await expect(reportRow).toContainText('230.00')
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    const download = await downloaded
    const csv = await readFile((await download.path())!, 'utf8')
    expect(csv).toContain(revisionId)
    expect(csv).toContain(name)
    expect(csv).toContain('230.00')
    expect(csv).toContain(ar ? 'الممتلكات والمعدات' : 'Property and equipment')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/evidence/as-s2-01b/${locale}-report-mobile.png`, fullPage: true })

    // A second real user can read history, but cannot use the scheduling API.
    const viewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
    const viewer = await viewerContext.newPage()
    await signIn(viewer, 'viewer@alpha.test')
    await viewer.goto('/accounts')
    await viewer.getByLabel('Search accounts', { exact: true }).fill(name)
    await viewer.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Statement presentation', exact: true }).click()
    await expect(viewer.getByRole('dialog').getByRole('table')).toContainText('Property and equipment')
    await expect(viewer.locator('#statement-line')).toHaveCount(0)
    await viewerContext.close()
  })
}

test('report switches dates without showing a delayed previous response and recovers from an error', async ({ page }) => {
  await signIn(page)
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let requested!: () => void
  const arrived = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/rest/v1/rpc/report_classified_balance_sheet', async (route) => {
    const date = route.request().postDataJSON().p_as_of_date
    if (date === '2030-01-01') { requested(); await delayed }
    if (date === '2030-01-03') return route.fulfill({ status: 500, json: { message: 'fixture unavailable' } })
    await route.fulfill({ json: [{ section: 'asset', account_id: '00000000-0000-4000-8000-000000000001', code: 'FX', name: `Fixture ${date}`, amount_minor: '100', statement_line: 'unclassified_asset', classification_id: null, effective_from: null, report_date: date }] })
  })
  await page.getByRole('link', { name: 'Reports', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Balance Sheet', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Fixture')
  await page.locator('#asof').fill('2030-01-01')
  await arrived
  await page.locator('#asof').fill('2030-01-02')
  await expect(page.getByRole('table')).toContainText('Fixture 2030-01-02')
  release()
  await expect(page.getByRole('table')).not.toContainText('Fixture 2030-01-01')
  await page.locator('#asof').fill('2030-01-03')
  await expect(page.getByRole('alert')).toContainText('could not be loaded')
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.locator('#asof').fill('2030-01-02')
  await expect(page.getByRole('table')).toContainText('Fixture 2030-01-02')
})

test('tenant change clears classified report and ignores the previous tenant response', async ({ page }) => {
  const secondId = 'b0000000-1111-4000-8000-000000000098'
  let firstId = ''
  await page.route('**/rest/v1/organization_members?**', async (route) => {
    if (!decodeURIComponent(route.request().url()).includes('organizations(')) return route.continue()
    const response = await route.fetch()
    const memberships = await response.json()
    firstId = memberships[0].organizations.id
    await route.fulfill({ response, json: [...memberships, { ...memberships[0], organizations: { ...memberships[0].organizations, id: secondId, name: 'Classification second tenant', legal_name: 'Classification second tenant LLC' } }] })
  })
  // Synthetic memberships test browser isolation only. SQL tests cover actual authorization.
  await page.route('**/rest/v1/rpc/*', async (route) => {
    const body = route.request().postData()
    if (!body?.includes(secondId)) return route.continue()
    const response = await route.fetch({ postData: body.replaceAll(secondId, firstId) })
    await route.fulfill({ response })
  })
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let requested!: () => void
  const arrived = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/rest/v1/rpc/report_classified_balance_sheet', async (route) => {
    const body = route.request().postDataJSON()
    if (body.p_organization_id === secondId) { requested(); await delayed }
    await route.fulfill({ json: [{ section: 'asset', account_id: '00000000-0000-4000-8000-000000000001', code: 'SCOPE', name: body.p_organization_id === secondId ? 'Private second classification' : 'First classification', amount_minor: '100', statement_line: 'unclassified_asset', classification_id: null, effective_from: null, report_date: body.p_as_of_date }] })
  })
  await signIn(page)
  await page.getByRole('link', { name: 'Reports', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Balance Sheet', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('First classification')
  await page.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByRole('option', { name: /Classification second tenant/ }).click()
  await arrived
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByRole('option', { name: /Alpha Trading/ }).click()
  await expect(page.getByRole('table')).toContainText('First classification')
  release()
  await expect(page.getByRole('table')).not.toContainText('Private second classification')
})
