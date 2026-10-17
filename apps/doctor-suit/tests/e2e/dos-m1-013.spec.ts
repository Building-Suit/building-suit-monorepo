import { test,expect } from '@playwright/test'
for (const locale of ['en','ar']) test(`DOS-M1-013 ${locale}: availability requires verified account admission`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }]); await page.goto('/availability'); await expect(page).toHaveURL(/\/sign-in\?next=/); expect(new URL(page.url()).searchParams.get('next')).toBe('/availability'); await expect(page.getByRole('button',{ name: /Add working window|إضافة فترة عمل/,exact: true })).toHaveCount(0)
})
