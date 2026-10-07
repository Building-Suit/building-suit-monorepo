import { test, expect } from '@playwright/test'
const bindingId = '11111111-1111-4111-8111-111111111111'
const fixture = () => ({ version: 4, enabled: true, recipientAlias: 'Synthetic recipient', recipientDetails: 'Synthetic recipient details', instructions: { en: 'Synthetic English transfer instructions', ar: 'تعليمات تحويل عربية للاختبار' }, paymentLink: 'https://payment.example.invalid/share', qr: { assetUrl: 'https://assets.example.invalid/qr.png', alt: { en: 'Synthetic QR', ar: 'رمز للاختبار' } } })
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) {
  test(`manual configuration ${locale} ${mobile ? 'mobile dark' : 'narrow desktop light'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 900, height: 1000 })
    await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
    await page.route('**/api/session', route => route.fulfill({ json: { userId: 'synthetic-owner', role: 'owner', authorityEnvironmentId: 'synthetic-environment' } }))
    await page.route('**/api/registry', route => route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit', ar: 'حزمة اختبار' }, items: [{ key: 'transfer', label: { en: 'Manual transfer', ar: 'تحويل يدوي' }, module: 'manual-transfer', bindingId }] }] } }))
    let configuration: ReturnType<typeof fixture> | null = fixture()
    let queryCode = 200
    let failSave = true
    const commands: unknown[] = []
    await page.route('**/api/adapters/shop', async route => {
      const body = route.request().postDataJSON()
      if (body.operation === 'shop.billing.command') {
        commands.push(body)
        if (failSave) { failSave = false; await route.fulfill({ status: 503, json: { data: { code: 'outcome_unknown' } } }); return }
        configuration = { ...body.payload.configuration, version: 5 }
        await route.fulfill({ json: { data: { configuration }, targetAuditId: 'synthetic-target-audit' } })
      } else {
        expect(body.payload).toEqual({ resource: 'manual-transfer' })
        await route.fulfill({ status: queryCode, json: queryCode === 200 ? { data: { configuration } } : { statusCode: queryCode } })
      }
    })
    const url = '/?suit=synthetic-suit&item=transfer'
    await page.goto(url)
    const preview = page.locator('[data-transfer-preview]')
    await expect(preview).toContainText(locale === 'ar' ? fixture().instructions.ar : fixture().instructions.en)
    await expect(preview.getByRole('link')).toHaveAttribute('href', fixture().paymentLink)
    await page.screenshot({ path: `/tmp/sas-instapay-${locale}-${mobile}-configured.png`, fullPage: true })
    const edit = page.getByRole('button', { name: locale === 'en' ? 'Edit manual transfer' : 'تعديل التحويل اليدوي', exact: true })
    await edit.focus(); await expect(edit).toBeFocused(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('#transfer-instructions-ar')).toHaveAttribute('dir', 'rtl')
    await expect(dialog.locator('#transfer-alias')).toHaveValue('Synthetic recipient')
    await dialog.locator('#transfer-alias').fill('Synthetic edited recipient')
    await dialog.locator('#transfer-reason').fill('Synthetic reviewed change')
    await page.screenshot({ path: `/tmp/sas-instapay-${locale}-${mobile}-edit.png`, fullPage: true })
    await dialog.getByRole('button', { name: locale === 'en' ? 'Save configuration' : 'حفظ الإعدادات', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.locator('#transfer-alias')).toBeDisabled()
    await dialog.getByRole('button', { name: locale === 'en' ? 'Retry exact request' : 'إعادة الطلب نفسه', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1])
    await expect(preview).toContainText('Synthetic edited recipient')
    configuration = null
    await page.goto(url)
    await expect(page.locator('[data-transfer]')).toContainText(locale === 'en' ? 'No manual-transfer configuration' : 'لا توجد إعدادات للتحويل اليدوي')
    await expect(preview).toHaveCount(0)
    await page.screenshot({ path: `/tmp/sas-instapay-${locale}-${mobile}-empty.png`, fullPage: true })
    configuration = { ...fixture(), enabled: false }
    await page.goto(url)
    await expect(page.locator('[data-transfer]')).toContainText(locale === 'en' ? 'Manual transfer disabled' : 'التحويل اليدوي معطّل')
    await expect(preview).toHaveCount(0)
    configuration = { ...fixture(), instructions: { en: '', ar: '' } }
    await page.goto(url)
    await expect(page.locator('[data-transfer]')).toContainText(locale === 'en' ? 'Configuration incomplete' : 'الإعدادات غير مكتملة')
    await expect(preview).toHaveCount(0)
    queryCode = 503
    await page.goto(url)
    await expect(page.locator('[data-transfer] [data-state="error"]')).toBeVisible()
    queryCode = 200; configuration = fixture()
    await page.locator('[data-transfer] [data-state="error"] button').click()
    await expect(preview).toBeVisible()
    queryCode = 403
    await page.goto(url)
    await expect(page.locator('[data-transfer] [data-state="denied"]')).toBeVisible()
    await expect(preview).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
