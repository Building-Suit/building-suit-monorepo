import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

const shop = '11111111-1111-4111-8111-111111111111'
for (const [locale, theme, width, height] of [['en', 'light', 1440, 1240], ['ar', 'dark', 390, 900]] as const) {
  test(`catalog create geometry and service scheduling ${locale} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', (name) => {
      if (name === 'shops') return [{ id: shop, name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_memberships') return [{ id: 'membership-1', shop_id: shop, profile_id: 'profile-1', role: 'owner', status: 'active' }]
      if (name === 'shop_permission_access') return { 'products.manage': true, 'services.manage': true }
      if (name === 'list_catalog_categories') return []
      if (name === 'service_scheduling_options') return { locations: [{ id: 'location-1', name: 'Main branch' }], staff: [{ membershipId: 'member-1', name: 'Sample staff', locationIds: ['location-1'] }] }
      if (name === 'shop_catalog_media') return { supportsMedia: true, supportsUploads: true, items: [], total: 0, page: 1, pageSize: 20 }
      return undefined
    })
    const ar = locale === 'ar'
    const saves: Record<string, unknown>[] = []
    let rejectSave = true
    let releaseSave: (() => void) | undefined
    await fixtureRoute(page, '**/rest/v1/rpc/shop_catalog_media', async route => {
      const args = route.request().postDataJSON()
      if (!String(args.p_action).startsWith('save_')) return route.fallback()
      saves.push(args)
      if (rejectSave) return route.fulfill({ status: 400, json: { message: 'Synthetic save failed' } })
      await new Promise<void>(resolve => { releaseSave = resolve })
      await route.fulfill({ json: 'saved-fixture' })
    })
    for (const kind of ['products', 'services']) {
      await fixtureGoto(page, `/${kind}`)
      const service = kind === 'services'
      const add = service ? ar ? 'إضافة خدمة' : 'Add service' : ar ? 'إضافة منتج' : 'Add product'
      await page.getByRole('button', { name: add, exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveAccessibleName(add)
      // Wait for the dialog's initial keyboard focus before native validation.
      await expect(dialog.getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true })).toBeFocused()
      const name = dialog.getByRole('textbox', { name: service ? ar ? 'اسم الخدمة' : 'Service name' : ar ? 'اسم المنتج' : 'Product name', exact: true })
      const save = dialog.getByRole('button', { name: service ? ar ? 'حفظ الخدمة' : 'Save service' : ar ? 'حفظ المنتج' : 'Save product', exact: true })
      await expect(dialog.locator('.bs-catalog-image__placeholder')).toBeVisible()
      await expect(dialog.locator('.bs-catalog-uploader').getByRole('status')).toContainText(ar ? 'اختر' : 'Choose')
      await expect(dialog.locator('input[type=url]')).toHaveCount(0)
      await expect(dialog.getByRole('combobox', { name: ar ? 'التصنيف' : 'Category', exact: true })).toContainText(ar ? 'كل التصنيفات' : 'All categories')
      expect(await save.getAttribute('form')).toBe(await dialog.locator('form').getAttribute('id'))
      const initial = await save.boundingBox()
      expect(initial!.y + initial!.height).toBeLessThanOrEqual(height)
      if (width === 1440) {
        expect((await dialog.boundingBox())!.width).toBeCloseTo(672, 0)
        expect((await save.boundingBox())!.width).toBeGreaterThanOrEqual(204)
        expect((await dialog.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(180)
      }
      if (service) {
        const scheduling = dialog.getByRole('checkbox', { name: ar ? 'الحجز بالمواعيد' : 'Appointment scheduling', exact: true })
        await expect(scheduling).not.toBeChecked()
        await scheduling.scrollIntoViewIfNeeded()
        await page.screenshot({ path: test.info().outputPath('service-create-initial.png'), fullPage: true })
        await dialog.screenshot({ path: test.info().outputPath('service-create-dialog.png') })
        await scheduling.check()
        await dialog.getByRole('checkbox', { name: 'Sample staff', exact: true }).check()
        await expect(dialog.getByRole('checkbox', { name: 'Main branch', exact: true })).toBeChecked()
        await expect(dialog.getByRole('spinbutton', { name: ar ? 'مدة الخدمة (دقيقة)' : 'Service duration (minutes)', exact: true })).toHaveValue('30')
      }
      await save.click()
      await expect(name).toBeFocused()
      expect(saves).toHaveLength(service ? 2 : 0)
      await name.fill(service ? 'Haircut' : 'Daily shampoo 250 ml')
      rejectSave = true
      await save.click()
      await expect(dialog.getByRole('alert')).toContainText('Synthetic save failed')
      rejectSave = false
      await save.click()
      await expect(save).toBeDisabled()
      await expect(dialog).toHaveAttribute('aria-busy', 'true')
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await expect.poll(() => Boolean(releaseSave)).toBe(true)
      releaseSave!()
      releaseSave = undefined
      await expect(dialog).toHaveCount(0)
      const payload = saves.at(-1)!.p_payload as Record<string, unknown>
      expect(payload.p_name).toBe(service ? 'Haircut' : 'Daily shampoo 250 ml')
      expect(payload.imageObjectName).toBeNull()
      if (service) {
        expect(payload.p_service_id).toBeNull()
        expect(payload.p_scheduling_enabled).toBe(true)
        expect(payload.p_location_ids).toEqual(['location-1'])
        expect(payload.p_staff_membership_ids).toEqual(['member-1'])
      } else expect(payload.p_product_id).toBeNull()
      await page.getByRole('button', { name: add, exact: true }).click()
      await dialog.getByRole('textbox', { name: service ? ar ? 'اسم الخدمة' : 'Service name' : ar ? 'اسم المنتج' : 'Product name', exact: true }).fill('Abandoned draft')
      await dialog.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
      const discard = dialog.getByRole('alert')
      await expect(discard).toContainText(ar ? 'تجاهل التغييرات غير المحفوظة؟' : 'Discard unsaved changes?')
      await discard.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(saves).toHaveLength(service ? 4 : 2)
      await expectNoPageOverflow(page)
    }
  })
}
