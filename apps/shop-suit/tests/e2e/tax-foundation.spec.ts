import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) test(`tax settings save an explicit inclusive VAT version: ${locale}`, async ({ page }) => {
 const ar = locale === 'ar'
 await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
 const versions: unknown[] = []
 const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
  if (name === 'tax_settings') return { versions, items: [] }
  if (name === 'save_tax_policy') { versions.push({ id: 'tax-version-1', effective_at: args.p_effective_at, reason: args.p_reason, policy: args.p_policy }); return 'tax-version-1' }
  return undefined
 })
 await fixtureGoto(page, '/taxes')
 await expect(page.getByText(ar ? 'الحساب مقفول. مفيش إعداد محفوظ.' : 'Calculation is disabled; no saved configuration.')).toBeVisible()
 await page.getByRole('button', { name: ar ? 'نسخة إعداد جديدة' : 'New settings version', exact: true }).click()
 const dialog = page.getByRole('dialog')
 await dialog.getByRole('checkbox', { name: ar ? 'تفعيل حساب الضريبة' : 'Enable tax calculation', exact: true }).check()
 await dialog.getByRole('combobox', { name: ar ? 'التصنيف' : 'Treatment', exact: true }).click()
 await page.getByRole('option', { name: ar ? 'قيمة مضافة' : 'VAT', exact: true }).click()
 await dialog.getByRole('combobox', { name: ar ? 'السعر' : 'Price mode', exact: true }).click()
 await page.getByRole('option', { name: ar ? 'شامل الضريبة' : 'Tax inclusive', exact: true }).click()
 await dialog.getByRole('spinbutton', { name: ar ? 'النسبة ٪' : 'Rate %', exact: true }).fill('14')
 await dialog.getByRole('textbox', { name: ar ? 'رمز التصنيف V001–V010' : 'Classification code V001–V010', exact: true }).fill('V009')
 await dialog.getByRole('textbox', { name: ar ? 'سبب التغيير' : 'Reason for change', exact: true }).fill('Future ordinary VAT policy')
 await dialog.getByRole('button', { name: ar ? 'حفظ نسخة' : 'Save version', exact: true }).click()
 await expect(dialog).not.toBeVisible()
 const command = calls.find(call => call.name === 'save_tax_policy')
 expect(command?.args.p_policy).toEqual({ enabled: true, default: { treatment: 'vat', rate: 14, priceMode: 'inclusive', subtype: 'V009' }, items: [] })
 expect(command?.args.p_shop_id).toBe('shop-1')
 expect(command?.args.p_effective_at).toMatch(/Z$/)
 await expect(page.getByText('Future ordinary VAT policy')).toBeVisible()
 await expectNoPageOverflow(page)
})
