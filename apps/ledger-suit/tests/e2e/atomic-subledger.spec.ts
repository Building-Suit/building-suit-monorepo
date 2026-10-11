import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const family of ['ar', 'ap'] as const) for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`exact ${family} obligation and linked reversal: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    const c = copy[family]
    const party = family === 'ar' ? 'customer' : 'supplier'
    const kind = family === 'ar' ? 'invoice' : 'bill'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const workspace = { [party + 's']: [{ id: 'party-1', name: 'Fixture party', archived: false }], accounts: [{ id: 'control-1', name: 'Fixture control', role: 'control', subledger: party, type: family === 'ar' ? 'asset' : 'liability', subtype: family === 'ar' ? 'accounts_receivable' : 'accounts_payable' }, { id: 'offset-1', name: 'Fixture offset', role: 'posting', subledger: null, type: family === 'ar' ? 'revenue' : 'expense', subtype: family === 'ar' ? 'sales' : 'other_expense' }], items: [], statement: { opening_minor: '0', charges_minor: '12345', bills_minor: '12345', adjustments_minor: '0', receipts_minor: '0', payments_minor: '0', closing_minor: '12345', movements: [] as { id: string; kind: string; date: string; reference: string; effect_minor: string; balance_minor: string; transaction_id: string; reason: string | null; reverses_document_id: string | null; reversed: boolean }[] }, reconciliation: [], legacy: [] }
    const { calls, goto } = await ledgerFixture(page, locale, [`${family}.read`, `${family}.issue`, `${family}.reverse`], (name, args) => {
      if (name === `read_${family}_workspace`) return workspace
      if (name === `post_${family}_document`) { workspace.statement.movements.push({ id: 'document-1', kind, date: String(args.p_document_date), reference: String(args.p_reference), effect_minor: '12345', balance_minor: '12345', transaction_id: 'journal-1', reason: null, reverses_document_id: null, reversed: false }); return 'document-1' }
      if (name === `reverse_${family}_document`) { workspace.statement.movements[0]!.reversed = true; workspace.statement.movements.push({ ...workspace.statement.movements[0]!, id: 'document-2', kind: 'reversal', effect_minor: '-12345', balance_minor: '0', reason: String(args.p_reason), reverses_document_id: 'document-1', transaction_id: 'journal-2', reversed: false }); return 'document-2' }
      return undefined
    })
    await goto(family === 'ar' ? '/receivables' : '/payables')
    await page.getByRole('button', { name: c.actions[kind], exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox', { name: c[party], exact: true }).selectOption('party-1')
    await dialog.getByRole('combobox', { name: c.control, exact: true }).selectOption('control-1')
    await dialog.getByRole('combobox', { name: family === 'ar' ? copy.ar.revenue : copy.ap.expenseOrAsset, exact: true }).selectOption('offset-1')
    await dialog.getByLabel(c.reference, { exact: true }).fill('Immutable obligation')
    await dialog.getByLabel(c.amount, { exact: true }).fill('123.45')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === `post_${family}_document`)?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_kind: kind, [`p_${party}_id`]: 'party-1', p_control_account_id: 'control-1', p_offset_account_id: 'offset-1', p_amount_minor: '12345', p_reference: 'Immutable obligation', p_allocations: [] })
    expect(calls.find(call => call.name === `post_${family}_document`)?.args.p_idempotency_key).toMatch(/^[\da-f-]{36}$/)
    await expect(page.getByRole('row').filter({ hasText: 'Immutable obligation' })).toContainText(/123.45|١٢٣/)
    await page.getByRole('button', { name: c.actions.reversal, exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(c.reason, { exact: true }).fill('Reviewed correction')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === `reverse_${family}_document`)?.args).toMatchObject({ p_document_id: 'document-1', p_organization_id: fixtureOrganization, p_reason: 'Reviewed correction' })
    expect(workspace.statement.movements).toHaveLength(2)
    await expectNoPageOverflow(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/subledger-${family}-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
  test(`exact ${family} foreign currency obligation and reviewed reversal: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    const c = copy.fx
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const fx = { currencies: [{ code: 'USD', minor_unit: 2, name: 'Dollar' }, { code: 'EGP', minor_unit: 2, name: 'Pound' }], mapping: { realized_gain_account_id: 'gain-1', realized_loss_account_id: 'loss-1', unrealized_gain_account_id: 'gain-1', unrealized_loss_account_id: 'loss-1' }, counterparties: [{ id: 'party-1', name: 'Fixture FX party' }], accounts: [{ id: 'control-1', name: 'Fixture FX control', type: family === 'ar' ? 'asset' : 'liability', subtype: family === 'ar' ? 'accounts_receivable' : 'accounts_payable', role: 'control', subledger: family === 'ar' ? 'customer' : 'supplier', currency: 'EGP' }, { id: 'offset-1', name: 'Fixture FX offset', type: family === 'ar' ? 'revenue' : 'expense', subtype: 'other', role: 'posting', subledger: null, currency: 'EGP' }], items: [] as { id: string; counterparty_id: string; counterparty_name: string; control_account_id: string; reference: string; document_date: string; due_date: string; currency_code: string; original_minor: string; outstanding_minor: string; recognition_rate: string; carrying_base_minor: string; rate_source: string; rate_reference: string }[], settlements: [], allocations: [], revaluations: [] }
    const { calls, goto } = await ledgerFixture(page, locale, ['fx.read', 'fx.manage'], (name, args) => {
      if (name === 'read_fx_workspace') return fx
      if (name === 'post_fx_open_item') { fx.items.push({ id: 'fx-item-1', counterparty_id: 'party-1', counterparty_name: 'Fixture FX party', control_account_id: 'control-1', reference: String(args.p_reference), document_date: String(args.p_document_date), due_date: String(args.p_due_date), currency_code: 'USD', original_minor: '12345', outstanding_minor: '12345', recognition_rate: '50', carrying_base_minor: '617250', rate_source: String(args.p_rate_source), rate_reference: String(args.p_rate_reference) }); return 'fx-item-1' }
      if (name === 'reverse_fx_open_item') return 'fx-reversal-1'
      return undefined
    })
    await goto(family === 'ar' ? '/receivables' : '/payables')
    const panel = page.getByTestId('fx-panel')
    await panel.getByRole('combobox', { name: c.counterparty, exact: true }).selectOption('party-1')
    await panel.getByRole('combobox', { name: c.control, exact: true }).selectOption('control-1')
    await panel.getByRole('combobox', { name: c.offset, exact: true }).selectOption('offset-1')
    await panel.getByLabel(c.reference, { exact: true }).fill('FX immutable source')
    await panel.getByLabel(c.amount, { exact: true }).fill('123.45')
    await panel.getByLabel(c.baseRate, { exact: true }).fill('50')
    await panel.getByLabel(c.rateSource, { exact: true }).fill('Reviewed rate')
    await panel.getByLabel(c.rateEvidence, { exact: true }).fill('Evidence reference')
    await panel.getByRole('button', { name: c.postItem, exact: true }).click()
    await expect(panel.getByRole('row').filter({ hasText: 'FX immutable source' })).toContainText(/123.45|١٢٣/)
    expect(calls.find(call => call.name === 'post_fx_open_item')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_subledger_type: family === 'ar' ? 'customer' : 'supplier', p_original_minor: '12345', p_currency_code: 'USD', p_recognition_rate: '50', p_rate_source: 'Reviewed rate', p_rate_reference: 'Evidence reference' })
    await panel.getByRole('tab', { name: c.tabs.reversal, exact: true }).click()
    await panel.getByRole('combobox', { name: c.reversalKind, exact: true }).selectOption('item')
    await panel.getByRole('combobox', { name: c.reversalTarget, exact: true }).selectOption('fx-item-1')
    await panel.getByLabel(c.reversalReason, { exact: true }).fill('Reviewed FX correction')
    await panel.getByRole('button', { name: c.postReversal, exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'reverse_fx_open_item').length).toBe(1)
    expect(calls.find(call => call.name === 'reverse_fx_open_item')?.args).toMatchObject({ p_item_id: 'fx-item-1', p_organization_id: fixtureOrganization, p_reason: 'Reviewed FX correction' })
    expect(fx.items[0]!.original_minor).toBe('12345')
    await expectNoPageOverflow(page)
  })
}
