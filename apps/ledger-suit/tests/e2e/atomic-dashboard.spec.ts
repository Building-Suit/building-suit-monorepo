import { expect, test } from '@playwright/test'
import { ledgerFixture } from './atomic-ledger-fixture'
import { recordShellGeometry, expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`financial dashboard exact summary and chart range: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls, goto } = await ledgerFixture(page, locale, ['accounts.read'], (name) => {
      if (name === 'search_transactions') return [{ id: 'transaction-1', transaction_date: '2026-10-01', description: 'Fixture posted expense', category_name: 'Office', from_account_name: 'Bank', to_account_name: 'Expense', status: 'posted', debit_minor: 12500, credit_minor: 12500, currency_code: 'EGP' }]
      if (name === 'dashboard_summary') return { base_currency: 'EGP', total_assets_minor: 12500, total_liabilities_minor: 2000, net_worth_minor: 10500, cash_and_bank_minor: 12500, accounts_receivable_minor: 0, accounts_payable_minor: 2000, revenue_this_month_minor: 0, expenses_this_month_minor: 12500, net_profit_this_month_minor: -12500, revenue_previous_month_minor: 0, expenses_previous_month_minor: 10000, net_profit_previous_month_minor: -10000 }
      if (name === 'report_monthly_series') return [{ month: '2026-10-01', revenue_minor: 0, expense_minor: 12500, net_minor: -12500 }]
      if (name === 'dashboard_liquid_accounts') return [{ account_id: 'bank-1', name: 'Fixture bank', net_debit_minor: 12500 }]
      return undefined
    })
    await goto('/dashboard')
    const dashboardLink = page.locator('#bs-primary-navigation nav').getByRole('link', { name: copy.nav.dashboard, exact: true, includeHidden: true })
    await expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: copy.dashboard.title })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Fixture posted expense' })).toContainText(/125|١٢٥/)
    await expect(page.getByRole('row').filter({ hasText: 'Fixture bank' })).toContainText(/125|١٢٥/)
    await page.getByRole('button', { name: copy.dashboard.months.replace('{count}', '3'), exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'report_monthly_series').at(-1)?.args.p_months).toBe(3)
    const chart = page.locator('.ls-card').filter({ has: page.getByRole('heading', { name: copy.dashboard.revenueVsExpenses, exact: true }) })
    await expect(chart).toHaveAttribute('data-bs-span', '2')
    if (width >= 768) {
      const cash = page.locator('.ls-card').filter({ has: page.getByRole('heading', { name: copy.dashboard.cashPosition, exact: true }) })
      const chartBounds = await chart.boundingBox(), cashBounds = await cash.boundingBox()
      expect(chartBounds).not.toBeNull()
      expect(cashBounds).not.toBeNull()
      expect(chartBounds!.width / cashBounds!.width).toBeGreaterThan(1.75)
    }
    await expectNoPageOverflow(page)
   await recordShellGeometry(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/dashboard-ledger-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
