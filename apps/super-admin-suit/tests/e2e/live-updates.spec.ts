import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
const owner = '11111111-1111-4111-8111-111111111111'
const environment = '22222222-2222-4222-8222-222222222222'
async function notifications(page: Page) {
  const sockets: WebSocketRoute[] = []
  let topic = '', join: unknown
  await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    sockets.push(socket)
    socket.onMessage(data => {
      if (typeof data !== 'string') return
      const [joinRef, ref, channel, event, payload] = JSON.parse(data)
      if (event === 'phx_join') {
        expect(payload.config.private).toBe(true)
        expect(payload.config.postgres_changes).toEqual([])
        expect(channel).toBe(`realtime:sas:${environment}`)
        topic = channel; join = joinRef
      }
      socket.send(JSON.stringify([joinRef, ref, channel, 'phx_reply', { status: 'ok', response: {} }]))
    })
  })
  return {
    sockets,
    send(kinds: string[], id = '33333333-3333-4333-8333-333333333333', authorityEnvironmentId = environment) {
      sockets.at(-1)!.send(JSON.stringify([join, null, topic, 'broadcast', { event: 'invalidate', payload: { id, authorityEnvironmentId, kinds } }]))
    },
  }
}
async function session(page: Page) {
  let allowed = true, checks = 0, registries = 0, held: Promise<void> | null = null
  await page.route('**/api/session', route => { checks++; return route.fulfill({ status: allowed ? 200 : 403, json: allowed ? { userId: owner, role: 'owner', authorityEnvironmentId: environment } : { statusCode: 403 } }) })
  await page.route('**/api/accounts/context', route => route.fulfill({ json: { modules: [] } }))
  await page.route('**/api/registry', async route => {
    registries++; if (held) await held
    await route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit' }, items: [
      { key: 'activity', label: { en: 'Activity' }, module: 'activity' },
      { key: 'payments', label: { en: 'Payments' }, module: 'payment-review', bindingId: owner },
    ] }] } })
  })
  return { deny() { allowed = false }, counts: () => ({ checks, registries }), hold(value: Promise<void> | null) { held = value } }
}
test('idle has no registry polling; notifications and reconnect preserve Activity filters, page and focus', async ({ page }) => {
  const live = await notifications(page), auth = await session(page)
  const queries: URLSearchParams[] = []
  await page.route('**/api/activity*', route => {
    queries.push(new URL(route.request().url()).searchParams)
    return route.fulfill({ json: { items: [{ id: 'synthetic', source: 'admin-adapter', suit: 'synthetic-suit', environment, actor: owner, action: 'synthetic.change', target: owner, status: 'succeeded', reason: '[redacted]', requestId: owner, correlationId: owner, occurredAt: '2026-10-01T12:00:00Z' }], total: 60, sources: [], coverage: 'partial' } })
  })
  await page.goto('/?suit=synthetic-suit&item=activity')
  const activity = page.locator('[data-activity]'), input = activity.locator('#activity-action')
  await expect(activity.getByRole('table')).toContainText('synthetic.change')
  await expect.poll(() => live.sockets.length).toBe(1)
  await input.fill('synthetic.change'); await activity.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await activity.locator('.bs-paginator').getByRole('button', { name: /next/i }).click()
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('2')
  await input.focus()
  await page.clock.install()
  await page.clock.runFor(1000)
  const before = auth.counts(), count = queries.length
  await page.clock.fastForward(90000)
  expect(auth.counts()).toEqual(before); expect(queries).toHaveLength(count)
  let release!: () => void
  auth.hold(new Promise<void>(resolve => { release = resolve }))
  live.send(['registry', 'activity']); await page.clock.runFor(300)
  await expect.poll(() => auth.counts().registries).toBe(before.registries + 1)
  await expect(input).toHaveValue('synthetic.change'); await expect(input).toBeFocused()
  await expect(activity.getByRole('table')).toContainText('synthetic.change')
  auth.hold(null); release()
  await expect.poll(() => queries.length).toBe(count + 1)
  expect(queries.at(-1)?.get('page')).toBe('2'); expect(queries.at(-1)?.get('action')).toBe('synthetic.change')
  await expect(input).toBeFocused()
  live.send(['activity'], '44444444-4444-4444-8444-444444444444', 'foreign')
  await page.clock.runFor(300); expect(queries).toHaveLength(count + 1)
  live.sockets[0].close()
  await page.clock.runFor(2000)
  await expect.poll(() => live.sockets.length).toBe(2)
  await page.clock.runFor(500)
  await expect.poll(() => queries.length).toBe(count + 2)
  await expect(input).toHaveValue('synthetic.change'); expect(queries.at(-1)?.get('page')).toBe('2')
  auth.deny(); live.send(['activity'], '55555555-5555-4555-8555-555555555555'); await page.clock.runFor(1000)
  await expect(activity.getByRole('table')).toHaveCount(0)
})
test('payment review draft survives live invalidation and focus; queued refresh resumes after close', async ({ page }) => {
  const live = await notifications(page); await session(page)
  let reads = 0
  await page.route('**/api/adapters/shop', route => {
    reads++
    return route.fulfill({ json: { data: { items: [{ id: owner, shopId: environment, shopName: 'Synthetic Shop', status: 'submitted', requestedPlanName: 'Synthetic plan', requestedPlanSlug: 'synthetic', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 150, effectivePriceAmount: 120, paidAmount: 120, transferDate: '2026-10-07', transferReference: 'Synthetic reference', priceSource: 'catalog', resourceLimits: {}, usageBlockers: [], evidence: [] }], total: 1, page: 1, pageSize: 25 } } })
  })
  await page.goto('/?suit=synthetic-suit&item=payments')
  await expect(page.getByRole('button', { name: 'Review payment', exact: true })).toBeVisible()
  await expect.poll(() => live.sockets.length).toBe(1)
  await page.clock.install(); await page.clock.runFor(1000)
  await page.getByRole('button', { name: 'Review payment', exact: true }).click()
  const dialog = page.getByRole('dialog'), input = dialog.locator('#billing-reason')
  await page.clock.runFor(500) // Let the existing modal opening focus settle.
  await input.fill('Preserve synthetic review draft'); await input.focus()
  const before = reads
  live.send(['registry', 'billing']); await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.clock.runFor(1000)
  expect(reads).toBe(before); await expect(dialog).toBeVisible(); await expect(input).toHaveValue('Preserve synthetic review draft'); await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('alert')).toContainText('Discard unsaved changes?')
  await dialog.getByRole('alert').getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.clock.runFor(1000)
  await expect.poll(() => reads).toBe(before + 1)
})
