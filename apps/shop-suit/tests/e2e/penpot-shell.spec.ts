import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`Penpot shell ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', name => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Main shop', business_mode: 'product', status: 'active', created_at: '2026-01-01' }]
      if (name === 'list_shop_locations') return [{ id: 'location-1', shop_id: 'shop-1', name: 'Main branch', status: 'active', is_default: true }]
      if (name === 'shop_permission_access') return { 'products.manage': true }
      if (name === 'list_products') return { items: [], total: 0, page: 1, pageSize: 20 }
      if (name === 'list_catalog_categories') return []
      if (name === 'shop_billing_read') return { subscription: { planName: 'Shop Suit plan', accessState: 'active', currentPeriodEnd: '2026-10-31T12:00:00Z' }, usage: { resources: [] }, submissions: [] }
      return undefined
    })
    await fixtureGoto(page, '/products')
    const sidebar = page.locator('#bs-primary-navigation')
    const header = page.getByRole('banner')
    if (width >= 1024) {
      expect((await sidebar.boundingBox())!.width).toBe(248)
      expect((await header.boundingBox())!.height).toBe(64)
      await expect(sidebar.locator('.bs-navigation-context')).toBeHidden()
      const switchers = header.locator('.bs-scope-switcher')
      expect((await switchers.first().boundingBox())!.width).toBe(184)
      expect((await switchers.last().boundingBox())!.width).toBe(184)
      const divider = await sidebar.locator('hr').boundingBox()
      test.info().annotations.push({ type: 'reference-geometry', description: JSON.stringify({ divider, sidebar: await sidebar.boundingBox(), header: await header.boundingBox() }) })
      await page.screenshot({ path: test.info().outputPath('expanded.png') })
      await header.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
      expect((await sidebar.boundingBox())!.width).toBe(72)
      await expect(sidebar.locator('.bs-navigation-mark')).toBeVisible()
      const mark = sidebar.locator('.bs-navigation-mark img:visible')
      await expect(mark).toHaveAttribute('src', '/brand/shop-suit-mark-dark.svg')
      const box = (await mark.boundingBox())!; expect(Math.abs(box.width - box.height)).toBeLessThan(1)
      await page.screenshot({ path: test.info().outputPath('collapsed.png') })
    } else {
      await header.getByRole('button', { name: 'فتح القائمة', exact: true }).click()
      await expect(sidebar).toBeVisible()
      await expect(sidebar.locator('.bs-navigation-context')).toBeVisible()
      await expect(sidebar.locator('.bs-side-menu__logo img:visible')).toHaveAttribute('src', '/brand/shop-suit-wordmark-light.svg')
      await page.screenshot({ path: test.info().outputPath('mobile-rtl.png') })
      await page.keyboard.press('Escape')
      await expect(sidebar).toBeHidden()
      await expect(header.getByRole('button', { name: 'فتح القائمة', exact: true })).toBeFocused()
    }
    await expectNoPageOverflow(page)
  })
}
