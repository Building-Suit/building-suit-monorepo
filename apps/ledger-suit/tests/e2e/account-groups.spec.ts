import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

for (const locale of ['en', 'ar']) {
  test(`${locale}: create a group and child; exclude group from posting and preserve the parent`, async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
    await page.getByLabel('Email').fill('owner@alpha.test')
    await page.getByLabel('Password').fill('ledgersuit')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
    await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
    await expect(page.getByLabel('Search accounts', { exact: true })).toBeEnabled()
    if (locale === 'ar') {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    const ar = locale === 'ar'
    const suffix = Date.now()
    const groupName = ar ? `مجموعة البنوك ${suffix}` : `Bank group ${suffix}`
    const childName = ar ? `حساب البنك ${suffix}` : `Bank child ${suffix}`
    const add = ar ? 'إضافة حساب' : 'Add account'
    const save = ar ? 'حفظ' : 'Save'
    const search = page.getByLabel(ar ? 'البحث في الحسابات' : 'Search accounts', { exact: true })
    await search.fill('hidden-during-save')
    await page.getByRole('button', { name: add, exact: true }).first().click()
    let dialog = page.getByRole('dialog')
    await dialog.locator('#account-name').fill(groupName)
    await dialog.locator('#account-subtype').selectOption('bank')
    await dialog.locator('#account-role').selectOption('group')
    await expect(dialog.locator('#account-contra')).toHaveCount(0)
    await mkdir('docs/evidence/as-s2-02a', { recursive: true })
    await page.screenshot({ path: `docs/evidence/as-s2-02a/${locale}-create-group.png`, fullPage: true })
    const created = page.waitForResponse(response => response.url().endsWith('/rpc/create_account'))
    await dialog.getByRole('button', { name: save, exact: true }).click()
    const groupResponse = await created
    expect(groupResponse.ok()).toBe(true)
    const groupId = await groupResponse.json() as string
    const org = groupResponse.request().postDataJSON().p_organization_id as string
    const requestHeaders = await groupResponse.request().allHeaders()
    const headers = { apikey: requestHeaders.apikey!, authorization: requestHeaders.authorization! }
    const backend = new URL(groupResponse.url()).origin
    // These tests may run on the normal disposable backend or the owned group
    // rehearsal backend; never issue these write requests to a hosted project.
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:63321']).toContain(backend)
    await expect(dialog).toBeHidden()
    await expect(search).toHaveValue('hidden-during-save')
    await page.getByRole('button', { name: ar ? 'عرض الحساب المحفوظ' : 'Show saved account' }).click()
    const groupRow = page.getByRole('table').getByRole('row').filter({ hasText: groupName })
    await expect(groupRow).toContainText(ar ? 'حساب تجميعي' : 'Group account')
    await expect(groupRow).toContainText(ar ? 'دون بنود مباشرة' : 'No direct entries')
    await groupRow.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('#account-role')).toBeDisabled()
    await dialog.getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true }).click()
    await page.getByRole('button', { name: add, exact: true }).first().click()
    dialog = page.getByRole('dialog')
    await dialog.locator('#account-name').fill(childName)
    await dialog.locator('#account-subtype').selectOption('bank')
    await dialog.locator('#account-parent').selectOption(groupId)
    const childCreated = page.waitForResponse(response => response.url().endsWith('/rpc/create_account'))
    await dialog.getByRole('button', { name: save, exact: true }).click()
    const childResponse = await childCreated
    expect(childResponse.ok()).toBe(true)
    const childId = await childResponse.json() as string
    await expect(dialog).toBeHidden()
    await search.fill(childName)
    await expect(page.getByRole('table')).toContainText(ar ? 'حساب ترحيل' : 'Posting account')
    await page.getByRole('link', { name: ar ? 'مصروف' : 'Expense', exact: true }).click()
    await page.getByRole('button', { name: ar ? 'إضافة مصروف' : 'Add Expense' }).first().click()
    await expect(page.locator('#src option').filter({ hasText: childName })).toHaveCount(1)
    await expect(page.locator('#src option').filter({ hasText: groupName })).toHaveCount(0)
    // The server independently rejects a tampered group account ID.
    const rejected = await page.request.post(`${backend}/rest/v1/rpc/create_adjustment`, {
      headers, data: {
        p_organization_id: org, p_transaction_date: '2026-09-01',
        p_description: 'Disposable group guard check', p_reason: 'Local verification',
        p_lines: [
          { account_id: groupId, side: 'debit', amount_minor: 100 },
          { account_id: childId, side: 'credit', amount_minor: 100 },
        ],
      },
    })
    expect(rejected.ok()).toBe(false)
    expect((await rejected.json()).message).toContain('ACCOUNT_GROUP_NOT_POSTABLE')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true }).click()
    await page.getByRole('link', { name: ar ? 'الحسابات' : 'Accounts', exact: true }).first().click()
    await search.fill(groupName)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await search.boundingBox())!.width).toBeGreaterThan(300)
    await expect(page.getByText(ar ? 'تم حفظ الحساب' : 'Account saved', { exact: true })).toHaveCount(0, { timeout: 6000 })
    await mkdir('docs/evidence/as-s2-02a', { recursive: true })
    await page.screenshot({ path: `docs/evidence/as-s2-02a/${locale}-group-mobile.png`, fullPage: true })
  })
}
