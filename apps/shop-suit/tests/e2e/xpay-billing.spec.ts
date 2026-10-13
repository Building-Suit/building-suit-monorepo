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
      await expect(checkout.getByRole('button')).toBeDisabled()
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
