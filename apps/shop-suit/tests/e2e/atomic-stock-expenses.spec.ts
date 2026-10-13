import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`expense history adapter commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    type Expense = { id: string; title: string; amount: number; status: string; category_id: string; category_name: string; expense_date: string; notes: string; created_at: string; created_by_name: string; corrects_expense_id: string | null; replaced_by_expense_id: string | null; voided_at: string | null; voided_by_name: string | null; change_reason: string | null; history_kind: string }
    const items: Expense[] = []
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'expense_categories') return [{ id: 'category-1', name: 'Utilities' }]
      if (name === 'list_expenses') return { items, total: items.length, page: 1, pageSize: 20, canManage: true }
      if (name === 'save_expense') {
        const id = `expense-${items.length + 1}`
        const original = items.find(item => item.id === args.p_expense_id)
        if (original) { original.status = 'void'; original.history_kind = 'corrected'; original.replaced_by_expense_id = id }
        items.push({ id, title: String(args.p_title), amount: Number(args.p_amount), status: 'paid', category_id: 'category-1', category_name: String(args.p_category_name), expense_date: String(args.p_expense_date), notes: '', created_at: '2026-01-01', created_by_name: 'Fixture actor', corrects_expense_id: original?.id ?? null, replaced_by_expense_id: null, voided_at: null, voided_by_name: null, change_reason: original ? String(args.p_correction_reason) : null, history_kind: original ? 'correction' : 'original' })
        return id
      }
      if (name === 'void_expense') { const item = items.find(item => item.id === args.p_expense_id)!; item.status = 'void'; item.history_kind = 'voided'; item.change_reason = String(args.p_reason); return item.id }
      return undefined
    })
    const ar = locale === 'ar'
    async function confirm() { const dialog = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }); await dialog.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }
    await fixtureGoto(page, '/expenses')
    await page.getByRole('button', { name: ar ? 'تسجيل مصروف' : 'Record expense', exact: true }).click()
    let editor = page.getByRole('dialog')
    await expect(editor.locator('[data-pc-section=footer]')).toBeVisible()
    await editor.getByLabel(ar ? 'عنوان المصروف' : 'Expense title', { exact: true }).fill('Fixture utilities')
    await editor.getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true }).fill('100')
    await editor.getByLabel(ar ? 'التصنيف' : 'Category', { exact: true }).fill('Utilities')
    await editor.getByRole('button', { name: ar ? 'حفظ المصروف' : 'Save expense', exact: true }).click()
    await confirm()
    await page.getByRole('button', { name: ar ? 'تصحيح' : 'Correct', exact: true }).click()
    editor = page.getByRole('dialog')
    await expect(editor.getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true })).toHaveValue('100')
    await editor.getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true }).fill('120')
    await editor.getByLabel(ar ? 'سبب التصحيح' : 'Correction reason', { exact: true }).fill('Corrected supplier amount')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/expenses-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await editor.getByRole('button', { name: ar ? 'حفظ التصحيح' : 'Save correction', exact: true }).click()
    await confirm()
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ amount: 100, status: 'void', replaced_by_expense_id: 'expense-2' })
    await page.getByRole('button', { name: ar ? 'إلغاء' : 'Void', exact: true }).click()
    editor = page.getByRole('dialog')
    await editor.getByLabel(ar ? 'سبب الإلغاء' : 'Void reason', { exact: true }).fill('Duplicate supplier bill')
    await editor.getByRole('button', { name: ar ? 'إلغاء' : 'Void', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const corrected = calls.filter(call => call.name === 'save_expense').at(-1)!
    expect(corrected.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_expense_id: 'expense-1', p_amount: 120, p_correction_reason: 'Corrected supplier amount' })
    expect(calls.find(call => call.name === 'void_expense')?.args).toMatchObject({ p_expense_id: 'expense-2', p_reason: 'Duplicate supplier bill' })
    for (const call of calls.filter(call => ['save_expense', 'void_expense'].includes(call.name))) expect(call.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
  })

  test(`inventory count adapter commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const product = { product_id: 'product-1', name: 'Fixture stock', sku: 'FIX-1', sale_price: 30, is_active: true, reorder_threshold: 2, quantity_on_hand: 10, inventory_value: 100, is_low_stock: false }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'inventory_access') return [{ can_view: true, can_manage: true, inventory_enabled: true }]
      if (name === 'list_inventory') return { items: [product], total_valuation: product.inventory_value, low_stock_count: 0 }
      if (name === 'list_inventory_history' || name === 'list_stock_counts') return { items: [], total: 0 }
      if (name === 'record_stock_count') { product.quantity_on_hand = Number(args.p_counted_quantity); return 'count-1' }
      if (name === 'set_reorder_threshold') { product.reorder_threshold = Number(args.p_threshold); return 'product-1' }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/inventory')
    await page.getByRole('button', { name: ar ? 'تسجيل جرد' : 'Record count', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel(ar ? 'المعدود' : 'Counted', { exact: true })).toHaveValue('10')
    await dialog.getByLabel(ar ? 'المعدود' : 'Counted', { exact: true }).fill('12')
    await dialog.getByLabel(ar ? 'تكلفة وحدة الفرق الموجب' : 'Positive variance unit cost', { exact: true }).fill('11')
    await dialog.getByLabel(ar ? 'المرجع' : 'Reference', { exact: true }).fill('COUNT-1')
    await dialog.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Physical shelf count')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/inventory-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'record_stock_count')?.args).toMatchObject({ p_shop_id: 'shop-1', p_product_id: 'product-1', p_counted_quantity: 12, p_positive_variance_unit_cost: 11, p_reference: 'COUNT-1', p_reason: 'Physical shelf count' })
    await page.getByRole('button', { name: ar ? 'تعديل الحد' : 'Set threshold', exact: true }).click()
    await page.getByRole('dialog').getByLabel(ar ? 'حد إعادة الطلب' : 'Reorder threshold', { exact: true }).fill('5')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'set_reorder_threshold')?.args).toEqual({ p_shop_id: 'shop-1', p_product_id: 'product-1', p_threshold: 5 })
  })
}
