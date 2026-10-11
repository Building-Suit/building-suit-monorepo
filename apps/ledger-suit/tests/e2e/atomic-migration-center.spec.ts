import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`migration reviewed approval: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const projects: Record<string, unknown>[] = []
    const review = { valid: true, approved: false, approved_by: 'Fixture reviewer', approved_at: '2035-01-01T12:00:00Z', source_revision: 1, modules: { opening_trial_balance: { state: 'complete', debit_total_minor: '10000', credit_total_minor: '10000', difference_minor: '0', currency: 'EGP' } }, variances: [], errors: [], warnings: [] }
    const { calls, goto } = await ledgerFixture(page, locale, ['migrations.read', 'migrations.manage', 'migrations.review', 'opening_balances.approve'], (name, args) => {
      if (name === 'list_migration_projects') return projects
      if (name === 'create_migration_project') { projects.push({ id: 'migration-one', name: args.p_name, cutover_date: args.p_cutover_date, source_type: args.p_source_type, migration_depth: args.p_migration_depth, status: 'validated', current_source_revision_id: 'source-one', current_mapping_revision_id: 'mapping-one', current_staging_batch_id: 'staging-one', opening_balance_batch_id: 'opening-one' }); return 'migration-one' }
      if (name === 'read_migration_center') return { project: projects[0], sources: [{ id: 'source-one', filename: 'immutable-original.csv', revision: 1, content_sha256: 'original-hash' }], original_rows: [], mapping_revisions: [], mapping_entries: [], normalized_rows: [], opening_batch: { id: 'opening-one', status: 'validated' }, opening_candidates: [], open_item_batches: [], operational_batches: [{ id: 'operations-one', status: 'validated', open_items_applicable: false, assets_applicable: false, bank_applicable: false, inventory_applicable: false, tax_applicable: false }], approval: review.approved ? { id: 'approval-one', approved_by: review.approved_by, approved_at: review.approved_at } : null }
      if (name === 'review_migration_cutover') return review
      if (name === 'approve_migration_cutover') { review.approved = true; return review }
      return undefined
    })
    await goto('/migration-center')
    await page.getByRole('button', { name: copy.migration.newProject, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(copy.migration.projectName).fill('Reviewed cutover')
    await dialog.getByLabel(copy.migration.cutoverDate).fill('2035-01-01')
    await dialog.getByRole('button', { name: copy.migration.createProject, exact: true }).click()
    await expect(page.locator('[data-final-review]')).toBeVisible()
    const approval = page.getByRole('button', { name: copy.migration.finalApprove, exact: true })
    await expect(approval).toBeDisabled()
    expect(calls.filter(call => call.name === 'approve_migration_cutover')).toHaveLength(0)
    await page.locator('[data-final-review]').getByRole('checkbox').check()
    await approval.click()
    await expect(page.locator('[data-cutover-approved]')).toContainText(copy.migration.approved)
    await expect(approval).toHaveCount(0)
    expect(calls.find(call => call.name === 'create_migration_project')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_name: 'Reviewed cutover', p_source_type: 'excel_csv', p_cutover_date: '2035-01-01', p_migration_depth: 'fast_cutover' })
    expect(calls.find(call => call.name === 'approve_migration_cutover')?.args).toMatchObject({ p_project_id: 'migration-one', p_operational_batch_id: 'operations-one', p_idempotency_key: expect.stringMatching(/^migration-final:migration-one:/) })
    await expect(page.locator('[data-migration-center]')).toContainText('immutable-original.csv')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/migration-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
