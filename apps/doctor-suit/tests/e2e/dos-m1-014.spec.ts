import { test,expect } from '@playwright/test'
for(const locale of ['en','ar'])test(`DOS-M1-014 ${locale}: appointment and queue commands require verified admission`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: locale,url: 'http://127.0.0.1:4336' }]);await page.goto('/appointments');await expect(page).toHaveURL(/\/sign-in\?next=/);expect(new URL(page.url()).searchParams.get('next')).toBe('/appointments');await expect(page.getByRole('button',{ name: /Book appointment|حجز موعد/,exact: true })).toHaveCount(0)
})
