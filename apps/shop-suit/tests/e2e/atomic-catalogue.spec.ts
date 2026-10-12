import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

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
      await expect(dialog.getByLabel(kind === 'products' ? (ar ? 'اسم المنتج' : 'Product name') : (ar ? 'اسم الخدمة' : 'Service name'))).toHaveValue(name)
      const field = dialog.getByLabel(ar ? 'سعر البيع' : 'Sale price', { exact: true })
      await expect(field).toHaveValue(kind === 'products' ? '30' : '100')
      await field.fill('120')
      if (kind === 'services') {
        await expect(dialog.getByLabel(ar ? 'الحجز بالمواعيد' : 'Appointment scheduling')).toBeChecked()
        await expect(dialog.getByLabel(ar ? 'مدة الخدمة (دقيقة)' : 'Service duration (minutes)', { exact: true })).toHaveValue('30')
        await expect(dialog.getByLabel('Fixture staff', { exact: true })).toBeChecked()
      }
      await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
      await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/catalogue-${kind}-${locale}-${theme}-${width}.png`, fullPage: true })
      await dialog.getByRole('button', { name: kind === 'products' ? (ar ? 'حفظ المنتج' : 'Save product') : (ar ? 'حفظ الخدمة' : 'Save service'), exact: true }).click()
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
