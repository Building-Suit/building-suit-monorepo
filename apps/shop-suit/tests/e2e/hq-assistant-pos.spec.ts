import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const jobId = 'ac1884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const invoiceId = 'ac2884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const topic = 'realtime:shop-hq-assistant-chat:00000000-0000-4000-8000-000000000001:shop-1:location-1'
const prompt = 'عميل اسمه احمد محمد عمل شعر ودقن. دفع ٢٠٠ كاش.'
const createdAt = '2026-11-13T10:00:00.000Z'

test('the floating HQ conversation restores receipts and streams reviewed corrections', async ({ page }) => {
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
  const row = (sequence: number, role: 'user' | 'assistant', text: string) =>
    ({ sequence, jobId, createdAt, kind: 'message', role, text })
  const receipt = {
    sequence: 3, jobId, createdAt, role: 'assistant', kind: 'receipt', link: { destination: 'receipt', saleId: invoiceId },
  }
  const correction = 'راجعنا الفاتورة، والخدمتين متسجلين.'
  await page.route('**/api/assistant/hq/history', route => route.fulfill({ json: {
    messages: stage < 0 ? [] : [
      row(1, 'user', prompt),
      ...(stage >= 1 ? [row(2, 'assistant', 'حاضر، هراجع بيانات البيع.'), receipt] : []),
      ...(stage >= 2 ? [row(4, 'assistant', correction)] : []),
    ],
    hasMore: false,
    activeJobs: stage === 0 ? [{ jobId, state: 'working', reviewPending: false }]
      : stage === 1 ? [{ jobId, state: 'completed', reviewPending: true }] : [],
  } }))
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
  await expect(page.getByRole('log').getByText(prompt)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open receipt' })).toHaveCount(0)
  stage = 1
  wake()
  const link = page.getByRole('link', { name: 'Open receipt' })
  await expect(link).toHaveAttribute('href', `/sales/${invoiceId}/receipt?origin=assistant`)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(composer).toBeEditable()

  stage = 2
  wake()
  await expect(page.getByRole('log').getByText(correction)).toBeVisible()
  await expect(link).toHaveCount(1)
  expect(calls.some(call => ['save_pos_sale_draft', 'checkout_pos_sale'].includes(call.name))).toBe(false)
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/sales/${invoiceId}/receipt\\?origin=assistant$`))
  await expect(page.getByRole('button', { name: 'Print receipt', exact: true })).toBeEnabled()
  await expect(page.getByRole('log').getByText(correction)).toBeVisible()
  await expect.poll(() => joins).toBe(1)
})
