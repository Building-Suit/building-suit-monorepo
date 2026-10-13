import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

for (const variant of [{ locale: 'en', theme: 'light', width: 1440 }, { locale: 'ar', theme: 'dark', width: 390 }] as const) {
  test(`non-landing contact pending, failure, retry and readable policies: ${variant.locale}`, async ({ page, context }) => {
    await page.setViewportSize({ width: variant.width, height: 1000 })
    await context.addCookies([{ name: 'building-suit-locale', value: variant.locale, domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), variant.theme)
    let release!: () => void
    let calls = 0
    let mode: 'pending' | 'rate' | 'failure' | 'success' = 'pending'
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route(/^http:\/\/127\.0\.0\.1:4432\//, async route => {
      if (route.request().url().endsWith('/rpc/submit_support_request')) {
        calls++
        if (mode === 'pending') await gate
        if (mode === 'failure') await route.fulfill({ status: 500, json: { message: 'PRIVATE_BACKEND_DETAIL' } })
        else if (mode === 'rate') await route.fulfill({ status: 400, json: { message: 'SUPPORT_RATE_LIMITED' } })
        else await route.fulfill({ json: { accepted: true } })
      }
      else if (route.request().url().includes('/auth/v1/')) await route.fulfill({ status: 401, json: { message: 'no public session' } })
      else await route.fulfill({ json: [] })
    })
    await page.goto('/contact')
    const main = page.getByRole('main')
    const labels = variant.locale === 'en'
      ? { category: 'Category', email: 'Reply email', subject: 'Subject', message: 'Message', consent: /I agree/, submit: 'Submit request', pending: 'Submitting…' }
      : { category: 'التصنيف', email: 'بريد الرد', subject: 'الموضوع', message: 'الرسالة', consent: /أوافق/, submit: 'إرسال الطلب', pending: 'جارٍ الإرسال…' }
    const category = main.getByRole('combobox')
    await expect(category).toHaveAccessibleName(labels.category)
    const id = await category.getAttribute('id')
    expect(id).toBeTruthy()
    await expect(main.locator(`label[for="${id}"]`)).toContainText(labels.category)
    await main.getByLabel(labels.email).fill('synthetic@example.test')
    await main.getByLabel(labels.subject).fill('Synthetic support question')
    await main.getByLabel(labels.message).fill('Please help with this synthetic question.')
    await main.getByLabel(labels.consent).check()
    await main.getByRole('button', { name: labels.submit, exact: true }).click()
    await expect.poll(() => calls).toBe(1)
    await expect(main.getByRole('button', { name: labels.pending, exact: true })).toBeDisabled()
    await expect(main.locator('fieldset')).toHaveAttribute('inert', '')
    await expect(main.locator('.bs-support-request__success')).toHaveCount(0)
    mode = 'failure'; release()
    await expect(main.getByRole('alert')).toBeVisible()
    await expect(main).not.toContainText('PRIVATE_BACKEND_DETAIL')
    await expect(main.getByLabel(labels.subject)).toHaveValue('Synthetic support question')
    mode = 'rate'
    await main.getByRole('button', { name: labels.submit, exact: true }).click()
    await expect(main.getByRole('alert')).toContainText(variant.locale === 'en' ? 'wait a few minutes' : 'بضع دقائق')
    mode = 'success'
    await main.getByRole('button', { name: labels.submit, exact: true }).click()
    await expect(main.getByRole('status')).toBeVisible()
    await expect(main.getByLabel(labels.subject)).toHaveValue('')
    await expect(main.getByLabel(labels.consent)).not.toBeChecked()
    expect(calls).toBe(3)
    await expect(page.locator('html')).toHaveAttribute('dir', variant.locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const evidence = 'docs/work-packages/evidence/penpot-public-states'
    await mkdir(evidence, { recursive: true })
    await page.evaluate(() => scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    await page.screenshot({ path: `${evidence}/${variant.locale}-contact.png`, fullPage: true })
    await page.goto('/terms')
    const section = page.locator('.bs-public-legal-page__body section').first()
    await expect(section).toBeVisible()
    const measure = await section.evaluate(el => ({ width: el.getBoundingClientRect().width, max: getComputedStyle(el).maxInlineSize }))
    expect(measure.max).not.toBe('none')
    expect(measure.width).toBeLessThan(800)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${evidence}/${variant.locale}-terms.png`, fullPage: true })
  })
}
