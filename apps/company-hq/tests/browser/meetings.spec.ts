import { expect, test, type Locator, type Page } from '@playwright/test'

const base = process.env.HQ_MEETING_PREVIEW_URL ?? 'http://127.0.0.1:4347'
const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
const panel = (page: Page) => page.locator('.bs-hq-meeting')
const externalRequests = new WeakMap<Page, string[]>()
type Snapshot = {
  mode: string
  registry: { id: string; name: string }[]
  record: {
    id: string; founderId: string; title: string; language: string; status: string; generation: number
    plans: { version: number; hash: string; status: string; tasks: { id: string }[] }[]
    participants: { id: string; name: string; status: string }[]
    tasks: { id: string; kind: string; status: string; agentId: string }[]
    events: { type: string; speakerId?: string; data: Record<string, unknown> }[]
  } | null
  receipts: { id: string; status: string; reviews?: unknown[] }[]
  reports: unknown[]
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(async requestHeaders => {
    const response = await fetch('/api/hq/meetings/demo', { headers: requestHeaders, credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error(`Synthetic snapshot failed: ${response.status}`)
    return response.json()
  }, headers)
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown } | null)?.__vue_app__))
}

async function openMeeting(page: Page, options: { mobile?: boolean } = {}) {
  if (options.mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForHydration(page)
  const entry = page.locator('.bs-hq-layout__ceo')
  await expect(entry).toBeEnabled()
  await entry.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).locator('[data-mode="demonstration"]')).toBeVisible()
  await expect(panel(page).locator('form').first().locator('button[type="submit"]')).toBeEnabled()
  return panel(page)
}

async function startMeeting(page: Page, title: string) {
  const setup = panel(page).locator('form').first()
  await setup.locator('input[maxlength="160"]').fill(title)
  await setup.locator('button[type="submit"]').click()
  await expect(panel(page).locator('.bs-hq-meeting__tiles')).toBeVisible()
  await expect.poll(async () => (await snapshot(page)).record?.title).toBe(title)
}

async function choose(select: Locator, page: Page, name: string) {
  await select.click()
  await page.getByRole('option', { name: name === 'English' ? /English|الإنجليزية|الإنجليزي/ : name, exact: name !== 'English' }).click()
}

async function sendText(page: Page, value: string) {
  const input = panel(page).locator('textarea[maxlength="4000"][rows="3"]')
  await input.fill(value)
  await input.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
  await expect(panel(page).getByText(value, { exact: true })).toBeVisible()
}

async function draftPlan(page: Page, title: string) {
  const details = panel(page).locator('details:has(input[maxlength="160"])')
  await details.locator('summary').click()
  const form = details.locator('form')
  await form.locator('input[maxlength="160"]').fill(title)
  await choose(form.getByRole('combobox'), page, 'Noah')
  await form.locator('textarea').nth(0).fill('Inspect only the disposable synthetic repository fixture')
  await form.locator('textarea').nth(1).fill('Persist a synthetic evidence report for independent review')
  await form.locator('button[type="submit"]').click()
  await expect(panel(page).locator('.bs-hq-meeting__plan > strong')).toHaveText(title)
}

async function confirmDecision(page: Page, index: number) {
  const plan = panel(page).locator('.bs-hq-meeting__plan')
  await plan.locator('.bs-hq-meeting__toolbar button').nth(index).click()
  await expect(page.getByRole('dialog')).toHaveCount(2)
  const confirmation = page.getByRole('dialog').last()
  await expect(confirmation).toBeVisible()
  // The exact version and immutable digest must be read back before consent.
  const record = (await snapshot(page)).record!
  await expect(confirmation).toContainText(String(record.plans.at(-1)!.version))
  await expect(confirmation).toContainText(record.plans.at(-1)!.hash)
  await confirmation.locator('button').last().click()
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await panel(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
}

test.beforeEach(async ({ page, context }) => {
  externalRequests.set(page, [])
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: new URL(base).hostname, path: '/' }])
  await page.addInitScript(() => {
    // Exercise the real documented scene fallback: these tests cover the meeting,
    // and do not benchmark the unrelated spatial WebGL renderer in headless CI.
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(contextId)) return null
      return getContext.call(this, contextId, ...args)
    } as typeof getContext
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, '__meetingMicrophoneCalls', { value: 0, writable: true })
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
      ;(window as unknown as { __meetingMicrophoneCalls: number }).__meetingMicrophoneCalls++
      throw new Error('Browser verification never captures real microphone audio')
    }
  })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
    externalRequests.get(page)?.push(url.origin)
    return route.abort('blockedbyclient')
  })
})

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) expect(await page.evaluate(() => (window as unknown as { __meetingMicrophoneCalls: number }).__meetingMicrophoneCalls)).toBe(0)
  expect(externalRequests.get(page) ?? []).toEqual([])
})

test('Arabic default, canonical identities, text fallback and English change in the actual HQ dialog', async ({ page }) => {
  const meeting = await openMeeting(page)
  await expect(meeting).toHaveAttribute('dir', 'rtl')
  await expect(meeting).toHaveAttribute('lang', 'ar')
  for (const name of ['Steve', 'Amaya', 'Noah']) await expect(meeting.getByRole('checkbox', { name: new RegExp(`^${name}`) })).toBeChecked()
  const source = await snapshot(page)
  expect(source.registry.find(item => item.name === 'Steve')?.id).toBe('AG-CEO-001')
  expect(source.registry.find(item => item.name === 'Amaya')?.id).toBe('AG-HR-001')
  expect(source.registry.find(item => item.name === 'Noah')?.id).toBe('AG-HR-002')
  await assertNoOverflow(page)
  await page.screenshot({ path: '/workspace/scratch/hq-meeting-arabic.png' })
  await startMeeting(page, 'اجتماع عربي للاختبار المصطنع')
  await sendText(page, 'Steve, summarize the synthetic meeting scope.')
  await expect.poll(async () => (await snapshot(page)).record?.events.filter(event => event.type === 'agent-contribution').at(-1)?.data.agentId).toBe('AG-CEO-001')
  await expect(meeting.locator('.bs-hq-meeting__log').first()).toContainText(/SYNTHETIC|تجريبي/)
  await choose(meeting.locator('.bs-hq-meeting__toolbar').first().getByRole('combobox'), page, 'English')
  await expect(meeting).toHaveAttribute('dir', 'ltr')
  await expect.poll(async () => (await snapshot(page)).record?.language).toBe('en')
  await expect(meeting.locator('.bs-hq-meeting__tiles article').filter({ hasText: 'Amaya' })).toBeVisible()
  await assertNoOverflow(page)
  await page.screenshot({ path: '/workspace/scratch/hq-meeting-english.png' })
})

test('mobile Arabic keyboard interaction and unavailable audio keep text usable', async ({ page }) => {
  const meeting = await openMeeting(page, { mobile: true })
  await expect(meeting).toHaveAttribute('dir', 'rtl')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.bs-hq-layout__ceo')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(meeting).toBeVisible()
  await startMeeting(page, 'اجتماع الجوال المصطنع')
  const input = meeting.locator('textarea[maxlength="4000"][rows="3"]')
  await input.focus()
  await expect(input).toBeFocused()
  await page.keyboard.type('Synthetic mobile text remains available.')
  await input.locator('xpath=ancestor::form').locator('button[type="submit"]').focus()
  await page.keyboard.press('Enter')
  await expect(meeting.getByText('Synthetic mobile text remains available.', { exact: true })).toBeVisible()
  await assertNoOverflow(page)
  await page.screenshot({ path: '/workspace/scratch/hq-meeting-mobile-arabic.png' })
})

test('persisted research raises a hand through events while discussion continues and links retain attribution', async ({ page }) => {
  const meeting = await openMeeting(page)
  await startMeeting(page, 'Synthetic background research and direct address')
  const chat = meeting.locator('textarea[maxlength="4000"][rows="2"]')
  const link = 'https://github.com/example/disposable-synthetic-fixture'
  await chat.fill(`Shared repository fixture ${link}`)
  await chat.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
  await expect(meeting.getByRole('link', { name: link, exact: true })).toHaveAttribute('href', link)
  const attribution = meeting.getByRole('link', { name: link, exact: true }).locator('xpath=ancestor::li')
  await expect(attribution.locator('strong')).not.toBeEmpty()
  const shared = (await snapshot(page)).record!
  expect(shared.events.find(event => event.type === 'link-shared')?.data.speakerId).toBe(shared.founderId)
  const research = meeting.locator('details:has(textarea[maxlength="2000"])').first()
  await research.locator('summary').click()
  await choose(research.getByRole('combobox'), page, 'Noah')
  await research.locator('textarea').fill('Inspect the shared disposable fixture; do not fetch the real repository')
  await research.locator('button[type="submit"]').click()
  await expect.poll(async () => (await snapshot(page)).record?.tasks.length ?? 0).toBe(1)
  const generation = (await snapshot(page)).record!.generation
  await meeting.locator('.bs-hq-meeting__audio .bs-hq-meeting__toolbar button').nth(2).click()
  await expect.poll(async () => (await snapshot(page)).record?.generation ?? 0).toBeGreaterThan(generation)
  await sendText(page, 'Amaya, discuss the synthetic staffing scope while Noah researches.')
  await expect.poll(async () => (await snapshot(page)).record?.events.filter(event => event.type === 'agent-contribution').at(-1)?.data.agentId).toBe('AG-HR-001')
  expect(await meeting.locator('.bs-hq-meeting__tile[data-status="speaking"]').count()).toBeLessThanOrEqual(1)
  const noah = meeting.locator('.bs-hq-meeting__tile').filter({ hasText: 'Noah' })
  await expect(noah).toHaveAttribute('data-status', 'hand-raised', { timeout: 20_000 })
  expect((await snapshot(page)).record?.tasks[0].status).toBe('completed')
  await noah.getByRole('button').click()
  await expect(meeting.locator('.bs-hq-meeting__log').first()).toContainText('[SYNTHETIC FIXTURE]')
})

test('exact plan approval dispatches once on intentional end and independent reports survive browser return', async ({ page }) => {
  await openMeeting(page)
  await startMeeting(page, 'Synthetic approved work after meeting')
  await draftPlan(page, 'Version-bound synthetic execution plan')
  await confirmDecision(page, 2)
  await expect.poll(async () => (await snapshot(page)).record?.plans.at(-1)?.status).toBe('approved')
  expect((await snapshot(page)).receipts).toHaveLength(0)
  const approvedId = (await snapshot(page)).record!.id
  // Leaving before intentional end must hold the approved-on-end scope.
  await page.goto('about:blank')
  await page.goto('/')
  await waitForHydration(page)
  await page.locator('.bs-hq-layout__ceo').click()
  await expect(panel(page)).toBeVisible()
  const held = await snapshot(page)
  expect(held.record?.id).toBe(approvedId)
  expect(held.record?.status).toBe('active')
  expect(held.receipts).toHaveLength(0)
  const end = panel(page).locator('footer button').first()
  await end.click()
  await expect.poll(async () => (await snapshot(page)).record?.status).toBe('ended')
  const ended = await snapshot(page)
  expect(ended.record?.plans.at(-1)?.status).toBe('dispatched')
  const id = ended.record!.id
  // A controlled browser disconnect does not own the separate worker/reviewer.
  await page.goto('about:blank')
  await page.goto('/')
  await waitForHydration(page)
  await page.locator('.bs-hq-layout__ceo').click()
  await expect.poll(async () => (await snapshot(page)).reports.length, { timeout: 20_000 }).toBe(1)
  const returned = await snapshot(page)
  expect(returned.record?.id).toBe(id)
  expect(returned.receipts).toHaveLength(1)
  await page.reload()
  await waitForHydration(page)
  await page.locator('.bs-hq-layout__ceo').click()
  expect((await snapshot(page)).receipts).toHaveLength(1)
})

test('discarding a proposed plan and ending the meeting creates no execution receipt', async ({ page }) => {
  await openMeeting(page)
  await startMeeting(page, 'Synthetic discarded plan')
  await draftPlan(page, 'Discard this exact synthetic plan')
  await confirmDecision(page, 5)
  await expect.poll(async () => (await snapshot(page)).record?.plans.at(-1)?.status).toBe('discarded')
  await panel(page).locator('footer button').first().click()
  await expect.poll(async () => (await snapshot(page)).record?.status).toBe('ended')
  const ended = await snapshot(page)
  expect(ended.receipts).toHaveLength(0)
  expect(ended.record?.tasks).toHaveLength(0)
})

test('another browser session cannot read a meeting and missing request boundaries fail closed', async ({ page, browser }) => {
  await openMeeting(page)
  await startMeeting(page, 'Synthetic owner isolation')
  const id = (await snapshot(page)).record!.id
  const foreign = await browser.newContext({ baseURL: base })
  try {
    const missingHeader = await foreign.request.get('/api/hq/meetings/demo')
    expect(missingHeader.status()).toBe(403)
    const unauthorized = await foreign.request.get(`/api/hq/meetings/demo?id=${id}`, { headers })
    expect(unauthorized.status()).toBe(404)
    const csrf = await foreign.request.post('/api/hq/meetings/demo', { headers, data: { requestId: '00000000-0000-4000-8000-000000000001', meetingId: id, command: { type: 'end' } } })
    expect(csrf.status()).toBe(403)
    expect((await snapshot(page)).record?.status).toBe('active')
  }
  finally { await foreign.close() }
})


test('explicit exact local voice assignments speak and a founder interruption fences stale browser callbacks', async ({ page }) => {
  await page.addInitScript(() => {
    type FakeUtterance = { text: string; voice?: { voiceURI: string }; onstart?: () => void; onend?: () => void; onerror?: () => void }
    const voices = [
      { voiceURI: 'synthetic:local:ar:one', name: 'Synthetic local Arabic One', lang: 'ar-SA', localService: true },
      { voiceURI: 'synthetic:local:ar:two', name: 'Synthetic local Arabic Two', lang: 'ar-SA', localService: true },
      { voiceURI: 'synthetic:remote:ar:excluded', name: 'Remote voice must be excluded', lang: 'ar-SA', localService: false },
    ]
    const harness = { spoken: [] as { text: string; voiceURI?: string }[], utterances: [] as FakeUtterance[], cancellations: 0 }
    Object.defineProperty(window, '__meetingAudioHarness', { value: harness })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
      text: string
      constructor(text: string) { this.text = text }
    } })
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => voices,
      addEventListener() {}, removeEventListener() {},
      speak(utterance: FakeUtterance) {
        harness.spoken.push({ text: utterance.text, voiceURI: utterance.voice?.voiceURI })
        harness.utterances.push(utterance)
        queueMicrotask(() => utterance.onstart?.())
      },
      cancel() { harness.cancellations++ },
    } })
  })
  const meeting = await openMeeting(page)
  const steveVoice = meeting.getByRole('combobox', { name: /Steve/ })
  await steveVoice.click()
  await expect(page.getByRole('option', { name: 'Remote voice must be excluded', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'Synthetic local Arabic One', exact: true }).click()
  await choose(meeting.getByRole('combobox', { name: /Amaya/ }), page, 'Synthetic local Arabic Two')
  await startMeeting(page, 'Synthetic local voice orchestration')
  await sendText(page, 'Steve, give a synthetic demonstration contribution.')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  const first = await page.evaluate(() => {
    const harness = (window as unknown as { __meetingAudioHarness: { spoken: { text: string; voiceURI: string }[]; cancellations: number } }).__meetingAudioHarness
    return { spoken: harness.spoken[0], cancellations: harness.cancellations }
  })
  expect(first.spoken.voiceURI).toBe('synthetic:local:ar:one')
  expect(first.spoken.text).toMatch(/SYNTHETIC|تجريبي/)
  const generation = (await snapshot(page)).record!.generation
  await meeting.locator('.bs-hq-meeting__audio .bs-hq-meeting__toolbar button').nth(2).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { cancellations: number } }).__meetingAudioHarness.cancellations)).toBeGreaterThan(first.cancellations)
  await expect.poll(async () => (await snapshot(page)).record!.generation).toBeGreaterThan(generation)
  await page.evaluate(() => {
    const first = (window as unknown as { __meetingAudioHarness: { utterances: { onstart?: () => void; onend?: () => void }[] } }).__meetingAudioHarness.utterances[0]
    first.onstart?.(); first.onend?.()
  })
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  expect(await meeting.locator('.bs-hq-meeting__tile[data-status="speaking"]').count()).toBe(0)
  await sendText(page, 'Amaya, give the next synthetic demonstration contribution.')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(2)
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: { voiceURI: string }[] } }).__meetingAudioHarness.spoken[1].voiceURI)).toBe('synthetic:local:ar:two')
  await page.evaluate(() => {
    const first = (window as unknown as { __meetingAudioHarness: { utterances: { onstart?: () => void; onend?: () => void }[] } }).__meetingAudioHarness.utterances[0]
    first.onstart?.(); first.onend?.()
  })
  await expect(meeting.locator('.bs-hq-meeting__tile').filter({ hasText: 'Amaya' })).toHaveAttribute('data-status', 'speaking')
})
