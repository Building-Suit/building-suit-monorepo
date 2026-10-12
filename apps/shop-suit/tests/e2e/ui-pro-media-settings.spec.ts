import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`media and settings ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.route('https://media.example.test/**', route => route.request().url().includes('broken') ? route.abort('failed') : route.fulfill({ status: route.request().url().includes('broken') ? 404 : 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#16293B"/><circle cx="80" cy="50" r="28" fill="#D89B42"/></svg>' }))
    await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Pilot shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_billing_read') return { subscription: { planName: 'Synthetic Solo', accessState: 'trialing', trialEndAt: '2026-10-19T12:00:00Z', trialDaysRemaining: 7 }, usage: { resources: [] }, submissions: [] }
      if (name === 'shop_permission_access') return { 'settings.manage': true }
      if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: [
        { id: 'product-1', name: 'Synthetic product', itemType: 'product', unitPrice: 25, discount: 0, stock: 3, imageUrl: 'https://media.example.test/product.svg' },
        { id: 'service-1', name: 'Synthetic service', itemType: 'service', unitPrice: 100, discount: 0, stock: null, imageUrl: 'https://media.example.test/service.svg' },
        { id: 'service-2', name: 'Missing image', itemType: 'service', unitPrice: 50, discount: 0, stock: null, imageUrl: null },
        { id: 'product-2', name: 'Broken image', itemType: 'product', unitPrice: 10, discount: 0, stock: 1, imageUrl: 'https://media.example.test/broken.svg' },
      ], total: 4, page: 1, pageSize: 30, supportsMedia: true, businessMode: 'mixed' }
      return undefined
    })
    await fixtureGoto(page, '/pos')
    await expect(page.locator('.bs-plan-summary')).toHaveCount(1)
    await expect(page.locator('.bs-plan-summary')).toContainText('Synthetic Solo')
    await expect(page.locator('.bs-plan-summary')).toContainText(locale === 'ar' ? 'فترة التجربة' : 'Free trial')
    if (width === 1440) {
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
      await expect(page.locator('.bs-shop-shell')).toHaveClass(/bs-shop-shell--collapsed/)
      await page.screenshot({ path: test.info().outputPath('sidebar-collapsed.png'), fullPage: true })
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    } else {
      await page.getByRole('button', { name: 'فتح القائمة', exact: true }).click()
    }
    await page.screenshot({ path: test.info().outputPath('sidebar-plan.png'), fullPage: true })
    const account = page.locator('[data-user-menu-trigger]')
    await account.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('sidebar-profile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(account).toBeFocused()
    if (width < 1024) await page.keyboard.press('Escape')
    await expect(page.locator('.bs-catalog-tile')).toHaveCount(4)
    await page.locator('.bs-catalog-tile').last().scrollIntoViewIfNeeded()
    await expect(page.locator('.bs-catalog-tile img')).toHaveCount(2)
    await expect(page.getByRole('main')).not.toContainText('NaN')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('pos-media.png'), fullPage: true })
    await fixtureGoto(page, '/settings')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.bs-section-navigation')).toBeVisible()
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('settings.png'), fullPage: true })
    const edit = page.getByRole('button', { name: locale === 'ar' ? 'تعديل ملف المتجر' : 'Edit shop profile', exact: true })
    await edit.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true }).click()
    await expect(edit).toBeFocused()
  })
}
