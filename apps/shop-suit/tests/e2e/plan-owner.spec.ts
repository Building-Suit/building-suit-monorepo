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
  ['plan-solo', 'Solo', 'solo', 'standard', 'Solo', 'monthly', 349, limits.solo],
  ['plan-solo', 'Solo', 'solo', 'standard', 'Solo', 'annual', 2847.84, limits.solo],
  ['plan-team', 'Team', 'team', 'standard', 'Team', 'monthly', 699, limits.team],
  ['plan-team', 'Team', 'team', 'standard', 'Team', 'annual', 5703.84, limits.team],
  ['plan-multi', 'Multi', 'multi', 'multi_2', 'Multi · 2 branches', 'monthly', 999, limits.multi2],
  ['plan-multi', 'Multi', 'multi', 'multi_2', 'Multi · 2 branches', 'annual', 8151.84, limits.multi2],
  ['plan-multi', 'Multi', 'multi', 'multi_3', 'Multi · 3 branches', 'monthly', 1199, limits.multi3],
  ['plan-multi', 'Multi', 'multi', 'multi_3', 'Multi · 3 branches', 'annual', 9783.84, limits.multi3],
] as const
const catalog = catalogRows.map(([id, name, slug, plan_variant, variant_name, billing_interval, price_amount, resource_limits]) => ({ id, name, slug, catalog_terms_id: `terms-${slug}-${plan_variant}-${billing_interval}`, plan_variant, variant_name, price_amount, resource_limits, currency: 'EGP', billing_interval, trial_days: 7, features: {}, is_purchasable: true, is_coming_soon: false }))

function plan(id: string, name: string, slug: string, variant: 'standard' | 'multi_2' | 'multi_3', interval: 'monthly' | 'annual', price: number, resourceLimits: typeof limits.team, blockers: Array<Record<string, unknown>> = []) {
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
      plan('plan-solo', 'Solo', 'solo', 'standard', 'monthly', 349, limits.solo, [
        { resource: 'active_locations', used: 4, limit: 1, excess: 3 },
        { resource: 'active_members', used: 10, limit: 2, excess: 8 },
        { resource: 'active_products', used: 300, limit: 250, excess: 50 },
        { resource: 'active_services', used: 260, limit: 50, excess: 210 },
        { resource: 'active_customers', used: 1800, limit: 500, excess: 1300 },
        { resource: 'active_suppliers', used: 160, limit: 50, excess: 110 },
      ]),
      plan('plan-solo', 'Solo', 'solo', 'standard', 'annual', 2847.84, limits.solo),
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

test('public pricing renders three server-priced families with exact monthly and yearly terms', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await setup(page, 'en', { status: null })
  await navigate(page, '/')
  await expect(page.getByRole('main').getByRole('heading', { name: 'Know your real profit, Stop guessing.', exact: true })).toBeVisible()
  // Landing motion reveals pricing on scroll before its controls become accessible.
  await page.locator('#pricing').scrollIntoViewIfNeeded()
  const plans = page.getByTestId('shop-plan-cards')
  await expect(plans).toBeVisible()
  await expect(plans.locator('article')).toHaveCount(3)
  const solo = plans.locator('[data-plan="solo"]')
  const team = plans.locator('[data-plan="team"]')
  const multi = plans.locator('[data-plan="multi"]')
  await expect(solo).toContainText('349')
  await expect(team).toContainText('699')
  await expect(multi).toContainText('999')
  await expect(multi).toContainText('Shop locations you can run')
  await plans.getByRole('radio', { name: 'Yearly' }).check()
  await expect(solo).toContainText('2,847.84')
  await expect(solo).toContainText('4,188')
  await expect(team).toContainText('5,703.84')
  await expect(team).toContainText('8,388')
  await expect(multi).toContainText('8,151.84')
  await expect(multi).toContainText('11,988')
  await expect(plans.getByText('32% off')).toHaveCount(3)
  await plans.getByRole('radio', { name: '3 branches' }).check()
  await expect(multi.getByRole('radio').last()).toBeChecked()
  await expect(multi).toContainText('9,783.84')
  await expect(multi).toContainText('14,388')
  await expect(multi).toContainText('25')
  await expect(multi).toContainText('10,000')
})

for (const locale of ['en', 'ar']) {
  test(`Multi switch is keyboard and screen-reader accessible: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await setup(page, locale, { status: null })
    await navigate(page, '/')
    await expect(page.getByRole('main').getByRole('heading', {
      name: locale === 'ar' ? 'أعرف حقاً الربح الحقيقي، توقف عن التخمين.' : 'Know your real profit, Stop guessing.',
      exact: true,
    })).toBeVisible()
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    const plans = page.getByTestId('shop-plan-cards')
    await expect(plans).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    const multi = plans.locator('[data-plan="multi"]')
    const variant = plans.getByRole('radio', { name: locale === 'ar' ? '٣ فروع' : '3 branches' })
    await variant.focus()
    await page.keyboard.press('Space')
    await expect(variant).toBeChecked()
    await expect(multi.getByRole('radio').last()).toBeChecked()
    await expect(multi).toContainText(locale === 'ar' ? '٢٥' : '25')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) {
  test(`owner compares plan limits and usage: ${locale}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await setup(page, locale, { status: null })
    await navigate(page, '/billing')
    const main = page.getByRole('main')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(main.getByRole('heading', { name: locale === 'ar' ? 'الاشتراك والدفع' : 'Subscription and billing' })).toBeVisible()
    const currentSubscription = main.locator('#current-plan')
    await expect(currentSubscription).toContainText(locale === 'ar' ? 'يُطبق سعر تفاوضي' : 'Negotiated price applies')
    await expect(main.locator('#usage').getByText(locale === 'ar' ? 'أعلى من الحد' : 'Over limit', { exact: true })).toHaveCount(4)
    await expect(main.locator('#usage').getByText(locale === 'ar' ? 'قريب من الحد' : 'Near limit', { exact: true })).toHaveCount(1)
    await expect(main.locator('#usage').getByText(locale === 'ar' ? 'متاح' : 'Available', { exact: true })).toHaveCount(1)
    await expect(main.getByRole('heading', { name: 'Legacy founder' })).toHaveCount(0)
    const soloCard = main.locator('article').filter({ has: page.getByRole('heading', { name: 'Solo', exact: true }) })
    const soloChoice = soloCard.getByRole('button', { name: locale === 'ar' ? 'اختيار الخطة' : 'Choose plan' })
    await expect(soloChoice).toBeEnabled()
    await expect(soloCard.getByRole('status').getByRole('listitem')).toHaveCount(6)
    for (const label of locale === 'ar'
      ? ['فروع المتجر', 'أفراد فريقك', 'المنتجات النشطة', 'الخدمات النشطة', 'العملاء النشطون', 'الموردون النشطون']
      : ['Shop locations', 'People on your team', 'Active products', 'Active services', 'Active customers', 'Active suppliers']) {
      await expect(soloCard.getByRole('status')).toContainText(label)
    }
    await expect(soloCard.getByRole('status')).toContainText(locale === 'ar'
      ? 'لن يُحذف أو يُؤرشف أي شيء تلقائيًا'
      : 'Nothing is deleted or archived automatically')
    await expect(soloCard.getByRole('status')).toContainText(locale === 'ar'
      ? 'حتى تخفّض الاستخدام أو ترقي الخطة'
      : 'until you reduce usage or upgrade the plan')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const locale of ['en', 'ar']) for (const [slug, name, price] of [
  ['solo', 'Solo', 349], ['team', 'Team', 649], ['multi', 'Multi', 999],
] as const) {
  test(`trial owner can review the exact ${name} X-Pay quote without a manual payment: ${locale}`, async ({ page }) => {
    const { calls } = await setup(page, locale, { status: null })
    await navigate(page, '/billing')
    const card = page.getByTestId('shop-plan-cards').locator(`[data-plan="${slug}"]`)
    await card.getByRole('button').click()
    const checkout = page.getByTestId('hosted-checkout')
    await expect(checkout).toContainText(name)
    await expect(checkout).toContainText(new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(price))
    await expect(checkout.getByRole('button')).toBeDisabled()
    expect(calls.filter(call => call.name === 'submit_shop_billing_notice')).toEqual([])
  })
}

test('owner selects exact Multi 3 annual quote for X-Pay', async ({ page }) => {
  await setup(page, 'en', { status: null })
  await navigate(page, '/billing')
  const plans = page.getByTestId('shop-plan-cards')
  await plans.getByRole('radio', { name: 'Yearly' }).check()
  await plans.getByRole('radio', { name: '3 branches' }).check()
  await plans.locator('[data-plan="multi"]').getByRole('button', { name: 'Choose plan' }).click()
  await expect(page.getByTestId('hosted-checkout')).toContainText('Multi · 3 branches')
  await expect(page.getByTestId('hosted-checkout')).toContainText('9,783.84')
  await expect(page.getByTestId('hosted-checkout')).toContainText('Annual')
  await expect(page.getByTestId('hosted-checkout').getByRole('button')).toBeDisabled()
})

for (const locale of ['en', 'ar']) for (const status of ['submitted', 'under_review', 'approved', 'rejected'] as const) {
  test(`historical ${status} does not imply a new activation: ${locale}`, async ({ page }) => {
    const { calls } = await setup(page, locale, { status })
    await navigate(page, '/billing')
    await expect(page.getByRole('row').filter({ hasText: 'IPN-PLAN-001' })).toBeVisible()
    await expect(page.locator('#current-plan')).toContainText(locale === 'ar' ? 'فترة تجريبية' : 'Trialing')
    await expect(page.getByTestId('hosted-checkout').getByRole('button')).toBeDisabled()
    await expect(page.locator('input[type="file"], input[type="date"], input[type="number"]')).toHaveCount(0)
    expect(calls.filter(call => /submit_shop_billing_notice|reserve_shop_billing_payment_evidence/.test(call.name))).toEqual([])
  })
}
