import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import { completePasswordSignIn } from './password-sign-in'

async function signIn(page: Page, locale: 'en' | 'ar', email = 'owner@alpha.test') {
  await page.goto('/login')
  const authenticated = page.waitForResponse(response => response.url().includes('/auth/v1/token?grant_type=password') && response.request().method() === 'POST')
  await completePasswordSignIn(page, email, 'ledgersuit', locale)
  const response = await authenticated
  expect(response.ok()).toBe(true)
  const { access_token: accessToken } = await response.json()
  await expect(page).toHaveURL('/dashboard')
  return accessToken as string
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: native journals, private saved views and report return navigation`, async ({ page, context, browser }, testInfo) => {
    test.setTimeout(120_000)
    const copy = locale === 'ar' ? ar : en
    const cookies = ['building-suit-locale', 'i18n_redirected'].map(name => ({ name, value: locale, domain: '127.0.0.1', path: '/' }))
    await context.addCookies(cookies)
    await signIn(page, locale)
    const searched = page.waitForRequest(request => request.url().includes('/rest/v1/rpc/search_transactions'))
    await page.getByRole('link', { name: copy.nav.transactions, exact: true }).first().click()
    const source = await searched
    const backend = new URL(source.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:61021']).toContain(backend)
    const organizationId = source.postDataJSON().p_organization_id as string
    const auth = await source.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: organizationId, ...data } })
      expect(response.ok(), `${name}: HTTP ${response.status()}`).toBe(true)
      return response.json()
    }
    const stamp = `${locale}-${Date.now()}`
    const bankName = `LS-JRN-VERIFY-001 bank ${stamp}`
    const equityName = `LS-JRN-VERIFY-001 equity ${stamp}`
    const description = `LS-JRN-VERIFY-001 adjustment ${stamp}`
    const bank = await rpc('create_account', { p_name: bankName, p_type: 'asset', p_subtype: 'bank' })
    const equity = await rpc('create_account', { p_name: equityName, p_type: 'equity', p_subtype: 'other_equity' })
    const revenue = await rpc('create_account', { p_name: `LS-JRN-VERIFY-001 revenue ${stamp}`, p_type: 'revenue', p_subtype: 'other_income' })
    const original = await rpc('create_adjustment', {
      p_transaction_date: '2026-10-15', p_description: description,
      p_reason: 'Retained native Journal Center acceptance fixture',
      p_lines: [{ account_id: bank, side: 'debit', amount_minor: 32100, memo: 'Bank line' }, { account_id: equity, side: 'credit', amount_minor: 32100, memo: 'Equity line' }],
    })
    const reversal = await page.request.post(`${backend}/rest/v1/rpc/reverse_transaction`, { headers, data: { p_transaction_id: original, p_reason: 'Retained native browser relationship fixture', p_reversal_date: '2026-10-16' } })
    expect(reversal.ok()).toBe(true)
    const reversalId = await reversal.json()
    const incomeDescription = `LS-JRN-VERIFY-001 income ${stamp}`
    const income = await rpc('record_income', { p_transaction_date: '2026-10-17', p_description: incomeDescription, p_amount_minor: 54300, p_destination_account_id: bank, p_revenue_account_id: revenue })

    await page.goto(`/transactions?account=${bank}&from=2026-10-01&to=2026-10-31`)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    const account = page.getByRole('combobox', { name: copy.transactions.account, exact: true })
    const status = page.getByRole('combobox', { name: copy.transactions.status, exact: true })
    const sourceFilter = page.getByRole('combobox', { name: copy.journalCenter.source, exact: true })
    const table = page.getByRole('region', { name: copy.transactions.title, exact: true }).getByRole('table')
    await expect(account).toHaveValue(bank)
    await expect(table.getByRole('row')).toHaveCount(4)
    await account.selectOption(equity)
    await expect(table.getByRole('row')).toHaveCount(3)
    await expect(table).not.toContainText(incomeDescription)
    await account.selectOption(bank)
    const from = page.getByLabel(copy.transactions.fromDate, { exact: true })
    await from.fill('2026-10-17')
    await expect(table.getByRole('row')).toHaveCount(2)
    await expect(table).toContainText(incomeDescription)
    await expect(table).not.toContainText(description)
    await from.fill('2026-10-01')
    await expect(table.getByRole('row')).toHaveCount(4)
    const references = async () => (await table.locator('tbody tr td:first-child').allTextContents()).map(value => value.trim())
    const expectedReferences = (await references()).toSorted()
    expect(new Set(expectedReferences).size).toBe(3)
    const sortButton = table.getByRole('button', { name: copy.journalCenter.journalReference, exact: true })
    await sortButton.click()
    await expect(page).toHaveURL(/sort=journal_reference/)
    await expect.poll(references).toEqual(expectedReferences.toReversed())
    await sortButton.press('Enter')
    await expect(page).toHaveURL(/direction=asc/)
    await expect.poll(references).toEqual(expectedReferences)
    await expect(table.getByRole('columnheader', { name: copy.journalCenter.journalReference })).toHaveAttribute('aria-sort', 'ascending')
    await sourceFilter.selectOption('manual')
    await status.selectOption('reversed')
    const row = table.getByRole('row').filter({ hasText: description })
    await expect(table.getByRole('row')).toHaveCount(2)
    await expect(row).toContainText('321.00')
    await expect(row).toContainText(copy.journalSources.manual)
    const search = page.getByRole('searchbox', { name: copy.transactions.searchLabel, exact: true })
    await search.fill('no-native-journal-matches-this-text')
    await expect(page.getByText(copy.transactions.noMatchTitle, { exact: true })).toBeVisible()
    await search.fill(description)
    await expect(row).toBeVisible()
    await expect(page).toHaveURL(/q=LS-JRN-VERIFY-001/)
    await page.getByRole('button', { name: copy.transactionWorkspace.moreFilters, exact: true }).click()
    await page.getByLabel(copy.transactions.minAmount, { exact: true }).fill('321.00')
    await page.getByLabel(copy.transactions.maxAmount, { exact: true }).fill('321.00')
    await expect(row).toBeVisible()

    const viewName = `LS-JRN-VERIFY-001 ${stamp}`
    await page.getByLabel(copy.journalCenter.viewName, { exact: true }).fill(viewName)
    await page.getByRole('button', { name: copy.journalCenter.saveView, exact: true }).click()
    const views = page.getByRole('combobox', { name: copy.journalCenter.savedViews, exact: true })
    await expect(views).toContainText(viewName)
    const saved = await page.request.get(`${backend}/rest/v1/saved_views?select=id,name,filters,sort,visibility&name=eq.${encodeURIComponent(viewName)}`, { headers })
    expect(saved.ok()).toBe(true)
    const [privateView] = await saved.json()
    expect(privateView.visibility).toBe('private')
    expect(privateView.filters).toMatchObject({ accountId: bank, status: 'reversed', source: 'manual', search: description, from: '2026-10-01', to: '2026-10-31', minAmount: '321.00', maxAmount: '321.00' })
    expect(privateView.sort).toEqual({ column: 'journal_reference', direction: 'asc' })
    await status.selectOption('posted')
    await expect(row).toHaveCount(0)
    await views.selectOption({ label: viewName })
    await expect(status).toHaveValue('reversed')
    await expect(row).toBeVisible()
    const savedUrl = page.url()
    await page.reload()
    await expect(status).toHaveValue('reversed')
    await expect(row).toBeVisible()
    await expect(page).toHaveURL(savedUrl)
    await expect(views).toContainText(viewName)
    await views.selectOption({ label: viewName })
    await expect(row).toBeVisible()

    await row.click()
    const journal = page.getByRole('dialog')
    await expect(journal).toContainText(description)
    await expect(journal).toContainText(bankName)
    await expect(journal).toContainText(equityName)
    await journal.getByRole('button', { name: new RegExp(copy.journalCenter.reversalJournal) }).click()
    await expect(journal).toContainText(copy.journalCenter.reverses)
    await expect(journal).toContainText(copy.journalCenter.originalJournal)
    await journal.getByRole('button', { name: copy.common.close, exact: true }).click()
    await expect(row).toBeVisible()
    await expect(page).toHaveURL(savedUrl)

    const peerContext = await browser.newContext()
    try {
      const peerPage = await peerContext.newPage()
      const peerToken = await signIn(peerPage, 'en', 'accountant@alpha.test')
      const peerHeaders = { apikey: headers.apikey, authorization: `Bearer ${peerToken}` }
      const privateUrl = `${backend}/rest/v1/saved_views?id=eq.${privateView.id}&select=id,name,filters,sort,visibility`
      const deniedRead = await peerPage.request.get(privateUrl, { headers: peerHeaders })
      expect(deniedRead.ok()).toBe(true)
      expect(await deniedRead.json()).toEqual([])
      const deniedWrite = await peerPage.request.patch(privateUrl, { headers: { ...peerHeaders, Prefer: 'return=representation' }, data: { name: 'Unauthorized overwrite' } })
      expect(deniedWrite.ok()).toBe(true)
      expect(await deniedWrite.json()).toEqual([])
      const retained = await page.request.get(privateUrl, { headers })
      expect(await retained.json()).toEqual([privateView])
    }
    finally { await peerContext.close() }

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button').filter({ hasText: description }).last()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/reports?tab=overview&from=2026-10-01&to=2026-10-31&asOf=2026-10-31')
    const bankRow = page.getByRole('row').filter({ hasText: bankName })
    await expect(bankRow).toContainText('864.00')
    const reportTrigger = bankRow.getByRole('button', { name: copy.reports.drilldownAmount.replace('{column}', copy.reports.periodDebit).replace('{account}', bankName), exact: true })
    await reportTrigger.click()
    const activity = page.getByRole('dialog')
    await expect(activity).toContainText(bankName)
    await expect(activity.locator('#activity-from')).toHaveValue('2026-10-01')
    await expect(activity.locator('#activity-to')).toHaveValue('2026-10-31')
    const movement = activity.getByRole('button', { name: incomeDescription, exact: true })
    await movement.click()
    await expect(activity).toContainText(incomeDescription)
    await expect(activity).toContainText('543.00')
    await activity.getByRole('button', { name: copy.accountActivity.back, exact: true }).click()
    await expect(movement).toBeFocused()
    await expect(activity.locator('#activity-from')).toHaveValue('2026-10-01')
    await expect(activity.locator('#activity-to')).toHaveValue('2026-10-31')
    await activity.getByRole('button', { name: copy.common.close, exact: true }).click()
    await expect(reportTrigger).toBeFocused()
    await expect(page.getByRole('tab', { name: copy.reports.tabs.overview, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=overview&from=2026-10-01&to=2026-10-31&asOf=2026-10-31/)
    const resultPath = testInfo.outputPath('native-journal-result.json')
    await writeFile(resultPath, JSON.stringify({ task: 'LS-JRN-VERIFY-001', locale, bank, equity, revenue, original, reversal: reversalId, income, saved_view: privateView.id, expected_debits_minor: '118500', expected_credits_minor: '118500', expected_bank_closing_minor: '54300', intercepted_backend_requests: 0, data_retained: true }, null, 2) + '\n')
    await testInfo.attach('native-journal-result', { contentType: 'application/json', path: resultPath })
  })
}
