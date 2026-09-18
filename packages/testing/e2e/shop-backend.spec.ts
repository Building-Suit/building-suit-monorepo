import { expect, test } from '@playwright/test'

test('Shop signup verifies email, provisions a shop and saves through the shared record dialog', async ({ page, context }) => {
  test.skip(process.env.BUILDING_TEST_BACKEND !== '1', 'Requires the explicitly initialized disposable monorepo backend')
  test.setTimeout(60000)
  const email = `shop-${Date.now()}@building-suit.test`
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.goto('http://127.0.0.1:4321/auth/signup')
  await page.getByLabel('Name', { exact: true }).fill('Local Shop Owner')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-shop-test-password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Shop name', { exact: true }).fill(`Local shop ${Date.now()}`)
  await page.getByLabel('Trial plan').selectOption('pro')
  await page.getByRole('button', { name: 'Create shop', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  let otp = ''
  await expect.poll(async () => {
    const inbox = await fetch(`http://127.0.0.1:59324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json()) as { messages?: Array<{ ID: string }> }
    const id = inbox.messages?.[0]?.ID
    if (!id) return false
    const message = await fetch(`http://127.0.0.1:59324/api/v1/message/${id}`).then(r => r.text())
    otp = message.match(/\b(\d{6})\b/)?.[1] || ''
    return otp.length === 6
  }).toBe(true)
  for (let i = 0; i < 6; i++) await page.getByLabel(`Verification code ${i + 1}`).fill(otp[i]!)
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4321/dashboard')
  await page.goto('http://127.0.0.1:4321/products')
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Product name', { exact: true }).fill('Local test product')
  await dialog.getByLabel('SKU', { exact: true }).fill(`LOCAL-${Date.now()}`)
  await dialog.getByLabel('Sale price', { exact: true }).fill('25')
  await dialog.getByRole('button', { name: 'Save product', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
  await page.screenshot({ path: '.local/screenshots/shop-products.png', fullPage: true })
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Local test product', exact: true })).toBeVisible()
})
