import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`asset acquisition register, depreciation and reviewed reversal: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const assets: Record<string, unknown>[] = [], events: Record<string, unknown>[] = []
    const schedule = { id: 'schedule-one', asset_id: 'asset-one', period_start: '2035-01-01', period_end: '2035-01-31', amount_minor: '10000', closing_nbv_minor: '110000', status: 'scheduled' }
    const accounts = [{ id: 'cost-one', name: 'Asset cost', type: 'asset', normal_balance: 'debit', role: 'posting' }, { id: 'acc-one', name: 'Accumulated depreciation', type: 'asset', normal_balance: 'credit', role: 'posting', contra_account_id: 'cost-one' }, { id: 'expense-one', name: 'Depreciation expense', type: 'expense', role: 'posting' }, { id: 'gain-one', name: 'Gain', type: 'revenue', role: 'posting' }]
    const { calls, goto } = await ledgerFixture(page, locale, ['assets.read','assets.register','assets.depreciate','assets.adjust','assets.dispose','assets.reverse'], (name, args) => {
      if (name === 'read_fixed_asset_workspace') return { accounts, acquisition_journals: [{ id: 'acquisition-original', date: '2035-01-01', reference: 'J-ACQ', description: 'Original acquisition', currency: 'EGP' }], assets, schedule: assets.length ? [schedule] : [], events, reconciliation: [] }
      if (name === 'register_fixed_asset') { assets.push({ id: 'asset-one', code: args.p_asset_code, name: args.p_name, status: 'active', currency: 'EGP', cost_minor: args.p_acquisition_cost_minor, accumulated_minor: '0', nbv_minor: args.p_acquisition_cost_minor, residual_minor: args.p_residual_value_minor, method: args.p_method, life_months: args.p_useful_life_months, in_service_date: args.p_in_service_date, acquisition_transaction_id: args.p_acquisition_transaction_id }); return 'asset-one' }
      if (name === 'post_asset_depreciation') { schedule.status = 'posted'; events.push({ id: 'event-one', asset_id: 'asset-one', kind: 'depreciation', date: '2035-01-31', transaction_id: 'depreciation-journal', reason: 'Scheduled depreciation', reverses_event_id: null }); return 'depreciation-journal' }
      if (name === 'reverse_fixed_asset_event') { events.push({ id: 'event-reversal', asset_id: 'asset-one', kind: 'reversal', date: args.p_reversal_date, reason: args.p_reason, transaction_id: 'reversal-journal', reverses_event_id: 'event-one' }); return 'reversal-journal' }
      return undefined
    })
    await goto('/fixed-assets')
    await page.getByRole('button', { name: copy.assets.register, exact: true }).click()
    const dialog = page.getByRole('dialog')
    for (const [id, value] of [['asset-code','AS-1'],['asset-name','Fixture machine'],['asset-service-date','2035-01-01'],['asset-cost','1200'],['asset-residual','0'],['asset-life','12']]) await dialog.locator(`#${id}`).fill(value)
    await dialog.locator('#asset-journal').selectOption('acquisition-original')
    await dialog.locator('#asset-cost-account').selectOption('cost-one')
    await dialog.locator('#asset-accumulated-account').selectOption('acc-one')
    await dialog.locator('#asset-expense-account').selectOption('expense-one')
    await dialog.locator('#asset-impairment-account').selectOption('expense-one')
    await dialog.locator('#asset-gain-loss-account').selectOption('gain-one')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Fixture machine', { exact: true })).toBeVisible()
    expect(calls.find(call => call.name === 'register_fixed_asset')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_acquisition_transaction_id: 'acquisition-original', p_acquisition_cost_minor: '120000', p_useful_life_months: 12, p_residual_value_minor: '0', p_method: 'straight_line' })
    await page.getByRole('button', { name: copy.assets.post, exact: true }).click()
    const history = page.locator('details').filter({ hasText: copy.assets.history })
    await history.locator('summary').click()
    await history.getByRole('button', { name: copy.assets.reverse, exact: true }).click()
    await page.getByRole('dialog').locator('#asset-action-date').fill('2035-02-01')
    await page.getByRole('dialog').locator('#asset-reason').fill('Reviewed correction')
    await page.getByRole('dialog').getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect.poll(() => events.length).toBe(2)
    expect(calls.find(call => call.name === 'reverse_fixed_asset_event')?.args).toMatchObject({ p_event_id: 'event-one', p_reversal_date: '2035-02-01', p_reason: 'Reviewed correction' })
    expect(events[0].transaction_id).toBe('depreciation-journal')
    expect(assets[0].acquisition_transaction_id).toBe('acquisition-original')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/assets-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
