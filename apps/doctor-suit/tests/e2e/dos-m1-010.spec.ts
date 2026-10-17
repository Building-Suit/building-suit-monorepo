import { test,expect } from '@playwright/test'
for (const locale of ['en','ar']) test(`DOS-M1-010 ${locale}: team administration never exposes grant controls without verified authority`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }])
  await page.goto('/team')
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.locator('input')).toHaveCount(0)
})
