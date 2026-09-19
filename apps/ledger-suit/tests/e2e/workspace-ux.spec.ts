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
  test(`${locale}: real account tree, unified transactions, preserved filters and authorized entry`, async ({ page }) => {
    test.setTimeout(60_000)
    await signIn(page)
    const request = page.waitForRequest(r => r.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
    const source = await request
    const backend = new URL(source.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:65321']).toContain(backend)
    const org = new URL(source.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const authorization = await source.allHeaders()
    const headers = { apikey: authorization.apikey!, authorization: authorization.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const result = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: org, ...data } })
      expect(result.ok(), `${name}: ${result.status()}`).toBe(true)
      return result.json()
    }
    const ar = locale === 'ar'
    const stamp = Date.now()
    const groupName = `${ar ? 'مجموعة خزائن التشغيل' : 'Operating cash group'} ${stamp}`
    const bankName = `${ar ? 'خزينة الفرع' : 'Branch cash'} ${stamp}`
    const income = `${ar ? 'تحصيل خدمات' : 'Service receipt'} ${stamp}`
    const expense = `${ar ? 'مصروف خدمات' : 'Service expense'} ${stamp}`
    const group = await rpc('create_account', { p_name: groupName, p_type: 'asset', p_subtype: 'cash', p_account_role: 'group' })
    const bank = await rpc('create_account', { p_name: bankName, p_type: 'asset', p_subtype: 'cash', p_parent_account_id: group })
    const revenue = await rpc('create_account', { p_name: `Revenue ${stamp}`, p_type: 'revenue', p_subtype: 'service_revenue' })
    const cost = await rpc('create_account', { p_name: `Expense ${stamp}`, p_type: 'expense', p_subtype: 'professional_fees' })
    await rpc('record_income', { p_transaction_date: '2026-09-01', p_description: income, p_destination_account_id: bank, p_revenue_account_id: revenue, p_amount_minor: 15000 })
    await rpc('record_expense', { p_transaction_date: '2026-09-02', p_description: expense, p_source_account_id: bank, p_expense_account_id: cost, p_amount_minor: 2500 })
    await page.reload()
    if (ar) {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'Dark', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    const tree = page.locator('#accounts-tree')
    await expect(page.getByRole('button', { name: ar ? 'عرض الشجرة' : 'Tree view', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(tree).toContainText(ar ? 'الأصول المتداولة' : 'Current assets')
    await expect(tree).toContainText(ar ? 'الأصول الثابتة' : 'Fixed assets')
    await page.getByRole('button', { name: ar ? 'طي الكل' : 'Collapse all', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(tree.getByRole('row')).toHaveCount(6)
    await page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true }).fill(bankName)
    await expect(tree).toContainText(groupName)
    await expect(tree).toContainText(ar ? 'الأصول المتداولة' : 'Current assets')
    await expect(tree.getByRole('row').filter({ hasText: groupName })).toContainText('125.00')
    await tree.getByRole('button', { name: bankName, exact: true }).click()
    await expect(page.getByRole('dialog').getByTestId('activity-closing')).toContainText('125.00')
    await page.keyboard.press('Escape')
    await tree.getByRole('button', { name: ar ? 'إضافة حساب فرعي' : 'Add subaccount', exact: true }).click()
    await expect(page.getByRole('dialog').locator('#account-parent')).toHaveValue(group)
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true }).click()
    await mkdir('docs/evidence/as-ux-01', { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `docs/evidence/as-ux-01/${locale}-tree.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/evidence/as-ux-01/${locale}-tree-mobile.png`, fullPage: true })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.getByRole('link', { name: ar ? 'المعاملات' : 'Transactions', exact: true }).first().click()
    const nav = page.getByRole('navigation', { name: ar ? 'التنقل الرئيسي' : 'Primary', exact: true }).first()
    await expect(nav.locator('a[href^="/records/income"], a[href^="/records/expense"], a[href="/imports"]')).toHaveCount(0)
    await page.locator('#account').selectOption(bank)
    await page.locator('#type').selectOption('income')
    await page.locator('#status').selectOption('posted')
    await page.locator('#from').fill('2026-09-01')
    await page.locator('#to').fill('2026-09-30')
    await expect(page.getByRole('table')).toContainText(income)
    await expect(page.getByRole('table')).not.toContainText(expense)
    await expect(page).toHaveURL(new RegExp(`account=${bank}`))
    await page.reload()
    await expect(page.locator('#account')).toHaveValue(bank)
    await expect(page.locator('#type')).toHaveValue('income')
    await page.getByRole('table').getByRole('button', { name: income, exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(income)
    await page.keyboard.press('Escape')
    await expect(page.locator('#type')).toHaveValue('income')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `docs/evidence/as-ux-01/${locale}-transactions.png`, fullPage: true })
    await page.getByRole('button', { name: ar ? 'معاملة جديدة' : 'New transaction', exact: true }).click()
    await expect(page.getByRole('dialog').locator('#flow')).toHaveValue('income')
    await page.keyboard.press('Escape')
    await page.locator('#type').selectOption('adjustment')
    await page.getByRole('button', { name: ar ? 'معاملة جديدة' : 'New transaction', exact: true }).click()
    const entry = page.getByRole('dialog')
    await expect(entry.locator('#flow')).toHaveValue('adjustment')
    await entry.locator('#date').fill('2026-09-03')
    const entryName = `${ar ? 'قيد من شاشة المعاملات' : 'Workspace journal'} ${stamp}`
    await entry.locator('#descr').fill(entryName)
    await entry.locator('#reason').fill('Disposable workspace verification')
    await entry.locator('#line-account-0').selectOption(bank)
    await entry.locator('#line-amount-0').fill('25.00')
    await entry.locator('#line-account-1').selectOption(revenue)
    await entry.locator('#line-amount-1').fill('25.00')
    await entry.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(entry).toHaveCount(0)
    await expect(page.getByRole('table')).toContainText(entryName)
    await expect(page.locator('#account')).toHaveValue(bank)
    await page.goto(`/records/expense?account=${bank}&from=2026-09-01&to=2026-09-30`)
    await expect(page).toHaveURL(/\/transactions\?/)
    await expect(page.locator('#type')).toHaveValue('expense')
    await expect(page.getByRole('table')).toContainText(expense)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('main')).toContainText(expense)
    await page.screenshot({ path: `docs/evidence/as-ux-01/${locale}-mobile.png`, fullPage: true })
  })
}

test('server filters reset pagination and errors retry without losing query; invalid ranges do not query', async ({ page }) => {
  await signIn(page)
  let fail = false
  const calls: Record<string, unknown>[] = []
  await page.route('**/rest/v1/rpc/search_transactions', route => {
    const query = route.request().postDataJSON()
    calls.push(query)
    if (fail) return route.fulfill({ status: 500, json: { message: 'Controlled transport failure' } })
    const offset = query.p_offset ?? 0
    return route.fulfill({ json: Array.from({ length: query.p_types ? 1 : 25 }, (_, i) => ({ id: `transaction-${offset + i}`, organization_id: query.p_organization_id, description: `Filtered entry ${offset + i}`, transaction_date: '2026-09-01', type: query.p_types?.[0] ?? 'income', status: 'posted', amount_minor: 1000, currency_code: 'EGP', total_count: query.p_types ? 1 : 60 })) })
  })
  await page.getByRole('link', { name: 'Transactions', exact: true }).first().click()
  await expect(page.locator('#type')).toBeEnabled()
  await expect(page.getByRole('table')).toContainText('Filtered entry 0')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Filtered entry 25')
  await page.getByRole('button', { name: 'Expense', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Filtered entry 0')
  expect(calls.at(-1)?.p_offset).toBe(0)
  expect(calls.at(-1)?.p_types).toEqual(['expense'])
  fail = true
  await page.locator('#status').selectOption('failed')
  await expect(page.getByRole('alert')).toContainText('Transactions could not be loaded')
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Filtered entry 0')
  await expect(page.locator('#status')).toHaveValue('failed')
  await page.locator('#from').fill('2026-09-30')
  await page.locator('#to').fill('2026-09-01')
  await expect(page.getByRole('alert')).toContainText('Enter a valid date range')
  expect(calls.at(-1)?.p_to_date).not.toBe('2026-09-01')
})

test('viewer has one transaction workspace and readable tree without write actions', async ({ page }) => {
  await signIn(page, 'viewer@alpha.test')
  await page.getByRole('link', { name: 'Transactions', exact: true }).first().click()
  await expect(page.locator('#type')).toBeEnabled()
  await expect(page.locator('#type')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'New transaction', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
  await expect(page.locator('#accounts-tree')).toContainText('Current assets')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add subaccount', exact: true })).toHaveCount(0)
})

test('switching organizations clears filters and ignores a late response from the previous organization', async ({ page }) => {
  const secondId = 'b0000000-1111-4000-8000-000000000095'
  let firstId = ''
  await page.route('**/rest/v1/organization_members?**', async route => {
    if (!decodeURIComponent(route.request().url()).includes('organizations(')) return route.continue()
    const response = await route.fetch()
    const memberships = await response.json()
    firstId = memberships[0].organizations.id
    await route.fulfill({ response, json: [...memberships, { ...memberships[0], organizations: { ...memberships[0].organizations, id: secondId, name: 'Workspace second tenant', legal_name: 'Workspace second tenant LLC' } }] })
  })
  // A synthetic membership exercises rendering isolation, not database authorization.
  await page.route('**/rest/v1/rpc/*', route => {
    const body = route.request().postData()
    return route.continue(body?.includes(secondId) ? { postData: body.replaceAll(secondId, firstId) } : {})
  })
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let arrived!: () => void
  const requested = new Promise<void>(resolve => { arrived = resolve })
  await page.route('**/rest/v1/rpc/search_transactions', async route => {
    const body = route.request().postDataJSON()
    if (body.p_organization_id === secondId) { arrived(); await delayed }
    await route.fulfill({ json: [{ id: '00000000-0000-4000-8000-000000000001', organization_id: body.p_organization_id, description: body.p_organization_id === secondId ? 'Private second transaction' : 'First tenant transaction', type: 'income', status: 'posted', transaction_date: '2026-09-01', amount_minor: 100, currency_code: 'EGP', total_count: 1 }] })
  })
  await signIn(page)
  await page.getByRole('link', { name: 'Transactions', exact: true }).first().click()
  await expect(page.locator('#type')).toBeEnabled()
  await expect(page.getByRole('table')).toContainText('First tenant transaction')
  await page.locator('#search').fill('First')
  await expect(page).toHaveURL(/q=First/)
  await page.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByRole('option', { name: /Workspace second tenant/ }).click()
  await requested
  await expect(page.locator('#search')).toHaveValue('')
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByRole('option', { name: /Alpha Trading/ }).click()
  await expect(page.getByRole('table')).toContainText('First tenant transaction')
  release()
  await expect(page.getByRole('table')).not.toContainText('Private second transaction')
  await page.unrouteAll({ behavior: 'wait' })
})
