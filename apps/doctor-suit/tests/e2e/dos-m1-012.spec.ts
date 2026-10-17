import { test,expect } from '@playwright/test'
for (const locale of ['en','ar']) test(`DOS-M1-012 ${locale}: private profile requires verified account admission`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }])
  await page.goto('/patients/62000000-0000-4000-8000-000000000003'); await expect(page).toHaveURL(/\/sign-in\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe('/patients/62000000-0000-4000-8000-000000000003'); await expect(page.locator('input[type=file]')).toHaveCount(0)
})
