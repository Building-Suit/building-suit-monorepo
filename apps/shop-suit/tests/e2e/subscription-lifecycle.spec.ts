import { test, expect, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

const limits = {
  active_locations: 3,
  active_members: 25,
  active_products: 5000,
  active_services: 1000,
}

const catalog = ['solo', 'team', 'multi'].map((slug, index) => ({
  id: `plan-${slug}`,
  slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  isActive: true,
  isPublic: true,
  isPurchasable: true,
  isComingSoon: false,
  catalogVersion: 1,
  priceAmount: [349, 699, 1099][index],
  currency: 'EGP',
  billingInterval: 'monthly',
  resourceLimits: limits,
  effectiveFrom: '2026-09-01T00:00:00Z',
  nextTerms: null,
  subscriptionCount: index + 1,
  canDelete: false,
}))

const queueItem = {
  id: 'notice-1',
  shopId: 'shop-1',
  shopName: 'Pilot barber',
  kind: 'activation',
  status: 'submitted',
  currentPlanSlug: 'multi',
  currentPlanName: 'Multi',
  requestedPlanId: 'plan-solo',
  requestedPlanSlug: 'solo',
  requestedPlanName: 'Solo',
  billingInterval: 'monthly',
  listPriceAmount: 349,
  effectivePriceAmount: 299,
  priceSource: 'override',
  usageBlockers: [{ resource: 'active_locations', used: 2, limit: 1, excess: 1 }],
  expectedAmount: 299,
  paidAmount: 299,
  currency: 'EGP',
  transferDate: '2026-09-30',
  transferReference: 'INSTAPAY-PILOT-001',
  reviewReason: null,
  receivedAmount: null,
  receivedReference: null,
  receivedDate: null,
  activationDays: null,
  approvedSubscriptionEnd: null,
  submittedAt: '2026-09-30T10:00:00Z',
  reviewedAt: null,
}

async function navigate(page: Page, path: string) {
  await page.locator('#__nuxt').evaluate(async (root, destination) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__
    await app?.config.globalProperties.$router?.push(destination)
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path}(?:[?#]|$)`))
}

async function setup(page: Page, locale: string) {
  return pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'platform_admin_session') {
      return { userId: '00000000-0000-4000-8000-000000000001', role: 'operator', canMutate: true, displayName: 'Lifecycle operator' }
    }
    if (name === 'platform_admin_read') {
      if (args.p_resource === 'dashboard') return {
        shops: 1, activeShops: 1, suspendedShops: 0, locations: 2, members: 3,
        activeTrials: 0, trialsExpiringSoon: 0, activeSubscriptions: 1,
        readOnlySubscriptions: 0, pendingBillingSubmissions: 1, recentEvents: [],
      }
      if (args.p_resource === 'shops') return { items: [], total: 0, page: 1, pageSize: 20 }
      if (args.p_resource === 'audit') return { items: [], total: 0, page: 1, pageSize: 25 }
    }
    if (name === 'platform_admin_billing_read') {
      if (args.p_resource === 'configuration') return {
        recipientAlias: 'building-suit@instapay', paymentLink: null, qrImageUrl: null,
        instructionsEn: 'Verify the transfer against the external statement.',
        instructionsAr: 'تحقق من التحويل مقابل كشف الحساب الخارجي.',
        updatedAt: '2026-09-30T09:00:00Z',
      }
      if (args.p_resource === 'summary') return { open: 1, submitted: 1, underReview: 0, approved: 0, rejected: 0 }
      if (args.p_resource === 'queue') return { items: [queueItem], total: 1, page: 1, pageSize: 25 }
      if (args.p_resource === 'audit') return { items: [], total: 0, page: 1, pageSize: 25 }
    }
    if (name === 'platform_plan_read' && args.p_resource === 'catalog') return { items: catalog }
    return undefined
  })
}

for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) {
  test(`platform operator reviews catalog and blocked transfer: ${locale}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await setup(page, locale)
    await navigate(page, '/platform-admin')
    const main = page.getByRole('main')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(main.getByRole('heading', { name: locale === 'ar' ? 'إدارة المنصة' : 'Platform administration' })).toBeVisible()

    await main.getByRole('button', { name: locale === 'ar' ? 'الخطط والاشتراكات' : 'Plans & subscriptions' }).click()
    await expect(main.getByRole('heading', { name: locale === 'ar' ? 'الخطط' : 'Plans' })).toBeVisible()
    await expect(main.getByText('Solo', { exact: true })).toBeVisible()
    await expect(main.getByText('Multi', { exact: true })).toBeVisible()

    await main.getByRole('button', { name: locale === 'ar' ? 'قائمة الفوترة' : 'Billing queue' }).click()
    await expect(main.getByRole('heading', { name: locale === 'ar' ? 'تعليمات InstaPay' : 'InstaPay instructions' })).toBeVisible()
    await expect(main.getByText('Pilot barber', { exact: true })).toBeVisible()
    await expect(main.getByText(locale === 'ar' ? 'تفاوضي' : 'Negotiated', { exact: true })).toBeVisible()
    await expect(main.getByText('active_locations: +1', { exact: true })).toBeVisible()
    await expect(main.getByRole('button', { name: locale === 'ar' ? 'اعتماد وتفعيل' : 'Approve and activate' })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
