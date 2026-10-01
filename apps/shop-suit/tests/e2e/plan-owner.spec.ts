import { test, expect, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

type RequestStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | null

const limits = {
  solo: { active_locations: 1, active_members: 2, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 },
  team: { active_locations: 1, active_members: 8, active_products: 500, active_services: 100, active_customers: 2000, active_suppliers: 150 },
  multi: { active_locations: 2, active_members: 16, active_products: 1000, active_services: 200, active_customers: 5000, active_suppliers: 300 },
}
const catalog = [
  ['plan-solo', 'Solo', 'solo', 349, limits.solo],
  ['plan-team', 'Team', 'team', 699, limits.team],
  ['plan-multi', 'Multi', 'multi', 999, limits.multi],
].map(([id, name, slug, price_amount, resource_limits]) => ({ id, name, slug, catalog_terms_id: `terms-${slug}`, plan_variant: slug === 'multi' ? 'multi_2' : 'standard', variant_name: name, price_amount, resource_limits, currency: 'EGP', billing_interval: 'monthly', trial_days: 7, features: {}, is_purchasable: true, is_coming_soon: false }))

function plan(id: string, name: string, slug: string, price: number, resourceLimits: typeof limits.team, blockers: Array<Record<string, unknown>> = []) {
  return { planId: id, planName: name, planSlug: slug, catalogTermsId: `terms-${slug}`, planVariant: slug === 'multi' ? 'multi_2' : 'standard', variantName: name, billingInterval: 'monthly', currency: 'EGP', listPriceAmount: price, effectivePriceAmount: slug === 'team' ? 649 : price, priceSource: slug === 'team' ? 'override' : 'catalog', resourceLimits, blockers }
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
      plan('legacy-plan', 'Legacy founder', 'legacy-founder', 199, limits.team),
      plan('plan-solo', 'Solo', 'solo', 349, limits.solo, [
        { resource: 'active_locations', used: 4, limit: 1, excess: 3 },
        { resource: 'active_members', used: 10, limit: 2, excess: 8 },
        { resource: 'active_products', used: 300, limit: 250, excess: 50 },
        { resource: 'active_services', used: 260, limit: 50, excess: 210 },
        { resource: 'active_customers', used: 1800, limit: 500, excess: 1300 },
        { resource: 'active_suppliers', used: 160, limit: 50, excess: 110 },
      ]),
      plan('plan-team', 'Team', 'team', 699, limits.team),
      plan('plan-multi', 'Multi', 'multi', 999, limits.multi),
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

for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) {
  test(`owner compares plan limits and usage: ${locale}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await setup(page, locale, { status: null })
    await navigate(page, '/billing')
    const main = page.getByRole('main')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(main.getByRole('heading', { name: locale === 'ar' ? 'الاشتراك والفوترة' : 'Subscription and billing' })).toBeVisible()
    const currentSubscription = main.locator('section[aria-label="Current subscription"]')
    await expect(currentSubscription.getByText(locale === 'ar' ? 'يُطبق سعر تفاوضي' : 'Negotiated price applies', { exact: true })).toBeVisible()
    await expect(main.locator('[data-usage-state="over"]')).toHaveCount(4)
    await expect(main.locator('[data-usage-state="available"]')).toHaveCount(2)
    await expect(main.getByRole('heading', { name: 'Legacy founder' })).toHaveCount(0)
    const soloCard = main.locator('article').filter({ has: page.getByRole('heading', { name: 'Solo', exact: true }) })
    const soloChoice = soloCard.getByRole('button', { name: locale === 'ar' ? 'اختيار الخطة' : 'Choose plan' })
    await expect(soloChoice).toBeEnabled()
    await expect(soloCard.getByRole('alert').getByRole('listitem')).toHaveCount(6)
    for (const label of locale === 'ar'
      ? ['الفروع النشطة', 'أعضاء الفريق', 'المنتجات النشطة', 'الخدمات النشطة', 'العملاء النشطون', 'الموردون النشطون']
      : ['Active locations', 'Team members', 'Active products', 'Active services', 'Active customers', 'Active suppliers']) {
      await expect(soloCard.getByRole('alert')).toContainText(label)
    }
    await expect(soloCard.getByRole('alert')).toContainText(locale === 'ar'
      ? 'لن يُحذف أو يُؤرشف أي شيء تلقائيًا'
      : 'Nothing is automatically deleted or archived')
    await expect(soloCard.getByRole('alert')).toContainText(locale === 'ar'
      ? 'حتى تخفّض الاستخدام أو ترقي الخطة'
      : 'until you reduce usage or upgrade the plan')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const locale of ['en', 'ar']) for (const [slug, name, price] of [
  ['solo', 'Solo', 349], ['team', 'Team', 649], ['multi', 'Multi', 999],
] as const) {
  test(`trial owner can submit a plan-aware ${name} request: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    const request = { status: null as RequestStatus }
    const { calls } = await setup(page, locale, request)
    await navigate(page, '/billing')
    const main = page.getByRole('main')
    const cardName = slug === 'multi'
      ? (locale === 'ar' ? 'مالتي · فرعان' : 'Multi · 2 branches')
      : name
    const planCard = main.locator('article').filter({ has: page.getByRole('heading', { name: cardName, exact: true }) })
    await planCard.getByRole('button').click()
    await expect(main.getByText(new RegExp(`${locale === 'ar' ? 'الخطة المطلوبة' : 'Requested plan'}: ${name}`))).toBeVisible()
    await main.getByRole('spinbutton', { name: locale === 'ar' ? 'المبلغ المحوّل' : 'Amount transferred' }).fill(String(price))
    await main.getByLabel(locale === 'ar' ? 'تاريخ التحويل' : 'Transfer date').fill('2026-09-29')
    await main.getByRole('textbox', { name: locale === 'ar' ? 'مرجع التحويل' : 'Transfer reference' }).fill(`IPN-${slug.toUpperCase()}-001`)
    await main.getByRole('button', { name: locale === 'ar' ? 'إرسال للمراجعة' : 'Submit for review' }).click()
    await page.getByRole('dialog').getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).click()

    await expect.poll(() => calls.filter(call => call.name === 'submit_shop_billing_notice').length).toBe(1)
    const submission = calls.find(call => call.name === 'submit_shop_billing_notice')
    expect(submission?.args.p_requested_plan_slug).toBe(slug)
    expect(submission?.args.p_requested_catalog_terms_id).toBe(`terms-${slug}`)
    expect(submission?.args.p_paid_amount).toBe(price)
  })
}

for (const locale of ['en', 'ar']) {
  test(`manual request and review states do not imply activation: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    const request = { status: null as RequestStatus }
    const { calls } = await setup(page, locale, request)
    await navigate(page, '/billing')
    const main = page.getByRole('main')
    const choose = main.getByRole('button', { name: locale === 'ar' ? 'اختيار الخطة' : 'Choose plan' }).last()
    await choose.focus()
    await page.keyboard.press('Enter')
    await main.getByRole('spinbutton', { name: locale === 'ar' ? 'المبلغ المحوّل' : 'Amount transferred' }).fill('999')
    await main.getByLabel(locale === 'ar' ? 'تاريخ التحويل' : 'Transfer date').fill('2026-09-29')
    await main.getByRole('textbox', { name: locale === 'ar' ? 'مرجع التحويل' : 'Transfer reference' }).fill('IPN-PLAN-001')
    await main.getByRole('button', { name: locale === 'ar' ? 'إرسال للمراجعة' : 'Submit for review' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(locale === 'ar' ? 'لن يتغير الوصول' : 'access will not change')
    await dialog.getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(main.getByText(locale === 'ar' ? /تم الإرسال للمراجعة اليدوية/ : /Submitted for manual review/)).toBeVisible()
    expect(calls.filter(call => call.name === 'submit_shop_billing_notice')).toHaveLength(1)

    for (const [status, message] of locale === 'ar'
      ? [['under_review', /يراجع مسؤول المنصة/], ['approved', /تم اعتماد هذا الطلب/], ['rejected', /تم رفض الطلب/]] as const
      : [['under_review', /operator is reviewing/], ['approved', /request was approved/], ['rejected', /request was rejected/]] as const) {
      request.status = status
      await page.reload()

      // A full reload starts with an empty client-side auth ref. The synthetic
      // fixture therefore passes through /auth/login and restores the session
      // on /dashboard. Wait for that restoration before using the SPA router,
      // otherwise the auth redirect can overwrite the /billing navigation.
      await expect(page.getByRole('main').getByRole('heading', {
        name: locale === 'ar' ? 'لوحة التشغيل' : 'Operating dashboard',
        exact: true,
      })).toBeVisible({ timeout: 20_000 })

      await navigate(page, '/billing')
      await expect(page.getByRole('main').getByText(message)).toBeVisible()
    }
  })
}
