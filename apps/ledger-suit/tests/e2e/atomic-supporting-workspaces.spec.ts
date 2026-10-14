import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow, navigateFixture } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`audit, portfolio, dimension and operational adapters: ${locale}, ${theme}, ${width}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  const { calls, goto } = await ledgerFixture(page, locale, ['audit.read', 'dimensions.read', 'dimensions.manage', 'transactions.read', 'imports.create', 'tags.read', 'commitments.read', 'recurring.read', 'counterparties.read'], name => {
   if (name === 'audit_history_window') return [{ days: 90, is_unlimited: false }]
   if (name === 'read_dimension_workspace') return { values: [], policies: [], accounts: [] }
   if (name === 'save_dimension_value') return 'reviewed-dimension'
   if (name === 'can_use_feature') return true
   return undefined
  })
  await goto('/audit')
  await expect(page.locator('main').getByRole('heading').first()).toBeVisible()
  await expectNoPageOverflow(page)
  await navigateFixture(page, '/clients')
  await expect(page.getByRole('heading', { name: copy.clientPortfolio.title, exact: true })).toBeVisible()
  await expect(page.getByText('Fixture workspace', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expectNoPageOverflow(page)
  await navigateFixture(page, '/accounting-dimensions')
  await expect(page.getByRole('heading', { name: copy.dimensions.title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: copy.dimensions.add, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(copy.dimensions.code, { exact: true }).fill('CENTER-001')
  await dialog.getByLabel(copy.dimensions.name, { exact: true }).fill('Reviewed cost center')
  await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.find(call => call.name === 'save_dimension_value')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_kind: 'cost_center', p_code: 'CENTER-001', p_name: 'Reviewed cost center', p_description: null, p_dimension_value_id: null })
  for (const kind of ['commitments', 'recurring', 'counterparties', 'tags']) {
   await navigateFixture(page, `/records/${kind}`)
   await expect(page.locator('main').getByRole('heading').first()).toBeVisible()
   await expectNoPageOverflow(page)
  }
  await navigateFixture(page, '/transactions')
  await expect(page.getByRole('heading', { name: copy.transactions.title, exact: true })).toBeVisible()
  await page.locator('#__nuxt').evaluate(root => { void (root as HTMLElement & { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__.config.globalProperties.$router.push('/imports') })
  await expect(page).toHaveURL(/\/transactions(?:\?import=1)?$/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(copy.imports.title)
  // A redirect has no committed frame URL; verify its middleware result before recording its source.
  test.info().annotations.push({ type: 'verified-route', description: JSON.stringify({ suit: 'ledger-suit', path: '/imports' }) })
 })
}
