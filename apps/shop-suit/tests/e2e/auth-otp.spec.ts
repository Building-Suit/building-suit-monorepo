import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:64321'

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

async function startSignup(page: Page, email = 'owner@example.test', mode: 'mixed' | 'service' = 'mixed') {
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
  await expect(page.getByText('Full product access for 14 days', { exact: true })).toBeVisible()
  await expect(page.getByText(/change this later in Business settings without losing data/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Products, stock and services' })).toBeChecked()
  if (mode === 'service') await page.getByRole('radio', { name: 'Services only' }).check()
  await expect(page.locator('#signup-plan')).toHaveCount(0)
  await page.getByRole('button', { name: 'Create shop', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
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
  await expect(page.getByText('انتهت صلاحية الرمز. اطلب رمزًا جديدًا.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'إرسال رمز جديد', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /تغيير البريد الإلكتروني/ })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'تسجيل الدخول بدلًا من ذلك' })).toBeVisible()
  await page.getByRole('button', { name: 'إرسال رمز جديد', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('أرسلنا رمز تحقق جديدًا')
})

test('Arabic signup is plan-neutral and defaults to mixed operations', async ({ page }) => {
  await resetFixture(page, 'ar')
  await page.goto('/auth/signup')
  await waitForHydration(page)
  await page.getByLabel('الاسم', { exact: true }).fill('مالك')
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('arabic-new@example.test')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('safe-test-password')
  await page.getByRole('button', { name: 'متابعة', exact: true }).click()
  await page.getByLabel('اسم الفرع الرئيسي', { exact: true }).fill('الفرع الرئيسي')
  await expect(page.getByText('تجربة كاملة لمدة 14 يومًا', { exact: true })).toBeVisible()
  await expect(page.getByText(/تغيير طريقة التشغيل لاحقًا من إعدادات النشاط دون فقد أي بيانات/)).toBeVisible()
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
  const mainRow = page.getByRole('listitem').filter({ hasText: 'Downtown' })
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
  await expect(page.getByRole('status')).toContainText('Shop profile updated.')
  await expect(page.getByLabel('Shop', { exact: true })).toContainText('OTP flagship Shop')
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByLabel('Shop display name', { exact: true })).toHaveValue('OTP flagship Shop')
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('owner@example.test')
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByLabel('Location name', { exact: true }).fill('North branch')
  await page.getByRole('button', { name: 'Add location', exact: true }).click()
  await expect(page.getByText('Using 2 of 2 active locations.')).toBeVisible()
  await expect(page.getByText(/active-location limit is full/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toHaveCount(0)

  const branchRow = page.getByRole('listitem').filter({ hasText: 'North branch' })
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
