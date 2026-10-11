import { expect, test } from '@playwright/test'
import { ledgerFixture } from './atomic-ledger-fixture'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`reasoned access command retains operator context: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls, goto } = await ledgerFixture(page, locale, [], (name, args) => {
      if (name === 'platform_admin_read') return { ok: true, data: args.p_resource === 'identity' ? [{ role: 'platform_admin' }] : args.p_resource === 'organizations' ? [{ id: 'organization-reviewed', name: 'Reviewed workspace', operator_suspended: false, plan_key: 'solo', status: 'active' }] : [] }
      if (name === 'platform_admin_set_access') return { ok: true, data: {} }
      return undefined
    }, { login: '/login?operator=1', landing: '/platform-admin' })
    await goto('/platform-admin')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.admin.title)
    await page.getByLabel(copy.admin.view, { exact: true }).selectOption('organizations')
    await expect(page.getByRole('row').filter({ hasText: 'Reviewed workspace' })).toBeVisible()
    await page.getByRole('button', { name: copy.admin.suspend, exact: true }).click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByRole('button', { name: copy.admin.submit, exact: true })).toBeDisabled()
    await dialog.getByLabel(copy.admin.reason, { exact: true }).fill('Reviewed support reason')
    await dialog.getByLabel(copy.admin.context, { exact: true }).fill('Verified operator context')
    await dialog.getByRole('button', { name: copy.admin.submit, exact: true }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const command = calls.find(call => call.name === 'platform_admin_set_access')
    expect(command?.args).toMatchObject({ p_organization_id: 'organization-reviewed', p_action: 'suspend', p_reason: 'Reviewed support reason', p_context: 'Verified operator context' })
    expect(command?.args.p_command_id).toMatch(/^[\da-f-]{36}$/)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/admin-ledger-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
for (const locale of ['en', 'ar'] as const) {
  test(`denied operator cannot read tenant resources: ${locale}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    const { calls, goto } = await ledgerFixture(page, locale, [], name => name === 'platform_admin_read' ? { ok: false, error: 'OPERATOR_REQUIRED' } : undefined, { login: '/login?operator=1', landing: '/platform-admin' })
    await goto('/platform-admin')
    await expect(page.getByRole('alert')).toHaveText(copy.admin.denied)
    await expect(page.getByLabel(copy.admin.view, { exact: true })).toBeDisabled()
    expect(calls.filter(call => call.name === 'platform_admin_read').every(call => call.args.p_resource === 'identity')).toBe(true)
  })
}
