import { test, expect, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

type RequestStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | null

const limits = {
  solo: { active_locations: 1, active_members: 2, active_products: 100, active_services: 25 },
  team: { active_locations: 2, active_members: 10, active_products: 1000, active_services: 100 },
  multi: { active_locations: 10, active_members: 50, active_products: null, active_services: null },
}
const catalog = [
  ['plan-solo', 'Solo', 'solo', 349, limits.solo],
  ['plan-team', 'Team', 'team', 699, limits.team],
  ['plan-multi', 'Multi', 'multi', 1099, limits.multi],
].map(([id, name, slug, price_amount, resource_limits]) => ({ id, name, slug, price_amount, resource_limits, currency: 'EGP', billing_interval: 'monthly', trial_days: 14, features: {}, is_purchasable: true, is_coming_soon: false }))

function plan(id: string, name: string, slug: string, price: number, resourceLimits: typeof limits.team, blockers: Array<Record<string, unknown>> = []) {
  return { planId: id, planName: name, planSlug: slug, catalogTermsId: `terms-${slug}`, billingInterval: 'monthly', currency: 'EGP', listPriceAmount: price, effectivePriceAmount: slug === 'team' ? 649 : price, priceSource: slug === 'team' ? 'override' : 'catalog', resourceLimits, blockers }
}

function billing(status: RequestStatus) {
  const submission = status ? [{
    id: 'submission-1', kind: 'renewal', status, expectedAmount: 1099, paidAmount: 1099, currency: 'EGP',
    requestedPlanId: 'plan-multi', requestedPlanSlug: 'multi', requestedPlanName: 'Multi', billingInterval: 'monthly',
    listPriceAmount: 1099, effectivePriceAmount: 1099, priceSource: 'catalog', transferDate: '2026-09-29',
    transferReference: 'IPN-PLAN-001', reviewReason: status === 'rejected' ? 'Reference not found' : null,
    receivedAmount: null, receivedReference: null, receivedDate: null, activationDays: null,
    approvedSubscriptionEnd: status === 'approved' ? '2026-11-12T12:00:00Z' : null,
    submittedAt: '2026-09-29T12:00:00Z', reviewedAt: ['approved', 'rejected'].includes(status) ? '2026-09-29T13:00:00Z' : null,
  }] : []
  return {
    subscription: {
      id: 'subscription-1', status: 'trialing', planId: 'plan-team', planSlug: 'team', planName: 'Team',
      priceAmount: 699, listPriceAmount: 699, effectivePriceAmount: 649, priceSource: 'override',
      priceOverrideId: 'override-1', priceOverrideReason: 'Pilot agreement', priceOverrideEffectiveFrom: '2026-09-01T00:00:00Z', priceOverrideExpiresAt: null,
      currency: 'EGP', billingInterval: 'monthly', trialStartAt: '2026-09-20T12:00:00Z', trialEndAt: '2026-10-04T12:00:00Z',
      periodStart: null, periodEnd: null, accessState: 'trialing', trialDaysRemaining: 5,
    },
    availablePlans: [
      plan('legacy-plan', 'Legacy founder', 'legacy-founder', 199, limits.team),
      plan('plan-solo', 'Solo', 'solo', 349, limits.solo, [{ resource: 'active_locations', used: 2, limit: 1, excess: 1 }]),
      plan('plan-team', 'Team', 'team', 699, limits.team),
      plan('plan-multi', 'Multi', 'multi', 1099, limits.multi),
    ],
    instructions: { recipientAlias: 'building-suit@instapay', paymentLink: null, qrImageUrl: null, instructionsEn: 'Transfer the exact amount and keep the reference.', instructionsAr: 'حوّل المبلغ المحدد واحتفظ بالمرجع.', updatedAt: '2026-09-01T00:00:00Z', manualVerification: true },
    usage: {
      locations: 2, members: 8, products: 20, services: 51, limits: limits.team,
      resources: [
        { resource: 'active_locations', used: 2, limit: 2, remaining: 0, unlimited: false, atLimit: true, overLimit: false },
        { resource: 'active_members', used: 8, limit: 10, remaining: 2, unlimited: false, atLimit: false, overLimit: false },
        { resource: 'active_products', used: 20, limit: null, remaining: null, unlimited: true, atLimit: false, overLimit: false },
        { resource: 'active_services', used: 51, limit: 50, remaining: 0, unlimited: false, atLimit: true, overLimit: true },
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
    await expect(main.locator('[data-usage-state="full"]')).toHaveCount(1)
    await expect(main.locator('[data-usage-state="near"]')).toHaveCount(1)
    await expect(main.locator('[data-usage-state="over"]')).toHaveCount(1)
    await expect(main.getByRole('heading', { name: 'Legacy founder' })).toHaveCount(0)
    await expect(main.getByRole('button', { name: locale === 'ar' ? 'اختيار الخطة' : 'Choose plan' }).first()).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
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
    await main.getByRole('spinbutton', { name: locale === 'ar' ? 'المبلغ المحوّل' : 'Amount transferred' }).fill('1099')
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
