import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

test('linked product can receive its first price and return to the catalog', async ({ page }) => {
  const productId = '10000000-0000-4000-8000-000000000001'
  let price: number | null = null
  let archived = false
  const { calls } = await pilotFixture(page, 'en', 'owner', (name, args) => {
    if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
    if (name === 'shop_permission_access') return { 'products.manage': true }
    if (name === 'list_products') return { items: [{ id: 'unrelated', name: 'Another product', sale_price: 10 }], total: 1, page: 1, pageSize: 20 }
    if (name === 'save_product_with_category') {
      price = Number(args.p_sale_price)
      return productId
    }
    if (name === 'archive_product') {
      archived = true
      return null
    }
  })
  let linkedQuery: URLSearchParams | undefined
  await fixtureRoute(page, /\/rest\/v1\/products\?/, route => {
    linkedQuery = new URL(route.request().url()).searchParams
    return route.fulfill({ json: !archived && linkedQuery.get('id') === `eq.${productId}` ? [{
      id: productId, name: 'Kids Backpack', sku: null, barcode: null,
      sale_price: price ?? 0, price_pending: price === null, category_id: null,
      created_at: '2026-01-01', base_unit_code: 'ea', measurement_status: 'active',
      image_url: null, image_object_name: null,
    }] : [] })
  })

  await fixtureGoto(page, `/products?product=${productId}`)
  await expect(page.getByRole('cell', { name: 'Kids Backpack' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Another product' })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Price needed' })).toBeVisible()
  expect(linkedQuery?.get('id')).toBe(`eq.${productId}`)
  expect(linkedQuery?.get('shop_id')).toBe('eq.shop-1')
  expect(linkedQuery?.get('is_active')).toBe('eq.true')
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit product' })
  const salePrice = dialog.getByLabel('Sale price', { exact: true })
  const save = dialog.getByRole('button', { name: 'Save product' })
  await expect(salePrice).toHaveValue('')
  await save.click()
  await expect(salePrice).toBeFocused()
  expect(calls.filter(call => call.name === 'save_product_with_category')).toHaveLength(0)
  await salePrice.fill('0')
  await save.click()
  await expect(dialog).toHaveCount(0)
  expect(calls.find(call => call.name === 'save_product_with_category')?.args).toMatchObject({ p_product_id: productId, p_sale_price: 0 })
  await expect(page.getByRole('cell', { name: 'Price needed' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Kids Backpack' })).toHaveCount(0)
  expect(calls.find(call => call.name === 'archive_product')?.args).toMatchObject({ p_shop_id: 'shop-1', p_product_id: productId })
  await page.getByRole('link', { name: 'View all products' }).click()
  await expect(page).toHaveURL(/\/products$/)
  await expect(page.getByRole('cell', { name: 'Another product' })).toBeVisible()
})

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`shared catalogue adapters: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_permission_access') return { 'products.manage': true, 'services.manage': true }
      if (name === 'list_catalog_categories') return [{ id: 'category-1', name: 'Fixture category' }]
      if (name === 'list_products') return { items: [{ id: 'product-1', name: 'Fixture product', sku: 'SKU-1', barcode: '1234', sale_price: 30, category_id: 'category-1', category_name: 'Fixture category' }], total: 1, page: 1, pageSize: 20 }
      if (name === 'list_services_by_category') return { items: [{ id: 'service-1', name: 'Fixture service', description: 'Fixture description', baseSalePrice: 100, defaultDiscountType: 'percent', defaultDiscountValue: 10, schedulingEnabled: true, durationMinutes: 30, cleanupMinutes: 5, locationIds: ['location-1'], staffMembershipIds: ['member-1'], categoryId: 'category-1', categoryName: 'Fixture category' }], total: 1, page: 1, pageSize: 20 }
      if (name === 'service_scheduling_options') return { locations: [{ id: 'location-1', name: 'First branch' }], staff: [{ membershipId: 'member-1', name: 'Fixture staff', locationIds: ['location-1'] }] }
      if (name === 'save_product_with_category' || name === 'save_service_with_category') return 'saved-fixture'
      return undefined
    })
    const ar = locale === 'ar'
    for (const kind of ['products', 'services']) {
      await fixtureGoto(page, `/${kind}`)
      const name = kind === 'products' ? 'Fixture product' : 'Fixture service'
      await expect(page.getByRole('cell').filter({ hasText: name }).first()).toBeVisible()
      await expectNoPageOverflow(page)
      await page.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveAccessibleName(kind === 'products' ? (ar ? 'تعديل المنتج' : 'Edit product') : (ar ? 'تعديل الخدمة' : 'Edit service'))
      const saveLabel = kind === 'products' ? (ar ? 'حفظ المنتج' : 'Save product') : (ar ? 'حفظ الخدمة' : 'Save service')
      const save = dialog.getByRole('button', { name: saveLabel, exact: true })
      const footer = dialog.locator('[data-pc-section=footer]')
      await expect(footer).toBeVisible()
      const before = await save.boundingBox()
      expect(before).not.toBeNull()
      expect(before!.y + before!.height).toBeLessThanOrEqual(1000)
      await dialog.locator('[data-pc-section=content]').evaluate(el => { el.scrollTop = el.scrollHeight })
      const after = await save.boundingBox()
      expect(after!.y).toBeCloseTo(before!.y, 0)
      expect(await save.getAttribute('form')).toBe(await dialog.locator('form').getAttribute('id'))
      await expect(dialog.getByLabel(kind === 'products' ? (ar ? 'اسم المنتج' : 'Product name') : (ar ? 'اسم الخدمة' : 'Service name'))).toHaveValue(name)
      const field = dialog.getByLabel(ar ? 'سعر البيع' : 'Sale price', { exact: true })
      await expect(field).toHaveValue(kind === 'products' ? '30' : '100')
      await field.fill('120')
      const nameInput = dialog.getByLabel(kind === 'products' ? (ar ? 'اسم المنتج' : 'Product name') : (ar ? 'اسم الخدمة' : 'Service name'))
      await nameInput.fill('')
      const savesBefore = calls.filter(call => call.name === (kind === 'products' ? 'save_product_with_category' : 'save_service_with_category')).length
      await save.click()
      await expect(nameInput).toBeFocused()
      expect(calls.filter(call => call.name === (kind === 'products' ? 'save_product_with_category' : 'save_service_with_category'))).toHaveLength(savesBefore)
      await nameInput.fill(name)
      if (kind === 'services') {
        await expect(dialog.getByLabel(ar ? 'الحجز بالمواعيد' : 'Appointment scheduling')).toBeChecked()
        await expect(dialog.getByLabel(ar ? 'مدة الخدمة (دقيقة)' : 'Service duration (minutes)', { exact: true })).toHaveValue('30')
        await expect(dialog.getByLabel('Fixture staff', { exact: true })).toBeChecked()
      }
      await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
      await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/catalogue-${kind}-${locale}-${theme}-${width}.png`, fullPage: true })
      await save.click()
      await expect(dialog).toHaveCount(0)
      const call = calls.find(call => call.name === (kind === 'products' ? 'save_product_with_category' : 'save_service_with_category'))!
      expect(call.args.p_shop_id).toBe('shop-1')
      expect(call.args[kind === 'products' ? 'p_sale_price' : 'p_base_sale_price']).toBe(120)
      if (kind === 'services') {
        expect(call.args.p_discount_type).toBe('percent')
        expect(call.args.p_location_ids).toEqual(['location-1'])
        expect(call.args.p_staff_membership_ids).toEqual(['member-1'])
      }
    }
  })
}
