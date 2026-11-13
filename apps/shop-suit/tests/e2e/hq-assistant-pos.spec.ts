import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const jobId = 'ac1884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const navigationJobId = 'ac3884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const invoiceId = 'ac2884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const topic = 'realtime:shop-hq-assistant-chat:00000000-0000-4000-8000-000000000001:shop-1:location-1'
const prompt = 'عميل اسمه احمد محمد عمل شعر ودقن. دفع ٢٠٠ كاش.'

test('the floating HQ conversation shows replies promptly, dates the history and groups action links', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 430, height: 750 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const now = Date.now()
  const recentTime = new Date(now - 10 * 60_000).toISOString()
  const olderTime = new Date(now - 2 * 86_400_000).toISOString()
  const { calls } = await pilotFixture(page, 'en')
  let wake = () => { throw new Error('Realtime subscription not ready') }
  let joins = 0
  await page.routeWebSocket('**/realtime/v1/websocket**', socket => {
    socket.onMessage(raw => {
      const frame = JSON.parse(String(raw))
      const [joinRef, ref, channel, event, payload] = Array.isArray(frame)
        ? frame : [frame.join_ref, frame.ref, frame.topic, frame.event, frame.payload]
      function send(name: string, value: unknown, responseRef: string | null = null) {
        socket.send(JSON.stringify(Array.isArray(frame)
          ? [joinRef, responseRef, channel, name, value]
          : { join_ref: joinRef, ref: responseRef, topic: channel, event: name, payload: value }))
      }
      if (event === 'phx_join' && channel === topic) {
        expect(payload.config.private).toBe(true)
        wake = () => send('broadcast', { event: 'chat', payload: {} })
        joins++
        send('phx_reply', { status: 'ok', response: {} }, ref)
      } else if (event === 'heartbeat' || event === 'phx_leave') {
        send('phx_reply', { status: 'ok', response: {} }, ref)
      }
    })
  })
  await page.route('**/api/assistant/hq/access', route => route.fulfill({
    json: { enabled: true, agentName: 'Shop Suit Agent', queueAvailable: true },
  }))
  let stage = -1
  let reads = 0
  const row = (sequence: number, role: 'user' | 'assistant', text: string) =>
    ({ sequence, jobId, createdAt: olderTime, kind: 'message', role, text })
  const receipt = {
    sequence: 3, jobId, createdAt: olderTime, role: 'assistant', kind: 'receipt', link: { destination: 'receipt', saleId: invoiceId },
  }
  const correction = 'راجعنا الفاتورة، والخدمتين متسجلين.'
  await page.route('**/api/assistant/hq/history', route => {
    reads++
    return route.fulfill({ json: {
      messages: stage < 0 ? [] : [
        row(1, 'user', prompt),
        ...(stage >= 1 ? [row(2, 'assistant', 'حاضر، هراجع بيانات البيع.')] : []),
        ...(stage >= 2 ? [receipt] : []),
        ...(stage >= 3 ? [row(4, 'assistant', correction)] : []),
        ...(stage >= 4 ? [
          { ...row(5, 'assistant', 'Open a sales page.'), jobId: navigationJobId, createdAt: recentTime },
          { sequence: 6, jobId: navigationJobId, createdAt: recentTime, role: 'assistant', kind: 'action', link: { destination: 'sales' } },
          { sequence: 7, jobId: navigationJobId, createdAt: recentTime, role: 'assistant', kind: 'action', link: { destination: 'reports' } },
        ] : []),
      ],
      hasMore: false,
      activeJobs: stage === 0 || stage === 1 ? [{ jobId, state: 'working', reviewPending: false }]
        : stage === 2 ? [{ jobId, state: 'completed', reviewPending: true }] : [],
    } })
  })
  await page.route('**/api/assistant/hq/requests', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      shopId: 'shop-1', locationId: 'location-1', message: prompt,
    })
    stage = 0
    return route.fulfill({ status: 202, json: { jobId } })
  })

  await fixtureGoto(page, '/dashboard?assistant=open')
  const composer = page.getByRole('textbox', { name: 'Your message' })
  await composer.fill(prompt)
  await composer.press('Enter')
  await expect.poll(() => joins).toBe(1)
  const log = page.getByRole('log', { name: 'Conversation' })
  const typing = log.locator('.bs-assistant-chat__typing')
  const acknowledgment = 'حاضر، هراجع بيانات البيع.'
  const link = log.getByRole('link', { name: 'Open receipt' })
  await expect(log.getByText(prompt)).toBeVisible()
  await expect(log.locator('.bs-assistant-chat__day')).toHaveCount(1)
  await expect(log.locator('time').first()).toHaveAttribute('datetime', olderTime)
  await expect(log.locator('time').first()).toContainText('2 days ago')
  const chatHeight = (await page.getByRole('region', { name: 'Shop Suit Agent' }).first().boundingBox())?.height ?? 0
  expect(chatHeight).toBeGreaterThan(650)
  await expect(typing).toBeVisible()
  await expect(typing.locator('span')).toHaveCount(3)
  await expect(typing.locator('span').first()).toHaveCSS('animation-iteration-count', 'infinite')
  await expect(page.getByRole('status').filter({ hasText: 'Shop Suit Agent is typing' })).toHaveCount(1)
  const readsBeforeAcknowledgment = reads
  stage = 1
  wake()
  await expect.poll(() => reads).toBeGreaterThan(readsBeforeAcknowledgment)
  await expect(typing).toHaveCount(0)
  await expect(page.getByText('Request under review', { exact: true })).toHaveCount(0)
  await expect(composer).toHaveAttribute('readonly', '')
  await expect(log.getByText(acknowledgment)).toBeVisible()
  await expect(link).toHaveCount(0)
  stage = 2
  wake()
  await expect(link).toHaveAttribute('href', `/sales/${invoiceId}/receipt?origin=assistant`)
  const reply = log.getByRole('listitem').filter({ hasText: acknowledgment })
  await expect(reply).toContainText('The sale was recorded.')
  await expect(reply.getByRole('link')).toHaveCount(1)
  await expect(typing).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(composer).toBeEditable()

  stage = 3
  wake()
  await expect(log.getByText(correction)).toBeVisible()
  await expect(log.getByRole('listitem').filter({ hasText: correction }).getByRole('link')).toHaveCount(0)
  await expect(link).toHaveCount(1)
  expect(calls.some(call => ['save_pos_sale_draft', 'checkout_pos_sale'].includes(call.name))).toBe(false)
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/sales/${invoiceId}/receipt\\?origin=assistant$`))
  await expect(page.getByRole('button', { name: 'Print receipt', exact: true })).toBeEnabled()
  await expect(page.getByRole('log').getByText(correction)).toBeVisible()
  await expect.poll(() => joins).toBe(1)

  stage = 4
  wake()
  const navigation = log.getByRole('listitem').filter({ hasText: 'Open a sales page.' })
  await expect(navigation.getByRole('link', { name: 'Sales', exact: true })).toHaveAttribute('href', '/sales')
  await expect(navigation.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute('href', '/reports')
  await expect(navigation.locator('time')).toContainText('10 min.')
  await expect(log.locator('.bs-assistant-chat__day')).toHaveCount(2)
  await expect(navigation.getByRole('link', { name: 'Reports', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('floating-assistant-narrow-dark.png'), animations: 'disabled' })
})

test('the Arabic product activation link opens the business mode settings', async ({ page }) => {
  await pilotFixture(page, 'ar', 'owner', name => name === 'shop_permission_access' ? { 'settings.manage': true } : undefined)
  await page.route('**/api/assistant/hq/access', route => route.fulfill({
    json: { enabled: true, agentName: 'Shop Suit Agent', queueAvailable: true },
  }))
  const createdAt = new Date().toISOString()
  await page.route('**/api/assistant/hq/history', route => route.fulfill({
    json: {
      messages: [
        { sequence: 1, jobId, createdAt, role: 'assistant', kind: 'message', text: 'اختار «منتجات وخدمات»، واضغط «حفظ طريقة التشغيل».' },
        { sequence: 2, jobId, createdAt, role: 'assistant', kind: 'action', link: { destination: 'business-mode' } },
      ],
      hasMore: false, activeJobs: [],
    },
  }))
  await fixtureGoto(page, '/dashboard?assistant=open')
  const link = page.getByRole('log').getByRole('link', { name: 'افتح طريقة تشغيل النشاط', exact: true })
  await expect(link).toHaveAttribute('href', '/settings/business-mode')
  await link.click()
  await expect(page).toHaveURL(/\/settings\/business-mode$/)
  await page.getByRole('button', { name: 'اقفل المحادثة', exact: true }).click()
  const settings = page.locator('#business-mode')
  await expect(settings.getByRole('radio', { name: /^خدمات فقط/ })).toBeChecked()
  await settings.getByRole('radio', { name: /^منتجات وخدمات/ }).check()
  await expect(settings.getByRole('button', { name: 'حفظ طريقة التشغيل', exact: true })).toBeEnabled()
})
