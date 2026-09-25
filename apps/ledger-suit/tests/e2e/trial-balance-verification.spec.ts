import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

const period = { from: '2026-05-01', to: '2026-05-31' }

async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 })
  await page.getByLabel(copy.auth.email).fill('owner@alpha.test')
  await page.getByLabel(copy.auth.password).fill('ledgersuit')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: six-column Trial Balance, period refresh, drill-down contexts and responsive RTL`, async ({ page, context }) => {
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
    expect(backend).toBe('http://127.0.0.1:60321')
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
    const bankName = `${locale === 'ar' ? 'بنك ميزان المراجعة' : 'Trial Balance bank'} ${stamp}`
    const equityName = `${locale === 'ar' ? 'حقوق ملكية الميزان' : 'Trial Balance equity'} ${stamp}`
    const expenseName = `${locale === 'ar' ? 'مصروف الميزان' : 'Trial Balance expense'} ${stamp}`
    const revenueName = `${locale === 'ar' ? 'إيراد الميزان' : 'Trial Balance revenue'} ${stamp}`
    const bank = await rpc('create_account', { p_name: bankName, p_type: 'asset', p_subtype: 'bank', p_code: `TB${stamp}` })
    const equity = await rpc('create_account', { p_name: equityName, p_type: 'equity', p_subtype: 'other_equity' })
    const expense = await rpc('create_account', { p_name: expenseName, p_type: 'expense', p_subtype: 'other_expense' })
    const revenue = await rpc('create_account', { p_name: revenueName, p_type: 'revenue', p_subtype: 'other_income' })
    const descriptions = {
      opening: locale === 'ar' ? `تمويل قبل الفترة ${stamp}` : `Pre-period funding ${stamp}`,
      payment: locale === 'ar' ? `سداد أول الفترة ${stamp}` : `Period-start payment ${stamp}`,
      receipt: locale === 'ar' ? `تحصيل آخر الفترة ${stamp}` : `Period-end receipt ${stamp}`,
      after: locale === 'ar' ? `حركة بعد الفترة ${stamp}` : `After-period receipt ${stamp}`,
    }
    async function adjustment(date: string, description: string, lines: Array<Record<string, unknown>>) {
      await rpc('create_adjustment', { p_transaction_date: date, p_description: description, p_reason: 'V2-VER-002A disposable browser fixture', p_lines: lines })
    }
    await adjustment('2026-04-30', descriptions.opening, [
      { account_id: bank, side: 'debit', amount_minor: 100000 },
      { account_id: equity, side: 'credit', amount_minor: 100000 },
    ])
    await adjustment('2026-05-01', descriptions.payment, [
      { account_id: expense, side: 'debit', amount_minor: 20000 },
      { account_id: bank, side: 'credit', amount_minor: 20000 },
    ])
    await adjustment('2026-05-31', descriptions.receipt, [
      { account_id: bank, side: 'debit', amount_minor: 50000 },
      { account_id: revenue, side: 'credit', amount_minor: 50000 },
    ])
    await adjustment('2026-06-01', descriptions.after, [
      { account_id: bank, side: 'debit', amount_minor: 700 },
      { account_id: revenue, side: 'credit', amount_minor: 700 },
    ])

    await page.goto(`/reports?from=${period.from}&to=${period.to}&asOf=${period.to}`)
    await page.waitForFunction(() => Boolean(
      (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown } | null)?.__vue_app__
      && document.querySelector('.nuxt-route-announcer'),
    ))
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('#from')).toHaveValue(period.from)
    await expect(page.locator('#to')).toHaveValue(period.to)
    const trial = page.locator('section[aria-labelledby="tb-heading"]')
    await expect(trial).toBeVisible()
    for (const label of [copy.reports.openingDebit, copy.reports.openingCredit, copy.reports.periodDebit, copy.reports.periodCredit, copy.reports.closingDebit, copy.reports.closingCredit]) {
      await expect(trial.getByRole('columnheader', { name: label, exact: true })).toBeVisible()
    }
    const row = trial.getByRole('row').filter({ hasText: bankName })
    await expect(row).toContainText(`TB${stamp}`)
    for (const amount of ['1,000.00', '500.00', '200.00', '1,300.00']) await expect(row).toContainText(amount)
    await expect(row).not.toContainText('-')
    await expect(trial.locator('tfoot')).toContainText(copy.reports.total)
    await expect(trial).toContainText(copy.reports.inBalance)

    await page.locator('#to').fill('2026-06-30')
    await expect(page).toHaveURL(/to=2026-06-30/)
    await page.locator('#from').fill('2026-06-01')
    await expect(page).toHaveURL(/from=2026-06-01.*to=2026-06-30/)
    await expect(row).toContainText('1,300.00')
    await expect(row).toContainText('7.00')
    await page.locator('#from').fill(period.from)
    await expect(page).toHaveURL(/from=2026-05-01/)
    await page.locator('#to').fill(period.to)
    await expect(page).toHaveURL(/from=2026-05-01.*to=2026-05-31/)

    async function openDrilldown(column: string, expectedFrom: string, expectedTo: string) {
      const activityResponse = page.waitForResponse(response => response.url().includes('/rpc/read_account_activity')
        && response.request().postDataJSON().p_account_id === bank
        && response.request().postDataJSON().p_from_date === expectedFrom
        && response.request().postDataJSON().p_to_date === expectedTo)
      await row.getByRole('button', { name: copy.reports.drilldownAmount.replace('{column}', column).replace('{account}', bankName), exact: true }).click()
      const response = await activityResponse
      expect(response.ok()).toBe(true)
      const dialog = page.getByRole('dialog')
      await expect(dialog.locator('#activity-from')).toHaveValue(expectedFrom)
      await expect(dialog.locator('#activity-to')).toHaveValue(expectedTo)
      return { dialog, data: await response.json() }
    }

    const opening = await openDrilldown(copy.reports.openingDebit, '0001-01-01', '2026-04-30')
    expect(opening.data.closing_minor).toBe('100000')
    await expect(opening.dialog).toContainText(descriptions.opening)
    await expect(opening.dialog).not.toContainText(descriptions.payment)
    await page.keyboard.press('Escape')

    const movement = await openDrilldown(copy.reports.periodCredit, period.from, period.to)
    expect([movement.data.opening_minor, movement.data.debit_minor, movement.data.credit_minor, movement.data.closing_minor]).toEqual(['100000', '50000', '20000', '130000'])
    await expect(movement.dialog).toContainText(descriptions.payment)
    await expect(movement.dialog).toContainText(descriptions.receipt)
    await movement.dialog.getByRole('button', { name: descriptions.receipt, exact: true }).click()
    await expect(movement.dialog.getByRole('heading', { level: 2 })).toHaveText(descriptions.receipt)
    await expect(movement.dialog.getByRole('table')).toContainText(revenueName)
    await movement.dialog.getByRole('button', { name: copy.accountActivity.back, exact: true }).click()
    await expect(movement.dialog.locator('#activity-from')).toHaveValue(period.from)
    await page.keyboard.press('Escape')

    const closing = await openDrilldown(copy.reports.closingDebit, '0001-01-01', period.to)
    expect(closing.data.closing_minor).toBe('130000')
    await expect(closing.dialog).toContainText(descriptions.opening)
    await expect(closing.dialog).toContainText(descriptions.payment)
    await expect(closing.dialog).toContainText(descriptions.receipt)
    await expect(closing.dialog).not.toContainText(descriptions.after)
    await page.keyboard.press('Escape')

    await expect(page.locator('#from')).toHaveValue(period.from)
    await expect(page.locator('#to')).toHaveValue(period.to)
    await expect(page).toHaveURL(/from=2026-05-01.*to=2026-05-31/)
    await page.setViewportSize({ width: 390, height: 844 })
    const scroller = trial.locator('.overflow-auto')
    await expect(scroller).toBeVisible()
    expect(await scroller.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(row.getByRole('button', { name: copy.reports.drilldownAmount.replace('{column}', copy.reports.closingDebit).replace('{account}', bankName), exact: true })).toBeVisible()
  })
}
