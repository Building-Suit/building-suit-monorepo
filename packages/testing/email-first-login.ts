import { expect, type Page } from '@playwright/test'

/** Synthetic account lookup only; callers still submit a real password stage.
 * This fixture never replaces Auth token/session validation. */
export async function advanceEmailFirstLogin(page: Page, fixtureEmail: string) {
  await page.route('**/api/auth/email-step', route => route.fulfill({
    json: { canContinue: String(route.request().postDataJSON()?.email ?? '').trim().toLowerCase() === fixtureEmail.trim().toLowerCase() },
  }))
  await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
  const password = page.locator('input[type=password]')
  await expect(password).toHaveCount(0)
  const email = page.locator('input[type=email]')
  await expect(email).toHaveCount(1)
  await email.fill(fixtureEmail)
  await email.press('Enter')
  await expect(password).toBeVisible()
  await expect(email).toHaveAttribute('readonly', '')
  await expect(page.locator('form button[type=submit]')).toHaveCount(1)
}
