import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const createdAt = '2026-11-13T10:00:00.000Z'
const jobId = 'ac1884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const priorJob = 'bc1884b0-d3a8-4d8a-8f77-586eb01ee7cd'

for (const locale of ['en', 'ar'] as const) {
  test(`floating HQ chat saves history across navigation, reload and authorization changes in ${locale}`, async ({ page }, testInfo) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width: ar ? 390 : 1440, height: 850 })
    if (ar) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), ar ? 'dark' : 'light')
    await pilotFixture(page, locale)

    const launcher = page.getByRole('button', { name: ar ? 'افتح محادثة مساعد شوب سوت' : 'Open Shop Suit Agent chat' })
    const close = page.getByRole('button', { name: ar ? 'اقفل المحادثة' : 'Close chat', exact: true })
    const enable = page.getByRole('button', { name: ar ? 'أوافق وأفعّل المساعد' : 'Authorize and enable' })
    const composer = page.getByRole('textbox', { name: ar ? 'رسالتك' : 'Your message' })
    const prompt = ar ? 'عميل اسمه أحمد محمد عمل شعر ودقن' : 'A customer named Ahmed Mohamed got a haircut and beard trim.'
    const reply = ar ? 'سجّل البيع في الفرع الحالي.' : 'Record the sale at the current branch.'
    const recent = ar ? 'رسالة محفوظة' : 'Saved message'
    const earlier = ar ? 'رسالة أقدم' : 'Earlier saved message'
    const changes: boolean[] = []
    let enabled = false
    let queueAvailable = true
    let submissions = 0
    let earlierReads = 0
    const acceptRequest = Promise.withResolvers<undefined>()

    await page.route('**/api/assistant/hq/access', route => {
      const request = route.request().postDataJSON()
      expect(request.shopId).toBe('shop-1')
      if (typeof request.enabled === 'boolean') {
        enabled = request.enabled
        changes.push(enabled)
      }
      return route.fulfill({ json: { enabled, agentName: 'Shop Suit Agent', queueAvailable } })
    })
    await page.route('**/api/assistant/hq/history', route => {
      const request = route.request().postDataJSON()
      const first = request.locationId === 'location-1'
      const item = (sequence: number, text: string, role: 'user' | 'assistant', id = jobId) =>
        ({ sequence, jobId: id, createdAt, kind: 'message', role, text })
      if (first && request.beforeSequence === 2) {
        earlierReads++
        return route.fulfill({ json: { messages: [item(1, earlier, 'user', priorJob)], hasMore: false, activeJobs: [] } })
      }
      return route.fulfill({ json: {
        messages: first ? [item(2, recent, 'assistant', priorJob), ...(submissions ? [item(3, prompt, 'user'), item(4, reply, 'assistant')] : [])] : [],
        hasMore: first,
        activeJobs: [],
      } })
    })
    await page.route('**/api/assistant/hq/requests', async route => {
      expect(enabled).toBe(true)
      expect(route.request().postDataJSON()).toEqual({
        shopId: 'shop-1', locationId: 'location-1', requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), message: prompt,
      })
      await acceptRequest.promise
      submissions++
      return route.fulfill({ status: 202, json: { jobId } })
    })

    await fixtureGoto(page, '/dashboard')
    await expect(launcher).toBeVisible()
    await expect(composer).toHaveCount(0)
    await launcher.click()
    await expect(enable).toBeVisible()
    await expect(page.getByRole('log').getByText(recent)).toBeVisible()
    await expect(composer).toHaveCount(0)
    await expect(page.getByRole('link', { name: ar ? 'سياسة الخصوصية' : 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    await expect(page.getByRole('link', { name: ar ? 'الشروط والأحكام' : 'Terms & Conditions' })).toHaveAttribute('href', '/terms')
    await page.getByRole('button', { name: ar ? 'اعرض الرسائل الأقدم' : 'Load earlier messages' }).click()
    await expect(page.getByRole('log').getByText(earlier)).toBeVisible()
    expect(earlierReads).toBe(1)
    await expectNoPageOverflow(page)
    const evidence = '.local/atomic-template-evidence/screenshots'
    await mkdir(evidence, { recursive: true })
    await page.screenshot({ path: `${evidence}/hq-assistant-floating-${locale}.png`, animations: 'disabled' })

    await enable.click()
    await composer.fill(prompt)
    await composer.press('Enter')
    try {
      const typing = page.getByRole('log').locator('.bs-assistant-chat__typing')
      await expect(typing).toBeVisible()
      if (ar) await expect(typing.locator('span').first()).toHaveCSS('animation-name', 'none')
    } finally {
      acceptRequest.resolve(undefined)
    }
    await expect(page.getByRole('log').getByText(reply)).toBeVisible()
    await expect(page.getByRole('log').locator('time').last()).toHaveAttribute('datetime', createdAt)
    await page.screenshot({ path: testInfo.outputPath(`floating-assistant-${locale}.png`), animations: 'disabled' })
    expect(submissions).toBe(1)

    await close.click()
    await expect(launcher).toBeFocused()
    await expect(page.getByRole('log')).toHaveCount(0)
    await page.goto('/assistant')
    await expect(page).toHaveURL(/\/dashboard\?assistant=open$/)
    await expect(page.getByRole('log').getByText(reply)).toBeVisible()

    await page.getByRole('button', { name: ar ? 'إيقاف المساعد' : 'Turn off agent' }).click()
    await expect(enable).toBeVisible()
    await expect(composer).toHaveCount(0)
    await expect(page.getByRole('log').getByText(reply)).toBeVisible()
    expect(changes).toEqual([true, false])

    queueAvailable = false
    await fixtureGoto(page, '/dashboard')
    await launcher.click()
    await expect(page.getByRole('log').getByText(reply)).toBeVisible()
    await expect(composer).toHaveCount(0)
    await expect(page.getByRole('log').getByText(recent)).toBeVisible()

    if (!ar) {
      const location = page.getByRole('combobox', { name: 'Location', exact: true }).first()
      await location.click()
      await page.getByRole('option', { name: 'Second branch', exact: true }).click()
      await expect(page.getByRole('log').getByText(reply)).toHaveCount(0)
      await location.click()
      await page.getByRole('option', { name: 'First branch', exact: true }).click()
      await expect(page.getByRole('log').getByText(reply)).toBeVisible()
    }
  })
}

test('employees cannot open the owner conversation', async ({ page }) => {
  await pilotFixture(page, 'en', 'employee')
  await fixtureGoto(page, '/dashboard?assistant=open')
  await expect(page.getByRole('button', { name: 'Open Shop Suit Agent chat', exact: true })).toHaveCount(0)
  await expect(page.getByRole('log')).toHaveCount(0)
})
