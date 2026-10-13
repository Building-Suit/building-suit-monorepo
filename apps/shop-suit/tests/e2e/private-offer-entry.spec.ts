import { test, expect } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
const id = '11111111-1111-4111-8111-111111111111'
// Synthetic browser transport; authorization is tested separately against local SQL.
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) {
  test(`private customer entry ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1200, height: 1000 })
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
    let redeemed = false
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_private_offer_read') return { offerId: id, offerVersion: 1, shopId: args.p_shop_id, targetBindingId: id, targetEnvironmentId: id, displayName: 'Synthetic frozen private terms', priceAmount: 123.45, currency: 'EGP', billingInterval: 'monthly', expiresAt: '2099-01-01T00:00:00Z', resourceLimits: { active_locations: 1, active_members: 2 }, entitlements: { synthetic_feature: true }, submissionId: redeemed ? id : null, blockers: [] }
      if (name === 'redeem_shop_private_offer') { redeemed = true; return id }
      return undefined
    })
    const link = `http://127.0.0.1:4326/billing#offer=${id}&version=1&binding=${id}&environment=${id}&token=${'T'.repeat(43)}`
    await fixtureGoto(page, link)
    await page.locator('summary').filter({ hasText: locale === 'en' ? 'Private offer' : 'عرض خاص' }).click()
    await expect(page.locator('[data-private-offer-preview]')).toContainText('Synthetic frozen private terms')
    await expect(page).toHaveURL('http://127.0.0.1:4326/billing')
    await expect(page.getByLabel(locale === 'en' ? 'Private offer link' : 'رابط العرض الخاص', { exact: true })).toHaveValue('')
    const previewCall = calls.find(call => call.name === 'shop_private_offer_read')!
    expect(previewCall.args.p_redemption_token).toBe('T'.repeat(43))
    await page.screenshot({ path: `/tmp/shop-private-offer-${locale}-${mobile}-preview.png`, fullPage: true })
    await page.getByRole('button', { name: locale === 'en' ? 'Clear private offer' : 'مسح العرض الخاص', exact: true }).click()
    await expect(page.locator('[data-private-offer-preview]')).toHaveCount(0)
    await page.getByLabel(locale === 'en' ? 'Private offer link' : 'رابط العرض الخاص', { exact: true }).fill(link.replace('127.0.0.1:4326', 'other.example.invalid'))
    await page.getByRole('button', { name: locale === 'en' ? 'Review private terms' : 'مراجعة شروط العرض', exact: true }).click()
    await expect(page.locator('[data-private-offer]')).toContainText(locale === 'en' ? 'This offer is unavailable' : 'هذا العرض غير متاح')
    expect(calls.filter(call => call.name === 'shop_private_offer_read')).toHaveLength(1)
    expect(calls.filter(call => call.name === 'redeem_shop_private_offer')).toHaveLength(0)
    await page.getByLabel(locale === 'en' ? 'Private offer link' : 'رابط العرض الخاص', { exact: true }).fill(link)
    await page.getByRole('button', { name: locale === 'en' ? 'Review private terms' : 'مراجعة شروط العرض', exact: true }).click()
    await expect(page.locator('[data-private-offer-preview]')).toBeVisible()
    const checkout = page.getByTestId('hosted-checkout')
    await expect(checkout).toContainText('Synthetic frozen private terms')
    await expect(checkout).toContainText(/123[.,٫]45|١٢٣٫٤٥/)
    await expect(checkout.getByRole('button').first()).toBeDisabled()
    expect(calls.filter(call => call.name === 'redeem_shop_private_offer')).toHaveLength(0)
    expect(calls.filter(call => call.name === 'submit_shop_billing_notice')).toHaveLength(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
    expect(stored).not.toContain('T'.repeat(43))
  })
}
