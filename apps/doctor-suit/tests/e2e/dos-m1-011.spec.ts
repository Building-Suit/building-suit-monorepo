import { test,expect } from '@playwright/test'
for (const locale of ['en','ar']) test(`DOS-M1-011 ${locale}: unconfigured patient administration requests verified sign-in`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }])
  await page.goto('/patients')
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe('/patients')
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button',{ name: /Add patient|إضافة مريض/,exact: true })).toHaveCount(0)
})
