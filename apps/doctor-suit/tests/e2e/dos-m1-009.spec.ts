import { test,expect } from '@playwright/test'
for (const locale of ['en','ar']) test(`DOS-M1-009 ${locale}: invitation credentials require a verified Doctor account`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }])
  await page.goto('/invitations/accept')
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.locator('input')).toHaveCount(0)
})
