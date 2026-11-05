import { expect, test, type Locator, type Page } from '@playwright/test'
import { installWorkforceFixture, workforceSnapshot } from './workforce-fixture'

async function emit(page: Page, topic: string, data: unknown = {}) {
  await page.evaluate(({ topic, data }) => (window as unknown as { __hqWorkforceStream: { emit(topic: string, data: unknown): void } }).__hqWorkforceStream.emit(topic, data), { topic, data })
}

async function openChat(page: Page) {
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const composer = page.getByRole('textbox', { name: 'Message Steve', exact: true })
  await expect(composer).toBeEditable()
  await expect(page.getByText('Oracle worker connected', { exact: true })).toBeVisible()
  return composer
}

async function caret(composer: Locator, start: number, end = start) {
  await composer.evaluate((element, { start, end }) => (element as HTMLTextAreaElement).setSelectionRange(start, end), { start, end })
}
async function selection(composer: Locator) {
  return composer.evaluate(element => ({ start: (element as HTMLTextAreaElement).selectionStart, end: (element as HTMLTextAreaElement).selectionEnd }))
}

async function visibility(page: Page, hidden: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('held realtime snapshot never disables, blurs or resets selection/IME while typing', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const composer = await openChat(page)
  const reads = fixture.requests.filter(value => value === 'GET /api/hq/agents').length
  expect(reads).toBe(1)
  let release!: () => void, started = false
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/hq/agents', async route => {
    started = true
    await held
    const snapshot = fixture.snapshot()
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot,
      conversationId: '40000000-0000-4000-8000-000000000001',
      messages: [{ id: '50000000-0000-4000-8000-000000000011', role: 'founder', agentId: 'AG-CEO-001', text: 'Background snapshot arrived.', createdAt: new Date().toISOString(), replyTo: null }],
    }) })
  })
  await composer.fill('Before after')
  await caret(composer, 7)
  await composer.evaluate(element => {
    const state = { blurs: 0, disabled: false }
    Object.assign(window, { __chatInputTrace: state })
    element.addEventListener('blur', () => { state.blurs += 1 })
    new MutationObserver(() => { state.disabled ||= (element as HTMLTextAreaElement).disabled }).observe(element, { attributes: true, attributeFilter: ['disabled'] })
  })
  await emit(page, 'agents')
  await expect.poll(() => started).toBe(true)
  await expect(composer).toBeEditable()
  await composer.pressSequentially('steady typing ', { delay: 35 })
  await expect(composer).toHaveValue('Before steady typing after')
  await expect(composer).toBeFocused()
  await caret(composer, 7, 13)
  await composer.dispatchEvent('compositionstart')
  release()
  await expect(page.getByRole('log')).toContainText('Background snapshot arrived.')
  await expect(composer).toBeFocused()
  expect(await selection(composer)).toEqual({ start: 7, end: 13 })
  await expect(composer).toHaveValue('Before steady typing after')
  await composer.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  await composer.dispatchEvent('compositionend')
  await composer.pressSequentially('continuous')
  await expect(composer).toHaveValue('Before continuous typing after')
  expect(await page.evaluate(() => (window as unknown as { __chatInputTrace: { blurs: number; disabled: boolean } }).__chatInputTrace)).toEqual({ blurs: 0, disabled: false })
  expect(fixture.chatRequests).toEqual([])
  expect(fixture.errors).toEqual([])
})

test('send takes priority over a held background read and stale read cannot overwrite its acknowledgment', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const composer = await openChat(page)
  let release!: () => void, started = false, heldOnce = false
  const held = new Promise<void>(resolve => { release = resolve })
  const stale = workforceSnapshot()
  await page.route('**/api/hq/agents', async route => {
    if (heldOnce) return route.fallback()
    heldOnce = true; started = true
    await held
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(stale) }).catch(() => undefined)
  })
  await composer.fill('Send without waiting for an unrelated snapshot.')
  await emit(page, 'agents')
  await expect.poll(() => started).toBe(true)
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
  await composer.press('Enter')
  await expect.poll(() => fixture.chatRequests.length).toBe(1)
  await expect(composer).toHaveValue('')
  await expect(page.getByRole('log')).toContainText('Send without waiting for an unrelated snapshot.')
  release()
  await expect.poll(() => fixture.requests.filter(value => value === 'GET /api/hq/agents').length).toBeGreaterThan(1)
  await expect(page.getByRole('log')).toContainText('Send without waiting for an unrelated snapshot.')
  expect(fixture.errors).toEqual([])
})

test('transient read failure and stream reconnect preserve focused draft; offline preserves same-identity draft; revocation clears it', async ({ page, context }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const composer = await openChat(page)
  let failRead = true
  await page.route('**/api/hq/agents', route => failRead
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Fixture transient failure"}' })
    : route.fallback())
  await composer.fill('Keep this draft across recovery.')
  await caret(composer, 10, 15)
  await emit(page, 'agents')
  await expect(page.locator('.bs-hq-chat__notice')).toBeVisible()
  await expect(composer).toBeEditable()
  await expect(composer).toBeFocused()
  expect(await selection(composer)).toEqual({ start: 10, end: 15 })
  failRead = false
  const connections = await page.evaluate(() => (window as unknown as { __hqWorkforceStream: { connections: number } }).__hqWorkforceStream.connections)
  await visibility(page, true)
  await visibility(page, false)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __hqWorkforceStream: { connections: number } }).__hqWorkforceStream.connections)).toBeGreaterThan(connections)
  await expect(page.locator('.bs-hq-chat__notice')).toHaveCount(0)
  await expect(composer).toHaveValue('Keep this draft across recovery.')
  await expect(composer).toBeFocused()
  expect(await selection(composer)).toEqual({ start: 10, end: 15 })
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(composer).toHaveCount(0)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('Founder fixture', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(composer).toHaveValue('Keep this draft across recovery.')
  let revoked = true
  await page.route('**/api/hq/access', route => revoked
    ? route.fulfill({ contentType: 'application/json', body: '{"status":"anonymous"}' })
    : route.fallback())
  await emit(page, 'access')
  await expect(composer).toHaveCount(0)
  revoked = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('Founder fixture', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(composer).toHaveValue('')
  expect(fixture.errors).toEqual([])
})

test('authenticated liveness frames keep typing uninterrupted without agents or company snapshot reads', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const composer = await openChat(page)
  await composer.fill('Presence is not a reason to reload my composer.')
  await caret(composer, 8)
  const reads = fixture.requests.filter(value => value === 'GET /api/hq/agents' || value === 'GET /api/hq/company').length
  await emit(page, 'presence', { observedAt: new Date().toISOString(), agentId: null, taskId: null })
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('Presence is not a reason to reload my composer.')
  expect(await selection(composer)).toEqual({ start: 8, end: 8 })
  await page.waitForTimeout(150)
  expect(fixture.requests.filter(value => value === 'GET /api/hq/agents' || value === 'GET /api/hq/company')).toHaveLength(reads)
  expect(fixture.errors).toEqual([])
})
