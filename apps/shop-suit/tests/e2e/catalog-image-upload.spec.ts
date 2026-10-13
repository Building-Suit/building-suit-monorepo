import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const shop = '11111111-1111-4111-8111-111111111111'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==', 'base64')
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`catalog file upload ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const saved: Record<string, string | null> = { products: null, services: null }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: shop, name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_memberships') return [{ id: 'membership-1', shop_id: shop, profile_id: 'profile-1', role: 'owner', status: 'active' }]
      if (name === 'shop_permission_access') return { 'products.manage': true, 'services.manage': true }
      if (name === 'list_catalog_categories') return []
      if (name === 'service_scheduling_options') return { locations: [], staff: [] }
      if (name === 'shop_catalog_media') {
        const action = String(args.p_action)
        const kind = action.includes('product') ? 'products' : 'services'
        if (action.startsWith('save_')) { saved[kind] = (args.p_payload as { imageObjectName: string | null }).imageObjectName; return 'saved-id' }
        return { supportsMedia: true, supportsUploads: true, total: 1, page: 1, pageSize: 20, items: [{ id: 'record-1', name: kind === 'products' ? 'Daily shampoo 250 ml' : 'Haircut', sku: 'SH250', barcode: '622100000001', sale_price: 220, baseSalePrice: 100, defaultDiscountType: 'amount', defaultDiscountValue: 0, schedulingEnabled: false, durationMinutes: 30, cleanupMinutes: 0, locationIds: [], staffMembershipIds: [], categoryId: null, category_id: null, imageUrl: null, imageObjectName: saved[kind] }] }
      }
      return undefined
    })
    let fail = true
    const uploads: string[] = []
    await page.route(/\/storage\/v1\/object\/shop-catalog-images\//, async route => {
      uploads.push(new URL(route.request().url()).pathname)
      if (fail) { fail = false; await route.fulfill({ status: 500, json: { message: 'Synthetic upload failure' } }); return }
      await route.fulfill({ json: { Key: 'synthetic' } })
    })
    await page.route(/\/storage\/v1\/object\/sign\/shop-catalog-images$/, async route => {
      const paths = route.request().postDataJSON().paths as string[]
      await route.fulfill({ json: paths.map(path => ({ path, signedURL: `/object/sign/shop-catalog-images/${path}?token=synthetic`, error: null })) })
    })
    await page.route(/\/storage\/v1\/object\/sign\/shop-catalog-images\//, route => route.fulfill({ contentType: 'image/png', body: png }))
    const ar = locale === 'ar'
    for (const kind of ['products', 'services']) {
      await fixtureGoto(page, `/${kind}`)
      await page.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const input = dialog.locator('input[type=file]')
      await expect(dialog.locator('input[type=url]')).toHaveCount(0)
      await expect(dialog.locator('.bs-catalog-image__placeholder')).toBeVisible()
      await input.setInputFiles({ name: 'active.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
      await expect(dialog.getByRole('alert')).toContainText(ar ? 'اختر صورة' : 'Choose a valid')
      await input.setInputFiles({ name: 'safe.png', mimeType: 'image/png', buffer: png })
      if (kind === 'products') {
        await expect(dialog.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true })).toBeVisible()
        await dialog.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
      }
      await expect(dialog.locator('.bs-catalog-uploader').getByRole('status')).toContainText(ar ? 'تم رفع الصورة' : 'Image uploaded')
      await expect(dialog.locator('.bs-catalog-uploader img')).toBeVisible()
      await expectNoPageOverflow(page)
      await page.screenshot({ path: test.info().outputPath(`${kind}-uploaded.png`), fullPage: true })
      await dialog.screenshot({ path: test.info().outputPath(`${kind}-dialog.png`) })
      await input.setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png })
      await expect(dialog.locator('.bs-catalog-uploader').getByRole('status')).toContainText(ar ? 'تم رفع الصورة' : 'Image uploaded')
      const save = kind === 'products' ? (ar ? 'حفظ المنتج' : 'Save product') : (ar ? 'حفظ الخدمة' : 'Save service')
      await dialog.getByRole('button', { name: save, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(saved[kind]).toMatch(new RegExp(`^${shop}/${kind}/[0-9a-f-]+\\.png$`))
      await page.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
      await expect(dialog.locator('.bs-catalog-uploader img')).toBeVisible()
      await dialog.getByRole('button', { name: ar ? 'إزالة' : 'Remove', exact: true }).click()
      await expect(dialog.locator('.bs-catalog-image__placeholder')).toBeVisible()
      await dialog.getByRole('button', { name: save, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(saved[kind]).toBeNull()
    }
    expect(uploads.length).toBe(5)
    expect(new Set(uploads).size).toBe(5)
    const saves = calls.filter(call => call.name === 'shop_catalog_media' && String(call.args.p_action).startsWith('save_'))
    expect(saves).toHaveLength(4)
    for (const call of saves) expect(call.args.p_shop_id).toBe(shop)
  })
}
