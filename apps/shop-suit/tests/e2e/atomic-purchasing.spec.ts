import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`purchasing adapter commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const vendors = [{ id: 'vendor-1', name: 'Fixture supplier', contact_name: null, phone: null, email: null, address: null, tax_number: null, notes: null, is_active: true, payable: 0 }]
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'supplier_access') return [{ can_manage_suppliers: true, can_manage_purchases: true }]
      if (name === 'list_vendors') return { items: vendors, total: vendors.length }
      if (name === 'list_products') return { items: [{ id: 'product-1', name: 'Fixture product', sku: 'FIX-1' }], total: 1 }
      if (name === 'list_purchases') return { items: [], total: 0, page: 1, pageSize: 20 }
      if (name === 'save_vendor') { vendors.push({ ...vendors[0], id: 'vendor-2', name: String(args.p_name) }); return 'vendor-2' }
      if (name === 'create_supplier_purchase') return 'purchase-1'
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/purchases')
    await page.getByRole('button', { name: ar ? 'إضافة مورد' : 'Add supplier', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    const supplierSave = dialog.getByRole('button', { name: ar ? 'حفظ المورد' : 'Save supplier', exact: true })
    expect(await supplierSave.getAttribute('form')).toBe(await dialog.locator('form').getAttribute('id'))
    await supplierSave.click()
    await expect(dialog.getByLabel(ar ? 'اسم المورد' : 'Supplier name', { exact: true })).toBeFocused()
    expect(calls.filter(call => call.name === 'save_vendor')).toHaveLength(0)
    await dialog.getByLabel(ar ? 'اسم المورد' : 'Supplier name', { exact: true }).fill('New supplier')
    await dialog.getByRole('button', { name: ar ? 'حفظ المورد' : 'Save supplier', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(calls.find(call => call.name === 'save_vendor')?.args).toMatchObject({ p_shop_id: 'shop-1', p_vendor_id: null, p_name: 'New supplier' })
    await page.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    const footerBefore = await dialog.locator('[data-pc-section=footer]').boundingBox()
    await dialog.locator('[data-pc-section=content]').evaluate(el => { el.scrollTop = el.scrollHeight })
    const footerAfter = await dialog.locator('[data-pc-section=footer]').boundingBox()
    expect(footerAfter!.y).toBeCloseTo(footerBefore!.y, 0)
    await dialog.getByRole('combobox', { name: ar ? 'المورد' : 'Supplier', exact: true }).click()
    await page.getByRole('option', { name: 'Fixture supplier', exact: true }).click()
    await dialog.getByRole('combobox', { name: ar ? 'المنتج 1' : 'Product 1', exact: true }).click()
    await page.getByRole('option', { name: 'Fixture product', exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await dialog.getByLabel(ar ? 'الكمية' : 'Quantity', { exact: true }).fill('2')
    await dialog.getByLabel(ar ? 'تكلفة الوحدة' : 'Unit cost', { exact: true }).fill('12.50')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/purchasing-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'ترحيل المشتريات' : 'Post purchase', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
    await expect(confirmation).toContainText(/25|٢٥/)
    await confirmation.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'create_supplier_purchase')?.args).toMatchObject({ p_shop_id: 'shop-1', p_vendor_id: 'vendor-1', p_items: [{ product_id: 'product-1', quantity: 2, unit_cost: 12.5 }] })
    expect(calls.find(call => call.name === 'create_supplier_purchase')?.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
  })
}
