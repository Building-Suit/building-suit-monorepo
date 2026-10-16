import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureReload, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  test(`website address remains unpublished: ${locale} ${theme}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 950 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    let address: { slug: string; state: 'draft'; aliases: string[] } | null = null
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'متجر جميل', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'shop_permission_access') return { 'settings.manage': true }
      if (name === 'shop_website_address') return address
      if (name === 'shop_website_address_save') { address = { slug: String(args.p_slug), state: 'draft', aliases: address ? [address.slug] : [] }; return address }
      return undefined
    })
    await fixtureGoto(page, '/settings')
    const panel = page.locator('#website-address')
    await panel.getByRole('button', { name: ar ? 'تعديل العنوان' : 'Edit address', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const input = dialog.getByLabel(ar ? 'العنوان المختصر' : 'Address slug', { exact: false })
    await expect(input).toHaveValue(/^shop-[a-f0-9]{32}$/)
    await input.fill('Admin')
    const save = dialog.getByRole('button', { name: ar ? 'حفظ العنوان' : 'Save address', exact: true })
    await expect(save).toBeDisabled()
    await input.fill('my-new-shop')
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(panel).toContainText('https://my-new-shop.shops.building-suit.com')
    await expect(panel.getByRole('status')).toContainText(ar ? 'بدون نشر' : 'unpublished')
    await fixtureReload(page)
    await expect(panel).toContainText('https://my-new-shop.shops.building-suit.com')
    expect(calls.find(call => call.name === 'shop_website_address_save')?.args).toEqual({ p_shop_id: 'shop-1', p_slug: 'my-new-shop' })
    await panel.getByRole('button', { name: ar ? 'تعديل العنوان' : 'Edit address', exact: true }).click()
    await expect(input).toHaveValue('my-new-shop')
    await input.fill('next-' + 'x'.repeat(45))
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(panel).toContainText('https://next-' + 'x'.repeat(45) + '.shops.building-suit.com')
    await expect(panel).toContainText('https://my-new-shop.shops.building-suit.com')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('website-address.png'), fullPage: true, animations: 'disabled' })
  })
}
test('website settings permission denial issues no address write', async ({ page }) => {
  const { calls } = await pilotFixture(page, 'en', 'owner', name => name === 'shop_permission_access' ? { 'settings.manage': false } : undefined)
  await fixtureGoto(page, '/settings')
  await expect(page.locator('#website-address')).toContainText('Settings permission required.')
  await expect(page.locator('#website-address').getByRole('button')).toHaveCount(0)
  expect(calls.some(call => call.name === 'shop_website_address_save')).toBe(false)
})

test('website load retry and collision feedback retain the editable draft', async ({ page }) => {
  await pilotFixture(page, 'en', 'owner', name => name === 'shop_permission_access' ? { 'settings.manage': true } : name === 'shop_website_address' ? null : undefined)
  let failedRead = true
  await fixtureRoute(page, '**/rest/v1/rpc/shop_website_address', async route => {
    if (failedRead) return route.fulfill({ status: 503, json: { message: 'private raw infrastructure detail' } })
    return route.fulfill({ json: null })
  })
  await fixtureRoute(page, '**/rest/v1/rpc/shop_website_address_save', route => route.fulfill({ status: 409, json: { code: '23505', message: 'private raw infrastructure detail' } }))
  await fixtureGoto(page, '/settings')
  const panel = page.locator('#website-address')
  await expect(panel).toContainText('Could not load address.')
  await expect(panel).not.toContainText('private raw')
  failedRead = false
  await panel.getByRole('button', { name: 'Retry', exact: true }).click()
  await panel.getByRole('button', { name: 'Edit address', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Address slug', { exact: false }).fill('occupied-shop')
  await dialog.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(dialog).toContainText('Could not save this address.')
  await expect(dialog).not.toContainText('private raw')
  await expect(dialog.getByLabel('Address slug', { exact: false })).toHaveValue('occupied-shop')
  await expect(dialog.getByRole('button', { name: 'Save address', exact: true })).toBeEnabled()
})
