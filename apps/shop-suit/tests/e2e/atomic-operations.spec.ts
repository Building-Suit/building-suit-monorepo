import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`cash shift adapter commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    let active: { id: string; registerKey: string; cashierMembershipId: string; cashierName: string; openingAmount: number; cashSales: number; cashRefunds: number; payIns: number; payOuts: number; expectedCash: number; openedAt: string; nonCashTotal: number; nonCashByMethod: object; events: object[] } | null = null
    const items: object[] = []
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'cash_shift_dashboard') return { canManage: true, canAdjust: true, currentMembershipId: 'membership-1', active, items, total: items.length, page: 1, pageSize: 20, cashiers: [{ id: 'membership-1', name: 'Fixture cashier' }] }
      if (name === 'open_cash_shift') { active = { id: 'shift-1', registerKey: 'main', cashierMembershipId: 'membership-1', cashierName: 'Fixture cashier', openingAmount: Number(args.p_opening_amount), cashSales: 0, cashRefunds: 0, payIns: 0, payOuts: 0, expectedCash: Number(args.p_opening_amount), openedAt: '2026-01-01T00:00:00Z', nonCashTotal: 0, nonCashByMethod: {}, events: [] }; return 'shift-1' }
      if (name === 'record_cash_movement' && active) { active.payIns = Number(args.p_amount); active.expectedCash += Number(args.p_amount); active.events.push({ id: 'event-1', kind: 'pay_in', amount: args.p_amount, reason: args.p_reason, reference: args.p_reference, occurredAt: '2026-01-01T00:00:00Z', actorName: 'Fixture cashier' }); return 'event-1' }
      if (name === 'close_cash_shift' && active) { items.push({ ...active, countedCash: args.p_counted_amount, variance: Number(args.p_counted_amount) - active.expectedCash, closedAt: '2026-01-01T00:30:00Z' }); active = null; return 'shift-1' }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/cash-shifts')
    async function confirm() {
      const dialog = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
      await dialog.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    await page.getByRole('button', { name: ar ? 'فتح وردية' : 'Open shift', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    await dialog.getByLabel(ar ? 'النقدية الافتتاحية' : 'Opening cash', { exact: true }).fill('100')
    await dialog.getByRole('button', { name: ar ? 'فتح الخزنة' : 'Open drawer', exact: true }).click()
    await confirm()
    await page.getByRole('button', { name: ar ? 'حركة نقدية' : 'Cash movement', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true }).fill('20')
    await dialog.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Float adjustment')
    await dialog.getByLabel(ar ? 'المرجع' : 'Reference', { exact: true }).fill('REF-1')
    await dialog.getByRole('button', { name: ar ? 'تسجيل الحركة' : 'Record movement', exact: true }).click()
    await confirm()
    await page.getByRole('button', { name: ar ? 'إغلاق الوردية' : 'Close shift', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-pc-section=footer]')).toBeVisible()
    await expect(dialog.getByLabel(ar ? 'النقدية المعدودة' : 'Counted cash', { exact: true })).toHaveValue('120')
    await dialog.getByLabel(ar ? 'النقدية المعدودة' : 'Counted cash', { exact: true }).fill('115')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/cash-shift-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'تأكيد العد والإغلاق' : 'Confirm count and close', exact: true }).click()
    await confirm()
    const opened = calls.find(call => call.name === 'open_cash_shift')!
    expect(opened.args.p_opening_amount).toBe(100)
    expect(opened.args.p_location_id).toBe('location-1')
    const movement = calls.find(call => call.name === 'record_cash_movement')!
    expect(movement.args.p_amount).toBe(20)
    expect(movement.args.p_kind).toBe('pay_in')
    expect(movement.args.p_reason).toBe('Float adjustment')
    expect(movement.args.p_reference).toBe('REF-1')
    const closed = calls.find(call => call.name === 'close_cash_shift')!
    expect(closed.args.p_counted_amount).toBe(115)
    expect(closed.args.p_session_id).toBe('shift-1')
    for (const command of [opened, movement, closed]) expect(command.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
  })
}

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`business settings adapter commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    let name = 'Fixture shop'
    let receipt = { displayName: 'Fixture receipt', address: null, phone: null, footer: null as string | null, paperSize: 'thermal_80', canManage: true }
    const { calls } = await pilotFixture(page, locale, 'owner', (rpc, args) => {
      if (rpc === 'shops') return [{ id: 'shop-1', name, business_mode: 'service', status: 'active', created_at: '2026-01-01' }]
      if (rpc === 'shop_permission_access') return { 'settings.manage': true }
      if (rpc === 'shop_plan_usage') return { resources: [] }
      if (rpc === 'shop_cash_policy') return false
      if (rpc === 'receipt_settings') return receipt
      if (rpc === 'save_shop_profile') { name = String(args.p_display_name); return 'shop-1' }
      if (rpc === 'save_shop_location') return 'location-created'
      if (rpc === 'save_receipt_settings') { receipt = { ...receipt, displayName: String(args.p_display_name), footer: String(args.p_footer), paperSize: String(args.p_paper_size) }; return 'shop-1' }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/settings')
    await page.getByRole('button', { name: ar ? 'تعديل ملف المتجر' : 'Edit shop profile', exact: true }).click()
    let dialog = page.getByRole('dialog')
    const profileName = dialog.getByLabel(ar ? 'اسم المتجر' : 'Shop display name', { exact: true })
    await expect(profileName).toHaveValue('Fixture shop')
    await profileName.fill('Revised shop')
    await dialog.getByRole('button', { name: ar ? 'حفظ ملف المتجر' : 'Save Shop profile', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(calls.find(call => call.name === 'save_shop_profile')?.args).toEqual({ p_shop_id: 'shop-1', p_display_name: 'Revised shop' })
    await page.getByRole('button', { name: ar ? 'إضافة فرع' : 'Add location', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'اسم الفرع' : 'Location name', { exact: true }).fill('New location')
    await dialog.getByRole('button', { name: ar ? 'إضافة فرع' : 'Add location', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const location = calls.find(call => call.name === 'save_shop_location')!
    expect(location.args.p_shop_id).toBe('shop-1'); expect(location.args.p_location_id).toBeNull(); expect(location.args.p_name).toBe('New location')
    await page.getByRole('button', { name: ar ? 'تعديل إعدادات الإيصال' : 'Edit receipt settings', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'رسالة أسفل الإيصال' : 'Receipt footer message', { exact: true }).fill('New footer')
    await dialog.getByRole('radio', { name: 'A4 / PDF', exact: true }).check()
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/settings-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: ar ? 'حفظ إعدادات الإيصال' : 'Save receipt settings', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(calls.find(call => call.name === 'save_receipt_settings')?.args).toEqual({ p_shop_id: 'shop-1', p_display_name: 'Fixture receipt', p_address: null, p_phone: null, p_footer: 'New footer', p_paper_size: 'a4' })
  })
}
