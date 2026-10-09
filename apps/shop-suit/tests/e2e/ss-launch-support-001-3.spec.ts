import { expect, test } from '@playwright/test'

const copy = {
  en: { heading: 'Contact Us', subject: 'Subject', message: 'Message', email: 'Reply email', consent: 'I agree that', submit: 'Submit request', success: 'Your request was recorded', validation: 'Enter a valid reply email', rate: 'Please wait a few minutes', error: 'We could not record' },
  ar: { heading: 'تواصل معنا', subject: 'الموضوع', message: 'الرسالة', email: 'بريد الرد', consent: 'أوافق على', submit: 'إرسال الطلب', success: 'تم تسجيل طلبك', validation: 'اكتب بريد رد صالحًا', rate: 'انتظر بضع دقائق', error: 'تعذر تسجيل طلبك' },
}

for (const locale of ['en', 'ar'] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`Contact composition and durable submission: ${locale} ${viewport.width} ${theme}`, async ({ page, context }, testInfo) => {
        await page.setViewportSize(viewport)
        await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
        await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
        let outcome: 'success' | 'rate' | 'error' | 'pending' = 'success'
        let calls = 0
        let release: (() => void) | undefined
        let lastPayload: Record<string, unknown> = {}
        await page.route('http://127.0.0.1:61321/**', async (route) => {
          if (route.request().url().includes('/rpc/submit_support_request')) {
            calls++
            lastPayload = route.request().postDataJSON()
            if (outcome === 'pending') await new Promise<void>((resolve) => { release = resolve })
            if (outcome === 'rate') await route.fulfill({ status: 400, json: { message: 'SUPPORT_RATE_LIMITED' } })
            else if (outcome === 'error') await route.fulfill({ status: 500, json: { message: 'temporarily unavailable' } })
            // Notification failure must not invalidate the committed intake response.
            else await route.fulfill({ json: { ok: true, accepted: !lastPayload.p_honeypot, notification: 'not_configured' } })
          }
          else await route.fulfill({ json: [] })
        })
        await page.goto('/contact')
        const labels = copy[locale]
        const main = page.getByRole('main')
        await expect(main.getByRole('heading', { name: labels.heading, level: 1 })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        const form = main.locator('form')
        const field = main.getByLabel(labels.subject, { exact: true })
        const bounds = await form.boundingBox()
        const surface = await main.locator('section').first().boundingBox()
        expect(bounds).not.toBeNull()
        expect(surface).not.toBeNull()
        expect(bounds!.x - surface!.x).toBeGreaterThanOrEqual(24)
        expect(surface!.x + surface!.width - bounds!.x - bounds!.width).toBeGreaterThanOrEqual(24)
        await main.getByRole('heading', { name: locale === 'en' ? 'Send a support request' : 'إرسال طلب دعم' }).scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath(`contact-${locale}-${viewport.width}-${theme}.png`), fullPage: true })

        const submit = main.getByRole('button', { name: labels.submit, exact: true })
        await submit.click()
        await expect(main.getByRole('alert')).toContainText(labels.validation)
        expect(calls).toBe(0)
        await field.fill(locale === 'ar' ? 'طلب دعم تجريبي طويل' : 'Support request with a longer subject')
        await main.getByLabel(labels.message, { exact: true }).fill('Synthetic support message. رسالة دعم تجريبية.\n'.repeat(20))
        await main.getByLabel(labels.email, { exact: true }).fill('support-e2e@example.test')
        await main.getByLabel(new RegExp(labels.consent)).check()
        outcome = 'pending'
        await submit.click()
        await expect(form).toHaveAttribute('aria-busy', 'true')
        await expect(field).toBeDisabled()
        await expect.poll(() => Boolean(release)).toBe(true)
        outcome = 'success'
        release!()
        await expect(main.getByRole('status')).toContainText(labels.success)
        expect(calls).toBe(1)
        expect(lastPayload.p_consent).toBe(true)
        await expect(field).toHaveValue('')

        await field.fill('Retry')
        await main.getByLabel(labels.message, { exact: true }).fill('Synthetic retry')
        await main.getByLabel(new RegExp(labels.consent)).check()
        outcome = 'rate'
        await submit.click()
        await expect(main.getByRole('alert')).toContainText(labels.rate)
        await expect(field).toHaveValue('Retry')
        outcome = 'error'
        await submit.click()
        await expect(main.getByRole('alert')).toContainText(labels.error)
        outcome = 'success'
        await main.locator('label[aria-hidden="true"] input').evaluate((input: HTMLInputElement) => {
          input.value = 'synthetic-bot'; input.dispatchEvent(new Event('input', { bubbles: true }))
        })
        await submit.click()
        expect(lastPayload.p_honeypot).toBe('synthetic-bot')
        await expect(main.getByRole('status')).toContainText(labels.success)
      })
    }
  }
}
