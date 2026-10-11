import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const journalId = '47000000-0000-4000-8000-000000000021'
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
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
for (const locale of ['en', 'ar'] as const) for (const width of [390, 768, 1440]) {
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

for (const locale of ['en', 'ar'] as const) {
 test(`document proposals require matching evidence, correction and human attestation: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const { calls, goto } = await ledgerFixture(page, locale, ['transactions.read', 'imports.create', 'attachments.create'], name => name === 'can_use_feature' ? true : undefined)
  await goto('/transactions')
  await page.getByRole('button', { name: copy.imports.entryPoint, exact: true }).click()
  const dialog = page.getByRole('dialog')
  const bytes = Buffer.from('%PDF-1.4 synthetic reviewed invoice')
  const proposal = { contract: 'ledger.document-extraction.v1', source: { file_name: 'invoice.pdf', sha256: createHash('sha256').update(bytes).digest('hex') }, candidates: [{ fields: Object.fromEntries(Object.entries({ type: 'expense', date: '2026-10-11', amount: '9007199254740993.25', account: '', category: 'Supplies', description: 'Office supplies' }).map(([field, value]) => [field, { value, confidence: 0.55, evidence: 'page 1 total' }])), errors: [{ code: 'ACCOUNT_NOT_EXTRACTED', message: 'Choose the reviewed account' }] }] }
  await dialog.locator('#document-source-file').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: bytes })
  await dialog.locator('#document-proposal-file').setInputFiles({ name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) })
  const accept = dialog.getByRole('button', { name: copy.imports.extraction.accept, exact: true })
  await expect(accept).toBeDisabled()
  await expect(dialog.getByText('ACCOUNT_NOT_EXTRACTED', { exact: true })).toBeVisible()
  await dialog.getByLabel(copy.imports.fields.account, { exact: true }).fill('Cash')
  await expect(accept).toBeDisabled()
  await dialog.getByRole('checkbox', { name: copy.imports.extraction.attestation }).check()
  await expect(accept).toBeEnabled()
  await dialog.getByLabel(copy.imports.fields.amount, { exact: true }).fill('9007199254740993.26')
  await expect(dialog.getByRole('checkbox', { name: copy.imports.extraction.attestation })).not.toBeChecked()
  await expect(accept).toBeDisabled()
  await dialog.getByRole('checkbox', { name: copy.imports.extraction.attestation }).check()
  await accept.click()
  await expect(dialog.getByRole('heading', { name: copy.imports.mappingTitle })).toBeVisible()
  await expect(dialog.getByText('9007199254740993.26', { exact: true })).toBeVisible()
  expect(calls.filter(call => ['create_csv_import_batch', 'confirm_csv_import_batch', 'reserve_attachment_upload'].includes(call.name))).toHaveLength(0)
 })
 test(`journal reversal requires a reason and keeps exact entry amounts: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  let reversed = false
  const { calls, goto } = await ledgerFixture(page, locale, ['transactions.read', 'transactions.reverse'], name => {
   const journal = { id: journalId, journal_reference: 'JRN-001', transaction_date: '2026-10-01', description: 'Reviewed journal', source: 'manual', type: 'income', status: reversed ? 'reversed' : 'posted', debit_minor: '900719925474099325', credit_minor: '900719925474099325', currency_code: 'EGP', tags: [], total_count: 1 }
   if (name === 'search_transactions') return [journal]
   if (name === 'transaction_summaries') return journal
   if (name === 'organization_settings') return { books_locked_until: null }
   if (name === 'opening_balance_batches') return null
   if (name === 'ledger_entries') return ['debit', 'credit'].map((side, index) => ({ entry_id: String(index), side, amount_minor: '900719925474099325', currency_code: 'EGP', base_amount_minor: '900719925474099325', memo: 'Reviewed entry', account_code: String(index), account_name: index ? 'Sales' : 'Cash', account_type: index ? 'income' : 'asset' }))
   if (name === 'reverse_transaction') { reversed = true; return journalId }
   return undefined
  })
  await goto('/transactions')
  await page.locator('main').getByText('Reviewed journal', { exact: true }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Reviewed journal' })).toBeVisible()
  await expect(dialog.getByText('Cash', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: copy.detail.reverseAction, exact: true }).click()
  await dialog.getByRole('button', { name: copy.detail.reverseConfirm, exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(calls.filter(call => call.name === 'reverse_transaction')).toHaveLength(0)
  await dialog.getByLabel(copy.detail.reverseReason, { exact: true }).fill('Reviewed correcting reversal')
  await dialog.getByRole('button', { name: copy.detail.reverseConfirm, exact: true }).click()
  await expect.poll(() => calls.filter(call => call.name === 'reverse_transaction').length).toBe(1)
  expect(calls.find(call => call.name === 'reverse_transaction')?.args).toEqual({ p_transaction_id: journalId, p_reason: 'Reviewed correcting reversal' })
 })
}
