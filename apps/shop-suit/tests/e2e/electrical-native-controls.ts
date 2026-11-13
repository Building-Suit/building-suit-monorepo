import { expect, type Page } from '@playwright/test'

// UI driver shared with explicit synthetic control qualification. No transport,
// credential, fixture or financial response is supplied by this module.
export async function addElectricalItem(page: Page, locale: string, product: { name: string }, quantity: string, gram = false) {
  const ar = locale === 'ar'
  const cart = page.locator('.bs-pos-cart')
  const tile = page.locator('.bs-catalog-tile').filter({ hasText: product.name })
  await expect(tile).toHaveCount(1)
  // Image and footer expose the same action; choose the image add surface.
  await tile.getByRole('button', { name: /^Add:|^إضافة:/ }).first().click()
  if (gram) {
    await cart.getByRole('listitem').filter({ hasText: product.name }).getByRole('combobox', { name: ar ? 'وحدة البيع' : 'Sale unit', exact: true }).click()
    await page.getByRole('option', { name: ar ? 'جرام' : 'Gram', exact: true }).click()
  }
  const input = cart.getByRole('spinbutton', { name: `${ar ? 'الكمية' : 'Quantity'}: ${product.name}`, exact: true })
  await input.fill(quantity)
  await input.blur()
  await expect(input).toHaveValue(quantity)
}
