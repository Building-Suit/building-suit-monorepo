import { expect, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

/** Complete the shared email-first UI; the caller chooses native or intercepted providers. */
export async function completePasswordSignIn(page: Page, email: string, password: string, locale: 'en' | 'ar' = 'en') {
  const copy = locale === 'ar' ? ar : en
  await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
  await page.getByLabel(copy.auth.email).fill(email)
  const submit = page.getByRole('button', { name: copy.auth.signIn, exact: true })
  await submit.click()
  await expect(page.getByLabel(copy.auth.password)).toBeVisible()
  await page.getByLabel(copy.auth.password).fill(password)
  // The outgoing email control and incoming password control briefly coexist.
  await expect(submit).toHaveCount(1)
  await submit.click()
}
