import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const jobId = 'ac1884b0-d3a8-4d8a-8f77-586eb01ee7cd'
const invoiceId = 'sale-1'
const topic = 'realtime:shop-hq-assistant-owner:' + jobId
const prompt = 'عميل اسمه احمد محمد عمل شعر ودقن. دفع ٢٠٠ كاش.'

test('HQ posts a receipt and a later reviewed correction in the same chat', async ({ page }) => {
  const { calls } = await pilotFixture(page, 'en')
  let wake = () => { throw new Error('Realtime subscription not ready') }
  let subscribed = false
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
        wake = () => send('broadcast', { event: 'reply', payload: {} })
        subscribed = true
        send('phx_reply', { status: 'ok', response: {} }, ref)
      } else if (event === 'heartbeat') {
        send('phx_reply', { status: 'ok', response: {} }, ref)
      }
    })
  })
  await page.route('**/api/assistant/hq/access', route => route.fulfill({ json: { enabled: true, agentName: 'Shop Suit Agent' } }))
  await page.route('**/api/assistant/hq/recent', route => route.fulfill({ json: [] }))
  await page.route('**/api/assistant/hq/requests', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      shopId: 'shop-1', locationId: 'location-1', messages: [{ role: 'user', content: prompt }],
    })
    return route.fulfill({ status: 202, json: { jobId } })
  })
  let stage = 0
  const receipt = { sequence: 2, kind: 'receipt', invoiceId }
  const correction = { sequence: 3, kind: 'reply', text: 'راجعنا الفاتورة، والخدمتين متسجلين.' }
  await page.route('**/api/assistant/hq/result', route => route.fulfill({
    json: {
      state: stage ? 'completed' : 'working',
      reviewPending: stage === 1,
      updates: stage ? [
        { sequence: 1, kind: 'reply', text: 'حاضر، هراجع بيانات البيع.' }, receipt,
        ...(stage === 2 ? [correction] : []),
      ] : [],
    },
  }))

  await fixtureGoto(page, '/assistant')
  const composer = page.getByRole('textbox', { name: 'Your message' })
  await composer.fill(prompt)
  await composer.press('Enter')
  await expect.poll(() => subscribed).toBe(true)
  await expect(page.getByRole('log').getByText(prompt)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open receipt' })).toHaveCount(0)
  stage = 1
  wake()
  const link = page.getByRole('link', { name: 'Open receipt' })
  await expect(link).toHaveAttribute('href', '/sales/sale-1/receipt?origin=assistant')
  await expect(page).toHaveURL(/\/assistant$/)
  await expect(composer).toBeEditable()

  stage = 2
  wake()
  await expect(page.getByRole('log').getByText(correction.text)).toBeVisible()
  await expect(link).toHaveCount(1)
  expect(calls.some(call => ['save_pos_sale_draft', 'checkout_pos_sale'].includes(call.name))).toBe(false)
  await link.click()
  await expect(page).toHaveURL(/\/sales\/sale-1\/receipt\?origin=assistant$/)
  await expect(page.getByRole('button', { name: 'Print receipt', exact: true })).toBeEnabled()
})
