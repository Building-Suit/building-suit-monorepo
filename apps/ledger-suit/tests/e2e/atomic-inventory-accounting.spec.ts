import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`inventory accounting configuration and reconciled source trace: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const sources: Record<string, unknown>[] = []
    const accounts = [{ id: 'control-one', code: '1200', name: 'Inventory control', role: 'control', subledger: 'inventory', type: 'asset', subtype: 'inventory' }, { id: 'cogs-one', code: '5000', name: 'Cost of sales', role: 'posting', subledger: null, type: 'expense', subtype: 'cost_of_sales' }, { id: 'offset-one', code: '3000', name: 'Offset equity', role: 'posting', subledger: null, type: 'equity', subtype: 'equity' }]
    const { calls, goto } = await ledgerFixture(page, locale, ['inventory.read', 'inventory.configure'], (name, args) => {
      if (name === 'read_inventory_workspace') return { currency: 'EGP', sources, facts: [], accounts, total: 0, offset: 0, limit: 25 }
      if (name === 'create_inventory_control_account') return 'control-one'
      if (name === 'configure_inventory_source') { sources.push({ id: 'source-one', source_key: args.p_source_key, actor_id: args.p_actor_id, status: 'reconciled', inventory_minor: '12300', inventory_gl_minor: '12300', inventory_variance_minor: '0', cogs_minor: '5000', cogs_gl_minor: '5000', cogs_variance_minor: '0', cogs_closing_minor: '0', source_inventory_variance_minor: '0', source_cogs_variance_minor: '0', latest_sequence: '42' }); return 'source-one' }
      return undefined
    })
    await goto('/inventory-accounting')
    await page.getByRole('button', { name: copy.inventory.newControl, exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel(copy.inventory.controlName).fill('Inventory control')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: copy.inventory.configure, exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(copy.inventory.sourceKey).fill('warehouse-source')
    await dialog.getByLabel(copy.inventory.actor).fill('trusted-source-actor')
    await dialog.getByLabel(copy.inventory.effectiveDate).fill('2035-01-01')
    await dialog.getByLabel(copy.inventory.control, { exact: true }).selectOption('control-one')
    await dialog.getByLabel(copy.inventory.cogs, { exact: true }).selectOption('cogs-one')
    await dialog.getByLabel(copy.inventory.offset, { exact: true }).selectOption('offset-one')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.locator('[data-inventory-status=reconciled]')).toBeVisible()
    expect(calls.find(call => call.name === 'configure_inventory_source')?.args).toEqual({ p_organization_id: fixtureOrganization, p_source_key: 'warehouse-source', p_actor_id: 'trusted-source-actor', p_effective_from: '2035-01-01', p_control_account_id: 'control-one', p_cogs_account_id: 'cogs-one', p_offset_account_id: 'offset-one' })
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/inventory-accounting-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
