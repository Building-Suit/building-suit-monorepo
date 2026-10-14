import { expect, test, type Page } from '@playwright/test'

async function expectWorkspace(page: Page, arabic: boolean) {
  await expect(page).toHaveURL(/\/dashboard$/)
  if (arabic) {
    await expect(page.getByRole('button', { name: 'فتح القائمة', exact: true })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('combobox', { name: 'الفرع', exact: true })).toContainText('Private location a')
  } else {
    await expect(page.locator('#bs-primary-navigation')).toHaveCount(1)
    await expect(page.locator('#bs-primary-navigation')).toBeVisible()
    await expect(page.getByRole('banner').getByRole('combobox', { name: 'Shop', exact: true })).toContainText('Private shop a')
  }
  await expect(page.getByRole('heading', { name: arabic ? 'لوحة التحكم' : 'Operating dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: arabic ? 'المميزات' : 'Features', exact: true })).toHaveCount(0)
}
for (const locale of ['en', 'ar']) {
  test(`committed dashboard retains workspace through session and data delays ${locale}`, async ({ page, context, request }) => {
    test.setTimeout(90_000)
    const ar = locale === 'ar'
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), ar ? 'dark' : 'light')
    for (const missingSubscription of [false, true]) {
      await request.post('http://127.0.0.1:4440/fixture/config', { data: { shopDelayMs: 450, subscriptionDelayMs: 600, missingSubscription } })
      await page.goto('/about')
      if (ar) await page.getByRole('button', { name: 'فتح القائمة', exact: true }).click()
      await page.getByRole('link', { name: ar ? 'تسجيل الدخول' : 'Sign in', exact: true }).click()
      await expect(page).toHaveURL(/\/auth\/login$/)
      await page.getByRole('textbox', { name: ar ? 'البريد الإلكتروني' : 'Email', exact: true }).fill('a@example.test')
      await page.locator('input[type=password]').fill('synthetic-password')
      await page.getByRole('button', { name: ar ? 'تسجيل الدخول' : 'Log in', exact: true }).click()
      await expectWorkspace(page, ar)
      await page.waitForLoadState('networkidle')
      await expectWorkspace(page, ar)
      await page.screenshot({ path: test.info().outputPath(missingSubscription ? 'dashboard-no-subscription.png' : 'dashboard-active.png'), fullPage: true })
      await page.reload()
      await expectWorkspace(page, ar)
      await page.goto('/dashboard')
      await expectWorkspace(page, ar)
      if (ar) await page.getByRole('button', { name: 'فتح القائمة', exact: true }).click()
      await page.getByRole('button', { name: ar ? 'الحساب' : 'Account', exact: true }).click()
      await page.getByRole('menuitem', { name: ar ? 'تسجيل الخروج' : 'Sign out', exact: true }).click()
      await expect(page).toHaveURL(/\/auth\/login$/)
      await expect(page.getByRole('textbox', { name: ar ? 'البريد الإلكتروني' : 'Email', exact: true })).toBeVisible()
      await expect(page.locator('#bs-primary-navigation')).toHaveCount(0)
      await expect(page.getByText('Private shop a', { exact: true })).toHaveCount(0)
    }
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login$/)
    await expect(page.locator('#bs-primary-navigation')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
