import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const journalId = '47000000-0000-4000-8000-000000000021'
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`journal filters and keyboard CSV review: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls, goto } = await ledgerFixture(page, locale, ['transactions.read', 'imports.create'], name => {
      if (name === 'can_use_feature') return true
      if (name === 'search_transactions') return [{ id: journalId, journal_reference: 'JRN-001', transaction_date: '2026-10-01', description: 'Fixture journal', source: 'manual', type: 'income', status: 'posted', debit_minor: 12345, credit_minor: 12345, currency_code: 'EGP', tags: [], total_count: 1 }]
      return undefined
    })
    await goto('/transactions')
    await expect(page.getByRole('heading', { name: copy.transactions.title, exact: true })).toBeVisible()
    await expect(page.getByText('Fixture journal', { exact: true }).filter({ visible: true })).toBeVisible()
    await page.getByRole('button', { name: copy.imports.entryPoint, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(copy.imports.pasteTitle).fill('type\tdate\tamount\taccount\tcategory\nincome\t2026-10-01\t100\tCash\tSales')
    await dialog.getByLabel(copy.imports.pasteTitle).press('Control+Enter')
    await expect(dialog.getByRole('heading', { name: copy.imports.mappingTitle })).toBeVisible()
    await expect(dialog.getByLabel(copy.imports.fields.amount, { exact: true })).toHaveValue('amount')
    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: copy.common.cancel, exact: true }).click()
    await expect(dialog.getByRole('heading', { name: copy.imports.mappingTitle })).toBeVisible()
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/journal-mapping-${locale}-${theme}-${width}.png`, animations: 'disabled' })
    expect(calls.find(call => call.name === 'search_transactions' && call.args.p_limit === 25)?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_limit: 25, p_sort: 'transaction_date' })
    await expectNoPageOverflow(page)
  })
}
test('journal read denial never issues the journal query', async ({ page }) => {
  const { calls, goto } = await ledgerFixture(page, 'en', [], () => undefined)
  await goto('/transactions')
  await expect(page.getByText(en.transactionWorkspace.noRead, { exact: true })).toBeVisible()
  expect(calls.filter(call => call.name === 'search_transactions' && call.args.p_limit === 25)).toHaveLength(0)
})
for (const locale of ['en', 'ar'] as const) for (const width of [390, 1440]) {
 test(`operational tags: ${locale}, ${width}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  await page.setViewportSize({ width, height: 1000 })
  const { goto } = await ledgerFixture(page, locale, ['tags.read', 'transactions.read', 'recurring.read', 'recurring.update'], name => {
   if (name === 'tags') return [{ id: journalId, name: 'Fixture tag', color: '#2563eb', created_at: '2026-10-01' }]
   if (name === 'recurring_rules') return [{ id: journalId, name: 'Fixture schedule', type: 'income', status: 'active', amount_minor: 10000, currency_code: 'EGP', interval_unit: 'month', interval_count: 1, next_run_on: '2026-11-01', created_at: '2026-10-01' }]
   return undefined
  })
  await goto('/records/tags')
  await expect(page.getByText('Fixture tag', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: copy.tagsGuide.viewTransactions, exact: true })).toHaveAttribute('href', new RegExp(journalId))
  await expectNoPageOverflow(page)
  await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/operational-tags-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
 })
}
for (const locale of ['en', 'ar'] as const) {
 test(`CSV staging preserves decimal text and confirms only reviewed rows: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  let staged: Record<string, string>[] = []
  let confirmed = false
  const batchId = '47000000-0000-4000-8000-000000000031'
  const { calls, goto } = await ledgerFixture(page, locale, ['transactions.read', 'imports.create'], (name, args) => {
   if (name === 'can_use_feature') return true
   if (name === 'create_csv_import_batch') { staged = args.p_rows as Record<string, string>[]; return batchId }
   if (name === 'validate_csv_import_batch') return batchId
   if (name === 'confirm_csv_import_batch') { confirmed = true; return { batch_id: batchId, status: 'completed' } }
   if (name === 'import_batches') return { id: batchId, filename: 'transactions.csv', status: confirmed ? 'completed' : 'validated', total_rows: 1, valid_rows: confirmed ? 0 : 1, invalid_rows: 0, posted_rows: confirmed ? 1 : 0, duplicate_rows: 0, failed_rows: 0 }
   if (name === 'import_rows') return [{ id: 'row-1', row_number: 1, status: confirmed ? 'posted' : 'valid', raw_data: { type: 'income', date: '2026-10-01', amount: '9007199254740993.25', account: 'Cash', category: 'Sales' }, error_code: null, error_message: null, transaction_id: confirmed ? journalId : null }]
   return undefined
  })
  await goto('/transactions')
  await page.getByRole('button', { name: copy.imports.entryPoint, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.imports.pasteTitle).fill('type\tdate\tamount\taccount\tcategory\nincome\t2026-10-01\t٩٠٠٧١٩٩٢٥٤٧٤٠٩٩٣٫٢٥\tCash\tSales')
  await dialog.getByLabel(copy.imports.pasteTitle).press('Control+Enter')
  await dialog.getByRole('button', { name: copy.imports.validate, exact: true }).click()
  await expect(dialog.getByRole('heading', { name: copy.imports.validationTitle })).toBeVisible()
  expect(staged[0]?.amount).toBe('٩٠٠٧١٩٩٢٥٤٧٤٠٩٩٣٫٢٥')
  expect(Object.values(staged[0]!)).toContain('9007199254740993.25')
  expect(calls.filter(call => call.name === 'confirm_csv_import_batch')).toHaveLength(0)
  await dialog.getByRole('button', { name: copy.imports.confirm, exact: true }).click()
  await expect(dialog.getByRole('heading', { name: copy.imports.resultsTitle })).toBeVisible()
  expect(calls.filter(call => call.name === 'confirm_csv_import_batch')).toHaveLength(1)
  expect(calls.find(call => call.name === 'confirm_csv_import_batch')?.args).toMatchObject({ p_batch_id: batchId })
 })
}
