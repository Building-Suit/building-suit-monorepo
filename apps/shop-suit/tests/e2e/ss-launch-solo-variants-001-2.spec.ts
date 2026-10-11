import { test, expect, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

type RequestStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | null

const limits = {
  solo: { active_locations: 1, active_members: 2, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 },
  team: { active_locations: 1, active_members: 8, active_products: 500, active_services: 100, active_customers: 2000, active_suppliers: 150 },
  multi2: { active_locations: 2, active_members: 16, active_products: 1000, active_services: 200, active_customers: 5000, active_suppliers: 300 },
  multi3: { active_locations: 3, active_members: 25, active_products: 2000, active_services: 300, active_customers: 10000, active_suppliers: 500 },
}
const catalogRows = [
  ['plan-solo', 'Solo', 'solo', 'solo_1', 'Solo · 1 member', 'monthly', 349, { ...limits.solo, active_members: 1 }],
  ['plan-solo', 'Solo', 'solo', 'solo_1', 'Solo · 1 member', 'annual', 2847.84, { ...limits.solo, active_members: 1 }],
  ['plan-solo', 'Solo', 'solo', 'solo_2', 'Solo · 2 members', 'monthly', 499, limits.solo],
  ['plan-solo', 'Solo', 'solo', 'solo_2', 'Solo · 2 members', 'annual', 4071.84, limits.solo],
  ['plan-team', 'Team', 'team', 'standard', 'Team', 'monthly', 699, limits.team],
  ['plan-team', 'Team', 'team', 'standard', 'Team', 'annual', 5703.84, limits.team],
  ['plan-multi', 'Multi', 'multi', 'multi_2', 'Multi · 2 branches', 'monthly', 999, limits.multi2],
  ['plan-multi', 'Multi', 'multi', 'multi_2', 'Multi · 2 branches', 'annual', 8151.84, limits.multi2],
  ['plan-multi', 'Multi', 'multi', 'multi_3', 'Multi · 3 branches', 'monthly', 1199, limits.multi3],
  ['plan-multi', 'Multi', 'multi', 'multi_3', 'Multi · 3 branches', 'annual', 9783.84, limits.multi3],
] as const
const catalog = catalogRows.map(([id, name, slug, plan_variant, variant_name, billing_interval, price_amount, resource_limits]) => ({ id, name, slug, catalog_terms_id: `terms-${slug}-${plan_variant}-${billing_interval}`, plan_variant, variant_name, price_amount, resource_limits, currency: 'EGP', billing_interval, trial_days: 7, features: {}, is_purchasable: true, is_coming_soon: false }))

function plan(id: string, name: string, slug: string, variant: 'standard' | 'solo_1' | 'solo_2' | 'multi_2' | 'multi_3', interval: 'monthly' | 'annual', price: number, resourceLimits: typeof limits.team, blockers: Array<Record<string, unknown>> = []) {
  const negotiated = slug === 'team' && interval === 'monthly'
  return { planId: id, planName: variant === 'multi_2' ? 'Multi · 2 branches' : variant === 'multi_3' ? 'Multi · 3 branches' : name, planSlug: slug, catalogTermsId: `terms-${slug}-${variant}-${interval}`, planVariant: variant, variantName: name, billingInterval: interval, currency: 'EGP', listPriceAmount: price, effectivePriceAmount: negotiated ? 649 : price, priceSource: negotiated ? 'override' : 'catalog', resourceLimits, blockers }
}

function billing(status: RequestStatus) {
  const submission = status ? [{
    id: 'submission-1', kind: 'renewal', status, expectedAmount: 999, paidAmount: 999, currency: 'EGP',
    requestedPlanId: 'plan-multi', requestedPlanSlug: 'multi', requestedPlanName: 'Multi', planVariant: 'multi_2', billingInterval: 'monthly',
    listPriceAmount: 999, effectivePriceAmount: 999, priceSource: 'catalog', transferDate: '2026-09-29',
    transferReference: 'IPN-PLAN-001', reviewReason: status === 'rejected' ? 'Reference not found' : null,
    receivedAmount: null, receivedReference: null, receivedDate: null, activationDays: null,
    approvedSubscriptionEnd: status === 'approved' ? '2026-11-12T12:00:00Z' : null,
    submittedAt: '2026-09-29T12:00:00Z', reviewedAt: ['approved', 'rejected'].includes(status) ? '2026-09-29T13:00:00Z' : null,
  }] : []
  return {
    subscription: {
      id: 'subscription-1', status: 'trialing', planId: 'plan-team', planSlug: 'team', planName: 'Team', planVariant: 'standard', variantName: 'Team',
      priceAmount: 699, listPriceAmount: 699, effectivePriceAmount: 649, priceSource: 'override',
      priceOverrideId: 'override-1', priceOverrideReason: 'Pilot agreement', priceOverrideEffectiveFrom: '2026-09-01T00:00:00Z', priceOverrideExpiresAt: null,
      currency: 'EGP', billingInterval: 'monthly', trialStartAt: '2026-09-28T12:00:00Z', trialEndAt: '2026-10-05T12:00:00Z',
      periodStart: null, periodEnd: null, accessState: 'trialing', trialDaysRemaining: 5,
    },
    availablePlans: [
      plan('legacy-plan', 'Legacy founder', 'legacy-founder', 'standard', 'monthly', 199, limits.team),
      plan('plan-solo', 'Solo', 'solo', 'solo_1', 'monthly', 349, { ...limits.solo, active_members: 1 }, [
        { resource: 'active_locations', used: 4, limit: 1, excess: 3 },
        { resource: 'active_members', used: 10, limit: 1, excess: 9 },
        { resource: 'active_products', used: 300, limit: 250, excess: 50 },
        { resource: 'active_services', used: 260, limit: 50, excess: 210 },
        { resource: 'active_customers', used: 1800, limit: 500, excess: 1300 },
        { resource: 'active_suppliers', used: 160, limit: 50, excess: 110 },
      ]),
      plan('plan-solo', 'Solo', 'solo', 'solo_1', 'annual', 2847.84, { ...limits.solo, active_members: 1 }),
      plan('plan-solo', 'Solo · 2 members', 'solo', 'solo_2', 'monthly', 499, limits.solo),
      plan('plan-solo', 'Solo · 2 members', 'solo', 'solo_2', 'annual', 4071.84, limits.solo),
      plan('plan-team', 'Team', 'team', 'standard', 'monthly', 699, limits.team),
      plan('plan-team', 'Team', 'team', 'standard', 'annual', 5703.84, limits.team),
      plan('plan-multi', 'Multi', 'multi', 'multi_2', 'monthly', 999, limits.multi2),
      plan('plan-multi', 'Multi', 'multi', 'multi_2', 'annual', 8151.84, limits.multi2),
      plan('plan-multi', 'Multi', 'multi', 'multi_3', 'monthly', 1199, limits.multi3),
      plan('plan-multi', 'Multi', 'multi', 'multi_3', 'annual', 9783.84, limits.multi3),
    ],
    instructions: { recipientAlias: 'building-suit@instapay', paymentLink: null, qrImageUrl: null, instructionsEn: 'Transfer the exact amount and keep the reference.', instructionsAr: 'حوّل المبلغ المحدد واحتفظ بالمرجع.', updatedAt: '2026-09-01T00:00:00Z', manualVerification: true },
    usage: {
      locations: 4, members: 10, products: 300, services: 260, customers: 1800, suppliers: 160, limits: limits.team,
      resources: [
        { resource: 'active_locations', used: 4, limit: 1, remaining: 0, unlimited: false, atLimit: true, overLimit: true },
        { resource: 'active_members', used: 10, limit: 8, remaining: 0, unlimited: false, atLimit: true, overLimit: true },
        { resource: 'active_products', used: 300, limit: 500, remaining: 200, unlimited: false, atLimit: false, overLimit: false },
        { resource: 'active_services', used: 260, limit: 100, remaining: 0, unlimited: false, atLimit: true, overLimit: true },
        { resource: 'active_customers', used: 1800, limit: 2000, remaining: 200, unlimited: false, atLimit: false, overLimit: false },
        { resource: 'active_suppliers', used: 160, limit: 150, remaining: 0, unlimited: false, atLimit: true, overLimit: true },
      ],
    },
    submissions: submission,
  }
}

async function navigate(page: Page, path: string) {
  await page.locator('#__nuxt').evaluate(async (root, destination) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__
    await app?.config.globalProperties.$router?.push(destination)
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path}(?:[?#]|$)`))
}

async function setup(page: Page, locale: string, request: { status: RequestStatus }) {
  return pilotFixture(page, locale, 'owner', (name) => {
    if (name === 'shop_public_plan_catalog') return catalog
    if (name === 'shop_billing_read') return billing(request.status)
    if (name === 'submit_shop_billing_notice') { request.status = 'submitted'; return 'submission-1' }
    return undefined
  })
}

for (const locale of ['en', 'ar']) for (const width of [360, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`Solo accessible server-priced variants: ${locale}, ${width}px, ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await setup(page, locale, { status: null })
    await navigate(page, '/')
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    const cards = page.getByTestId('shop-plan-cards')
    await expect(cards.locator('article')).toHaveCount(3)
    const solo = cards.locator('[data-plan="solo"]')
    await expect(solo).toContainText(locale === 'ar' ? '٣٤٩' : '349')
    const one = solo.getByRole('radio', { name: locale === 'ar' ? 'عضو واحد' : '1 member', exact: true })
    const two = solo.getByRole('radio', { name: locale === 'ar' ? 'عضوان' : '2 members', exact: true })
    await expect(one).toBeChecked()
    await expect(solo.locator('fieldset')).toHaveAccessibleName(locale === 'ar' ? 'عدد الأعضاء في خطة سولو' : 'Solo member allowance')
    await one.focus()
    await expect(one).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(two).toBeChecked()
    await expect(solo).toContainText(locale === 'ar' ? '٤٩٩' : '499')
    await cards.getByRole('radio', { name: locale === 'ar' ? 'سنوي' : 'Yearly', exact: true }).check()
    await expect(solo).toContainText(locale === 'ar' ? '٤٬٠٧١٫٨٤' : '4,071.84')
    await one.focus()
    await page.keyboard.press('Space')
    await expect(one).toBeChecked()
    await expect(solo).toContainText(locale === 'ar' ? '٢٬٨٤٧٫٨٤' : '2,847.84')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await cards.screenshot({ path: testInfo.outputPath('solo-plans.png') })
  })
}

for (const locale of ['en', 'ar']) {
  test(`Solo yearly selection retains the exact term through manual submission: ${locale}`, async ({ page }) => {
    const { calls } = await setup(page, locale, { status: null })
    await navigate(page, '/billing')
    const cards = page.getByTestId('shop-plan-cards')
    const solo = cards.locator('[data-plan="solo"]')
    await solo.getByRole('radio', { name: locale === 'ar' ? 'عضوان' : '2 members', exact: true }).check()
    await solo.getByRole('button', { name: locale === 'ar' ? 'اختيار الخطة' : 'Choose plan' }).click()
    await cards.getByRole('radio', { name: locale === 'ar' ? 'سنوي' : 'Yearly', exact: true }).check()
    await expect(solo).toContainText(locale === 'ar' ? '٤٬٠٧١٫٨٤' : '4,071.84')
    const main = page.getByRole('main')
    await main.getByRole('spinbutton', { name: locale === 'ar' ? 'المبلغ المحوّل' : 'Amount transferred' }).fill('4071.84')
    await main.getByLabel(locale === 'ar' ? 'تاريخ التحويل' : 'Transfer date').fill('2026-09-29')
    await main.getByRole('textbox', { name: locale === 'ar' ? 'مرجع التحويل' : 'Transfer reference' }).fill('SOLO2-ANNUAL')
    await main.getByRole('button', { name: locale === 'ar' ? 'ابعت للمراجعة' : 'Submit for review' }).click()
    await page.getByRole('dialog').getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'submit_shop_billing_notice').length).toBe(1)
    const notice = calls.find(call => call.name === 'submit_shop_billing_notice')
    expect(notice?.args.p_requested_catalog_terms_id).toBe('terms-solo-solo_2-annual')
    expect(notice?.args.p_paid_amount).toBe(4071.84)
  })
}
