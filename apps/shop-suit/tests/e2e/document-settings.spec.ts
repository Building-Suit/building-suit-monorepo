import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) test(`document presentation editor persists only future settings: ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
  let settings = { displayName: 'Original business', address: '', phone: '', footer: 'Original footer', paperSize: 'thermal_80', documentLabel: '', documentLanguage: 'ar', documentDirection: 'auto', showDescriptions: true, notes: '', logoDataUrl: '' }
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shop_permission_access') return { 'settings.manage': true }
    if (name === 'receipt_settings') return { ...settings, canManage: true }
    if (name === 'save_document_settings') { settings = { ...settings, ...(args.p_settings as typeof settings) }; return { ...settings, canManage: true } }
    if (name === 'shop_cash_policy') return { requireOpenShift: false }
    return undefined
  })
  await fixtureGoto(page, '/settings')
  await page.getByRole('button', { name: ar ? 'تعديل إعدادات الإيصال' : 'Edit receipt settings', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: ar ? 'عنوان المستند' : 'Document label', exact: true }).fill('Original custom label')
  await dialog.getByRole('textbox', { name: ar ? 'ملاحظات المستند' : 'Document notes', exact: true }).fill('Original custom note')
  await dialog.getByRole('checkbox', { name: ar ? 'إظهار وصف البنود' : 'Show line descriptions', exact: true }).uncheck()
  const logo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5WQAAAAASUVORK5CYII='
  await dialog.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(logo, 'base64') })
  await expect(dialog.getByRole('img', { name: 'Original business' })).toHaveAttribute('src', `data:image/png;base64,${logo}`)
  await dialog.getByRole('button', { name: ar ? 'حفظ إعدادات الإيصال' : 'Save receipt settings', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const save = calls.find(call => call.name === 'save_document_settings')
  expect(save?.args).toMatchObject({ p_shop_id: 'shop-1', p_settings: { documentLabel: 'Original custom label', notes: 'Original custom note', showDescriptions: false, documentLanguage: 'ar', documentDirection: 'auto', logoDataUrl: `data:image/png;base64,${logo}` } })
  await page.getByRole('button', { name: ar ? 'تعديل إعدادات الإيصال' : 'Edit receipt settings', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: ar ? 'عنوان المستند' : 'Document label', exact: true })).toHaveValue('Original custom label')
  await expect(dialog.getByRole('checkbox', { name: ar ? 'إظهار وصف البنود' : 'Show line descriptions', exact: true })).not.toBeChecked()
  await expectNoPageOverflow(page)
})

for (const showDescriptions of [false, true]) test(`issued presentation uses its captured logo, label, locale, notes and descriptions: ${showDescriptions}`, async ({ page }) => {
  const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5WQAAAAASUVORK5CYII='
  await pilotFixture(page, 'ar', 'owner', name => name === 'get_location_sale_receipt' ? {
    version: 1, invoiceId: 'sale-1', invoiceNumber: 'PRESENTATION-001', issuedAt: '2026-10-01T12:00:00Z', currency: 'EGP',
    presentation: { documentLabel: 'Issued custom label', language: 'en', direction: 'ltr', showDescriptions, notes: 'Issued note', logoDataUrl: logo },
    business: { name: 'Issued business', address: null, phone: null }, location: { name: 'Issued location', code: null, address: null, phone: null }, staffName: null, customer: { name: null, phone: null },
    lines: [{ id: 'line-1', itemType: 'service', name: 'Issued service', description: 'Issued description', sku: null, quantity: 1, unitPrice: 10, discount: 0, total: 10 }],
    payments: [{ id: 'payment-1', amount: 10, method: 'cash', reference: null, paidAt: '2026-10-01T12:00:00Z' }], subtotal: 10, discount: 0, total: 10, footer: 'Issued footer', paperSize: 'a4',
  } : undefined)
  await fixtureGoto(page, '/sales/sale-1/receipt')
  const document = page.locator('.bs-printable-document')
  await expect(document).toHaveAttribute('lang', 'en')
  await expect(document).toHaveAttribute('dir', 'ltr')
  await expect(document).toContainText('Issued custom label')
  await expect(document).toContainText('Issued note')
  await expect(document.getByRole('img', { name: 'Issued business' })).toHaveAttribute('src', logo)
  if (showDescriptions) await expect(document).toContainText('Issued description')
  else await expect(document).not.toContainText('Issued description')
  await page.getByRole('radio', { name: 'العربية', exact: true }).check()
  await expect(document).toHaveAttribute('lang', 'ar')
  await expect(document).toHaveAttribute('dir', 'ltr')
  await expect(document).toContainText('Issued custom label')
  await expect(document).toContainText('Issued note')
})
