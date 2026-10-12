import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const bankId = '47000000-0000-4000-8000-000000000061'
const bank = { organization_id: fixtureOrganization, account_id: bankId, code: '101', name: 'Fixture bank', type: 'asset', subtype: 'bank', currency: 'EGP', account_role: 'posting', control_subledger_type: null, control_binding_locked: false, normal_balance: 'debit', contra_account_id: null, is_system: false, classification_locked: false, net_debit_minor: '12345', statement_balance_minor: '12345', entry_count: 1, is_archived: false, is_liquid: true, parent_account_id: null }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`account tree, table, chart review and controlled editor: ${locale}, ${theme}, ${width}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  const { calls, goto } = await ledgerFixture(page, locale, ['accounts.read', 'accounts.create', 'accounts.update', 'reports.read', 'transactions.read'], name => {
   if (name === 'read_account_balances') return [bank]
   if (name === 'currencies') return [{ code: 'EGP', name: 'Egyptian pound' }]
   if (name === 'can_use_feature') return false
   if (name === 'read_account_activity') return { account: { id: bankId, name: bank.name, code: bank.code, type: 'asset', is_archived: false }, currency: 'EGP', from_date: '2026-01-01', to_date: '2026-10-11', opening_minor: '0', debit_minor: '12345', credit_minor: '0', closing_minor: '12345', total: 0, rows: [] }
   return undefined
  })
  await goto('/accounts?setup=templates')
  await expect(page.getByRole('heading', { name: copy.chartTemplates.title, exact: true })).toBeVisible()
  await expect(page.getByText(copy.chartTemplates.noApply, { exact: true })).toBeVisible()
  const tree = page.locator('#accounts-tree')
  await expect(tree.getByRole('button', { name: bank.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: copy.accountTree.collapseAll, exact: true }).click()
  await expect(tree.getByRole('button', { name: bank.name, exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: copy.accountTree.expandAll, exact: true }).click()
  await page.getByLabel(copy.accounts.searchLabel, { exact: true }).fill('Fixture bank')
  await page.getByRole('button', { name: copy.accounts.clearSearch, exact: true }).click()
  await expect(page.getByLabel(copy.accounts.searchLabel, { exact: true })).toBeFocused()
  await page.getByRole('button', { name: copy.accountTree.tableView, exact: true }).click()
  const table = page.locator('#accounts-table')
  await expect(table.getByText(bank.name, { exact: true })).toBeVisible()
  await table.getByRole('button', { name: bank.name, exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: bank.name, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: copy.accounts.add, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.accounts.name, { exact: true }).fill('Reviewed account')
  await dialog.getByLabel(copy.accounts.role, { exact: true }).selectOption('group')
  await expect(dialog.getByLabel(copy.accounts.normalBalance, { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true })).toBeVisible()
  await dialog.getByRole('alert').getByRole('button', { name: copy.common.cancel, exact: true }).click()
  expect(calls.filter(call => call.name === 'create_account')).toHaveLength(0)
  await expectNoPageOverflow(page)
  await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/accounts-editor-${locale}-${theme}-${width}.png`, animations: 'disabled' })
 })
}
for (const locale of ['en', 'ar'] as const) {
 test(`dated account classification preserves the expected revision: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const revision = '47000000-0000-4000-8000-000000000062'
  const { calls, goto } = await ledgerFixture(page, locale, ['accounts.read', 'accounts.update'], name => {
   if (name === 'read_account_balances') return [bank]
   if (name === 'account_statement_classification_context') return { today: '2026-10-11', min_effective_date: '2026-10-11', history: [{ id: revision, effective_from: '2026-01-01', statement_line: 'other_non_current_assets', reason: 'Original evidence', revision: '1' }] }
   if (name === 'schedule_account_statement_classification') return 'new-classification'
   return undefined
  })
  await goto('/accounts?view=table')
  await page.locator('#accounts-table').getByRole('button', { name: copy.statementClassification.title, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.statementClassification.line, { exact: true }).selectOption('current_assets')
  await dialog.getByLabel(copy.statementClassification.reason, { exact: true }).fill('Reviewed dated evidence')
  await dialog.getByRole('button', { name: copy.statementClassification.schedule, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.find(call => call.name === 'schedule_account_statement_classification')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_account_id: bankId, p_statement_line: 'current_assets', p_effective_from: '2026-10-11', p_reason: 'Reviewed dated evidence', p_expected_revision_id: revision })
  expect(calls.find(call => call.name === 'schedule_account_statement_classification')?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
 })
}

for (const locale of ['en', 'ar'] as const) {
 test(`control adjustment rejects unsafe amounts and preserves audited payload: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const controlId = '47000000-0000-4000-8000-000000000063'
  const { calls, goto } = await ledgerFixture(page, locale, ['accounts.read', 'controls.reconcile', 'controls.adjust'], name => {
   if (name === 'read_account_balances') return [bank, { ...bank, account_id: controlId, name: 'Reviewed receivables control', account_role: 'control', control_subledger_type: 'customer' }]
   if (name === 'reconcile_control_accounts') return [{ control_account_id: controlId, account_code: '102', account_name: 'Reviewed receivables control', subledger_type: 'customer', as_of_date: '2026-10-11', gl_balance_minor: 12345, subledger_balance_minor: 10000, variance_minor: 2345, status: 'unreconciled' }]
   if (name === 'create_control_adjustment') return 'reviewed-adjustment'
   return undefined
  })
  await goto('/accounts')
  await page.getByRole('button', { name: copy.controls.adjust, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.controls.counterpartAccount, { exact: true }).selectOption(bankId)
  await dialog.getByLabel(copy.transactions.amount, { exact: true }).fill('9007199254740993.25')
  await dialog.getByLabel(copy.transactions.description, { exact: true }).fill('Reviewed correction')
  await dialog.getByLabel(copy.controls.adjustmentReason, { exact: true }).fill('Documented reconciliation')
  await dialog.getByLabel(copy.controls.reconciliationReference, { exact: true }).fill('CASE-001')
  await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(calls.filter(call => call.name === 'create_control_adjustment')).toHaveLength(0)
  await dialog.getByLabel(copy.transactions.amount, { exact: true }).fill('123.45')
  await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const command = calls.find(call => call.name === 'create_control_adjustment')?.args
  expect(command).toMatchObject({ p_organization_id: fixtureOrganization, p_control_account_id: controlId, p_lines: [{ account_id: controlId, side: 'debit', amount_minor: 12345 }, { account_id: bankId, side: 'credit', amount_minor: 12345 }], p_description: 'Reviewed correction', p_reason: 'Documented reconciliation', p_reference_kind: 'reconciliation_case', p_reconciliation_reference: 'CASE-001' })
  expect(command?.p_idempotency_key).toMatch(/^[\da-f-]{36}$/)
 })
}
