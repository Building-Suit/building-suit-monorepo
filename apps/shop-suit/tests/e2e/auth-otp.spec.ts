import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:4432'

async function resetFixture(page: Page, locale = 'en') {
  await fetch(`${fixtureUrl}/__reset`)
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
    }
    return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })
}

async function startSignup(page: Page, email = 'owner@example.test', mode: 'mixed' | 'service' = 'mixed', recovery = false) {
  await page.goto('/auth/signup')
  await waitForHydration(page)
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  await page.getByLabel('Name', { exact: true }).fill('OTP owner')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('safe-test-password')
  await continueButton.click()
  await page.getByLabel('Shop name', { exact: true }).fill('OTP shop')
  await page.getByLabel('Main location name', { exact: true }).fill('Downtown')
  await page.getByLabel('Location code (optional)', { exact: true }).fill('DT')
  await page.getByLabel('Location address (optional)', { exact: true }).fill('1 Main Street')
  await page.getByLabel('Location phone (optional)', { exact: true }).fill('+201000000000')
  await expect(page.getByText('Full product access for 7 days', { exact: true })).toBeVisible()
  await expect(page.getByText(/change this later in Business settings without losing data/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Products, stock and services' })).toBeChecked()
  if (mode === 'service') await page.getByRole('radio', { name: 'Services only' }).check()
  await expect(page.locator('#signup-plan')).toHaveCount(0)
  await page.getByRole('button', { name: 'Create shop', exact: true }).click()
  await expect(page.getByRole('heading', { name: recovery ? 'Continue signup safely' : 'Verify your email' })).toBeVisible()
}

async function enterOtp(page: Page, code: string) {
  for (let index = 0; index < code.length; index++) await page.getByLabel(`Verification code ${index + 1}`).fill(code[index]!)
}

test('invalid OTP, refresh, resend and verification retry provision one owner shop', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page)
  await enterOtp(page, '111111')
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('not valid')
  await expect(page.getByRole('button', { name: /Change email/ })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Sign in instead' })).toBeVisible()

  await page.evaluate(() => {
    const key = 'shop-suit.pending-onboarding'
    const draft = JSON.parse(sessionStorage.getItem(key)!)
    draft.resendAt = 0
    sessionStorage.setItem(key, JSON.stringify(draft))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await page.getByRole('button', { name: 'Send another code', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('new verification code')

  await enterOtp(page, '654321')
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Retry', exact: true })
  await page.waitForFunction(() => location.pathname === '/dashboard' || Boolean(document.querySelector('[role="alert"]')))
  if (await retry.isVisible()) await retry.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
  expect(state.createCalls).toBe(1)
  expect(state.createPayload).toEqual({
    p_shop_name: 'OTP shop', p_business_mode: 'mixed', p_main_location_name: 'Downtown',
    p_main_location_code: 'DT', p_main_location_address: '1 Main Street', p_main_location_phone: '+201000000000',
  })
  expect(state.signupPayload.data.pending_shop).toEqual({
    name: 'OTP shop', business_mode: 'mixed', main_location_name: 'Downtown',
    main_location_code: 'DT', main_location_address: '1 Main Street', main_location_phone: '+201000000000',
  })

  await expect(page.getByRole('heading', { name: 'Operating dashboard' })).toBeVisible()
  await page.goto('/billing')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Subscription and billing' })).toBeVisible()
  await expect(page.getByText('Trialing', { exact: true })).toBeVisible()
  await expect(page.getByText('7 days', { exact: true })).toBeVisible()
})

test('start over clears the pending draft and permits a different email', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page)
  await page.getByRole('button', { name: /Change email/ }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeEditable()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => sessionStorage.getItem('shop-suit.pending-onboarding'))).toBeNull()
  await page.getByLabel('Email', { exact: true }).fill('different@example.test')
})

test('an existing unconfirmed identity is resent instead of dead-ending', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page, 'existing@example.test')
  await expect(page.getByRole('link', { name: 'Reset password' })).toBeVisible()
  await page.evaluate(() => {
    const key = 'shop-suit.pending-onboarding'
    const draft = JSON.parse(sessionStorage.getItem(key)!)
    draft.resendAt = 0
    sessionStorage.setItem(key, JSON.stringify(draft))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Send another code', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('new verification code')
  const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
  expect(state.signupCalls).toBe(1)
  expect(state.resendCalls).toBe(1)
})

test('expired drafts recover by resend and Arabic exposes every safe exit', async ({ page }) => {
  await resetFixture(page, 'ar')
  await page.goto('/auth/signup')
  await page.evaluate(() => sessionStorage.setItem('shop-suit.pending-onboarding', JSON.stringify({
    version: 1,
    savedAt: Date.now() - 3_600_000,
    expiresAt: Date.now() - 1_000,
    resendAt: 0,
    form: { displayName: 'مالك', email: 'arabic@example.test', shopName: 'متجر', plan: 'team', businessMode: 'mixed' },
  })))
  await page.reload()
  await expect(page.getByText('صلاحية الكود خلصت. اطلب كود جديد.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ابعت كود جديد', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /غيّر الإيميل/ })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'سجّل دخول بدل كده' })).toBeVisible()
  await page.getByRole('button', { name: 'ابعت كود جديد', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('بعتنا كود تأكيد جديد')
})

test('Arabic signup is plan-neutral and defaults to mixed operations', async ({ page }) => {
  await resetFixture(page, 'ar')
  await page.goto('/auth/signup')
  await waitForHydration(page)
  await page.getByLabel('الاسم', { exact: true }).fill('مالك')
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('arabic-new@example.test')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('safe-test-password')
  await page.getByRole('button', { name: 'كمّل', exact: true }).click()
  await page.getByLabel('اسم الفرع الرئيسي', { exact: true }).fill('الفرع الرئيسي')
  await expect(page.getByText('تجربة كاملة 7 أيام', { exact: true })).toBeVisible()
  await expect(page.getByText(/تقدر تغيّرها بعدين من إعدادات النشاط، وبياناتك هتفضل محفوظة/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'منتجات ومخزون وخدمات' })).toBeChecked()
  await expect(page.locator('#signup-plan')).toHaveCount(0)
})

test('signup main location, selected mode, editing, restore, and capacity persist', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page, 'lifecycle@example.test', 'service')
  await enterOtp(page, '654321')
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Retry', exact: true })
  await page.waitForFunction(() => location.pathname === '/dashboard' || Boolean(document.querySelector('[role="alert"]')))
  if (await retry.isVisible()) await retry.click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/settings')
  await waitForHydration(page)
  await expect(page.getByRole('radio', { name: 'Services only' })).toBeChecked()
  const mainRow = page.locator('#locations').getByRole('row').filter({ hasText: 'Downtown' })
  await mainRow.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save location', exact: true })).toBeVisible()
  await page.getByLabel('Location name', { exact: true }).fill('Downtown flagship')
  await page.getByLabel('Address', { exact: true }).fill('2 Main Street')
  await page.getByRole('button', { name: 'Save location', exact: true }).click()
  await expect(page.locator('#locations').getByText('Downtown flagship', { exact: true })).toBeVisible()
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole('radio', { name: 'Services only' })).toBeChecked()
  await expect(page.locator('#locations').getByText('Downtown flagship', { exact: true })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Shop profile' })).toBeVisible()
  await page.getByLabel('Shop display name', { exact: true }).fill('OTP flagship Shop')
  await page.getByRole('button', { name: 'Save Shop profile', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Shop profile updated.' }).first()).toBeVisible()
  await expect(page.getByRole('banner').getByRole('combobox', { name: 'Shop', exact: true })).toContainText('OTP flagship Shop')
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByLabel('Shop display name', { exact: true })).toHaveValue('OTP flagship Shop')
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Account', exact: true })).toContainText('lifecycle@example.test')
  await page.getByRole('button', { name: 'Account', exact: true }).click()

  await page.getByRole('button', { name: 'Add location', exact: true }).click()
  const addLocationDialog = page.getByRole('dialog', { name: 'Add location', exact: true })
  await addLocationDialog.getByLabel('Location name', { exact: true }).fill('North branch')
  await addLocationDialog.getByRole('button', { name: 'Add location', exact: true }).click()
  await expect(page.getByText('Using 2 of 2 active locations.')).toBeVisible()
  await expect(page.getByText(/active-location limit is full/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toHaveCount(0)

  const branchRow = page.locator('#locations').getByRole('row').filter({ hasText: 'North branch' })
  await branchRow.getByRole('button', { name: 'Archive', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toBeVisible()
  await branchRow.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByText(/active-location limit is full/)).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.context().addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'ملف المتجر' })).toBeVisible()
  await expect(page.getByLabel('اسم المتجر', { exact: true })).toHaveValue('OTP flagship Shop')
  await expect(page.getByText(/عنوان الفرع الرئيسي وهاتفه بيانات فرع/)).toBeVisible()
  const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
  expect(state.shopName).toBe('OTP flagship Shop')
})

for (const email of ['Confirmed@Example.test', 'Masked@Example.test']) {
  test(`confirmed duplicate ${email} recovers without provisioning or automatic resend`, async ({ page }) => {
    await resetFixture(page)
    await startSignup(page, email, 'mixed', true)
    await expect(page.getByText(/if you have an account, sign in or reset your password/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in instead' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reset password' })).toHaveAttribute('href', '/auth/forgot-password')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Continue signup safely' })).toBeVisible()
    const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
    expect(state.signupPayload.email).toBe(email.toLowerCase())
    expect(state.signupCalls).toBe(1)
    expect(state.resendCalls).toBe(0)
    expect(state.verifyCalls).toBe(0)
    expect(state.createCalls).toBe(0)
    await page.getByRole('button', { name: 'Sign in instead' }).click()
    await expect(page).toHaveURL(/\/auth\/login$/)
    expect(await page.evaluate(() => sessionStorage.getItem('shop-suit.pending-onboarding'))).toBeNull()
  })
}

test('an ambiguous duplicate can request OTP, refresh and retry without another signup', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page, 'Ambiguous@Example.test', 'mixed', true)
  await page.getByRole('button', { name: 'Send another code', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await enterOtp(page, '654321')
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  await page.waitForFunction(() => location.pathname === '/dashboard' || Boolean(document.querySelector('[role="alert"]')))
  const retry = page.getByRole('button', { name: 'Retry', exact: true })
  if (await retry.isVisible()) await retry.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
  expect(state.signupCalls).toBe(1)
  expect(state.resendCalls).toBe(1)
  expect(state.resendPayload.email).toBe('ambiguous@example.test')
  expect(state.verifyPayload.email).toBe('ambiguous@example.test')
  expect(state.createCalls).toBe(1)
  expect(state.locations).toHaveLength(1)
})

test('Arabic duplicate recovery offers sign-in, reset and start-over after refresh', async ({ page }) => {
  await resetFixture(page, 'ar')
  await page.goto('/auth/signup')
  await page.evaluate(() => sessionStorage.setItem('shop-suit.pending-onboarding', JSON.stringify({
    version: 1, savedAt: Date.now(), expiresAt: 0, resendAt: 0, recovery: true,
    form: { displayName: 'مالك', email: 'CONFIRMED@example.test', shopName: 'متجر', businessMode: 'mixed' },
  })))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'كمّل التسجيل بأمان' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'سجّل دخول بدل كده' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'استرجع كلمة المرور' })).toHaveAttribute('href', '/auth/forgot-password')
  await page.getByRole('button', { name: /غيّر الإيميل/ }).click()
  await expect(page.getByLabel('البريد الإلكتروني', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => sessionStorage.getItem('shop-suit.pending-onboarding'))).toBeNull()
})

test('resend failure keeps duplicate recovery and a cooldown across refresh', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page, 'ambiguous-failed@example.test', 'mixed', true)
  await page.getByRole('button', { name: 'Send another code', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be sent')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Continue signup safely' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Request another code in/ })).toBeDisabled()
  await page.getByRole('button', { name: /Change email/ }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeEditable()
})

test('verification for a different identity cannot provision the pending shop', async ({ page }) => {
  await resetFixture(page)
  await startSignup(page, 'wrong-session@example.test')
  await enterOtp(page, '654321')
  await page.getByRole('button', { name: 'Verify your email', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Continue signup safely' })).toBeVisible()
  const state = await fetch(`${fixtureUrl}/__state`).then(response => response.json())
  expect(state.createCalls).toBe(0)
})
