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
  test(`${locale}: Journal Center filters, saved views, lines and reversal navigation`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'ar' ? ar : en
    if (locale === 'ar') {
      await context.addCookies([
        { name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' },
        { name: 'i18n_redirected', value: 'ar', domain: '127.0.0.1', path: '/' },
      ])
    }
    await signIn(page, copy)
    const accountRequest = page.waitForRequest(request => request.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: copy.nav.accounts, exact: true }).first().click()
    const source = await accountRequest
    const backend = new URL(source.url()).origin
    const organizationId = new URL(source.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const auth = await source.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: organizationId, ...data } })
      const payload = await response.json()
      expect(response.ok(), `${name}: ${response.status()} ${JSON.stringify(payload)}`).toBe(true)
      return payload
    }

    const stamp = Date.now().toString().slice(-9)
    const bankName = `${locale === 'ar' ? 'بنك مركز القيود' : 'Journal Center bank'} ${stamp}`
    const equityName = `${locale === 'ar' ? 'حقوق ملكية مركز القيود' : 'Journal Center equity'} ${stamp}`
    const description = `${locale === 'ar' ? 'قيد مراجعة مهني' : 'Professional journal review'} ${stamp}`
    const bank = await rpc('create_account', { p_name: bankName, p_type: 'asset', p_subtype: 'bank' })
    const equity = await rpc('create_account', { p_name: equityName, p_type: 'equity', p_subtype: 'other_equity' })
    const original = await rpc('create_adjustment', {
      p_transaction_date: '2026-09-15', p_description: description,
      p_reason: 'Focused Journal Center browser fixture',
      p_lines: [
        { account_id: bank, side: 'debit', amount_minor: 32100, memo: 'Bank line' },
        { account_id: equity, side: 'credit', amount_minor: 32100, memo: 'Equity line' },
      ],
    })
    const reversal = await page.request.post(`${backend}/rest/v1/rpc/reverse_transaction`, {
      headers,
      data: { p_transaction_id: original, p_reason: 'Browser relationship fixture', p_reversal_date: '2026-09-16' },
    })
    expect(reversal.ok(), await reversal.text()).toBe(true)

    await page.goto(`/transactions?account=${bank}&source=manual&status=reversed&from=2026-09-01&to=2026-09-30`)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.getByRole('heading', { level: 1, name: copy.transactions.title })).toBeVisible()
    await expect(page.locator('#account')).toHaveValue(bank)
    await expect(page.locator('#source')).toHaveValue('manual')
    await expect(page.locator('#status')).toHaveValue('reversed')
    const row = page.getByRole('row').filter({ hasText: description })
    await expect(row).toContainText('JRN-')
    await expect(row).toContainText('321.00')
    await expect(row).toContainText(copy.journalSources.manual)

    const viewName = `${locale === 'ar' ? 'قيود سبتمبر' : 'September journals'} ${stamp}`
    await page.locator('#saved-view-name').fill(viewName)
    await page.getByRole('button', { name: copy.journalCenter.saveView, exact: true }).click()
    await expect(page.locator('#saved-view')).toContainText(viewName)
    await page.locator('#status').selectOption('')
    await expect(page).not.toHaveURL(/status=reversed/)
    await page.locator('#saved-view').selectOption({ label: viewName })
    await expect(page.locator('#status')).toHaveValue('reversed')
    await expect(page).toHaveURL(/status=reversed/)

    await row.getByRole('button').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(description)
    await expect(dialog).toContainText(bankName)
    await expect(dialog).toContainText(equityName)
    await expect(dialog).toContainText(copy.journalCenter.reversalJournal)
    await expect(dialog).toContainText(`${copy.detail.debit}:`)
    await expect(dialog).toContainText(`${copy.detail.credit}:`)
    await dialog.getByRole('button', { name: new RegExp(copy.journalCenter.reversalJournal) }).click()
    await expect(dialog).toContainText(copy.journalCenter.reverses)
    await expect(dialog).toContainText(copy.journalCenter.originalJournal)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.keyboard.press('Escape')
    const compactList = page.locator('.md\\:hidden').filter({ hasText: description })
    await expect(compactList).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(compactList).toContainText(copy.detail.debit)
    await expect(compactList).toContainText(copy.detail.credit)
  })
}
