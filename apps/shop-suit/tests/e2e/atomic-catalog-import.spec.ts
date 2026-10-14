import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`catalog import validation, confirmation and immutable request: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const categories = [{ id: 'category-1', name: 'Supplies' }]
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'list_catalog_categories') return categories
      if (name === 'catalog_sales_report') return { items: [{ type: 'product', name: 'Fixture item', category: 'Supplies', quantity: 2, amount: 20 }] }
      if (name === 'save_catalog_category') { categories.push({ id: 'category-2', name: String(args.p_name) }); return 'category-2' }
      if (name === 'catalog_import') return { valid: true, dryRun: Boolean(args.p_dry_run), rowCount: 1, errors: [], created: 1, updated: 0, openingStockPosted: 0 }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/catalog-import')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ar ? 'إعداد قائمة المنتجات والخدمات' : 'Catalog setup & import')
    await page.getByRole('button', { name: ar ? 'إضافة تصنيف' : 'Add category', exact: true }).click()
    const editor = page.getByRole('dialog')
    await editor.getByRole('textbox', { name: ar ? 'اسم التصنيف' : 'Category name', exact: true }).fill('New category')
    await editor.getByRole('button', { name: ar ? 'إضافة تصنيف' : 'Add category', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nFixture item\n') })
    await expect(page.getByRole('alert')).toBeVisible()
    expect(calls.filter(call => call.name === 'catalog_import')).toHaveLength(0)
    await page.locator('input[type=file]').setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('name,sale_price\nFixture item,10\n') })
    await page.getByRole('button', { name: ar ? 'فحص من غير حفظ' : 'Validate without saving', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: ar ? 'الملف صالح للتنفيذ.' : 'The file is ready to import.' })).toBeVisible()
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/catalog-import-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: ar ? 'تنفيذ الاستيراد' : 'Apply import', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
    await confirmation.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
    expect(calls.filter(call => call.name === 'catalog_import')).toHaveLength(1)
    await page.getByRole('button', { name: ar ? 'تنفيذ الاستيراد' : 'Apply import', exact: true }).click()
    await confirmation.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const imports = calls.filter(call => call.name === 'catalog_import')
    expect(imports).toHaveLength(2)
    expect(imports[0].args).toMatchObject({ p_shop_id: 'shop-1', p_kind: 'products', p_dry_run: true, p_rows: [{ row_number: 2, name: 'Fixture item', sale_price: '10' }] })
    expect(imports[1].args).toMatchObject({ p_shop_id: 'shop-1', p_kind: 'products', p_dry_run: false, p_request_id: imports[0].args.p_request_id })
    expect(calls.find(call => call.name === 'save_catalog_category')?.args).toMatchObject({ p_shop_id: 'shop-1', p_category_id: null, p_name: 'New category' })
  })
}

for (const locale of ['en', 'ar']) for (const kind of ['customers', 'suppliers']) {
  test(`catalog import ${kind}: validation issues, retry and result ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
    let invalid = true
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'list_catalog_categories') return []
      if (name === 'catalog_sales_report') return { items: [] }
      if (name === 'catalog_import') return invalid
        ? { valid: false, dryRun: true, rowCount: 1, errors: [{ row: 2, field: 'name', code: 'invalid_name' }] }
        : { valid: true, dryRun: true, rowCount: 1, errors: [] }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/catalog-import')
    const choice = page.getByRole('combobox', { name: ar ? 'استيراد CSV' : 'CSV import', exact: true })
    await choice.click()
    await page.getByRole('option', { name: kind === 'customers' ? ar ? 'عملاء' : 'Customers' : ar ? 'موردون' : 'Suppliers', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles({ name: `${kind}.csv`, mimeType: 'text/csv', buffer: Buffer.from('name,email\nFixture identity,identity@example.invalid\n') })
    const validate = page.getByRole('button', { name: ar ? 'فحص من غير حفظ' : 'Validate without saving', exact: true })
    const apply = page.getByRole('button', { name: ar ? 'تنفيذ الاستيراد' : 'Apply import', exact: true })
    await validate.click()
    await expect(page.getByRole('cell', { name: 'invalid_name', exact: true })).toBeVisible()
    await expect(apply).toBeDisabled()
    invalid = false
    await validate.click()
    await expect(page.getByRole('status').filter({ hasText: ar ? 'الملف صالح للتنفيذ.' : 'The file is ready to import.' })).toBeVisible()
    await expect(apply).toBeEnabled()
    expect(calls.filter(call => call.name === 'catalog_import').map(call => call.args.p_kind)).toEqual([kind, kind])
    await expectNoPageOverflow(page)
  })
}

for (const locale of ['en', 'ar']) {
  test(`catalog report loading error and retry ${locale}`, async ({ page }) => {
    let denied = true
    await pilotFixture(page, locale, 'owner', name => {
      if (name === 'catalog_sales_report') return { items: [] }
      if (name === 'list_catalog_categories') return []
      return undefined
    })
    await fixtureRoute(page, '**/rest/v1/rpc/catalog_sales_report', async route => {
      if (denied) await route.fulfill({ status: 503, json: { message: 'Synthetic report unavailable' } })
      else await route.fallback()
    })
    await fixtureGoto(page, '/catalog-import')
    const ar = locale === 'ar'
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل التقرير.' : 'Could not load the report.')
    denied = false
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText(ar ? 'مفيش بيانات.' : 'No data.', { exact: true })).toBeVisible()
    await expectNoPageOverflow(page)
  })
}
