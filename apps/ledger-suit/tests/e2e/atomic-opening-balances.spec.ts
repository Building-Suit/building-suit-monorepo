import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`opening balances mapping, validation, posting and reversal: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const accounts = [{ id: 'cash', code: '1000', name: 'Cash', type: 'asset', account_role: 'posting', is_archived: false }, { id: 'equity', code: '3000', name: 'Equity', type: 'equity', account_role: 'posting', is_archived: false }]
    type Batch = { id: string; migration_mode: string; cutoff_date: string; revision: number; status: string; validation_result: object | null; posted_transaction_id: string | null; reversal_transaction_id: string | null; correction_reason: string | null; created_by: string; approved_by: string | null }
    const batches: Batch[] = []
    let mapped: { source_row: number; source_code: string; source_name: string; debit: string; credit: string; account_id: string }[] = []
    const { calls, goto } = await ledgerFixture(page, locale, ['opening_balances.read', 'opening_balances.manage', 'opening_balances.approve', 'opening_balances.correct'], (name, args) => {
      if (name === 'accounts') return accounts
      if (name === 'opening_balance_batches') return batches
      if (name === 'create_opening_balance_batch') {
        batches.push({ id: `batch-${batches.length + 1}`, migration_mode: String(args.p_migration_mode), cutoff_date: String(args.p_cutoff_date), revision: 1, status: 'draft', validation_result: null, posted_transaction_id: null, reversal_transaction_id: null, correction_reason: null, created_by: 'Fixture owner', approved_by: null })
        return batches.at(-1)!.id
      }
      if (name === 'update_opening_balance_batch') { mapped = args.p_rows as typeof mapped; return args.p_batch_id }
      if (name === 'validate_opening_balance_batch') {
        const valid = mapped[1].credit === '100.00'
        const validation = { valid, debit_total_minor: '10000', credit_total_minor: valid ? '10000' : '9999', difference_minor: valid ? '0' : '1', errors: valid ? [] : ['OPENING_BATCH_UNBALANCED'], rows: [], preview: mapped.map(row => ({ row_id: String(row.source_row), account_id: row.account_id, account_code: row.account_id === 'cash' ? '1000' : '3000', account_name: row.account_id === 'cash' ? 'Cash' : 'Equity', debit_minor: row.account_id === 'cash' ? '10000' : '0', credit_minor: row.account_id === 'equity' ? valid ? '10000' : '9999' : '0' })) }
        const batch = batches.find(batch => batch.id === args.p_batch_id)!
        batch.validation_result = { ...validation, valid_row_count: 2, zero_row_count: 0 }
        return validation
      }
      if (name === 'approve_opening_balance_batch') { const batch = batches.find(batch => batch.id === args.p_batch_id)!; batch.status = 'posted'; batch.posted_transaction_id = 'journal-original'; batch.approved_by = 'Fixture owner'; return 'journal-original' }
      if (name === 'reverse_opening_balance_batch') { const batch = batches.find(batch => batch.id === args.p_batch_id)!; batch.status = 'reversed'; batch.reversal_transaction_id = 'journal-reversal'; batch.correction_reason = String(args.p_reason); return 'journal-reversal' }
      return undefined
    })
    await goto('/opening-balances')
    await page.locator('#opening-cutoff').fill('2034-12-31')
    async function upload(credit: string) {
      const csv = `${copy.opening.sourceCode},${copy.opening.sourceName},${copy.opening.debit},${copy.opening.credit}\nSRC-CASH,Cash,100.00,\nSRC-EQ,Equity,,${credit}`
      await page.locator('#opening-file').setInputFiles({ name: `opening-${credit}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) })
      await page.getByLabel(`${copy.opening.ledgerAccount} 1`).selectOption('cash')
      await page.getByLabel(`${copy.opening.ledgerAccount} 2`).selectOption('equity')
      await page.getByRole('button', { name: copy.opening.validate, exact: true }).click()
    }
    await upload('99.99')
    await expect(page.locator('[data-validation=invalid]')).toContainText(copy.opening.errors.OPENING_BATCH_UNBALANCED)
    await expect(page.getByRole('button', { name: copy.opening.approve, exact: true })).toBeDisabled()
    await upload('100.00')
    await expect(page.locator('[data-validation=valid]')).toContainText(copy.opening.validationPassed)
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/opening-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: copy.opening.approve, exact: true }).click()
    await expect(page.locator('[data-opening-posted]')).toContainText(copy.opening.postedLocked)
    await expect(page.locator('#opening-cutoff')).toBeDisabled()
    const posted = page.locator('article[data-batch-status=posted]')
    await posted.getByLabel(copy.opening.correctionReason).fill('Correct original source')
    await posted.getByLabel(copy.opening.reversalDate).fill('2035-01-01')
    await posted.getByRole('button', { name: copy.opening.reverse, exact: true }).click()
    await expect(page.locator('article[data-batch-status=reversed]')).toContainText('journal-reversal')
    const updated = calls.filter(call => call.name === 'update_opening_balance_batch').at(-1)!
    expect(updated.args.p_rows).toMatchObject([{ source_row: 1, account_id: 'cash', debit: '100.00' }, { source_row: 2, account_id: 'equity', credit: '100.00' }])
    expect(calls.find(call => call.name === 'create_opening_balance_batch')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_migration_mode: 'year_start', p_cutoff_date: '2034-12-31' })
    expect(calls.find(call => call.name === 'reverse_opening_balance_batch')?.args).toMatchObject({ p_batch_id: 'batch-2', p_reason: 'Correct original source', p_reversal_date: '2035-01-01' })
    expect(batches[1]).toMatchObject({ posted_transaction_id: 'journal-original', reversal_transaction_id: 'journal-reversal' })
  })
}
