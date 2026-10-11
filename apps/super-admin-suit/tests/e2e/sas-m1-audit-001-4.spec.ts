import { test, expect } from '@playwright/test'
const id = '11111111-1111-4111-8111-111111111111'
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) test(`activity ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
  await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
  await page.route('**/api/session', route => route.fulfill({ json: { userId: 'synthetic-owner', role: 'owner', authorityEnvironmentId: id } }))
  await page.route('**/api/registry', route => route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit', ar: 'حزمة اختبار' }, items: [{ key: 'activity', label: { en: 'Activity', ar: 'النشاط' }, module: 'activity' }] }] } }))
  let status = 200, empty = false, delayed = false
  const queries: URLSearchParams[] = []
  await page.route('**/api/activity*', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ bindingId: id, stream: 'billing' })
      await route.fulfill({ status: 503, json: { status: 'unavailable', coverage: 'partial' } }); return
    }
    queries.push(new URL(route.request().url()).searchParams)
    if (delayed) await new Promise(resolve => setTimeout(resolve, 800))
    await route.fulfill({ status, json: status !== 200 ? { statusCode: status } : { items: empty ? [] : [{ id: 'admin:synthetic', source: 'admin-adapter', suit: 'synthetic-suit', environment: id, actor: id, action: 'shop.billing.command.review', target: id, status: 'target_rejected', reason: '[redacted]', requestId: id, correlationId: id, occurredAt: '2026-10-01T12:00:00Z' }], total: empty ? 0 : 60, page: 1, pageSize: 25, coverage: 'partial', sources: [{ bindingId: id, suit: 'synthetic-suit', environment: id, stream: 'billing', nextPage: 2, lastObservedAt: null, lastFailedAt: null, observedTotal: null, coverage: 'partial' }] } })
  })
  const url = '/?suit=synthetic-suit&item=activity'
  await page.goto(url)
  const activity = page.locator('[data-activity]')
  await expect(activity.getByRole('table')).toContainText('target_rejected')
  await expect(activity.getByRole('table')).toContainText('[redacted]')
  await expect(activity.getByRole('button', { name: /edit|delete|تعديل|حذف/i })).toHaveCount(0)
  await expect(activity).toContainText(locale === 'en' ? 'Remote observations are partial' : 'السجلات البعيدة جزئية')
  await page.screenshot({ path: `/tmp/sas-audit-${locale}-${mobile}-records.png`, fullPage: true })
  const filter = activity.getByRole('button', { name: locale === 'en' ? 'Apply filters' : 'تطبيق المرشحات', exact: true })
  await filter.focus(); await expect(filter).toBeFocused()
  await activity.locator('#activity-action').fill('billing.review')
  await filter.click()
  await expect.poll(() => queries.at(-1)?.get('action')).toBe('billing.review')
  await activity.locator('.bs-paginator').getByRole('button', { name: /next|التالي/i }).click()
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('2')
  await activity.locator('[data-activity-source] button').click()
  await expect(activity.getByRole('alert')).toContainText(locale === 'en' ? 'Remote retrieval failed' : 'فشل جلب السجلات')
  empty = true
  await page.goto(url)
  await expect(activity.locator('[data-state="empty"]')).toBeVisible()
  await page.screenshot({ path: `/tmp/sas-audit-${locale}-${mobile}-empty.png`, fullPage: true })
  status = 503
  await page.goto(url)
  await expect(activity.locator('[data-state="error"]')).toBeVisible()
  await page.screenshot({ path: `/tmp/sas-audit-${locale}-${mobile}-error.png`, fullPage: true })
  status = 200; delayed = true; empty = false
  await activity.locator('[data-state="error"] button').click()
  await expect(activity.locator('[data-state="loading"]')).toBeVisible()
  await expect(activity.getByRole('table')).toBeVisible()
  status = 403; delayed = false
  await page.goto(url)
  await expect(activity.locator('[data-state="denied"]')).toBeVisible()
  await expect(activity.getByRole('table')).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
