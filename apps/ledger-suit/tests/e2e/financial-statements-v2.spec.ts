import { expect, test } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: mapped statements, indirect cash flow and report drill-down`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'ar' ? ar : en
    if (locale === 'ar') await context.addCookies([
      { name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' },
      { name: 'i18n_redirected', value: 'ar', domain: '127.0.0.1', path: '/' },
    ])
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
    await page.getByLabel(copy.auth.email).fill('owner@alpha.test')
    await page.getByLabel(copy.auth.password).fill('ledgersuit')
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
    const accountRequest = page.waitForRequest(request => request.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: copy.nav.accounts, exact: true }).first().click()
    const request = await accountRequest
    const backend = new URL(request.url()).origin
    expect(backend).toBe('http://127.0.0.1:60321')
    const organizationId = new URL(request.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const auth = await request.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: organizationId, ...data } })
      const payload = await response.json()
      expect(response.ok(), `${name}: ${response.status()} ${JSON.stringify(payload)}`).toBe(true)
      return payload
    }
    const stamp = Date.now().toString().slice(-9)
    const month = locale === 'en' ? '06' : '07'
    const date = (day: string) => `2026-${month}-${day}`
    const cash = await rpc('create_account', { p_name: `FS cash ${stamp}`, p_type: 'asset', p_subtype: 'bank' })
    const revenue = await rpc('create_account', { p_name: `FS revenue ${stamp}`, p_type: 'revenue', p_subtype: 'service_revenue' })
    const expense = await rpc('create_account', { p_name: `FS expense ${stamp}`, p_type: 'expense', p_subtype: 'rent' })
    const equipment = await rpc('create_account', { p_name: `FS equipment ${stamp}`, p_type: 'asset', p_subtype: 'equipment' })
    const capital = await rpc('create_account', { p_name: `FS capital ${stamp}`, p_type: 'equity', p_subtype: 'owner_capital' })
    async function map(account: string, dimension: string, line: string) {
      await rpc('schedule_account_financial_mapping', { p_account_id: account, p_dimension: dimension,
        p_statement_line: line, p_effective_from: date('01'), p_reason: 'Disposable browser statement fixture', p_request_id: crypto.randomUUID() })
    }
    async function mapBalance(account: string, line: string) {
      await rpc('schedule_account_statement_classification', { p_account_id: account, p_statement_line: line,
        p_effective_from: date('01'), p_reason: 'Disposable browser statement fixture', p_request_id: crypto.randomUUID() })
    }
    await map(revenue, 'profit_loss', 'operating_revenue')
    await map(expense, 'profit_loss', 'operating_expenses')
    await map(revenue, 'cash_flow', 'operating')
    await map(expense, 'cash_flow', 'operating')
    await map(equipment, 'cash_flow', 'investing')
    await map(capital, 'cash_flow', 'financing')
    await mapBalance(cash, 'current_assets')
    await mapBalance(equipment, 'property_equipment')
    await mapBalance(capital, 'equity')
    async function post(day: string, lines: Array<Record<string, unknown>>) {
      await rpc('create_adjustment', { p_transaction_date: day, p_lines: lines,
        p_description: `Statement fixture ${stamp}`, p_reason: 'Disposable browser statement fixture' })
    }
    await post(date('10'), [{ account_id: cash, side: 'debit', amount_minor: 10000 }, { account_id: revenue, side: 'credit', amount_minor: 10000 }])
    await post(date('11'), [{ account_id: expense, side: 'debit', amount_minor: 3000 }, { account_id: cash, side: 'credit', amount_minor: 3000 }])
    await post(date('12'), [{ account_id: equipment, side: 'debit', amount_minor: 5000 }, { account_id: cash, side: 'credit', amount_minor: 5000 }])
    await post(date('13'), [{ account_id: cash, side: 'debit', amount_minor: 2000 }, { account_id: capital, side: 'credit', amount_minor: 2000 }])
    const rawStatement = await rpc('report_profit_and_loss', { p_from_date: date('01'), p_to_date: date('30') })
    expect(rawStatement).toEqual(expect.arrayContaining([expect.objectContaining({ account_id: revenue, amount_minor: 10000 })]))

    await page.goto(`/reports?tab=profit-loss&from=${date('01')}&to=${date('30')}&asOf=${date('30')}`)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    const pl = page.getByRole('tabpanel', { name: copy.reports.tabs.profitLoss })
    await expect(pl.getByText(`FS revenue ${stamp}`)).toBeVisible()
    await expect(pl.getByText(`FS expense ${stamp}`)).toBeVisible()
    await expect(pl.getByRole('row', { name: new RegExp(`FS revenue ${stamp}`) })).toContainText('100.00')
    await pl.getByRole('button', { name: `FS revenue ${stamp}` }).click()
    await expect(page.getByRole('dialog')).toContainText(`FS revenue ${stamp}`)
    await expect(page.locator('#activity-from')).toHaveValue(date('01'))
    await page.getByRole('dialog').getByRole('button', { name: `Statement fixture ${stamp}` }).click()
    await expect(page.getByRole('dialog')).toContainText(`FS cash ${stamp}`)
    await page.getByRole('dialog').getByRole('button', { name: copy.accountActivity.back }).click()
    await expect(page.locator('#activity-from')).toHaveValue(date('01'))
    await page.getByRole('dialog').getByRole('button', { name: /close|إغلاق/i }).first().click()
    await expect(page).toHaveURL(/tab=profit-loss/)
    await expect(page.locator('#from')).toHaveValue(date('01'))

    await page.getByRole('tab', { name: copy.reports.tabs.balanceSheet }).click()
    const bs = page.getByRole('tabpanel', { name: copy.reports.tabs.balanceSheet })
    await expect(bs.getByText(`FS equipment ${stamp}`)).toBeVisible()
    await expect(bs.getByRole('row', { name: new RegExp(`FS equipment ${stamp}`) })).toContainText('50.00')
    await page.getByRole('tab', { name: copy.reports.tabs.cashFlow }).click()
    const cf = page.getByRole('tabpanel', { name: copy.reports.tabs.cashFlow })
    await expect(cf).toContainText(copy.financialMapping.cashLines.net_profit)
    await expect(cf).toContainText(copy.financialMapping.cashLines.operating_cash)
    await expect(cf).toContainText(copy.financialMapping.cashLines.investing_cash)
    await expect(cf).toContainText(copy.financialMapping.cashLines.financing_cash)
    await expect(cf.getByRole('alert')).toHaveCount(0)

    const unmapped = await rpc('create_account', { p_name: `FS unmapped ${stamp}`, p_type: 'revenue', p_subtype: 'service_revenue' })
    await post(date('14'), [{ account_id: cash, side: 'debit', amount_minor: 700 }, { account_id: unmapped, side: 'credit', amount_minor: 700 }])
    await page.goto(`/reports?tab=profit-loss&from=${date('01')}&to=${date('30')}&asOf=${date('30')}`)
    const unmappedPl = page.getByRole('tabpanel', { name: copy.reports.tabs.profitLoss })
    await expect(unmappedPl.getByRole('alert')).toContainText(copy.financialMapping.incomplete)
    await expect(unmappedPl.getByRole('button', { name: `FS unmapped ${stamp}` })).toBeVisible()
    await page.getByRole('tab', { name: copy.reports.tabs.cashFlow }).click()
    await expect(page.getByRole('tabpanel', { name: copy.reports.tabs.cashFlow }).getByRole('alert').first()).toBeVisible()

    await page.goto('/accounts?view=tree')
    await page.locator('#account-search').fill(`FS unmapped ${stamp}`)
    const treeRow = page.getByRole('row', { name: new RegExp(`FS unmapped ${stamp}`) })
    await treeRow.getByText(copy.accountTree.more).click()
    await treeRow.getByRole('button', { name: copy.statementClassification.title }).click()
    const mapping = page.getByRole('dialog', { name: copy.statementClassification.title })
    await expect(mapping).toContainText(`FS unmapped ${stamp}`)
    await mapping.locator('#statement-line').selectOption('operating_revenue')
    await mapping.locator('#statement-effective').fill(date('01'))
    await mapping.locator('#statement-reason').fill('Disposable browser mapping history fixture')
    await mapping.getByRole('button', { name: copy.statementClassification.schedule }).click()
    await expect(mapping).toHaveCount(0)
    await treeRow.getByRole('button', { name: copy.statementClassification.title }).click()
    await expect(page.getByRole('dialog', { name: copy.statementClassification.title })).toContainText('Disposable browser mapping history fixture')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('dialog', { name: copy.statementClassification.title })).toBeVisible()
  })
}
