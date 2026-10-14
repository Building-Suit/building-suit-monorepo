import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const legacyRequest = { id: 'legacy-request', status: 'under_review', requestedPlanName: 'Legacy Team', effectivePriceAmount: 199.9, paidAmount: 199.9, currency: 'EGP', transferReference: 'legacy-reference', transferDate: '2026-10-01', reviewReason: 'Existing review remains available' }
for (const locale of ['en', 'ar'] as const) {
  for (const dark of [false, true]) {
    test(`X-Pay setup unavailable preserves history and removes manual entry points: ${locale}/${dark ? 'dark' : 'light'}`, async ({ page }) => {
      const fixture = await pilotFixture(page, locale, 'owner', name => name === 'shop_billing_read' ? {
        subscription: { planName: 'Trial plan', accessState: 'trialing', priceAmount: 199.9, effectivePriceAmount: 199.9, currency: 'EGP', trialDaysRemaining: 7, trialEndAt: '2026-10-20' },
        availablePlans: [], usage: { resources: [], limits: {} }, submissions: [legacyRequest],
        instructions: { recipientAlias: 'must-not-display', paymentLink: 'https://example.invalid/manual', qrImageUrl: null, instructionsEn: 'Old transfer instructions', instructionsAr: 'تعليمات التحويل السابقة' },
      } : undefined)
      await fixtureGoto(page, '/billing')
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
      const checkout = page.getByTestId('hosted-checkout')
      await expect(checkout.getByRole('heading', { name: locale === 'en' ? 'Pay with X-Pay' : 'الدفع بـ X-Pay' })).toBeVisible()
      await expect(checkout.getByRole('button').first()).toBeDisabled()
      await expect(checkout.getByRole('status')).toContainText(locale === 'en' ? 'not available yet' : 'غير متاح بعد')
      await expect(checkout).toContainText(locale === 'en' ? 'day one' : 'أول يوم')
      const logo = checkout.getByRole('img', { name: 'X-Pay', exact: true })
      await expect(logo).toBeVisible()
      await expect(logo.locator(`img[src$="xpay-${dark ? 'dark' : 'light'}.svg"]`)).toBeVisible()
      await expect(logo.locator(`img[src$="xpay-${dark ? 'light' : 'dark'}.svg"]`)).toBeHidden()
      await expect(page.getByRole('main')).toContainText('legacy-reference')
      await expect(page.getByRole('main')).toContainText(legacyRequest.reviewReason)
      await expect(page.locator('[data-payment-evidence]')).toHaveCount(0)
      await expect(page.locator('input[type="file"], input[type="date"], input[type="number"]')).toHaveCount(0)
      await expect(page.getByText('must-not-display')).toHaveCount(0)
      await expect(page.getByRole('link', { name: locale === 'en' ? 'Terms & Conditions' : 'الشروط والأحكام' }).first()).toHaveAttribute('href', '/terms')
      expect(fixture.calls.filter(call => /submit_shop_billing_notice|redeem_shop_private_offer|reserve_shop_billing_payment_evidence/.test(call.name))).toEqual([])
    })
  }
}

test('non-owner has no billing or checkout access', async ({ page }) => {
  const fixture = await pilotFixture(page, 'en', 'barber')
  await fixtureGoto(page, '/billing')
  await expect(page.getByRole('main')).toContainText('Ask the Shop owner')
  await expect(page.getByTestId('hosted-checkout')).toHaveCount(0)
  expect(fixture.calls.filter(call => call.name === 'shop_billing_read')).toEqual([])
})

for (const locale of ['en', 'ar'] as const) {
  test(`public policy says day-one X-Pay with verified activation: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.route(/\/auth\/v1\//, route => route.fulfill({ status: 401, json: { message: 'no session' } }))
    await page.goto('/terms')
    await expect(page.getByRole('main')).toContainText('X-Pay')
    await expect(page.getByRole('main')).toContainText(locale === 'en' ? 'day one' : 'أول يوم')
    await expect(page.getByRole('main')).toContainText(locale === 'en' ? 'Pending, failed or cancelled' : 'المعلّقة أو الفاشلة أو الملغاة')
    await expect(page.getByRole('main')).not.toContainText('InstaPay')
    await page.goto('/privacy')
    await expect(page.getByRole('main')).toContainText(locale === 'en' ? 'does not collect card numbers' : 'لا يجمع Shop Suit أرقام البطاقات')
    await page.goto('/refund-cancellation')
    await expect(page.getByRole('main')).toContainText(locale === 'en' ? 'no automatic refund or fixed processing time is promised' : 'لا نعد باسترداد تلقائي أو مدة معالجة ثابتة')
  })
}

const orderId = '11111111-1111-4111-8111-111111111111'
const hostedOrder = { orderId, state: 'open', currency: 'EGP', amountMinor: 34900, planName: 'Server-approved Solo', createdAt: '2026-10-13T12:00:00Z', sessionId: 'cs_test_browser', url: 'https://checkout.xpay.app/c/cs_test_browser' }
async function readyFixture(page: Parameters<typeof pilotFixture>[0], response: (args: Record<string, unknown>) => unknown) {
  const limits = { active_locations: 1, active_members: 5, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 }
  return pilotFixture(page, 'en', 'owner', (name, args) => {
    if (name === 'shop_public_plan_catalog') return [{ id: 'public-1', name: 'Solo', slug: 'solo', catalog_terms_id: 'terms-1', plan_variant: 'standard', variant_name: 'Standard', price_amount: 399, currency: 'EGP', billing_interval: 'monthly', trial_days: 7, features: {}, resource_limits: limits, is_purchasable: true, is_coming_soon: false }]
    if (name === 'shop_billing_read') return { subscription: { planName: 'Trial plan', accessState: 'trialing', status: 'trialing', currency: 'EGP', trialDaysRemaining: 7 }, availablePlans: [{ planId: 'public-1', planSlug: 'solo', planName: 'Solo', catalogTermsId: 'terms-1', planVariant: 'standard', variantName: 'Standard', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 399, effectivePriceAmount: 399, priceSource: 'catalog', resourceLimits: limits, blockers: [] }], usage: { resources: [], limits }, submissions: [] }
    if (name === 'shop-xpay-checkout') return args.action === 'status' ? { ready: true, mode: 'test', orders: [] } : response(args)
    return undefined
  })
}
test('trial owner continues on day one using the server quote and exact hosted URL', async ({ page }) => {
  const fixture = await readyFixture(page, () => hostedOrder)
  await page.route(hostedOrder.url, route => route.fulfill({ contentType: 'text/html', body: '<p>Synthetic provider checkout</p>' }))
  await fixtureGoto(page, '/billing')
  await page.locator('[data-plan="solo"]').getByRole('button').click()
  const checkout = page.getByTestId('hosted-checkout')
  await expect(checkout).toContainText('day one')
  await expect(checkout).not.toContainText('no real funds')
  await checkout.getByRole('button', { name: 'Continue to X-Pay', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm', exact: true })
  await expect(dialog).toContainText('Server-approved Solo')
  await expect(dialog).toContainText('349.00')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page).toHaveURL(hostedOrder.url)
  const request = fixture.calls.find(call => call.name === 'shop-xpay-checkout' && call.args.requestId)
  expect(request?.args).toMatchObject({ shopId: 'shop-1', catalogTermsId: 'terms-1', locale: 'en' })
  expect(request?.args).not.toHaveProperty('amount')
  expect(fixture.calls.some(call => /submit_shop_billing_notice|reserve_shop_billing_payment_evidence/.test(call.name))).toBe(false)
})
test('pending return cannot claim activation or start another charge', async ({ page }) => {
  const fixture = await readyFixture(page, () => ({ ...hostedOrder, state: 'pending', url: null }))
  await fixtureGoto(page, `/billing?xpayOrder=${orderId}&cancelled=1`)
  await expect(page.getByTestId('checkout-state')).toContainText('Confirming your payment')
  await expect(page).not.toHaveURL(/xpayOrder|cancelled/)
  await expect(page.getByRole('main')).toContainText('Trial plan')
  await expect(page.getByTestId('hosted-checkout').getByRole('button', { name: 'Continue to X-Pay', exact: true })).toHaveCount(0)
  expect(fixture.calls.filter(call => call.name === 'shop-xpay-checkout' && call.args.requestId)).toEqual([])
})
test('a hostile provider URL is rejected without confirmation or navigation', async ({ page }) => {
  await readyFixture(page, () => ({ ...hostedOrder, url: 'https://evil.example/collect' }))
  await fixtureGoto(page, '/billing')
  await page.locator('[data-plan="solo"]').getByRole('button').click()
  await page.getByTestId('hosted-checkout').getByRole('button', { name: 'Continue to X-Pay', exact: true }).click()
  await expect(page.getByTestId('hosted-checkout')).toContainText('Payment confirmation is taking longer')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/billing$/)
})
test('lost checkout response retries the same identity and preserves trial access', async ({ page }) => {
  const fixture = await readyFixture(page, () => ({ error: 'checkout_not_completed', retrySafe: true }))
  await fixtureGoto(page, '/billing')
  await page.locator('[data-plan="solo"]').getByRole('button').click()
  const action = page.getByTestId('hosted-checkout').getByRole('button', { name: 'Continue to X-Pay', exact: true })
  await action.click()
  await expect(page.getByTestId('hosted-checkout')).toContainText('Payment confirmation is taking longer')
  await expect(action).toHaveCount(0)
  await fixtureGoto(page, '/billing')
  await action.click()
  const calls = fixture.calls.filter(call => call.name === 'shop-xpay-checkout' && call.args.requestId)
  expect(calls).toHaveLength(2)
  expect(calls[0]?.args.requestId).toBe(calls[1]?.args.requestId)
  await expect(page.getByRole('main')).toContainText('Trial plan')
})
