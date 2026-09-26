import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 })
  await page.getByLabel(copy.auth.email).fill('owner@alpha.test')
  await page.getByLabel(copy.auth.password).fill('ledgersuit')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: create, reconcile, protect, and adjust a Control account`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'ar' ? ar : en
    if (locale === 'ar') await context.addCookies([
      { name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' },
      { name: 'i18n_redirected', value: 'ar', domain: '127.0.0.1', path: '/' },
    ])
    await signIn(page, copy)

    const balancesRequest = page.waitForRequest(request => request.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: copy.nav.accounts, exact: true }).first().click()
    await expect(page).toHaveURL('/accounts')
    const source = await balancesRequest
    const backend = new URL(source.url()).origin
    expect(backend).toBe('http://127.0.0.1:60321')
    const organizationId = new URL(source.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const auth = await source.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    const stamp = `${locale}-${Date.now()}`

    const counterpartResponse = await page.request.post(`${backend}/rest/v1/rpc/create_account`, {
      headers,
      data: {
        p_organization_id: organizationId,
        p_name: `Control counterpart ${stamp}`,
        p_code: `CP${Date.now().toString().slice(-6)}`,
        p_type: 'equity', p_subtype: 'other_equity', p_account_role: 'posting',
      },
    })
    expect(counterpartResponse.ok()).toBe(true)
    const counterpartId = await counterpartResponse.json() as string

    await page.reload()
    await expect(page.getByLabel(copy.accounts.searchLabel, { exact: true })).toBeEnabled()
    await page.getByRole('button', { name: copy.accountTree.tableView, exact: true }).click()
    const controlName = locale === 'ar' ? `مراقبة العملاء ${stamp}` : `AR Control ${stamp}`
    await page.getByRole('button', { name: copy.accounts.add, exact: true }).first().click()
    const accountDialog = page.getByRole('dialog')
    await accountDialog.locator('#account-name').fill(controlName)
    await accountDialog.locator('#account-role').selectOption('control')
    await expect(accountDialog.locator('#control-subledger-type')).toBeVisible()
    await accountDialog.locator('#control-subledger-type').selectOption('customer')
    await expect(accountDialog.locator('#account-type')).toHaveValue('asset')
    await expect(accountDialog.locator('#account-subtype')).toHaveValue('accounts_receivable')
    const controlCreated = page.waitForResponse(response => response.url().endsWith('/rpc/create_account'))
    await accountDialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    const controlResponse = await controlCreated
    const controlPayload = await controlResponse.json()
    expect(controlResponse.ok(), JSON.stringify(controlPayload)).toBe(true)
    expect(typeof controlPayload).toBe('string')

    const search = page.getByLabel(copy.accounts.searchLabel, { exact: true })
    await search.fill(controlName)
    const accountRow = page.getByRole('table').first().getByRole('row').filter({ hasText: controlName })
    await expect(accountRow).toContainText(copy.accounts.roles.control)
    await expect(accountRow).toContainText(copy.controls.subledgers.customer)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')

    const reconciliation = page.locator('section').filter({ has: page.getByRole('heading', { name: copy.controls.reconciliation }) })
    await expect(reconciliation).toContainText(controlName)
    await expect(reconciliation.getByRole('row').filter({ hasText: controlName })).toContainText(copy.controls.statuses.reconciled)

    const adjustmentButton = reconciliation.getByRole('row').filter({ hasText: controlName }).getByRole('button', { name: copy.controls.adjust, exact: true })
    await adjustmentButton.click()
    const adjustmentDialog = page.getByRole('dialog')
    await adjustmentDialog.getByLabel(copy.controls.counterpartAccount).selectOption(counterpartId)
    await adjustmentDialog.getByLabel(copy.transactions.amount).fill('10.00')
    const adjustmentDescription = `Control adjustment ${stamp}`
    const adjustmentReason = locale === 'ar' ? 'فرق افتتاحي مراجع' : 'Reviewed opening variance'
    const adjustmentReference = `REC-${stamp}`
    await adjustmentDialog.getByLabel(copy.transactions.description).fill(adjustmentDescription)
    await adjustmentDialog.getByLabel(copy.controls.adjustmentReason).fill(adjustmentReason)
    await adjustmentDialog.getByLabel(copy.controls.reconciliationReference).fill(adjustmentReference)
    await adjustmentDialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(adjustmentDialog).toBeHidden()
    await expect(reconciliation.getByRole('row').filter({ hasText: controlName })).toContainText(copy.controls.statuses.unreconciled)

    await page.goto(`/transactions?q=${encodeURIComponent(adjustmentDescription)}`)
    const journalRow = page.getByRole('row').filter({ hasText: adjustmentDescription })
    await expect(journalRow).toContainText(copy.journalSources.control_adjustment)
    await journalRow.getByRole('button').first().click()
    const journalDialog = page.getByRole('dialog')
    await expect(journalDialog).toContainText(adjustmentReason)
    await expect(journalDialog).toContainText(adjustmentReference)
    await journalDialog.getByRole('button', { name: copy.common.close, exact: true }).click()

    await page.locator('#type').selectOption('adjustment')
    await expect(page.locator('#type')).toHaveValue('adjustment')
    await page.getByRole('button', { name: copy.transactionWorkspace.new, exact: true }).click()
    const genericDialog = page.getByRole('dialog')
    await expect(genericDialog).toBeVisible()
    await expect(genericDialog.locator('#flow')).toHaveValue('adjustment')
    await expect(genericDialog.locator('#line-account-0 option').filter({ hasText: controlName })).toHaveCount(0)
    await genericDialog.getByRole('button', { name: copy.common.cancel, exact: true }).click()

    await page.getByRole('link', { name: copy.nav.accounts, exact: true }).first().click()
    await page.getByRole('button', { name: copy.accountTree.tableView, exact: true }).click()
    await page.getByLabel(copy.accounts.searchLabel, { exact: true }).fill(controlName)
    const lockedRow = page.getByRole('table').first().getByRole('row').filter({ hasText: controlName })
    await expect(lockedRow).toContainText(copy.controls.bindingLocked)
    await lockedRow.getByRole('button', { name: copy.accounts.edit, exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(copy.controls.bindingLockedHint)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  })
}
