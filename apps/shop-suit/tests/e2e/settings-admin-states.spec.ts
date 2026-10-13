import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

async function setup(page: Page, locale: string, mode = 'ready') {
  await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), locale === 'ar' ? 'dark' : 'light')
  let noShop = false
  let tenantStatus = 'active'
  const fixture = await pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shops' && noShop) return []
    if (name === 'shop_permission_access') return { 'settings.manage': mode !== 'read-only' }
    if (name === 'shop_plan_usage') return { resources: [{ resource: 'active_locations', used: 2, limit: 2, atLimit: mode === 'capacity' }] }
    if (name === 'shop_cash_policy') return false
    if (name === 'receipt_settings') return { displayName: 'Fixture receipt', address: null, phone: null, footer: null, paperSize: 'thermal_80', canManage: mode !== 'read-only' }
    if (name === 'platform_admin_session') return mode === 'denied' ? null : { userId: 'synthetic-admin', role: mode === 'observer' ? 'observer' : 'operator', canMutate: mode !== 'observer', displayName: 'Synthetic operator' }
    if (name === 'platform_plan_read') return args.p_resource === 'catalog' ? { items: [] } : { subscription: null, availablePlans: [] }
    if (name === 'platform_admin_read') {
      if (args.p_resource === 'dashboard') return { shops: 1, activeShops: 1, recentEvents: [] }
      if (args.p_resource === 'shops') return { items: [{ id: 'tenant-1', name: 'Synthetic tenant', ownerName: 'Synthetic owner', ownerEmail: 'owner@example.test', accessState: 'active', planSlug: 'fixture', memberCount: 1 }], total: 1 }
      if (args.p_resource === 'shop') return { shop: { id: args.p_shop_id, name: 'Synthetic tenant', status: tenantStatus, businessMode: 'mixed', createdAt: '2026-10-13T08:00:00Z' }, owner: null, subscription: null, locations: [], members: [], usage: { members: 1, locations: 1, products: 0, services: 0, limits: null }, billingHistory: [], sensitiveEvents: [], supportNotes: [] }
      return { items: [], total: 0 }
    }
    if (name === 'platform_admin_command') { if (args.p_action === 'suspend_shop') tenantStatus = 'suspended'; if (args.p_action === 'reactivate_shop') tenantStatus = 'active'; return null }
    return undefined
  })
  noShop = mode === 'no-shop'
  return fixture
}

for (const locale of ['en', 'ar'] as const) {
  const ar = locale === 'ar'
  test(`settings failed permission read and pending retry ${locale}`, async ({ page }) => {
    await setup(page, locale)
    let fail = true
    let release!: () => void
    let gate = Promise.resolve()
    await fixtureRoute(page, '**/rest/v1/rpc/shop_permission_access', async route => {
      if (!route.request().postDataJSON().p_permission_keys.includes('settings.manage')) return route.fallback()
      if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic permission lookup failure' } })
      await gate
      return route.fallback()
    })
    await fixtureGoto(page, '/settings')
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل إعدادات النشاط' : 'Could not load business settings')
    await expect(page.locator('#shop-profile,#business-mode,#locations,#receipt-settings,#cash-policy')).toHaveCount(0)
    await expect(page.getByText(ar ? 'محتاج صلاحية إدارة الإعدادات' : 'Business-settings permission is required', { exact: false })).toHaveCount(0)
    fail = false
    gate = new Promise<void>(resolve => { release = resolve })
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.locator('#shop-profile,#business-mode,#locations,#receipt-settings,#cash-policy')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    release()
    await expect(page.locator('#shop-profile')).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'تعديل ملف المتجر' : 'Edit shop profile', exact: true })).toBeEnabled()
    await page.screenshot({ path: test.info().outputPath('settings-ready.png'), fullPage: true, animations: 'disabled' })
    await expectNoPageOverflow(page)
  })
  for (const mode of ['read-only', 'capacity', 'no-shop']) {
    test(`settings ${mode} ${locale}`, async ({ page }) => {
      const { calls } = await setup(page, locale, mode)
      await fixtureGoto(page, '/settings')
      if (mode === 'read-only') for (const label of [ar ? 'تعديل ملف المتجر' : 'Edit shop profile', ar ? 'تغيير طريقة التشغيل' : 'Change business mode', ar ? 'تعديل إعدادات الإيصال' : 'Edit receipt settings']) await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled()
      if (mode === 'capacity') {
        await expect(page.getByRole('button', { name: ar ? 'إضافة فرع' : 'Add location', exact: true })).toHaveCount(0)
        await expect(page.locator('#locations').getByRole('link')).toHaveAttribute('href', '/billing')
      }
      if (mode === 'no-shop') {
        await expect(page.getByText(ar ? 'افتح لوحة التحكم لاختيار متجر أو إعداد متجرك.' : 'Open Dashboard to choose or set up your Shop.', { exact: true })).toBeVisible()
        await expect(page.locator('#shop-profile,#business-mode,#locations,#receipt-settings,#cash-policy')).toHaveCount(0)
      }
      expect(calls.filter(call => /^(set_shop_|save_shop_|save_receipt_|archive_shop_)/.test(call.name))).toHaveLength(0)
    })
  }
  for (const rpc of ['receipt_settings', 'shop_cash_policy']) {
    test(`settings ${rpc} fails and retries ${locale}`, async ({ page }) => {
      await setup(page, locale)
      await fixtureRoute(page, `**/rest/v1/rpc/${rpc}`, route => route.fulfill({ status: 503, json: { message: 'Synthetic settings failure' } }))
      await fixtureGoto(page, '/settings')
      const section = page.locator(rpc === 'receipt_settings' ? '#receipt-settings' : '#cash-policy')
      await expect(section.getByRole('alert')).toBeVisible()
      await expect(section.getByRole('dialog')).toHaveCount(0)
      await fixtureUnroute(page, `**/rest/v1/rpc/${rpc}`)
      await section.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
      await expect(section.getByRole('alert')).toHaveCount(0)
      if (rpc === 'receipt_settings') await expect(section.getByText('Fixture receipt', { exact: true })).toBeVisible()
      else await expect(section.getByRole('checkbox')).toBeVisible()
    })
  }

  test(`admin session lookup failure differs from denied ${locale}`, async ({ page }) => {
    const { calls } = await setup(page, locale)
    await fixtureRoute(page, '**/rest/v1/rpc/platform_admin_session', route => route.fulfill({ status: 503, json: { message: 'SENSITIVE DEBUG FAILURE' } }))
    await fixtureGoto(page, '/platform-admin')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('SENSITIVE DEBUG FAILURE', { exact: false })).toHaveCount(0)
    await expect(page.getByRole('table')).toHaveCount(0)
    expect(calls.filter(call => call.name === 'platform_admin_read')).toHaveLength(0)
    await fixtureUnroute(page, '**/rest/v1/rpc/platform_admin_session')
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByRole('cell', { name: /Synthetic tenant/ })).toBeVisible()
  })
  for (const mode of ['observer', 'denied']) {
    test(`admin ${mode} ${locale}`, async ({ page }) => {
      const { calls } = await setup(page, locale, mode)
      await fixtureGoto(page, '/platform-admin')
      if (mode === 'denied') { await expect(page.getByRole('table')).toHaveCount(0); await expect(page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true })).toBeVisible() }
      else {
        await page.getByRole('button', { name: ar ? 'فتح عرض الدعم' : 'Open support view', exact: true }).first().click()
        const dialog = page.getByRole('dialog', { name: 'Synthetic tenant', exact: true })
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('button', { name: /Suspend|Reactivate|note|تعليق|إعادة تنشيط|ملاحظة/ })).toHaveCount(0)
      }
      expect(calls.filter(call => /command$/.test(call.name))).toHaveLength(0)
    })
  }
  test(`admin tenant retry suppresses stale controls ${locale}`, async ({ page }) => {
    await setup(page, locale)
    await fixtureGoto(page, '/platform-admin')
    await fixtureRoute(page, '**/rest/v1/rpc/platform_admin_read', route => route.request().postDataJSON().p_resource === 'shop' ? route.fulfill({ status: 503, json: { message: 'Synthetic detail failure' } }) : route.fallback())
    await page.getByRole('button', { name: ar ? 'فتح عرض الدعم' : 'Open support view', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Suspend|Reactivate|note|تعليق|إعادة تنشيط|ملاحظة/ })).toHaveCount(0)
    await fixtureUnroute(page, '**/rest/v1/rpc/platform_admin_read')
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/platform_admin_read', async route => { if (route.request().postDataJSON().p_resource !== 'shop') return route.fallback(); await gate; return route.fallback() })
    await dialog.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByTestId('section-skeleton')).toBeVisible()
    release()
    await expect(page.getByRole('dialog', { name: 'Synthetic tenant', exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('admin-detail.png'), fullPage: true, animations: 'disabled' })
  })
  test(`operator non-billing support controls ${locale}`, async ({ page }) => {
    test.setTimeout(60000)
    const scriptErrors: string[] = []
    page.on('pageerror', error => scriptErrors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) scriptErrors.push(message.text()) })
    const { calls } = await setup(page, locale)
    await fixtureGoto(page, '/platform-admin')
    await page.getByRole('button', { name: ar ? 'فتح عرض الدعم' : 'Open support view', exact: true }).first().click()
    const detail = page.getByRole('dialog', { name: 'Synthetic tenant', exact: true })
    for (const [key, label] of [['add_support_note', ar ? 'إضافة ملاحظة دعم' : 'Add support note'], ['suspend_shop', ar ? 'إيقاف وصول المتجر' : 'Suspend Shop access'], ['reactivate_shop', ar ? 'إعادة تفعيل وصول المتجر' : 'Reactivate Shop access']] as const) {
      await detail.getByRole('button', { name: label, exact: true }).click()
      const action = page.getByRole('dialog', { name: label, exact: true })
      await action.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Fixture support action')
      if (key === 'add_support_note') await action.getByLabel(ar ? 'ملاحظة الدعم' : 'Support note', { exact: true }).fill('Fixture support note')
      await action.getByRole('button', { name: ar ? 'تطبيق الإجراء' : 'Apply control', exact: true }).click()
      if (key === 'suspend_shop') {
        const confirmation = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
        await confirmation.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
        expect(calls.filter(call => call.name === 'platform_admin_command' && call.args.p_action === key)).toHaveLength(0)
        await action.getByRole('button', { name: ar ? 'تطبيق الإجراء' : 'Apply control', exact: true }).click()
        await confirmation.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      }
      await expect(action).toHaveCount(0)
      expect(calls.filter(call => call.name === 'platform_admin_command').at(-1)?.args).toMatchObject({ p_shop_id: 'tenant-1', p_action: key, p_reason: 'Fixture support action', p_payload: key === 'add_support_note' ? { note: 'Fixture support note' } : {} })
    }
    expect(calls.filter(call => call.name === 'platform_admin_billing_command' || call.name === 'platform_plan_command')).toHaveLength(0)
    expect(scriptErrors).toEqual([])
  })
}
