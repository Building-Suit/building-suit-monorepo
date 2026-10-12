import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const accountId = '47000000-0000-4000-8000-000000000041'
const trial = { account_id: accountId, code: '101', name: 'Fixture bank', type: 'asset', opening_debit_minor: '10000', opening_credit_minor: '0', period_debit_minor: '5000', period_credit_minor: '0', closing_debit_minor: '15000', closing_credit_minor: '0' }
const profit = [{ section: 'operating_revenue', account_id: accountId, code: '101', name: 'Fixture revenue', amount_minor: 5000 }]
const balance = [{ section: 'asset', account_id: accountId, code: '101', name: 'Fixture bank', amount_minor: '15000', statement_line: 'current_assets', effective_from: '2026-01-01' }]
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`five financial report surfaces and activity drilldown: ${locale}, ${theme}, ${width}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  const { calls, goto } = await ledgerFixture(page, locale, ['reports.read', 'reports.export'], name => {
   if (name === 'accounts') return [{ id: accountId, code: '101', name: 'Fixture bank', is_active: true, system_key: 'bank' }]
   if (name === 'report_financial_overview') return { profit_loss: profit, balance_sheet: balance, trial_balance: [trial], integrity: { balanced: true, difference_minor: 0 }, reconciliation: { profit_loss_difference_minor: 0, balance_sheet_difference_minor: 0, mapping_complete: true, accounts: [] } }
   if (name === 'report_profit_and_loss') return profit
   if (name === 'report_classified_balance_sheet') return balance
   if (name === 'report_indirect_cash_flow') return { net_profit_minor: 5000, operating_adjustments: [], operating_adjustments_minor: 0, operating_cash_minor: 5000, investing_cash_minor: 0, financing_cash_minor: 0, unclassified_cash_minor: 0, net_cash_change_minor: 5000, opening_cash_minor: 10000, closing_cash_minor: 15000, operating_adjustment_difference_minor: 0, classification_complete: true, reconciled: true }
   if (name === 'report_general_ledger') return [{ entry_id: 'entry-1', entry_date: '2026-10-01', reference: 'JRN-001', description: 'Fixture journal', debit_minor: 5000, credit_minor: 0, running_balance_minor: 15000 }]
   if (name === 'read_account_activity') return { account: { id: accountId, name: 'Fixture bank', code: '101', type: 'asset', is_archived: false }, currency: 'EGP', from_date: '2026-01-01', to_date: '2026-10-11', opening_minor: '10000', debit_minor: '5000', credit_minor: '0', closing_minor: '15000', total: 0, rows: [] }
   return undefined
  })
  await goto('/reports?from=2026-01-01&to=2026-10-11')
  await expect(page.getByRole('heading', { name: copy.reports.title, exact: true })).toBeVisible()
  const section = page.getByRole('tabpanel')
  await expect(section.getByText('Fixture bank', { exact: true })).toBeVisible()
  await section.getByRole('button', { name: new RegExp(copy.reports.openingDebit) }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fixture bank', exact: true })).toBeVisible()
  expect(calls.find(call => call.name === 'read_account_activity')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_account_id: accountId, p_from_date: '0001-01-01', p_to_date: '2025-12-31' })
  await page.keyboard.press('Escape')
  for (const key of ['profitLoss', 'balanceSheet', 'cashFlow', 'ledger'] as const) {
   await page.getByRole('tab', { name: copy.reports.tabs[key], exact: true }).click()
   await expect(section).toHaveAttribute('aria-label', copy.reports.tabs[key])
   if (key === 'profitLoss') await expect(section.getByText('Fixture revenue', { exact: true })).toBeVisible()
   if (key === 'balanceSheet') await expect(section.getByText('Fixture bank', { exact: true })).toBeVisible()
   if (key === 'cashFlow') await expect(section.getByText(copy.financialMapping.cashLines.closing_cash, { exact: true })).toBeVisible()
   if (key === 'ledger') await expect(section.getByText('Fixture journal', { exact: true })).toBeVisible()
   await expectNoPageOverflow(page)
   await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/reports-${key}-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  }
 })
}
for (const locale of ['en', 'ar'] as const) {
 test(`cash allocation retains classification identity and minor-unit split: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const entryId = '47000000-0000-4000-8000-000000000051'
  const { calls, goto } = await ledgerFixture(page, locale, ['reports.read', 'accounts.update'], name => {
   if (name === 'report_indirect_cash_flow') return { net_profit_minor: 0, operating_adjustments: [], operating_adjustments_minor: 0, operating_cash_minor: 0, investing_cash_minor: 0, financing_cash_minor: 0, unclassified_cash_minor: 10000, net_cash_change_minor: 10000, opening_cash_minor: 0, closing_cash_minor: 10000, operating_adjustment_difference_minor: 0, classification_complete: false, reconciled: true }
   if (name === 'report_cash_flow_detail') return [{ entry_id: entryId, transaction_id: 'fixture-journal', account_id: accountId, section: 'unclassified_cash', amount_minor: 10000 }]
   if (name === 'cash_flow_allocation_context') return { amount_minor: 10000, decision_id: null, allocations: {} }
   if (name === 'classify_cash_flow_entry') return 'classification-one'
   return undefined
  })
  await goto('/reports?tab=cash-flow')
  await page.getByRole('button', { name: copy.financialMapping.allocate, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.financialMapping.lines.operating, { exact: true }).fill('50.00')
  await dialog.getByLabel(copy.financialMapping.lines.investing, { exact: true }).fill('30.00')
  await dialog.getByLabel(copy.financialMapping.lines.financing, { exact: true }).fill('20.00')
  await dialog.getByLabel(copy.statementClassification.reason, { exact: true }).fill('Reviewed original evidence')
  await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.find(call => call.name === 'classify_cash_flow_entry')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_entry_id: entryId, p_allocations: { operating: 5000, investing: 3000, financing: 2000 }, p_reason: 'Reviewed original evidence' })
  expect(calls.find(call => call.name === 'classify_cash_flow_entry')?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
 })
}
