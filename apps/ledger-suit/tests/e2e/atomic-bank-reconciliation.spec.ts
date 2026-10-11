import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`bank exact matching, unmatch reason and completion: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const reconciliation = { id: 'reconcile-one', bank_account_id: 'bank-one', currency_code: 'EGP', statement_start: '2035-01-01', statement_end: '2035-01-31', file_name: 'immutable-bank.csv', status: 'review', import_errors: [] }
    const line = { id: 'line-one', source_row: 1, date: '2035-01-02', description: 'Receipt', external_reference: 'BANK-1', amount_minor: '10000', status: 'unmatched', validation_error: null }
    const match = { id: 'match-one', active: false, statement_total_minor: '10000', ledger_total_minor: '10000', matched_at: '2035-01-03', unmatch_reason: null as string | null }
    const { calls, goto } = await ledgerFixture(page, locale, ['bank.read','bank.import','bank.match','bank.adjust','bank.complete','bank.reopen'], (name, args) => {
      if (name === 'read_bank_reconciliation_workspace') return { accounts: [], reconciliations: [reconciliation], selected_id: reconciliation.id, lines: [line], candidates: [{ id: 'journal-one', date: '2035-01-02', reference: 'J-1', description: 'Receipt journal', effect_minor: '10000' }], matches: calls.some(call => call.name === 'match_bank_items') ? [match] : [], outstanding: [], events: [], equation: { statement_minor: '10000', outstanding_minor: '0', ledger_minor: '10000', difference_minor: '0' } }
      if (name === 'match_bank_items') { line.status = 'matched'; match.active = true; return match.id }
      if (name === 'unmatch_bank_items') { line.status = 'unmatched'; match.active = false; match.unmatch_reason = String(args.p_reason); return null }
      if (name === 'complete_bank_reconciliation') { reconciliation.status = 'completed'; return null }
      if (name === 'reopen_bank_reconciliation') { reconciliation.status = 'reopened'; return null }
      return undefined
    })
    await goto('/bank-reconciliation')
    const button = page.getByRole('button', { name: copy.bank.matchExact, exact: true })
    await expect(button).toBeDisabled()
    await page.getByRole('checkbox', { name: copy.bank.selectLine.replace('{row}', '1') }).check()
    await expect(button).toBeDisabled()
    await page.getByRole('checkbox', { name: copy.bank.selectTransaction.replace('{reference}', 'J-1') }).check()
    await button.click()
    await expect(page.locator('[data-bank-state=matched]')).toBeVisible()
    expect(calls.find(call => call.name === 'match_bank_items')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_reconciliation_id: 'reconcile-one', p_statement_line_ids: ['line-one'], p_transaction_ids: ['journal-one'], p_idempotency_key: expect.stringMatching(/^[\da-f-]{36}$/) })
    await page.getByRole('button', { name: copy.bank.unmatch, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#bank-reason').fill('Reviewed mistaken match')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.locator('[data-bank-state=unmatched]')).toBeVisible()
    expect(calls.find(call => call.name === 'unmatch_bank_items')?.args).toMatchObject({ p_match_group_id: 'match-one', p_reason: 'Reviewed mistaken match' })
    await page.getByRole('button', { name: copy.bank.complete, exact: true }).click()
    await expect(page.getByRole('button', { name: copy.bank.reopen, exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/bank-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
