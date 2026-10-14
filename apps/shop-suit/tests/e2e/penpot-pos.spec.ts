import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`POS touch cart ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Main shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: Array.from({ length: 14 }, (_, i) => ({ id: `item-${i}`, name: `Synthetic item ${i}`, itemType: i === 13 ? 'service' : 'product', unitPrice: 10, discount: 0, stock: i === 0 ? 2 : i === 12 ? .5 : i === 13 ? null : 100, sku: `SKU-${i}`, barcode: null, imageUrl: null })), total: 14, page: 1, pageSize: 30, businessMode: 'mixed' }
      if (name === 'pos_checkout_context') return { staff: [{ id: 'member-1', name: 'Sample cashier' }], customers: [], appointments: [] }
      return undefined
    })
    await fixtureGoto(page, '/pos')
    const tiles = page.locator('.bs-catalog-tile')
    await expect(tiles).toHaveCount(14)
    await tiles.nth(0).click()
    if (width < 1024) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
    const cart = page.locator('.bs-pos-cart')
    await expect(cart).toBeVisible()
    const increase = cart.getByRole('button', { name: `${locale === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}: Synthetic item 0`, exact: true })
    const decrease = cart.getByRole('button', { name: `${locale === 'ar' ? 'تقليل الكمية' : 'Decrease quantity'}: Synthetic item 0`, exact: true })
    for (const control of [increase, decrease]) { const box = (await control.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44) }
    await increase.click(); await expect(increase).toBeDisabled()
    await expect(cart.getByRole('spinbutton')).toHaveValue('2')
    await decrease.click(); await expect(cart.getByRole('spinbutton')).toHaveValue('1')
    await decrease.click(); await expect(cart.getByRole('spinbutton')).toHaveCount(0)
    await expect(cart.getByRole('heading')).toBeFocused()
    if (width < 1024) await page.getByRole('button', { name: locale === 'ar' ? 'الكتالوج' : 'Catalog', exact: true }).click()
    await tiles.nth(12).click()
    if (width < 1024) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
    await expect(cart.getByRole('spinbutton')).toHaveValue('0.5')
    await cart.getByRole('button', { name: `${locale === 'ar' ? 'حذف' : 'Remove'}: Synthetic item 12`, exact: true }).click()
    if (width < 1024) await page.getByRole('button', { name: locale === 'ar' ? 'الكتالوج' : 'Catalog', exact: true }).click()
    for (let i = 1; i < 12; i++) await tiles.nth(i).click()
    if (width < 1024) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
    const footer = cart.locator('.bs-pos-cart__footer')
    const before = (await footer.boundingBox())!
    const bottomNav = page.locator('[data-viewport-bottom]')
    const bottomLimit = await bottomNav.isVisible() ? (await bottomNav.boundingBox())!.y : 900
    expect(before.y + before.height).toBeLessThanOrEqual(bottomLimit)
    const list = cart.locator('.bs-pos-cart__lines')
    expect(await list.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
    await list.evaluate(node => { node.scrollTop = node.scrollHeight })
    const after = (await footer.boundingBox())!
    expect(Math.abs(before.y - after.y)).toBeLessThan(1)
    await expect(footer.getByRole('button')).toBeVisible()
    await expectNoPageOverflow(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: test.info().outputPath('pos-cart.png') })
  })
}
