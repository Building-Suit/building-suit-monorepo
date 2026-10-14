import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const plan = { id: 'plan-reviewed', slug: 'solo', name: 'Reviewed Solo', isActive: true, isPublic: true, isPurchasable: true, isComingSoon: false, catalogVersion: 2, priceAmount: 399, currency: 'EGP', billingInterval: 'monthly', resourceLimits: {}, effectiveFrom: '2026-10-01', nextTerms: null, subscriptionCount: 1 }
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`operator plan version and transfer review preserve payload: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const arabic = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'platform_admin_session') return { userId: 'operator', role: 'operator', canMutate: true, displayName: 'Fixture operator' }
      if (name === 'platform_plan_read') return args.p_resource === 'catalog' ? { items: [plan] } : { subscription: null, availablePlans: [] }
      if (name === 'platform_admin_read') return args.p_resource === 'dashboard' ? { shops: 1, activeShops: 1, recentEvents: [] } : { items: [], total: 0 }
      if (name === 'platform_admin_billing_read') return args.p_resource === 'queue' ? { items: [{ id: 'transfer-reviewed', shopId: 'tenant-reviewed', shopName: 'Reviewed tenant', status: 'submitted', currentPlanName: 'Solo', requestedPlanName: 'Reviewed Solo', billingInterval: 'monthly', listPriceAmount: 399, effectivePriceAmount: 349, priceSource: 'override', paidAmount: 349, currency: 'EGP', usageBlockers: [], transferReference: 'Verified reference', transferDate: '2026-10-01' }], total: 1 } : args.p_resource === 'configuration' ? {} : args.p_resource === 'summary' ? { open: 1 } : { items: [], total: 0 }
      if (name === 'platform_plan_command' || name === 'platform_admin_billing_command') return null
      return undefined
    })
    await fixtureGoto(page, '/platform-admin')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(arabic ? 'إدارة المنصة' : 'Platform administration')
    await page.getByRole('button', { name: arabic ? 'الخطط والاشتراكات' : 'Plans & subscriptions', exact: true }).click()
    await page.getByRole('button', { name: arabic ? 'نشر إصدار جديد' : 'Publish new version', exact: true }).click()
    const terms = page.getByRole('dialog')
    await terms.getByLabel(arabic ? 'الاسم المعروض' : 'Display name', { exact: true }).fill('Reviewed version')
    await terms.getByLabel(arabic ? 'يسري من' : 'Effective from', { exact: true }).fill('2026-11-01T10:30')
    await terms.getByLabel(arabic ? 'السبب' : 'Reason', { exact: true }).fill('Verified catalogue version')
    await terms.getByRole('button', { name: arabic ? 'تطبيق وتسجيل' : 'Apply and audit', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const published = calls.find(call => call.name === 'platform_plan_command')
    expect(published?.args).toMatchObject({ p_action: 'publish_terms', p_plan_id: 'plan-reviewed', p_shop_id: null, p_reason: 'Verified catalogue version', p_payload: { displayName: 'Reviewed version', currency: 'EGP', priceAmount: 399, billingInterval: 'monthly' } })
    expect(published?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
    await page.getByRole('button', { name: arabic ? 'قائمة الفوترة' : 'Billing queue', exact: true }).click()
    const queueRow = page.getByRole('row').filter({ hasText: 'Reviewed tenant' })
    await expect(queueRow.getByRole('cell')).toHaveCount(4)
    await expect(queueRow).toContainText('Reviewed Solo')
    await expect(queueRow).toContainText('Verified reference')
    await expect(queueRow).toContainText(/399|٣٩٩/)
    await expect(queueRow).toContainText(/349|٣٤٩/)
    await page.screenshot({ path: test.info().outputPath('compact-billing-queue.png'), fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: arabic ? 'اعتماد وتفعيل' : 'Approve and activate', exact: true }).click()
    const review = page.getByRole('dialog').first()
    await review.getByLabel(arabic ? 'السبب' : 'Reason', { exact: true }).fill('Verified receipt evidence')
    await review.getByRole('button', { name: arabic ? 'تطبيق الإجراء' : 'Apply control', exact: true }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: arabic ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const reviewed = calls.find(call => call.name === 'platform_admin_billing_command')
    expect(reviewed?.args).toMatchObject({ p_action: 'approve', p_submission_id: 'transfer-reviewed', p_reason: 'Verified receipt evidence', p_payload: { receivedAmount: 349, receivedReference: 'Verified reference', receivedDate: '2026-10-01' } })
    expect(reviewed?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
    await expectNoPageOverflow(page)
    const dismissals = page.locator('[role="status"][aria-live="polite"] button')
    while (await dismissals.count()) await dismissals.first().click()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/admin-shop-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
for (const locale of ['en', 'ar']) {
  test(`observer cannot open mutation controls: ${locale}`, async ({ page }) => {
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => name === 'platform_plan_read' ? args.p_resource === 'catalog' ? { items: [plan] } : { subscription: null, availablePlans: [] } : undefined)
    await fixtureGoto(page, '/platform-admin')
    await page.getByRole('button', { name: locale === 'ar' ? 'الخطط والاشتراكات' : 'Plans & subscriptions', exact: true }).click()
    await expect(page.getByRole('button', { name: locale === 'ar' ? 'نشر إصدار جديد' : 'Publish new version', exact: true })).toHaveCount(0)
    expect(calls.some(call => call.name.endsWith('_command'))).toBe(false)
  })
}
