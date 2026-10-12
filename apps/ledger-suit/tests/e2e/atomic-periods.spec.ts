import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`period creation, closure, reopening and year end: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const periods: Record<string, unknown>[] = [], transitions: Record<string, unknown>[] = [], closes: Record<string, unknown>[] = []
    const { calls, goto } = await ledgerFixture(page, locale, ['periods.read', 'periods.manage', 'periods.year_end_close'], (name, args) => {
      if (name === 'organizations') return { fiscal_year_start_month: 1 }
      if (name === 'accounting_periods') return periods
      if (name === 'accounting_period_transitions') return transitions
      if (name === 'fiscal_year_closes') return closes
      if (name === 'create_accounting_period') { periods.push({ id: 'period-one', start_date: args.p_start_date, end_date: args.p_end_date, fiscal_year_start: '2035-01-01', fiscal_year_end: '2035-12-31', status: 'open' }); return 'period-one' }
      if (name === 'transition_accounting_period') { transitions.push({ id: transitions.length + 1, period_id: 'period-one', previous_status: periods[0].status, new_status: args.p_new_status, reason: args.p_reason, transitioned_at: '2035-01-02T10:00:00Z' }); periods[0].status = args.p_new_status; return null }
      if (name === 'close_fiscal_year') { closes.push({ fiscal_year_start: '2035-01-01', net_income_minor: '12300', closing_transaction_id: 'closing-journal' }); return 'closing-journal' }
      return undefined
    })
    await goto('/periods')
    await page.getByRole('button', { name: copy.periods.create, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#period-start').fill('2035-01-01')
    await dialog.locator('#period-end').fill('2035-12-31')
    await dialog.getByRole('button', { name: copy.periods.create, exact: true }).click()
    const period = page.locator('[data-period-start="2035-01-01"]')
    await expect(period).toHaveAttribute('data-period-status', 'open')
    await period.getByRole('button', { name: copy.periods.softClose, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'soft_closed')
    await expect(period.getByRole('button', { name: copy.periods.reopen, exact: true })).toBeDisabled()
    await period.getByRole('button', { name: copy.periods.hardClose, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'hard_closed')
    await expect(period.getByRole('button', { name: copy.periods.reopen, exact: true })).toBeDisabled()
    await period.locator('#reason-period-one').fill('Reviewed correction')
    await period.getByRole('button', { name: copy.periods.reopen, exact: true }).click()
    await expect(period).toHaveAttribute('data-period-status', 'soft_closed')
    expect(calls.filter(call => call.name === 'transition_accounting_period').at(-1)?.args).toEqual({ p_period_id: 'period-one', p_new_status: 'soft_closed', p_reason: 'Reviewed correction' })
    await page.locator('#year-start').fill('2035-01-01')
    await expect(page.getByRole('button', { name: copy.periods.yearEnd, exact: true })).toBeDisabled()
    await page.locator('#year-end-reason').fill('Reviewed closing result')
    await page.getByRole('button', { name: copy.periods.yearEnd, exact: true }).click()
    await expect(period.getByRole('link', { name: copy.periods.closingJournal })).toHaveAttribute('href', '/transactions?q=closing-journal')
    expect(calls.find(call => call.name === 'close_fiscal_year')?.args).toEqual({ p_organization_id: fixtureOrganization, p_fiscal_year_start: '2035-01-01', p_reason: 'Reviewed closing result', p_idempotency_key: 'year-end:2035-01-01' })
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/periods-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
