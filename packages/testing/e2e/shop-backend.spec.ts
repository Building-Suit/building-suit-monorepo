import { expect, test } from '@playwright/test'
const shopOrigin = process.env.BS_E2E_BACKEND_SHOP_ORIGIN ?? 'http://127.0.0.1:4321'
const ledgerOrigin = process.env.BS_E2E_BACKEND_LEDGER_ORIGIN ?? 'http://127.0.0.1:4320'
const mailOrigin = process.env.BS_ATOMIC_BACKEND_SHOP_MAIL ?? 'http://127.0.0.1:61324'

test('Shop signup, product persistence and independent Ledger sessions', async ({ page, context }) => {
  test.skip(process.env.BUILDING_TEST_BACKEND !== '1', 'Requires the explicitly initialized disposable monorepo backend')
  test.setTimeout(60000)
  const email = `shop-${Date.now()}@building-suit.test`
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.goto(`${shopOrigin}/auth/signup`)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Local Shop Owner')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  const password = page.locator('input[type=password]')
  await expect(password).toHaveAccessibleName('Password')
  await password.fill('local-shop-test-password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'Shop name', exact: true }).fill(`Local shop ${Date.now()}`)
  await page.getByRole('textbox', { name: 'Main location name', exact: true }).fill('Atomic local branch')
  await expect(page.getByText('Full product access for 7 days', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Products and stock', exact: true }).check()
  await page.getByRole('button', { name: 'Create shop', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  let otp = ''
  await expect.poll(async () => {
    const inbox = await fetch(`${mailOrigin}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json()) as { messages?: Array<{ ID: string }> }
    const id = inbox.messages?.[0]?.ID
    if (!id) return false
    const message = await fetch(`${mailOrigin}/api/v1/message/${id}`).then(r => r.text())
    otp = message.match(/\b(\d{6})\b/)?.[1] || ''
    return otp.length === 6
  }).toBe(true)
  for (let i = 0; i < 6; i++) await page.getByLabel(`Verification code ${i + 1}`).fill(otp[i]!)
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  await expect(page).toHaveURL(`${shopOrigin}/dashboard`)
  await page.goto(`${shopOrigin}/products`)
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill('Local test product')
  await dialog.getByRole('textbox', { name: 'SKU', exact: true }).fill(`LOCAL-${Date.now()}`)
  await dialog.getByRole('spinbutton', { name: 'Sale price', exact: true }).fill('25')
  await dialog.getByRole('button', { name: 'Save product', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
  await page.screenshot({ path: '.local/screenshots/shop-products.png', fullPage: true })
  // Cookies share a hostname across local ports; product prefixes must isolate them.
  const ledger = await context.newPage()
  await ledger.goto(`${ledgerOrigin}/dashboard`)
  await expect(ledger).toHaveURL(/\/login/)
  await expect(ledger.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible()
  await ledger.close()
  const cookies = await context.cookies()
  expect(cookies.some(cookie => cookie.name.startsWith('bs-shop-local-auth-token'))).toBe(true)
  expect(cookies.some(cookie => cookie.name.startsWith('bs-ledger-local-auth-token'))).toBe(false)
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
})
