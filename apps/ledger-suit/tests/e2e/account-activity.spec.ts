import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

async function signIn(page: Page, email = 'owner@alpha.test') {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('ledgersuit')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

for (const locale of ['en', 'ar']) {
  test(`${locale}: real statement, page two, journal, another account and back preserve context`, async ({ page, browser }) => {
    test.setTimeout(60_000)
    await signIn(page)
    const request = page.waitForRequest(r => r.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
    const initial = await request
    const backend = new URL(initial.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:65321']).toContain(backend)
    const organization = new URL(initial.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const allHeaders = await initial.allHeaders()
    const headers = { apikey: allHeaders.apikey!, authorization: allHeaders.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data })
      expect(response.ok(), `${name}: ${response.status()}`).toBe(true)
      return response.json()
    }
    const ar = locale === 'ar'
    const stamp = Date.now()
    const bankName = ar ? `البنك التشغيلي ${stamp}` : `Operating bank ${stamp}`
    const capitalName = ar ? `تمويل المالك ${stamp}` : `Owner funding ${stamp}`
    const bank = await rpc('create_account', { p_organization_id: organization, p_name: bankName, p_type: 'asset', p_subtype: 'bank' })
    const capital = await rpc('create_account', { p_organization_id: organization, p_name: capitalName, p_type: 'equity', p_subtype: 'owner_capital' })
    async function post(date: string, amount: number, description: string, credit = false) {
      return rpc('create_adjustment', { p_organization_id: organization, p_transaction_date: date, p_description: description, p_reason: 'Disposable browser review', p_lines: [
        { account_id: bank, side: credit ? 'credit' : 'debit', amount_minor: amount },
        { account_id: capital, side: credit ? 'debit' : 'credit', amount_minor: amount },
      ] })
    }
    await post('2026-01-01', 100000, ar ? 'تمويل أول المدة' : 'Opening funding')
    for (let i = 1; i <= 30; i++) await post('2026-01-10', 1000, `${ar ? 'دفعة تمويل' : 'Funding installment'} ${i}`)
    await post('2026-01-11', 5000, ar ? 'رد جزء من التمويل' : 'Funding repayment', true)
    await page.reload()
    if (ar) {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    await page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true }).fill(bankName)
    await page.getByRole('button', { name: bankName, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('#activity-from')).not.toHaveValue('')
    await dialog.locator('#activity-from').fill('2026-01-10')
    await dialog.locator('#activity-to').fill('2026-01-31')
    const loaded = page.waitForResponse(r => r.url().endsWith('/rpc/read_account_activity') && r.request().postDataJSON().p_from_date === '2026-01-10')
    await dialog.getByRole('button', { name: ar ? 'عرض الحركة' : 'Show activity', exact: true }).click()
    const result = await (await loaded).json()
    expect([result.opening_minor, result.debit_minor, result.credit_minor, result.closing_minor]).toEqual(['100000', '30000', '5000', '125000'])
    await expect(dialog.getByTestId('activity-closing')).toContainText('1,250.00')
    await mkdir('docs/evidence/as-s3-01a', { recursive: true })
    await page.screenshot({ path: `docs/evidence/as-s3-01a/${locale}-statement.png`, fullPage: true })
    await dialog.getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true }).click()
    const item = `${ar ? 'دفعة تمويل' : 'Funding installment'} 26`
    await expect(dialog.getByRole('button', { name: item, exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: item, exact: true }).click()
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(item)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(dialog.getByRole('table')).toContainText(capitalName)
    await page.screenshot({ path: `docs/evidence/as-s3-01a/${locale}-journal.png`, fullPage: true })
    await dialog.getByRole('button', { name: capitalName, exact: true }).click()
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(capitalName)
    await expect(dialog.locator('#activity-from')).toHaveValue('2026-01-10')
    const back = dialog.getByRole('button', { name: ar ? 'العودة إلى العرض السابق' : 'Back to previous view', exact: true })
    await back.click()
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(item)
    await back.click()
    await expect(dialog.getByRole('button', { name: item, exact: true })).toBeVisible()
    await expect(dialog.locator('#activity-from')).toHaveValue('2026-01-10')
    await expect(dialog.getByRole('button', { name: item, exact: true })).toBeFocused()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/evidence/as-s3-01a/${locale}-mobile.png`, fullPage: true })
    await dialog.locator('#activity-from').fill('2026-02-01')
    await dialog.locator('#activity-to').fill('2026-02-28')
    await dialog.getByRole('button', { name: ar ? 'عرض الحركة' : 'Show activity', exact: true }).click()
    await expect(dialog).toContainText(ar ? 'لا توجد قيود مرحلة' : 'No posted entries')
    await expect(dialog.getByTestId('activity-opening')).toContainText('1,250.00')
    await expect(dialog.getByTestId('activity-closing')).toContainText('1,250.00')
    await expect(page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true })).toHaveValue(bankName)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true })).toHaveValue(bankName)
    const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
    const viewer = await context.newPage()
    await signIn(viewer, 'viewer@alpha.test')
    await viewer.goto('/accounts')
    await viewer.getByLabel('Search accounts', { exact: true }).fill(bankName)
    await viewer.getByRole('button', { name: bankName, exact: true }).click()
    await expect(viewer.getByRole('dialog').getByTestId('activity-closing')).toContainText('1,250.00')
    await context.close()
  })
}

test('closing a delayed account request cannot populate the next dialog; errors offer retry', async ({ page }) => {
  await signIn(page)
  const initialRequest = page.waitForRequest(r => r.url().includes('/rest/v1/account_balances?'))
  await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
  const initial = await initialRequest
  const backend = new URL(initial.url()).origin
  expect(['http://127.0.0.1:60321', 'http://127.0.0.1:65321']).toContain(backend)
  const headers = await initial.allHeaders()
  const name = `Delayed account ${Date.now()}`
  const created = await page.request.post(`${backend}/rest/v1/rpc/create_account`, {
    headers: { apikey: headers.apikey!, authorization: headers.authorization! },
    data: { p_organization_id: new URL(initial.url()).searchParams.get('organization_id')!.replace('eq.', ''), p_name: name, p_type: 'asset', p_subtype: 'bank' },
  })
  expect(created.ok()).toBe(true)
  await page.reload()
  await page.getByLabel('Search accounts', { exact: true }).fill(name)
  const account = page.getByRole('table').getByRole('button', { name, exact: true })
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let arrived!: () => void
  const requested = new Promise<void>(resolve => { arrived = resolve })
  let calls = 0
  await page.route('**/rest/v1/rpc/read_account_activity', async (route) => {
    const response = await route.fetch()
    calls++
    if (calls === 1) {
      const data = await response.json()
      arrived(); await delayed
      return route.fulfill({ json: { ...data, account: { ...data.account, name: 'STALE ACCOUNT MUST NOT APPEAR' } } })
    }
    if (calls === 2) return route.fulfill({ status: 500, json: { message: 'Fixture unavailable' } })
    return route.fulfill({ response })
  })
  await account.click()
  await requested
  await page.keyboard.press('Escape')
  await account.click()
  await expect(page.getByRole('alert')).toBeVisible()
  release()
  await page.getByRole('dialog').getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('dialog').getByTestId('activity-closing')).toBeVisible()
  await expect(page.getByRole('dialog')).not.toContainText('STALE ACCOUNT MUST NOT APPEAR')
  await page.unrouteAll({ behavior: 'wait' })
})
