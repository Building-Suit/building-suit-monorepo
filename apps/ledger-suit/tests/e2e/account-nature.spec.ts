import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel('Email').fill('owner@alpha.test')
  await page.getByLabel('Password').fill('ledgersuit')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
  await expect(page.getByLabel('Search accounts', { exact: true })).toBeEnabled()
}

for (const locale of ['en', 'ar']) {
  test(`${locale}: create and review a contra asset with a real posted balance`, async ({ page }) => {
    await signIn(page)
    if (locale === 'ar') {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    const ar = locale === 'ar'
    const suffix = Date.now()
    const assetName = ar ? `أجهزة ${suffix}` : `Equipment ${suffix}`
    const contraName = ar ? `مجمع إهلاك ${suffix}` : `Accumulated depreciation ${suffix}`
    const add = ar ? 'إضافة حساب' : 'Add account'
    const save = ar ? 'حفظ' : 'Save'
    const search = page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true })
    // These requests use the real local RPC; no financial responses are mocked.
    await page.getByRole('button', { name: add, exact: true }).first().click()
    let dialog = page.getByRole('dialog')
    await dialog.locator('#account-name').fill(assetName)
    await dialog.locator('#account-subtype').selectOption('equipment')
    await expect(dialog.locator('#account-normal-balance')).toHaveValue('debit')
    const createdAsset = page.waitForResponse(response => response.url().endsWith('/rpc/create_account'))
    await dialog.getByRole('button', { name: save, exact: true }).click()
    const assetResponse = await createdAsset
    expect(assetResponse.ok()).toBe(true)
    const assetId = await assetResponse.json() as string
    const requestHeaders = await assetResponse.request().allHeaders()
    const headers = { apikey: requestHeaders.apikey!, authorization: requestHeaders.authorization! }
    const org = assetResponse.request().postDataJSON().p_organization_id as string
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: add, exact: true }).first().click()
    dialog = page.getByRole('dialog')
    await dialog.locator('#account-name').fill(contraName)
    await dialog.locator('#account-subtype').selectOption('equipment')
    await dialog.locator('#account-normal-balance').selectOption('credit')
    await dialog.locator('#account-contra').selectOption(assetId)
    const createdContra = page.waitForResponse(response => response.url().endsWith('/rpc/create_account'))
    await dialog.getByRole('button', { name: save, exact: true }).click()
    const contraResponse = await createdContra
    expect(contraResponse.ok()).toBe(true)
    const contraId = await contraResponse.json() as string
    await expect(dialog).toBeHidden()
    // A minimal balanced journal demonstrates opposite natural sides without
    // inventing a tax rate, costing method or customer cutover policy.
    const backend = new URL(assetResponse.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:63321']).toContain(backend)
    const posted = await page.request.post(`${backend}/rest/v1/rpc/create_adjustment`, {
      headers,
      data: {
        p_organization_id: org, p_transaction_date: '2026-09-01',
        p_description: ar ? 'قيد اختبار' : 'Acceptance journal',
        p_reason: ar ? 'بيانات اختبار محلية' : 'Disposable local fixture',
        p_lines: [
          { account_id: assetId, side: 'debit', amount_minor: 3000000 },
          { account_id: contraId, side: 'credit', amount_minor: 3000000 },
        ],
      },
    })
    expect(posted.ok()).toBe(true)
    await page.reload()
    await expect(search).toBeEnabled()
    await search.fill(contraName)
    const row = page.getByRole('table').getByRole('row').filter({ hasText: contraName })
    await expect(row).toContainText(assetName)
    await expect(row).toContainText(ar ? 'دائن' : 'Credit')
    await expect(row).toContainText('30,000.00')
    await row.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('#account-normal-balance')).toBeDisabled()
    await expect(dialog.locator('#account-contra')).toBeDisabled()
    await dialog.locator('#account-name').fill(`${contraName} 2`)
    await dialog.getByRole('button', { name: save, exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('table')).toContainText(`${contraName} 2`)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('account totals retain parent postings, subtract contra balances and display exact large amounts', async ({ page }) => {
  await page.route('**/rest/v1/account_balances?**', async (route) => {
    const org = new URL(route.request().url()).searchParams.get('organization_id')!.slice(3)
    const common = { account_role: 'posting', organization_id: org, type: 'asset', subtype: 'equipment', currency: 'EGP',
      is_archived: false, is_liquid: false, is_system: false, classification_locked: true, entry_count: 1,
      contra_account_id: null, parent_account_id: null, normal_balance: 'debit' }
    const rows = [
      { ...common, account_id: 'parent', code: '1', name: 'Parent with postings', net_debit_minor: '9007199254740993', statement_balance_minor: '9007199254740993' },
      { ...common, account_id: 'child', code: '2', name: 'Child with postings', parent_account_id: 'parent', net_debit_minor: '100', statement_balance_minor: '100' },
      { ...common, account_id: 'contra', code: '3', name: 'Contra with credit', normal_balance: 'credit', contra_account_id: 'parent', net_debit_minor: '-50', statement_balance_minor: '-50' },
    ]
    await route.fulfill({ json: rows, headers: { 'Content-Range': '0-2/3' } })
  })
  await signIn(page)
  const total = page.getByRole('tabpanel').locator('h2 + span')
  await expect(total).toContainText('90,071,992,547,410.43')
  await page.getByLabel('Search accounts', { exact: true }).fill('Contra with credit')
  await expect(total).toContainText('90,071,992,547,410.43')
  await expect(page.getByRole('table')).toContainText('Credit')
})
