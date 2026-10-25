import { test, expect, type BrowserContext } from '@playwright/test'
import { manualPaymentCopy } from '../../app/utils/manualPaymentPresentation'
interface FinancialFixture { origin: string; api: string; storageState: Awaited<ReturnType<BrowserContext['storageState']>>; reference: string; notice: { id: string; quote_id: string; intent_id: string; amount_minor: string; currency: string }; quote: { quote_id: string; terms_id: string; amount_minor: string; currency: string; currency_exponent: number; payment_route: { live_activation: boolean; purchase_available: boolean } } }
function fixture(): FinancialFixture {
  if (process.env.DOCTOR_FINANCIAL_ACCEPTANCE !== 'owned-actual-provider') throw Error('Owned financial fixture required')
  const f = JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE ?? '{}') as FinancialFixture
  if (f.origin !== 'http://127.0.0.1:4341' || f.api !== 'http://127.0.0.1:65321' || !Array.isArray(f.storageState?.cookies)) throw Error('Owned financial target rejected')
  return f
}
for (const ar of [false, true]) test(`DOS-M6-003-C02-${ar ? 'AR' : 'EN'}`, async ({ browser }) => {
  const f = fixture(), copy = manualPaymentCopy(ar)
  // Source values come from actual owned subscriber RPCs after the existing full quote/receipt/review journey.
  expect(f.notice.quote_id).toBe(f.quote.quote_id); expect(f.notice.amount_minor).toBe(f.quote.amount_minor)
  expect(f.quote.amount_minor).toBe('243984'); expect(f.quote.currency).toBe('EGP'); expect(f.quote.currency_exponent).toBe(2)
  expect(f.quote.payment_route.live_activation).toBe(false); expect(f.quote.payment_route.purchase_available).toBe(false)
  const context = await browser.newContext({ storageState: f.storageState, viewport: { width: ar ? 390 : 1280, height: 1000 }, colorScheme: ar ? 'dark' : 'light' })
  try {
    await context.route('**/*', route => [f.origin, f.api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
    await context.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: f.origin }])
    await context.addInitScript(({ dark }) => localStorage.setItem('building-suit.theme', dark ? 'dark' : 'light'), { dark: ar })
    const page = await context.newPage(); await page.goto(f.origin + '/payment-notices')
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible()
    await page.getByRole('row').filter({ hasText: f.reference }).getByRole('button', { name: copy.open, exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.details, exact: true })).toBeVisible()
    await expect(page.getByText(f.quote.quote_id, { exact: true })).toBeVisible()
    await expect(page.getByText(f.notice.intent_id, { exact: true })).toBeVisible()
    await expect(page.getByText(f.quote.terms_id, { exact: true })).toBeVisible()
    await expect(page.getByText('2439.84 EGP', { exact: true }).last()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  } finally { await context.unrouteAll({ behavior: 'ignoreErrors' }); await context.close() }
})
