import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`reviewed transfer notice preserves quote and idempotency: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const arabic = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const limits = { active_locations: 1, active_members: 1, active_products: 100, active_services: 100, active_customers: 100, active_suppliers: 100 }
    const plan = { planId: 'plan-1', planSlug: 'solo', planName: 'Fixture reviewed plan', catalogTermsId: 'terms-1', planVariant: 'standard', variantName: 'Standard', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 399, effectivePriceAmount: 349, priceSource: 'override', resourceLimits: limits, blockers: [] }
    const billing = { subscription: { id: 'subscription-1', status: 'active', planId: 'plan-1', planSlug: 'solo', planName: 'Fixture reviewed plan', planVariant: 'standard', variantName: 'Standard', priceAmount: 399, listPriceAmount: 399, effectivePriceAmount: 349, priceSource: 'override', currency: 'EGP', billingInterval: 'monthly', trialEndAt: null, periodEnd: '2026-12-01', accessState: 'active', trialDaysRemaining: 0 }, availablePlans: [plan], instructions: { recipientAlias: 'Fixture recipient', paymentLink: null, qrImageUrl: null, instructionsEn: 'Review transfer details', instructionsAr: 'راجع تفاصيل التحويل', updatedAt: '2026-10-01', manualVerification: true }, usage: { locations: 1, products: 1, services: 0, members: 1, customers: 1, suppliers: 0, limits, resources: [] }, submissions: [] as object[] }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_public_plan_catalog') return [{ id: 'public-1', name: 'Solo', slug: 'solo', catalog_terms_id: 'terms-1', plan_variant: 'standard', variant_name: 'Standard', price_amount: 399, currency: 'EGP', billing_interval: 'monthly', trial_days: 7, features: {}, resource_limits: limits, is_purchasable: true, is_coming_soon: false }]
      if (name === 'shop_billing_read') return billing
      if (name === 'submit_shop_billing_notice') { billing.submissions.push({ id: 'submission-1', kind: 'renewal', status: 'submitted', requestedPlanName: plan.planName, effectivePriceAmount: 349, paidAmount: args.p_paid_amount, currency: 'EGP', transferReference: args.p_transfer_reference, transferDate: args.p_transfer_date, reviewReason: null }); return null }
      if (name === 'shop_billing_payment_evidence_read') return []
      return undefined
    })
    await fixtureGoto(page, '/billing')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(arabic ? 'الاشتراك والدفع' : 'Subscription and billing')
    await expect(page.locator('#plans')).toContainText(/349|٣٤٩/)
    await page.locator('[data-plan="solo"]').getByRole('button').click()
    await page.getByRole('button', { name: arabic ? 'ابعت للمراجعة' : 'Submit for review', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(arabic ? 'المبلغ المحوّل' : 'Amount transferred', { exact: true }).fill('349')
    await dialog.getByLabel(arabic ? 'تاريخ التحويل' : 'Transfer date', { exact: true }).fill('2026-10-01')
    await dialog.getByLabel(arabic ? 'مرجع التحويل' : 'Transfer reference', { exact: true }).fill('Reviewed transfer reference')
    await dialog.getByRole('button', { name: arabic ? 'ابعت للمراجعة' : 'Submit for review', exact: true }).click()
    const confirm = page.getByRole('dialog').last()
    await confirm.getByRole('button', { name: arabic ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const command = calls.find(call => call.name === 'submit_shop_billing_notice')
    expect(command?.args).toMatchObject({ p_shop_id: 'shop-1', p_requested_plan_slug: 'solo', p_requested_catalog_terms_id: 'terms-1', p_paid_amount: 349, p_transfer_date: '2026-10-01', p_transfer_reference: 'Reviewed transfer reference' })
    expect(command?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
    await expect(page.getByRole('row').filter({ hasText: 'Reviewed transfer reference' })).toContainText(/349|٣٤٩/)
    await expectNoPageOverflow(page)
    const dismissals = page.locator('[role="status"][aria-live="polite"] button')
    while (await dismissals.count()) await dismissals.first().click()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/billing-shop-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}

for (const locale of ['en', 'ar']) {
  test(`billing load failure recovers safely: ${locale}`, async ({ page }) => {
    const { fixtureRoute } = await import('./pilot-fixture')
    await pilotFixture(page, locale)
    let failed = true
    await fixtureRoute(page, /\/rpc\/shop_billing_read$/, async route => { if (failed) await route.fulfill({ status: 500, json: { message: 'Synthetic billing failure' } }); else await route.fallback() })
    await fixtureGoto(page, '/billing')
    await expect(page.getByRole('alert')).toContainText(locale === 'ar' ? 'مقدرناش نحمّل معلومات الاشتراك.' : 'Could not load billing information.')
    failed = false
    await page.getByRole('button', { name: locale === 'ar' ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('heading', { level: 2, name: locale === 'ar' ? 'استخدام الخطة' : 'Plan usage', exact: true })).toBeVisible()
  })
  test(`billing denial cannot start an owner query: ${locale}`, async ({ page }) => {
    const { calls } = await pilotFixture(page, locale, 'employee')
    await fixtureGoto(page, '/billing')
    await expect(page.locator('[data-state="denied"]')).toContainText(locale === 'ar' ? 'هذه التفاصيل متاحة للمالك فقط.' : 'Only the owner can access these details.')
    expect(calls.some(call => call.name === 'shop_billing_read')).toBe(false)
    await expect(page.getByRole('button', { name: locale === 'ar' ? 'ابعت للمراجعة' : 'Submit for review', exact: true })).toHaveCount(0)
  })
}
