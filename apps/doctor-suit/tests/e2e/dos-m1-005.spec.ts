import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar']) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`DOS-M1-005 ${locale} ${width}px ${theme}: canonical landing, truthful availability and actual internal navigation`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: locale === 'en' ? 'Your practice, in one workspace' : 'ممارستك الطبية، في مساحة واحدة' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await page.locator('a[href^="http"], a[href^="mailto:"], a[href^="tel:"]').count()).toBe(0)
    await expect(page.getByText(locale === 'en' ? 'Administrative preview with synthetic data only. Clinical care and payments are unavailable.' : 'معاينة إدارية ببيانات تجريبية فقط. الرعاية السريرية والمدفوعات غير متاحتين.', { exact: true })).toBeVisible()
    await expect(page.locator('main a[href="/sign-up"]')).toBeVisible()
    await expect(page.locator('#pricing')).toBeVisible()
    await expect(page.locator('#pricing [data-shop-pricing]')).toHaveCount(1)
    for(const amount of ['299','599','999']){const price=page.locator('#pricing').getByText(`${amount} ${locale==='en'?'EGP':'ج.م'}`,{exact:true});await price.scrollIntoViewIfNeeded();await expect(price).toBeVisible()}
    await expect(page.locator('#pricing').getByRole('button',{name:locale==='en'?'Live payment unavailable':'الدفع الحي غير متاح'})).toHaveCount(3)
    await page.locator('#pricing').getByRole('radio',{name:locale==='en'?'Yearly':'سنوي',exact:true}).check()
    for(const amount of ['2439.84','4887.84','8151.84']){const price=page.locator('#pricing').getByText(`${amount} ${locale==='en'?'EGP':'ج.م'}`,{exact:true});await price.scrollIntoViewIfNeeded();await expect(price).toBeVisible()}
    await page.getByRole('link', { name: locale === 'en' ? 'Preview scope' : 'نطاق المعاينة',exact:true }).click()
    await expect(page).toHaveURL(/\/preview$/)
    await expect(page.getByText(locale === 'en' ? 'Synthetic preview · no active account, practice or location' : 'معاينة تجريبية · لا يوجد حساب أو ممارسة أو موقع نشط')).toBeVisible()
  })
}
