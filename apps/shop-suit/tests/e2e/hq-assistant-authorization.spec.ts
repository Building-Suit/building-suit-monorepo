import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

for (const locale of ['en', 'ar'] as const) {
  test(`owner grants and withdraws authorization for the HQ agent in ${locale}`, async ({ page }) => {
    const arabic = locale === 'ar'
    await page.setViewportSize({ width: arabic ? 390 : 1440, height: 900 })
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), arabic ? 'dark' : 'light')
    await pilotFixture(page, locale)

    let enabled = false
    const changes: boolean[] = []
    await page.route('**/api/assistant/hq/access', route => {
      const request = route.request().postDataJSON()
      expect(request.shopId).toBe('shop-1')
      expect(request.locationId).toBe('location-1')
      if (typeof request.enabled === 'boolean') {
        enabled = request.enabled
        changes.push(enabled)
      }
      return route.fulfill({ json: { enabled, agentName: 'Shop Suit Agent' } })
    })

    const prompt = arabic ? 'عميل اسمه أحمد محمد عمل شعر ودقن' : 'A customer named Ahmed Mohamed got a haircut and beard trim.'
    let submissions = 0
    await page.route('**/api/assistant/hq/requests', route => {
      expect(enabled).toBe(true)
      expect(route.request().postDataJSON()).toMatchObject({
        shopId: 'shop-1', locationId: 'location-1',
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        messages: [{ role: 'user', content: prompt }],
      })
      submissions++
      return route.fulfill({ status: 202, json: { jobId: 'synthetic-hq-job' } })
    })
    await page.route('**/api/assistant/hq/recent', route => route.fulfill({ json: [] }))
    let statusReads = 0
    const reply = arabic ? 'تحب تسجّل البيع في الفرع ده؟' : 'Is this sale for the current branch?'
    await page.route('**/api/assistant/hq/result', route => {
      expect(route.request().postDataJSON()).toEqual({
        shopId: 'shop-1', locationId: 'location-1', jobId: 'synthetic-hq-job',
      })
      statusReads++
      return route.fulfill({ json: { state: 'completed', reviewPending: false, updates: [{ sequence: 1, kind: 'reply', text: reply }] } })
    })

    await fixtureGoto(page, '/assistant')
    const enable = page.getByRole('button', { name: arabic ? 'أوافق وأفعّل المساعد' : 'Authorize and enable' })
    const composer = page.getByRole('textbox', { name: arabic ? 'رسالتك' : 'Your message' })
    await expect(enable).toBeVisible()
    await expect(composer).toHaveCount(0)
    await expect(page.getByRole('link', { name: arabic ? 'سياسة الخصوصية' : 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    await expect(page.getByRole('link', { name: arabic ? 'الشروط والأحكام' : 'Terms & Conditions' })).toHaveAttribute('href', '/terms')
    await expectNoPageOverflow(page)
    const evidence = '.local/atomic-template-evidence/screenshots'
    await mkdir(evidence, { recursive: true })
    await page.screenshot({ path: `${evidence}/hq-assistant-authorization-${locale}.png`, animations: 'disabled' })

    await enable.click()
    await composer.fill(prompt)
    await composer.press('Enter')
    await expect(page.getByRole('log').getByText(reply)).toBeVisible()
    expect(submissions).toBe(1)
    expect(statusReads).toBeGreaterThan(0)

    await page.getByRole('button', { name: arabic ? 'إيقاف المساعد' : 'Turn off agent' }).click()
    await expect(enable).toBeVisible()
    await expect(composer).toHaveCount(0)
    await expect(page.getByText(reply)).toHaveCount(0)
    expect(changes).toEqual([true, false])
  })
}
