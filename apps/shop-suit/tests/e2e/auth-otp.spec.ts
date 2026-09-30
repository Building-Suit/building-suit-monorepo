import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:64321'

async function resetFixture(page: Page, locale = 'en') {
  await fetch(`${fixtureUrl}/__reset`)
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
}

async function startSignup(page: Page, email = 'owner@example.test') {
  await page.goto('/auth/signup')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
    }
    return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  await page.getByLabel('Name', { exact: true }).fill('OTP owner')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('safe-test-password')
  await continueButton.click()
  await page.getByLabel('Shop name', { exact: true }).fill('OTP shop')
  await expect(page.getByText('Full product access for 14 days', { exact: true })).toBeVisible()
  await expect(page.getByText(/change this later in Business settings without losing data/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Products, stock and services' })).toBeChecked()
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
  expect(state.createPayload).toEqual({ p_shop_name: 'OTP shop', p_business_mode: 'mixed' })
  expect(state.signupPayload.data.pending_shop).toEqual({ name: 'OTP shop', business_mode: 'mixed' })
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
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
    }
    return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })
  await page.getByLabel('الاسم', { exact: true }).fill('مالك')
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('arabic-new@example.test')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('safe-test-password')
  await page.getByRole('button', { name: 'متابعة', exact: true }).click()
  await expect(page.getByText('تجربة كاملة لمدة 14 يومًا', { exact: true })).toBeVisible()
  await expect(page.getByText(/تغيير طريقة التشغيل لاحقًا من إعدادات النشاط دون فقد أي بيانات/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'منتجات ومخزون وخدمات' })).toBeChecked()
  await expect(page.locator('#signup-plan')).toHaveCount(0)
})
