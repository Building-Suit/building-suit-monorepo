import { test, expect, type Page } from '@playwright/test'

const docsBaseUrl =
  process.env.BS_E2E_DOCS_URL ?? 'http://127.0.0.1:4322'

const shopBaseUrl =
  process.env.BS_E2E_SHOP_URL ?? 'http://127.0.0.1:4321'

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__))
}

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  test(`shared patterns: ${locale}, ${theme}, keyboard and mobile`, async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${docsBaseUrl}/components`)
    await waitForNuxtHydration(page)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const patterns = page.getByTestId('foundation-patterns')
    const picker = patterns.getByRole('combobox', { name: locale === 'ar' ? 'الصنف' : 'Item', exact: true })
    await picker.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    expect(await page.getByRole('listbox').getByRole('option').count()).toBeLessThan(50)
    const filter = page.getByRole('searchbox', { name: locale === 'ar' ? 'بحث · الصنف' : 'Search · Item' })
    await filter.fill('Item 9999')
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)
    const filteredOption = page.getByRole('listbox').getByRole('option', { name: 'Item 9999', exact: true })
    await filter.press('ArrowDown')
    await expect(filteredOption).toBeVisible()

    // PrimeVue's documented filter-input Enter behavior closes the popup and
    // restores focus to the select; it is not the option-activation gesture.
    await filter.press('Enter')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(picker).toBeFocused()

    // Reopen and activate the filtered option through the option itself.
    await picker.press('ArrowDown')
    const reopenedFilter = page.getByRole('searchbox', { name: locale === 'ar' ? 'بحث · الصنف' : 'Search · Item' })
    await reopenedFilter.fill('Item 9999')
    await expect(filteredOption).toBeVisible()
    await filteredOption.click()
    await expect(picker).toContainText('Item 9999')

    await picker.press('ArrowDown')
    await page.getByRole('searchbox', { name: locale === 'ar' ? 'بحث · الصنف' : 'Search · Item' }).fill('does-not-exist')
    await expect(page.getByRole('listbox').getByRole('option', { name: locale === 'ar' ? 'لا توجد سجلات' : 'No records found', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(picker).toBeFocused()
    const input = patterns.getByRole('textbox', { name: locale === 'ar' ? 'القيمة' : 'Value', exact: true })
    await input.fill('test')
    const consent = patterns.getByRole('checkbox', { name: locale === 'ar' ? 'أوافق على الشروط' : 'I agree to the terms', exact: true })
    await patterns.getByRole('button', { name: locale === 'ar' ? 'حفظ' : 'Save', exact: true }).click()
    await expect(patterns.getByRole('alert')).toHaveCount(0)
    await expect(consent).toBeFocused()
    await consent.check()
    await patterns.getByRole('button', { name: locale === 'ar' ? 'حفظ' : 'Save', exact: true }).click()
    await expect(patterns.getByRole('alert')).toBeFocused()
    await patterns.getByRole('button', { name: locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…', exact: true }).click()
    await expect(input).toBeDisabled()
    await expect(patterns.locator('form')).toHaveAttribute('aria-busy', 'true')
    await patterns.getByRole('button', { name: locale === 'ar' ? 'إظهار إشعار' : 'Show notification' }).click()
    // The host uses shared translated labels, independent of the product.
    const toastDismiss = page.getByRole('button', { name: locale === 'ar' ? 'إغلاق' : 'Close', exact: true }).last()
    await expect(toastDismiss).toBeVisible()
    const box = await toastDismiss.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await toastDismiss.click()
    const catalogueToolbar = page.getByRole('toolbar', { name: locale === 'ar' ? 'أمثلة المكونات' : 'Component examples' })
    const catalogueAdd = catalogueToolbar.getByRole('button', { name: locale === 'ar' ? 'إضافة' : 'Create', exact: true })
    await catalogueAdd.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').fill('Unsaved')
    await page.keyboard.press('Escape')
    const discardDialog = page.getByRole('dialog').last()
    await expect(discardDialog.getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true }).first()).toBeFocused()
    await discardDialog.getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).first().click()
    await expect(dialog).toHaveCount(0)
    await expect(catalogueAdd).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}

// All requests are fulfilled in the browser. No disposable or hosted DB is needed.
async function shopFixture(page: Page, locale = 'en') {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'ui@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', email: user.email })).toString('base64url')}.test`
  let mode = 'mixed'
  let customerName = 'Customer fixture'
  const appointmentStart = new Date(); appointmentStart.setHours(10, 0, 0, 0)
  const appointmentEnd = new Date(appointmentStart.getTime() + 35 * 60_000)
  let appointments = [
    { id: 'appointment-1', locationId: 'location-1', staffMembershipId: 'membership-1', serviceId: 'service-1', customerId: 'customer-1', identityKind: 'customer', customerName: 'Customer fixture', customerPhone: '01000000000', status: 'booked', startsAt: appointmentStart.toISOString(), endsAt: appointmentEnd.toISOString(), notes: null, saleId: null, serviceName: 'Haircut', staffName: 'Fixture barber', history: [] },
    { id: 'appointment-2', locationId: 'location-1', staffMembershipId: 'membership-1', serviceId: 'service-1', customerId: null, identityKind: 'walk_in', customerName: 'Waiting walk-in', customerPhone: null, status: 'waiting', startsAt: new Date(appointmentStart.getTime() + 60 * 60_000).toISOString(), endsAt: new Date(appointmentEnd.getTime() + 60 * 60_000).toISOString(), notes: null, saleId: null, serviceName: 'Haircut', staffName: 'Fixture barber', history: [] },
  ]
  const stock = { product_id: 'product-1', name: 'Stock fixture', sku: 'SKU', is_active: true, reorder_threshold: 2, quantity_on_hand: 10, inventory_value: 100, is_low_stock: false }
  await page.route('http://127.0.0.1:61321/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({ json: url.pathname.endsWith('/token') ? { access_token: jwt, refresh_token: 'test', expires_in: 3600, token_type: 'bearer', user } : user }); return
    }
    const name = url.pathname.split('/').at(-1)!
    const args = route.request().postDataJSON() ?? {}
    calls.push({ name, args })
    let data: unknown = []
    switch (name) {
      case 'portals': data = { id: 'portal-1' }; break
      case 'profiles': data = { id: 'profile-1', status: 'active' }; break
      case 'shop_memberships': data = [{ id: 'membership-1', shop_id: 'shop-1', profile_id: 'profile-1', role: 'owner', status: 'active' }]; break
      case 'shops': data = [{ id: 'shop-1', name: 'Fixture shop', business_mode: mode, status: 'active', created_at: '2026-01-01' }]; break
      case 'list_shop_locations': data = [{ id: 'location-1', shop_id: 'shop-1', name: 'Main location', code: 'MAIN', address: null, phone: null, status: 'active', is_default: true, archived_at: null }]; break
      case 'sale_access': data = [{ can_view: true, can_manage: true, can_issue: true }]; break
      case 'shop_permission_access': data = { 'settings.manage': true }; break
      case 'list_location_sales': data = { items: [], total: 0, canManage: true, canIssue: true }; break
      case 'sale_catalog': data = { businessMode: mode, canIssue: true, products: Array.from({ length: 10000 }, (_, i) => ({ id: `product-${i}`, name: `Product ${i}`, stock: 10, unitPrice: 5 })), services: [], customers: [] }; break
      case 'payment_access': data = [{ can_receive: true }]; break
      case 'inventory_access': data = [{ can_view: true, can_manage: true, inventory_enabled: true }]; break
      case 'list_inventory': data = { items: [stock], total_valuation: 100, low_stock_count: 0 }; break
      case 'list_inventory_history': data = { items: [{ id: `movement-${args.p_page}`, event_at: '2026-01-01', source_type: 'manual_receipt', reference: `Movement page ${args.p_page}`, quantity_change: 1, value_change: 10 }], total: 125 }; break
      case 'list_stock_counts': data = { items: [{ id: `count-${args.p_page}`, counted_at: '2026-01-01', reference: `Count page ${args.p_page}`, expected_quantity: 1, counted_quantity: 2, variance_quantity: 1 }], total: 125 }; break
      case 'customer_access': data = [{ can_view: true, can_manage: true }]; break
      case 'list_customers': data = { items: [{ id: 'customer-1', name: customerName, is_active: true }], total: 1, canManage: true }; break
      case 'get_customer': data = [{ id: 'customer-1', name: customerName, is_active: true, can_manage: true }]; break
      case 'customer_statement': data = { items: [], total: 0, outstanding: 250 }; break
      case 'list_outstanding_invoices': data = { items: [{ id: `invoice-${args.p_page}`, invoice_number: `INV-${args.p_page}`, outstanding: 100, total_amount: 100, settlement_state: 'unpaid' }], total: 125 }; break
      case 'save_customer': customerName = String(args.p_name); data = 'customer-1'; break
      case 'record_customer_receipt': data = 'receipt-1'; break
      case 'set_shop_business_mode': mode = String(args.p_business_mode); data = null; break
      case 'appointment_options': data = { canManage: true, canManageSchedule: true, locations: [{ id: 'location-1', name: 'Main location' }], staff: [{ membershipId: 'membership-1', name: 'Fixture barber', locationIds: ['location-1'] }], services: [{ id: 'service-1', name: 'Haircut', durationMinutes: 30, cleanupMinutes: 5, locationIds: ['location-1'], staffMembershipIds: ['membership-1'] }], customers: [{ id: 'customer-1', name: customerName, phone: '01000000000' }] }; break
      case 'appointment_calendar': data = { appointments, workingHours: Array.from({ length: 7 }, (_, weekday) => ({ membershipId: 'membership-1', weekday, startsLocal: '09:00:00', endsLocal: '18:00:00', timezone: 'Africa/Cairo' })), blocks: [] }; break
      case 'save_appointment': appointments = [...appointments, { id: 'appointment-3', locationId: 'location-1', staffMembershipId: String(args.p_membership_id), serviceId: String(args.p_service_id), customerId: null, identityKind: 'walk_in', customerName: String(args.p_walk_in_name), customerPhone: null, status: 'booked', startsAt: String(args.p_starts_at), endsAt: new Date(new Date(String(args.p_starts_at)).getTime() + 35 * 60_000).toISOString(), notes: null, saleId: null, serviceName: 'Haircut', staffName: 'Fixture barber', history: [] }]; data = 'appointment-3'; break
      case 'transition_appointment': appointments = appointments.map(item => item.id === args.p_appointment_id ? { ...item, status: String(args.p_status) } : item); data = args.p_appointment_id; break
      case 'save_staff_schedule': data = null; break
    }
    await route.fulfill({ json: data })
  })
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await page.goto(`${shopBaseUrl}/auth/login`)
  await waitForNuxtHydration(page)
  await page.getByRole('textbox', { name: locale === 'ar' ? /البريد الإلكتروني/ : /Email/ }).fill(user.email)
  await page.getByLabel(locale === 'ar' ? /كلمة المرور/ : /Password/).fill('fixture-password')
  const loginResponse = page.waitForResponse(response =>
    response.url().startsWith('http://127.0.0.1:61321/auth/v1/token')
    && response.request().method() === 'POST',
  )
  await page.locator('form button[type="submit"]').click()
  await loginResponse
  await expect(page).toHaveURL(/dashboard/)
  return calls
}

test('Shop inventory pages beyond 100 and clean/dirty dialog behavior', async ({ page }) => {
  const calls = await shopFixture(page)
  await page.locator('a[href="/inventory"]').first().click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  const movements = page.getByRole('region', { name: 'Inventory movements', exact: true })
  await movements.getByRole('button', { name: 'Last Page' }).click()
  await expect(page.getByText('Movement page 7')).toBeVisible()
  expect(calls.some(call => call.name === 'list_inventory_history' && call.args.p_page === 7 && call.args.p_page_size === 20)).toBe(true)
  await page.getByRole('button', { name: 'Record count', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Record count', exact: true }).click()
  await page.getByRole('dialog').getByRole('spinbutton', { name: 'Counted', exact: true }).fill('8')
  await page.keyboard.press('Escape')
  await expect(page.getByText('Discard unsaved changes?')).toBeVisible()
})

test('Shop virtualized sale picker, receipt allocations across pages, settings save', async ({ page }) => {
  const calls = await shopFixture(page)
  await page.locator('a[href="/sales"]').first().click()
  await page.getByRole('button', { name: 'New sale', exact: true }).click()
  const picker = page.getByRole('dialog').getByRole('combobox', { name: 'Catalog item', exact: true })
  await picker.click()
  expect(await page.getByRole('option').count()).toBeLessThan(50)
  await page.keyboard.press('Escape')
  const saleDialog = page.getByRole('dialog')
  await expect(saleDialog).toBeVisible()
  await saleDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(saleDialog).toHaveCount(0)
  await page.locator('a[href="/customers"]').first().click()
  await page.getByRole('link', { name: 'Customer fixture', exact: true }).click()
  await page.getByRole('button', { name: 'Record receipt', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton', { name: 'INV-1 Amount', exact: true }).fill('10')
  await dialog.getByRole('button', { name: 'Next Page' }).click()
  await dialog.getByRole('spinbutton', { name: 'INV-2 Amount', exact: true }).fill('20')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toHaveCount(0)
  const receipt = calls.find(call => call.name === 'record_customer_receipt')!
  expect(receipt.args.p_amount).toBe(30)
  expect(receipt.args.p_allocations).toEqual([{ invoice_id: 'invoice-1', amount: 10 }, { invoice_id: 'invoice-2', amount: 20 }])
  await page.locator('a[href="/settings"]').first().click()
  await page.getByRole('button', { name: 'Save operation mode', exact: true }).click()
  const modeDialog = page.getByRole('dialog', { name: 'Business operation mode', exact: true })
  await modeDialog.getByRole('radio', { name: /Services only/ }).check()
  await modeDialog.getByRole('button', { name: 'Save operation mode', exact: true }).click()
  await expect(modeDialog).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Business operation mode updated.' }).first()).toBeVisible()
  expect(calls.some(call => call.name === 'set_shop_business_mode' && call.args.p_business_mode === 'service')).toBe(true)
})

test('Shop inventory distinguishes permission denial from empty data', async ({ page }) => {
  await shopFixture(page)
  await page.route('**/rest/v1/rpc/inventory_access', route => route.fulfill({ json: [{ can_view: false, can_manage: false, inventory_enabled: false }] }))
  await page.locator('a[href="/inventory"]').first().click()
  await expect(page.getByRole('alert')).toHaveText('You do not have permission to view inventory.')
  await expect(page.getByRole('button', { name: 'Manual receipt', exact: true })).toHaveCount(0)
  await expect(page.getByText('No matching products.')).toHaveCount(0)
})

test('Shop inventory announces loading and recovers from a read error', async ({ page }) => {
  await shopFixture(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route('**/rest/v1/rpc/list_inventory', async route => {
    if (requests++ > 0) { await route.fallback(); return }
    await gate
    await route.fulfill({ status: 500, json: { message: 'fixture unavailable' } })
  })
  await page.locator('a[href="/inventory"]').first().click()
  const table = page.getByRole('region', { name: 'Inventory', exact: true })
  await expect(table).toHaveAttribute('aria-busy', 'true')
  release()
  await expect(table.getByRole('alert')).toContainText('Could not load inventory.')
  await table.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Stock fixture', { exact: true })).toBeVisible()
  await expect(table.getByRole('alert')).toHaveCount(0)
})

test('Shop appointment calendar supports keyboard day/week, walk-ins and queue actions', async ({ page }) => {
  const calls = await shopFixture(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.locator('a[href="/appointments"]').first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible()
  const week = page.getByRole('button', { name: 'Week', exact: true })
  await week.focus(); await page.keyboard.press('Enter')
  await expect(week).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Waiting walk-in', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Start service', exact: true }).last().click()
  expect(calls.some(call => call.name === 'transition_appointment' && call.args.p_status === 'in_service')).toBe(true)
  await page.getByRole('button', { name: 'New appointment', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Service', exact: true }).click()
  await page.getByRole('option', { name: 'Haircut', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Staff member', exact: true }).click()
  await page.getByRole('listbox').getByRole('option', { name: 'Fixture barber', exact: true }).click()
  await dialog.getByRole('radio', { name: 'Walk-in', exact: true }).check()
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('New walk-in')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('New walk-in', { exact: true })).toBeVisible()
  expect(calls.some(call => call.name === 'save_appointment' && call.args.p_identity_kind === 'walk_in')).toBe(true)
})

test('Shop appointment controls remain RTL, responsive and touch-sized', async ({ page }) => {
  await shopFixture(page, 'ar')
  await page.locator('a[href="/appointments"]').first().click()
  await expect(page).toHaveURL(/\/appointments/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'المواعيد', exact: true })).toBeVisible()
  const add = page.getByRole('button', { name: 'موعد جديد', exact: true })
  const box = await add.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  await add.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
