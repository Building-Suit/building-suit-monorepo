import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`purchasing failed read and recovery: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', name => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Synthetic shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'supplier_access') return [{ can_manage_suppliers: true, can_manage_purchases: true }]
      if (name === 'list_vendors') return { items: [{ id: 'vendor-1', name: 'Synthetic supplier', is_active: true, payable: 0 }], total: 1 }
      if (name === 'list_products') return { items: [{ id: 'product-1', name: 'Synthetic product', sku: 'CLOUD-1' }], total: 1 }
      if (name === 'list_purchases') return { items: [], total: 0 }
      return undefined
    })
    let failed = true
    await fixtureRoute(page, '**/rest/v1/rpc/list_vendors', route => failed ? route.fulfill({ status: 503, json: { message: 'Synthetic supplier query failure' } }) : route.fallback())
    await fixtureGoto(page, '/purchases')
    await expect(page.getByText(ar ? 'تعذّر تحميل بيانات المشتريات.' : 'Could not load purchase data.', { exact: true })).toBeVisible()
    await expect(page.getByText(ar ? 'أضف موردًا قبل تسجيل المشتريات.' : 'Add a supplier before recording a purchase.', { exact: true })).toHaveCount(0)
    await expect(page.getByText(ar ? 'أضف منتجًا أولًا قبل تسجيل المشتريات.' : 'Add a product before recording a purchase.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('table')).toHaveCount(0)
    failed = false
    await page.getByRole('alert').filter({ hasText: ar ? 'تعذّر تحميل بيانات المشتريات.' : 'Could not load purchase data.' }).getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByRole('cell', { name: /Synthetic supplier/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true })).toBeEnabled()
    await expectNoPageOverflow(page)
  })

  test(`customer failed access avoids read-only claim and retries: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', name => {
      if (name === 'customer_access') return [{ can_view: true, can_manage: true }]
      if (name === 'list_customers') return { items: [{ id: 'customer-1', name: 'Synthetic customer', phone: null, email: null, is_active: true, updated_at: '2026-01-01T00:00:00Z' }], total: 1, page: 1, pageSize: 20, canManage: true }
      return undefined
    })
    let failed = true
    await fixtureRoute(page, '**/rest/v1/rpc/customer_access', route => failed ? route.fulfill({ status: 503, json: { message: 'Synthetic customer access failure' } }) : route.fallback())
    await fixtureGoto(page, '/customers')
    await expect(page.getByText(ar ? 'مقدرناش نحمّل العملاء.' : 'Could not load customers.', { exact: true })).toBeVisible()
    await expect(page.getByText(ar ? 'تقدر تشوف العملاء، بس معندكش صلاحية تعدّل بياناتهم.' : 'You can view customers, but you do not have permission to change them.', { exact: true })).toHaveCount(0)
    failed = false
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Synthetic customer', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'إضافة عميل' : 'Add customer', exact: true })).toBeVisible()
    await expectNoPageOverflow(page)
  })
}
