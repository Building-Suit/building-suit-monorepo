import { expect, test } from '@playwright/test'
// Run the full existing Shop public/legal suite, including contact intake and billing links.
import './public-legal.spec'

for (const locale of ['en', 'ar'] as const) {
  test(`launch claims and policy navigation remain visible: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.route('http://127.0.0.1:61321/**', route => route.fulfill({ json: [] }))
    await page.goto('/terms')
    const main = page.getByRole('main')
    await expect(main).toContainText(locale === 'en' ? 'Solo (1 or 2 members)' : 'Solo (عضو واحد أو عضوان)')
    await expect(main).toContainText(locale === 'en' ? 'not currently verified as enabled' : 'لم يتم التحقق حاليًا')
    await expect(main).toContainText(locale === 'en' ? 'Normal logout ends only the current session' : 'ينهي تسجيل الخروج العادي الجلسة الحالية فقط')
    await page.goto('/privacy')
    await expect(page.getByRole('main')).toContainText('Resend')
    await expect(page.getByRole('main')).toContainText(locale === 'en' ? 'does not guarantee email delivery or a response time' : 'لا يضمن تسجيل الطلب تسليم البريد أو مدة محددة للرد')
    for (const path of ['/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation']) {
      await page.goto(path)
      for (const href of ['/terms', '/privacy', '/delivery-shipping', '/refund-cancellation']) {
        await expect(page.locator(`footer a[href="${href}"]`)).toBeVisible()
      }
    }
  })
}
