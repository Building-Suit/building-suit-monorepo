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
  test(`${locale}: period close, hard close, reasoned reopen, and history`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'ar' ? ar : en
    if (locale === 'ar') await context.addCookies([
      { name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' },
      { name: 'i18n_redirected', value: 'ar', domain: '127.0.0.1', path: '/' },
    ])
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
    const existing = await page.request.get(`${backend}/rest/v1/accounting_periods?select=start_date,end_date&organization_id=eq.${organizationId}`, { headers })
    expect(existing.ok()).toBe(true)
    const used = new Set((await existing.json() as Array<{ start_date: string }>).map(row => row.start_date))
    let day = locale === 'en' ? 1 : 183
    let date = ''
    while (!date) {
      const candidate = new Date(Date.UTC(2090, 0, day++)).toISOString().slice(0, 10)
      if (!used.has(candidate)) date = candidate
    }

    await page.goto('/periods')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.getByRole('heading', { level: 1, name: copy.periods.title })).toBeVisible()
    await expect(page.getByText(copy.periods.fiscalYear, { exact: true })).toBeVisible()
    await page.locator('#period-start').fill(date)
    await page.locator('#period-end').fill(date)
    await page.getByRole('button', { name: copy.periods.create, exact: true }).click()

    const period = page.locator(`section[data-period-start="${date}"]`)
    await expect(period).toBeVisible()
    const stamp = Date.now().toString().slice(-8)
    const debit = await rpc('create_account', { p_name: `Period debit ${stamp}`, p_type: 'asset', p_subtype: 'bank' })
    const credit = await rpc('create_account', { p_name: `Period credit ${stamp}`, p_type: 'equity', p_subtype: 'other_equity' })
    const journalDescription = `Period action ${date}`
    await rpc('create_adjustment', {
      p_transaction_date: date, p_description: journalDescription, p_reason: 'Period browser fixture',
      p_lines: [{ account_id: debit, side: 'debit', amount_minor: 100 }, { account_id: credit, side: 'credit', amount_minor: 100 }],
    })
    await period.getByRole('button', { name: copy.periods.softClose, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'soft_closed')
    await expect(period).toContainText(copy.periods.status.soft_closed)
    await period.getByRole('button', { name: copy.periods.hardClose, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'hard_closed')
    await expect(period).toContainText(copy.periods.status.hard_closed)

    await page.goto(`/transactions?q=${encodeURIComponent(journalDescription)}`)
    const journalRow = page.getByRole('row').filter({ hasText: journalDescription })
    await journalRow.getByRole('button').first().click()
    const journalDialog = page.getByRole('dialog')
    await expect(journalDialog).toContainText(copy.journalCenter.periodHardClosed)
    await expect(journalDialog.getByRole('button', { name: copy.detail.reverseAction, exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto('/periods')
    await expect(period).toHaveAttribute('data-period-status', 'hard_closed')

    const reopen = period.getByRole('button', { name: copy.periods.reopen, exact: true })
    await expect(reopen).toBeDisabled()
    await period.getByLabel(copy.periods.reason).fill(locale === 'ar' ? 'تصحيح معتمد' : 'Approved correction')
    await expect(reopen).toBeEnabled()
    await reopen.click()
    await expect(period).toHaveAttribute('data-period-status', 'soft_closed')
    await period.getByLabel(copy.periods.reason).fill(locale === 'ar' ? 'فتح نافذة التصحيح' : 'Open correction window')
    await period.getByRole('button', { name: copy.periods.reopen, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'open')
    await period.getByText(copy.periods.history, { exact: true }).click()
    await expect(period).toContainText(locale === 'ar' ? 'تصحيح معتمد' : 'Approved correction')
    await expect(period).toContainText(locale === 'ar' ? 'فتح نافذة التصحيح' : 'Open correction window')

    await expect(page.locator('#year-start')).toBeVisible()
    await expect(page.locator('#year-end-reason')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
