import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { login } from './pilot-backend'
import { marketFixture, type MarketMode, type MarketRole } from './market-backend'

async function confirm(page: Page, ar: boolean) {
  await page.getByRole('dialog').last().getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
}

async function layout(page: Page, ar: boolean) {
  await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

async function importCsv(page: Page, ar: boolean, kind: string, csv: string) {
  // A full navigation exposes the native select before Vue attaches v-model.
  // Wait for hydration so choosing customers cannot leave the importer in its
  // default products mode and reject the otherwise valid customer headers.
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
    }
    return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })
  const importKind = page.getByRole('combobox', { name: ar ? 'استيراد CSV' : 'CSV import', exact: true })
  await importKind.selectOption(kind)
  await expect(importKind).toHaveValue(kind)
  await page.locator('input[type=file]').setInputFiles({ name: `${kind}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) })
  const validate = page.getByRole('button', { name: ar ? 'فحص بدون حفظ' : 'Validate without saving', exact: true })
  await expect(validate, `${kind} CSV should be parsed and ready for validation`).toBeEnabled()
  await validate.click()
  await expect(page.getByRole('status').filter({ hasText: ar ? 'الملف صالح للتنفيذ.' : 'The file is ready to import.' })).toBeVisible()
  const applied = page.waitForResponse(response => response.url().endsWith('/rpc/catalog_import') && response.request().postDataJSON()?.p_dry_run === false)
  await page.getByRole('button', { name: ar ? 'تنفيذ الاستيراد' : 'Apply import', exact: true }).click()
  await confirm(page, ar)
  const response = await applied
  expect(response.ok()).toBe(true)
  const result = await response.json()
  expect(result.valid).toBe(true)
  expect(result.created).toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return { args: response.request().postDataJSON(), result }
}

// Real Auth + real public RPCs throughout. Synthetic UX failure injection lives
// in cross-workflow-usability.spec.ts and cannot pass this qualification gate.
for (const mode of ['product', 'service', 'mixed'] satisfies MarketMode[])
  for (const role of ['owner', 'manager', 'cashier'] satisfies MarketRole[])
    for (const locale of ['en', 'ar']) for (const width of [360, 1440]) {
      test(`general shop day: ${mode}, ${role}, ${locale}, ${width}px`, async ({ page, browser }) => {
        const fixture = await marketFixture(mode, role)
        const ar = locale === 'ar'
        const hasProduct = mode !== 'service'
        const total = (hasProduct ? 20 : 0) + (mode !== 'product' ? 30 : 0)
        const args = { p_shop_id: fixture.shopId, p_location_id: fixture.locationId }
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.name))
        await page.setViewportSize({ width, height: 900 })
        const ownerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4422', timezoneId: 'Africa/Cairo', viewport: { width, height: 900 } })
        try {
          const ownerPage = await ownerContext.newPage()
          ownerPage.on('pageerror', error => errors.push(error.name))
          await login(ownerPage, fixture.owner, locale)
          await ownerPage.goto('/catalog-import')
          const imported = await importCsv(ownerPage, ar, 'customers', 'name,phone,email,address,notes\nMarket customer,01000000000,market@example.invalid,,\n')
          expect(await fixture.rpc(fixture.owner, 'catalog_import', imported.args)).toEqual(imported.result)
          if (hasProduct) {
            await importCsv(ownerPage, ar, 'products', 'name,sku,barcode,sale_price,opening_stock,opening_cost,category,supplier\nMarket product,MARKET-1,622100000001,20,0,0,Market,\n')
            await importCsv(ownerPage, ar, 'suppliers', 'name,contact_name,phone,email,address,tax_number,notes\nMarket supplier,,01100000000,supplier@example.invalid,,,\n')
            await layout(ownerPage, ar)
            await ownerPage.goto('/purchases')
            await ownerPage.getByRole('button', { name: ar ? 'تسجيل مشتريات' : 'Record purchase', exact: true }).click()
            const dialog = ownerPage.getByRole('dialog')
            for (const [label, option] of [[ar ? 'المورد' : 'Supplier', 'Market supplier'], [ar ? 'المنتج 1' : 'Product 1', 'Market product']] as const) {
              await dialog.getByRole('combobox', { name: label, exact: true }).click()
              await ownerPage.getByRole('option', { name: option, exact: true }).click()
            }
            await dialog.getByRole('spinbutton', { name: ar ? 'الكمية' : 'Quantity', exact: true }).fill('10')
            await dialog.getByRole('spinbutton', { name: ar ? 'تكلفة الوحدة' : 'Unit cost', exact: true }).fill('10')
            const purchase = ownerPage.waitForResponse(response => response.url().endsWith('/rpc/create_supplier_purchase') && response.request().method() === 'POST')
            await dialog.getByRole('button', { name: ar ? 'ترحيل المشتريات' : 'Post purchase', exact: true }).click()
            await confirm(ownerPage, ar)
            expect((await purchase).ok()).toBe(true)
            await expect(dialog).toHaveCount(0)
            await layout(ownerPage, ar)
          }
          await login(page, fixture.actor, locale)
          await page.goto('/cash-shifts')

          // Full document navigation can expose SSR controls before Vue has
          // attached their event handlers. Wait for Nuxt client hydration
          // before driving the cash-shift interaction.
          await page.waitForFunction(() => {
            const root = document.querySelector('#__nuxt') as HTMLElement & {
              __vue_app__?: {
                config?: {
                  globalProperties?: {
                    $nuxt?: { isHydrating?: boolean }
                  }
                }
              }
            }

            return root.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
          })

          const openShift = page.getByRole('button', {
            name: ar ? 'فتح وردية' : 'Open shift',
            exact: true,
          })

          await expect(openShift).toBeEnabled()
          await openShift.click()

          const dialog = page.getByRole('dialog')
          await expect(dialog).toBeVisible()
          await dialog.getByRole('spinbutton', { name: ar ? 'النقدية الافتتاحية' : 'Opening cash', exact: true }).fill('50')
          await dialog.getByRole('button', { name: ar ? 'فتح الخزنة' : 'Open drawer', exact: true }).click()
          await confirm(page, ar)
          await expect(dialog).toHaveCount(0)

          await page.goto('/pos')
          if (hasProduct) {
            await expect(page.locator('li button').filter({ hasText: 'Market product' })).toBeVisible()
            // The catalog can already be visible from SSR before the POS
            // window keydown listener has mounted. Wait for Nuxt hydration to
            // finish before exercising the real keyboard-wedge scanner path.
            await page.waitForFunction(() => {
              const root = document.querySelector('#__nuxt') as HTMLElement & {
                __vue_app__?: {
                  config?: {
                    globalProperties?: {
                      $nuxt?: { isHydrating?: boolean }
                    }
                  }
                }
              }

              return root.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
            })

            const catalogSearch = page.locator('input[type="search"]').first()
            await expect(catalogSearch).toBeVisible()

            const scan = page.waitForResponse(response => response.url().endsWith('/rpc/pos_catalog_search') && response.request().postDataJSON()?.p_barcode === '622100000001')

            // Keyboard wedge input, through the actual POS listener.
            await page.keyboard.press('F2')
            await expect(catalogSearch).toBeFocused()
            await page.keyboard.type('622100000001', { delay: 5 })
            await page.keyboard.press('Enter')
            expect((await scan).ok()).toBe(true)
          }
          if (mode !== 'product') await page.locator('li button').filter({ hasText: 'Market service' }).click()
          const cart = page.getByRole('main').getByRole('complementary', {
            name: ar ? 'البيعة الحالية' : 'Current sale',
            exact: true,
          })
          if (hasProduct) await expect(cart).toContainText('Market product')
          if (mode !== 'product') await expect(cart).toContainText('Market service')
          await page.locator('#pos-customer').fill('Market')
          await page.getByRole('button', { name: /Market customer/ }).click()
          await layout(page, ar)
          const pay = page.getByRole('main').getByRole('button', { name: ar ? /^تحصيل / : /^Pay / })
          await expect(pay).toBeEnabled()
          const paid = page.waitForResponse(response => response.url().endsWith('/rpc/checkout_pos_sale') && response.request().method() === 'POST')
          await pay.click()
          await confirm(page, ar)
          const response = await paid
          expect(response.ok()).toBe(true)
          const invoiceId = await response.json() as string
          await expect(page).toHaveURL(new RegExp(`/sales/${invoiceId}/receipt`))
          await expect(page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })).toBeEnabled()
          expect(await fixture.rpc(fixture.actor, 'checkout_pos_sale', response.request().postDataJSON())).toBe(invoiceId)
          const receiptArgs = { ...args, p_invoice_id: invoiceId }
          const receipt = await fixture.rpc<{ total: number; lines: Array<{ itemType: string }>; payments: unknown[] }>(fixture.actor, 'get_location_sale_receipt', receiptArgs)
          expect(Number(receipt.total)).toBe(total)
          expect(receipt.lines.map(line => line.itemType).sort()).toEqual(mode === 'mixed' ? ['product', 'service'] : [mode])
          expect(receipt.payments).toHaveLength(1)
          await page.reload()
          await expect(page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })).toBeEnabled()
          expect(await fixture.rpc(fixture.actor, 'get_location_sale_receipt', receiptArgs)).toEqual(receipt)
          await layout(page, ar)

          const report = (name: string) => fixture.rpc<{ summary: Record<string, number>; items: unknown[] }>(fixture.owner, 'shop_operational_report', { p_shop_id: fixture.shopId, p_report: name })
          expect(Number((await report('sales')).summary.sales)).toBe(total)
          expect(Number((await report('collections')).summary.netCollections)).toBe(total)
          expect(Number((await report('receivables')).summary.outstanding)).toBe(0)
          expect(Number((await report('inventory')).summary.quantityOnHand)).toBe(hasProduct ? 9 : 0)
          if (hasProduct) expect(Number((await report('suppliers')).summary.payable)).toBe(100)

          await page.goto('/cash-shifts')
          await page.getByRole('button', { name: ar ? 'إغلاق الوردية' : 'Close shift', exact: true }).click()
          await expect(dialog.getByRole('spinbutton', { name: ar ? 'النقدية المعدودة' : 'Counted cash', exact: true })).toHaveValue(String(50 + total))
          await dialog.getByRole('button', { name: ar ? 'تأكيد العد والإغلاق' : 'Confirm count and close', exact: true }).click()
          await confirm(page, ar)
          await expect(dialog).toHaveCount(0)
          const shifts = await fixture.rpc<{ active: unknown; items: Array<{ expectedCash: number; variance: number }> }>(fixture.actor, 'cash_shift_dashboard', args)
          expect(shifts.active).toBeNull()
          expect(shifts.items).toHaveLength(1)
          expect(Number(shifts.items[0]!.expectedCash)).toBe(50 + total)
          expect(Number(shifts.items[0]!.variance)).toBe(0)
          await layout(page, ar)
          await ownerPage.goto('/reports')
          await expect(ownerPage.getByRole('heading', { name: ar ? 'التقارير التشغيلية' : 'Operational reports', exact: true })).toBeVisible()
          await layout(ownerPage, ar)
          expect(errors).toEqual([])
        } finally { await ownerContext.close() }
      })
    }

test('existing staff JWT loses access on suspension; outsider and other-shop owner are denied', async ({ page }) => {
  const fixture = await marketFixture('mixed', 'cashier')
  const args = { p_shop_id: fixture.shopId, p_location_id: fixture.locationId }
  await login(page, fixture.actor, 'en')
  await page.goto('/pos')
  await expect(page.getByRole('main').getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  await expect(fixture.rpc(fixture.actor, 'shop_operational_report', { p_shop_id: fixture.shopId, p_report: 'suppliers' })).rejects.toThrow(/failed \(403\)/)
  const outsider = await fixture.account('outsider')
  await expect(fixture.rpc(outsider, 'pos_checkout_context', args)).rejects.toThrow(/failed \(403\)/)
  await fixture.rpc(outsider, 'create_owner_shop', { p_shop_name: 'Other market shop', p_plan_slug: 'pro', p_business_mode: 'mixed' })
  await expect(fixture.rpc(outsider, 'pos_checkout_context', args)).rejects.toThrow(/failed \(403\)/)
  await fixture.rpc(fixture.owner, 'manage_shop_member', {
    p_request_id: randomUUID(), p_shop_id: fixture.shopId, p_membership_id: fixture.membershipId,
    p_action: 'suspend', p_reason: 'Market qualification',
  })
  await expect(fixture.rpc(fixture.actor, 'pos_checkout_context', args)).rejects.toThrow(/failed \(403\)/)
  await expect(fixture.rpc(fixture.actor, 'open_cash_shift', {
    ...args, p_request_id: randomUUID(), p_register_key: 'denied', p_opening_amount: 0, p_notes: null,
  })).rejects.toThrow(/failed \(403\)/)
  await page.reload()
  await expect(page.getByRole('button', { name: /^Pay / })).toHaveCount(0)
})
