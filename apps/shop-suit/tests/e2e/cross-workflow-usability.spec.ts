import { test, expect, type Page, type Locator } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

async function navigate(page: Page, path: string) {
  await page.locator('#__nuxt').evaluate((root, to) => {
    const app = (root as HTMLElement & { __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    void app.config.globalProperties.$router.push(to)
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}
async function target(control: Locator) {
  const box = await control.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThanOrEqual(44)
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
async function retailFixture(page: Page, locale: string, businessMode: 'product' | 'service' | 'mixed' = 'mixed', locationCount = 2) {
  const state = {
    empty: false, deny: false, reportGate: null as ReturnType<typeof deferred> | null,
    purchaseGate: null as ReturnType<typeof deferred> | null, saved: false, imports: 0,
    expenses: [] as Array<Record<string, unknown>>,
  }
  const fixture = await pilotFixture(page, locale, 'owner', async (name, args) => {
    const shop = String(args.p_shop_id ?? 'shop-1')
    const p = Number(args.p_page ?? 1)
    const size = Number(args.p_page_size ?? 20)
    const list = (kind: string) => {
      const items = Array.from({ length: 125 }, (_, index) => ({ id: `${kind}-${index + 1}`, name: `${shop} ${kind} ${String(index + 1).padStart(3, '0')}`, sku: `SKU-${index + 1}`, sale_price: 100, is_active: true, payable: 0 }))
      const filtered = items.filter(item => !args.p_search || item.name.includes(String(args.p_search)))
      return { items: state.empty ? [] : filtered.slice((p - 1) * size, p * size), total: state.empty ? 0 : filtered.length, page: p, pageSize: size, canManage: !state.deny }
    }
    if (name === 'shops') return ['shop-1', 'shop-2'].map(id => ({ id, name: id, business_mode: businessMode, status: 'active', created_at: '2026-01-01' }))
    if (name === 'shop_memberships') return ['shop-1', 'shop-2'].map(id => ({ id: `member-${id}`, shop_id: id, profile_id: 'profile-1', status: 'active', role: 'owner' }))
    if (name === 'list_shop_locations') return Array.from({ length: locationCount }, (_, index) => index + 1).map(n => ({ id: `${shop}-location-${n}`, shop_id: shop, name: `${shop} branch ${n}`, status: 'active', is_default: n === 1 }))
    if (name === 'shop_permission_access') return Object.fromEntries((args.p_permission_keys as string[]).map(key => [key, !state.deny && key !== 'reports.view' ? true : key === 'reports.view' && !state.deny]))
    if (name === 'shop_team_read') return { canManage: !state.deny, canManagePermissions: !state.deny, canViewAudit: !state.deny, members: [], roles: [], locations: [], invitations: [], events: [] }
    if (name === 'shop_plan_usage') return { locations: 2, members: 1, products: 0, services: 0, limits: {}, resources: [] }
    if (name === 'receipt_settings') return { displayName: 'Fixture shop', address: null, phone: null, footer: null, paperSize: 'thermal_80', canManage: !state.deny }
    if (name === 'list_catalog_categories' || name === 'expense_categories') return []
    if (name === 'shop_operating_report') return null
    if (name === 'list_products') return list('product')
    if (name === 'list_vendors') return list('supplier')
    if (name === 'list_services_by_category') return { ...list('service'), items: [] }
    if (name === 'service_scheduling_options') return { locations: [], staff: [] }
    if (name === 'supplier_access') return [{ can_manage_suppliers: !state.deny, can_manage_purchases: !state.deny, inventory_enabled: true }]
    if (name === 'list_purchases') return { items: state.saved ? [{ id: 'purchase-new', vendorNameSnapshot: 'New posted purchase', status: 'posted', totalAmount: 12, payable: 12, settlementState: 'unpaid', issuedAt: '2026-09-29' }] : [], total: state.saved ? 1 : 0 }
    if (name === 'create_supplier_purchase') { await state.purchaseGate?.promise; state.saved = true; return 'purchase-new' }
    if (name === 'customer_access') return [{ can_view: !state.deny, can_manage: !state.deny }]
    if (name === 'list_customers') return list('customer')
    if (name === 'sale_access') return [{ can_view: !state.deny, can_manage: !state.deny }]
    if (name === 'sale_catalog') return { products: [], services: [], customers: [], canManage: true }
    if (name === 'pos_catalog_search_by_category') return { items: [], total: 0, page: p, pageSize: size, businessMode, ambiguousBarcode: false }
    if (name === 'list_location_sales') return { items: [], total: 0, canManage: !state.deny, canIssue: !state.deny }
    if (name === 'list_expenses') return { items: state.expenses, total: state.expenses.length, page: p, pageSize: size, canManage: !state.deny }
    if (name === 'save_expense') {
      const now = '2026-09-30T12:00:00Z'
      const original = state.expenses.find(item => item.id === args.p_expense_id)
      if (original) {
        original.status = 'void'; original.history_kind = 'corrected'; original.change_reason = args.p_correction_reason
        const id = `expense-${state.expenses.length + 1}`
        original.replaced_by_expense_id = id
        state.expenses.unshift({ id, title: args.p_title, amount: args.p_amount, status: 'paid', category_id: 'category-1', category_name: args.p_category_name, expense_date: `${args.p_expense_date}T12:00:00Z`, notes: args.p_notes, created_at: now, created_by_name: 'Fixture owner', corrects_expense_id: original.id, replaced_by_expense_id: null, voided_at: null, voided_by_name: null, change_reason: args.p_correction_reason, history_kind: 'correction' })
        return id
      }
      const id = `expense-${state.expenses.length + 1}`
      state.expenses.unshift({ id, title: args.p_title, amount: args.p_amount, status: 'paid', category_id: 'category-1', category_name: args.p_category_name, expense_date: `${args.p_expense_date}T12:00:00Z`, notes: args.p_notes, created_at: now, created_by_name: 'Fixture owner', corrects_expense_id: null, replaced_by_expense_id: null, voided_at: null, voided_by_name: null, change_reason: null, history_kind: 'original' })
      return id
    }
    if (name === 'void_expense') {
      const expense = state.expenses.find(item => item.id === args.p_expense_id)
      if (expense) { expense.status = 'void'; expense.history_kind = 'voided'; expense.change_reason = args.p_reason }
      return null
    }
    if (name === 'inventory_access') return [{ can_view: !state.deny, can_manage: !state.deny, inventory_enabled: true }]
    if (name === 'list_inventory') return { items: [], total_valuation: 0, low_stock_count: 0 }
    if (name === 'cash_shift_dashboard') return { canManage: !state.deny, canAdjust: !state.deny, currentMembershipId: 'member-shop-1', active: null, items: [], total: 0, cashiers: [] }
    if (name === 'catalog_sales_report') return { items: [] }
    if (name === 'catalog_import') { state.imports++; return { valid: true, dryRun: args.p_dry_run, rowCount: 1, errors: [], created: 1, updated: 0, openingStockPosted: 1 } }
    if (name === 'barcode_label_data') return { items: [{ name: 'Label', barcode: '123', salePrice: 1 }], total: 2101, pageSize: size }
    if (name === 'shop_operational_report') {
      if (size === 500) await state.reportGate?.promise
      return { report: args.p_report, items: state.empty ? [] : [{ id: 'row-1', invoice_number: `${shop} report row`, amount: 100, source_path: '/sales' }], total: state.empty ? 0 : 1, summary: { sales: 100 } }
    }
  })
  return { ...fixture, retail: state }
}

for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) for (const theme of ['light', 'dark']) {
  test(`retail routes, labels and responsive states: ${locale}, ${width}px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await retailFixture(page, locale)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    for (const [path, en, ar] of [
      ['/dashboard', 'Operating dashboard', 'لوحة التشغيل'], ['/appointments', 'Appointments', 'المواعيد'],
      ['/pos', 'Point of sale', 'نقطة البيع'],
      ['/products', 'Products', 'المنتجات'], ['/services', 'Services', 'الخدمات'],
      ['/customers', 'Customers', 'العملاء'], ['/sales', 'Sales', 'المبيعات'],
      ['/inventory', 'Inventory', 'المخزون'], ['/expenses', 'Expenses', 'المصروفات'],
      ['/cash-shifts', 'Cashier shifts', 'ورديات الخزنة'], ['/catalog-import', 'Catalog setup & import', 'إعداد الكتالوج والاستيراد'],
      ['/purchases', 'Purchases', 'المشتريات'], ['/reports', 'Operational reports', 'التقارير التشغيلية'],
      ['/team', 'Team & permissions', 'الفريق والصلاحيات'], ['/billing', 'Subscription and billing', 'الاشتراك والفوترة'],
      ['/settings', 'Business settings', 'إعدادات النشاط'],
    ] as const) {
      await navigate(page, path)
      await expect(page.getByRole('main').getByRole('heading', { name: locale === 'ar' ? ar : en, exact: true, level: 1 })).toBeVisible()
      await noOverflow(page)
      // Accessible-name computation catches placeholder-only controls as well as unlabeled filters.
      const controls = page.getByRole('main').locator('input:not([type="hidden"]), select, [role="combobox"], button')
      for (const control of await controls.all()) {
        if (await control.isVisible()) await expect(control).toHaveAccessibleName(/\S/)
      }
    }
    expect(errors).toEqual([])
    const account = page.locator('header').getByRole('button', { name: locale === 'ar' ? 'الحساب' : 'Account', exact: true })
    await target(account)
    await account.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: locale === 'ar' ? 'الحساب' : 'Account', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(account).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

for (const locale of ['en', 'ar']) {
  test(`expense create, correct and void keep trace history: ${locale}`, async ({ page }) => {
    await retailFixture(page, locale)
    const ar = locale === 'ar'
    await navigate(page, '/expenses')
    const main = page.getByRole('main')
    await expect(main.getByText(ar
      ? 'سجّل هنا الأموال التي ينفقها المتجر'
      : 'Record money the shop spends here', { exact: false })).toBeVisible()
    await main.getByRole('button', { name: ar ? 'تسجيل مصروف' : 'Record expense', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: ar ? 'تسجيل مصروف' : 'Record expense', exact: true })
    await dialog.getByRole('textbox', { name: ar ? 'عنوان المصروف' : 'Expense title', exact: true }).fill('Monthly rent')
    await dialog.getByRole('spinbutton', { name: ar ? 'المبلغ' : 'Amount', exact: true }).fill('100')
    await dialog.getByRole('combobox', { name: ar ? 'التصنيف' : 'Category', exact: true }).fill('Rent')
    await dialog.getByRole('button', { name: ar ? 'حفظ المصروف' : 'Save expense', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(main.getByText('Monthly rent', { exact: true })).toBeVisible()

    let row = main.locator('tr').filter({ hasText: 'Monthly rent' }).first()
    await row.getByRole('button', { name: ar ? 'تصحيح' : 'Correct', exact: true }).click()
    dialog = page.getByRole('dialog', { name: ar ? 'تصحيح' : 'Correct', exact: true })
    await dialog.getByRole('textbox', { name: ar ? 'عنوان المصروف' : 'Expense title', exact: true }).fill('Monthly rent corrected')
    await dialog.getByRole('spinbutton', { name: ar ? 'المبلغ' : 'Amount', exact: true }).fill('120')
    await dialog.getByRole('textbox', { name: ar ? 'سبب التصحيح' : 'Correction reason', exact: true }).fill('Correct invoice amount')
    await dialog.getByRole('button', { name: ar ? 'حفظ التصحيح' : 'Save correction', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(main.getByText('Monthly rent corrected', { exact: true })).toBeVisible()
    await expect(main.getByText(ar ? 'الأصل المصحح' : 'Corrected original', { exact: true })).toBeVisible()

    row = main.locator('tr').filter({ hasText: 'Monthly rent corrected' }).first()
    await row.getByRole('button', { name: ar ? 'إلغاء' : 'Void', exact: true }).click()
    dialog = page.getByRole('dialog', { name: ar ? 'إلغاء المصروف' : 'Void expense', exact: true })
    await dialog.getByRole('textbox', { name: ar ? 'سبب الإلغاء' : 'Void reason', exact: true }).fill('Duplicate invoice')
    await dialog.getByRole('button', { name: ar ? 'إلغاء' : 'Void', exact: true }).click()
    row = main.locator('tr').filter({ hasText: 'Monthly rent corrected' }).first()
    const voidedBadges = row.getByText(ar ? 'ملغى' : 'Voided', { exact: true })
    await expect(voidedBadges).toHaveCount(2)
    await expect(row.getByRole('cell').last().getByText(ar ? 'ملغى' : 'Voided', { exact: true })).toBeVisible()
    await expect(row).toContainText('Duplicate invoice')
  })

  test(`expense server reasons stay distinct: ${locale}`, async ({ page }) => {
    await retailFixture(page, locale, 'service')
    const ar = locale === 'ar'
    let failure = 'SHOP_SUBSCRIPTION_INACTIVE'
    await page.route('**/rest/v1/rpc/save_expense', route => route.fulfill({ status: 403, json: { message: failure } }))
    await navigate(page, '/expenses')
    const main = page.getByRole('main')
    await expect(main.getByText(ar ? 'يُسجَّل دخل المبيعات تلقائيًا' : 'Sales income is recorded automatically', { exact: false })).toBeVisible()
    await main.getByRole('button', { name: ar ? 'تسجيل مصروف' : 'Record expense', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: ar ? 'تسجيل مصروف' : 'Record expense', exact: true })
    await dialog.getByRole('textbox', { name: ar ? 'عنوان المصروف' : 'Expense title', exact: true }).fill('Utilities')
    await dialog.getByRole('spinbutton', { name: ar ? 'المبلغ' : 'Amount', exact: true }).fill('40')
    await dialog.getByRole('combobox', { name: ar ? 'التصنيف' : 'Category', exact: true }).fill('Utilities')
    const submit = dialog.getByRole('button', { name: ar ? 'حفظ المصروف' : 'Save expense', exact: true })
    const confirm = async () => {
      await submit.click()
      await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    }
    await confirm()
    await expect(dialog).toContainText(ar ? 'الاشتراك غير نشط' : 'The subscription is inactive')
    failure = 'SHOP_PERMISSION_DENIED'
    await confirm()
    await expect(dialog).toContainText(ar ? 'لا تملك صلاحية إدارة المصروفات' : 'You do not have expense-management permission')
    failure = 'LOCATION_ACCESS_DENIED'
    await confirm()
    await expect(dialog).toContainText(ar ? 'لا تملك صلاحية الوصول إلى الفرع' : 'You cannot access the selected location')
    failure = 'ACCOUNTING_PERIOD_CLOSED'
    await confirm()
    await expect(dialog).toContainText(ar ? 'هذه الفترة المحاسبية مغلقة' : 'This accounting period is closed')
    failure = 'EXPENSE_REQUEST_CONFLICT'
    await confirm()
    await expect(dialog).toContainText(ar ? 'استُخدم رقم المحاولة' : 'This retry key was already used')
  })

  test(`paged purchase choices, explicit stock confirmation and pending save: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    const { calls, retail } = await retailFixture(page, locale)
    const ar = locale === 'ar'
    await navigate(page, '/purchases')
    const main = page.getByRole('main')
    await expect(main.getByText('shop-1 supplier 001', { exact: true }).first()).toBeVisible()
    const suppliers = main.getByRole('region', { name: ar ? 'الموردون' : 'Suppliers', exact: true })
    await expect(suppliers).toBeVisible()
    // Supplier history reaches beyond the former fixed first 100 records.
    const last = main.getByRole('button', { name: /Last [Pp]age|الصفحة الأخيرة/ }).first()
    await last.click()
    await expect(suppliers).toContainText('shop-1 supplier 125')
    await main.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true }).click()
    const form = page.getByRole('dialog', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true })
    const productGroup = form.getByRole('group', { name: ar ? 'المنتج 1' : 'Product 1', exact: true })
    await productGroup.getByRole('searchbox').fill('125')
    await expect(productGroup.getByRole('combobox')).toBeEnabled()
    await productGroup.getByRole('combobox').click()
    await page.getByRole('option', { name: 'shop-1 product 125', exact: true }).click()
    await form.getByRole('spinbutton', { name: ar ? 'تكلفة الوحدة' : 'Unit cost', exact: true }).fill('12')
    const submit = form.getByRole('button', { name: ar ? 'ترحيل المشتريات' : 'Post purchase', exact: true })
    await target(submit); await submit.click()
    const confirm = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
    await expect(confirm).toContainText(ar ? 'ستزيد كميات المخزون' : 'Stock quantities')
    await expect(confirm.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true })).toBeFocused()
    expect(calls.filter(call => call.name === 'create_supplier_purchase')).toHaveLength(0)
    retail.purchaseGate = deferred()
    await confirm.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(form.getByRole('spinbutton').first()).toBeDisabled()
    await page.keyboard.press('Escape'); await expect(form).toBeVisible()
    retail.purchaseGate.resolve()
    await expect(form).toHaveCount(0)
    await expect(main.getByText('New posted purchase', { exact: true })).toBeVisible()
    expect(calls.filter(call => call.name === 'create_supplier_purchase')).toHaveLength(1)
    await noOverflow(page)
  })

  test(`context switch cancels delayed exports and clears drafts: ${locale}`, async ({ page }) => {
    const { retail, calls } = await retailFixture(page, locale)
    const ar = locale === 'ar'
    let downloads = 0
    page.on('download', () => downloads++)
    await navigate(page, '/reports')
    await expect(page.getByText('shop-1 report row', { exact: true })).toBeVisible()
    retail.reportGate = deferred()
    await page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'shop_operational_report' && call.args.p_page_size === 500).length).toBe(1)
    await page.locator('header').getByRole('combobox', { name: ar ? 'المتجر' : 'Shop', exact: true }).selectOption('shop-2')
    await expect(page.getByText('shop-2 report row', { exact: true })).toBeVisible()
    await expect(page.getByText('shop-1 report row', { exact: true })).toHaveCount(0)
    retail.reportGate.resolve()
    await navigate(page, '/purchases')
    await page.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('textbox', { name: ar ? 'ملاحظات' : 'Notes', exact: true }).fill('Sensitive old branch draft')
    // Simulate an external context change while a dialog owns pointer focus.
    await page.locator('header').getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true }).selectOption('shop-2-location-2', { force: true })
    await expect(form).toHaveCount(0)
    await page.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('textbox', { name: ar ? 'ملاحظات' : 'Notes', exact: true })).toHaveValue('')
    expect(downloads).toBe(0)
  })

  test(`report loading, empty, error retry and permission denial: ${locale}`, async ({ page }) => {
    const { retail } = await retailFixture(page, locale)
    const ar = locale === 'ar'
    const gate = deferred()
    let fail = false
    let delay = true
    await page.route('**/rest/v1/rpc/shop_operational_report', async route => {
      if (delay) await gate.promise
      if (fail) await route.fulfill({ status: 500, json: { message: 'private database detail' } })
      else await route.fallback()
    })
    retail.empty = true
    await navigate(page, '/reports')
    await expect(page.getByRole('status').filter({ hasText: ar ? 'جاري تحميل التقرير' : 'Loading report' })).toBeVisible()
    gate.resolve(); delay = false
    await expect(page.getByText(ar ? 'لا توجد نتائج لهذه المرشحات.' : 'No results match these filters.', { exact: true })).toBeVisible()
    fail = true
    await page.getByRole('main').getByRole('combobox', { name: ar ? 'التقارير التشغيلية' : 'Operational reports', exact: true }).selectOption('expenses')
    await expect(page.getByRole('alert')).toContainText(ar ? 'تعذّر تحميل التقرير.' : 'Could not load this report.')
    await expect(page.getByText('private database detail', { exact: true })).toHaveCount(0)
    fail = false; retail.deny = true
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByText(ar ? 'ليست لديك صلاحية عرض التقارير.' : 'You do not have report access.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'تصدير CSV' : 'Export CSV', exact: true })).toBeDisabled()
  })

  test(`import effect confirmation and complete paged barcode export: ${locale}`, async ({ page }) => {
    const { calls, retail } = await retailFixture(page, locale)
    const ar = locale === 'ar'
    await navigate(page, '/catalog-import')
    await page.locator('input[type="file"]').setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from('name,sale_price\nTest,10\n') })
    await page.getByRole('button', { name: ar ? 'فحص بدون حفظ' : 'Validate without saving', exact: true }).click()
    await page.getByRole('button', { name: ar ? 'تنفيذ الاستيراد' : 'Apply import', exact: true }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toContainText(ar ? 'كميات المخزون وقيمته' : 'inventory quantities and value')
    await confirm.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
    expect(retail.imports).toBe(1)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: ar ? 'تصدير بيانات ملصقات الباركود' : 'Export barcode label data', exact: true }).click()
    await download
    const exports = calls.filter(call => call.name === 'barcode_label_data')
    expect(exports).toHaveLength(22)
    expect(exports.at(-1)?.args.p_page).toBe(22)
    expect(exports.every(call => call.args.p_page_size === 100)).toBe(true)
  })
}

test('expense view-only state identifies the missing permission', async ({ page }) => {
  const { retail } = await retailFixture(page, 'en')
  retail.deny = true
  await navigate(page, '/expenses')
  const main = page.getByRole('main')
  await expect(main.getByText('You can view expenses only. Ask the owner for expense-management permission to record, correct, or void one.', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Record expense', exact: true })).toHaveCount(0)
})

test('expense missing-location state identifies the owner action', async ({ page }) => {
  await retailFixture(page, 'en', 'mixed', 0)
  await navigate(page, '/expenses')
  await expect(page.getByRole('main').getByText('Select an active location at the top of the page. If none is listed, ask the owner to assign you to one.', { exact: true })).toBeVisible()
})
