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

async function openMeeting(page: Page, options: { mobile?: boolean; mode?: 'demonstration' | 'live' } = {}) {
  if (options.mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForHydration(page)
  const entry = page.getByRole('button', { name: 'Meeting' })
  await expect(entry).toBeEnabled()
  await entry.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).locator(`[data-mode="${options.mode ?? 'demonstration'}"]`)).toBeVisible()
  await expect(panel(page).locator('form').first().locator('input[maxlength="160"]')).toBeEnabled()
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
  const controlled = await select.getAttribute('aria-controls')
  expect(controlled).toBeTruthy()
  await page.locator(`[id="${controlled}"]`).getByRole('option', { name, exact: true }).click()
  await expect(select).toHaveAttribute('aria-expanded', 'false')
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

async function installSyntheticLocalVoices(page: Page) {
  await page.addInitScript(() => {
    type FakeUtterance = { text: string; voice?: { voiceURI: string }; onstart?: () => void; onend?: () => void; onerror?: () => void }
    const voices = [
      { voiceURI: 'synthetic:local:en:one', name: 'Synthetic local English One', lang: 'en-US', localService: true },
      { voiceURI: 'synthetic:local:en:two', name: 'Synthetic local English Two', lang: 'en-US', localService: true },
      { voiceURI: 'synthetic:remote:en:excluded', name: 'Remote voice must be excluded', lang: 'en-US', localService: false },
    ]
    const harness = { spoken: [] as { text: string; voiceURI?: string }[], utterances: [] as FakeUtterance[], cancellations: 0, cancelTimes: [] as number[], interruptIntentAt: null as number | null }
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
      cancel() { harness.cancellations++; harness.cancelTimes.push(performance.now()) },
    } })
  })
}

/** Synthetic protocol transport only: no model download, native audio or ASR is used. */
async function installSyntheticAutomaticRecognition(page: Page) {
  await page.addInitScript(() => {
    type WorkerMessage = { type: string; id?: string; sessionId?: string; chunkId?: number; audio?: Float32Array }
    type ResultHandler = ((event: { data: Record<string, unknown> }) => void) | null
    type PortHandler = ((event: { data: { type: string; audio?: Float32Array } }) => void) | null
    const harness = {
      workers: [] as FakeWorker[], activeWorklet: null as FakeWorklet | null,
      pending: null as { worker: FakeWorker; id: string; sessionId: string; chunkId: number } | null,
      lastResult: null as { handler: ResultHandler; id: string; sessionId: string; chunkId: number } | null,
      latePort: null as PortHandler, captures: 0, trackStops: 0, prepares: 0, transcribes: 0, terminated: 0,
      workletLoads: 0, starts: 0, stops: 0, finishes: 0, tailOnFinish: false, denyNextCapture: false,
      completePrepare(failed = false) {
        const worker = this.workers.at(-1)!
        const id = worker.prepareId
        if (failed) worker.onmessage?.({ data: { type: 'error', id, code: 'model-load-failed' } })
        else {
          worker.onmessage?.({ data: { type: 'state', phase: 'loading', progress: 75 } })
          worker.onmessage?.({ data: { type: 'prepared', id } })
        }
      },
      emitChunk() {
        const node = this.activeWorklet!
        this.latePort = node.port.onmessage
        node.port.onmessage?.({ data: { type: 'chunk', audio: new Float32Array(16_000).fill(0.03) } })
      },
      completeResult(text: string, language: 'ar' | 'en') {
        const pending = this.pending!
        this.lastResult = { handler: pending.worker.onmessage, id: pending.id, sessionId: pending.sessionId, chunkId: pending.chunkId }
        this.pending = null
        pending.worker.onmessage?.({ data: { type: 'result', id: pending.id, sessionId: pending.sessionId, chunkId: pending.chunkId, text, language } })
      },
      emitLateResult(text: string) {
        const previous = this.pending
          ? { handler: this.pending.worker.onmessage, ...this.pending }
          : this.lastResult
        previous?.handler?.({ data: { type: 'result', id: previous.id, sessionId: previous.sessionId, chunkId: previous.chunkId, text, language: 'ar' } })
        this.latePort?.({ data: { type: 'chunk', audio: new Float32Array(16_000).fill(0.03) } })
      },
    }
    class FakeWorker {
      onmessage: ResultHandler = null
      onerror: (() => void) | null = null
      prepareId = ''
      constructor() { harness.workers.push(this) }
      postMessage(message: WorkerMessage) {
        if (message.type === 'prepare') { this.prepareId = message.id!; harness.prepares++ }
        else if (message.type === 'transcribe') {
          harness.transcribes++
          harness.pending = { worker: this, id: message.id!, sessionId: message.sessionId!, chunkId: message.chunkId! }
          message.audio?.fill(0)
        }
      }
      terminate() { harness.terminated++ }
    }
    class FakeAudioContext {
      sampleRate = 16_000
      destination = {}
      audioWorklet = { addModule: async () => { harness.workletLoads++ } }
      resume() { return Promise.resolve() }
      close() { return Promise.resolve() }
      createMediaStreamSource() { return { connect() {}, disconnect() {} } }
      createAnalyser() { return { fftSize: 512, getFloatTimeDomainData(value: Float32Array) { value.fill(0) } } }
    }
    class FakeWorklet {
      port = {
        onmessage: null as PortHandler,
        postMessage(message: { type: string }) {
          if (message.type === 'start') harness.starts++
          else if (message.type === 'stop') harness.stops++
          else if (message.type === 'finish') {
            harness.finishes++
            queueMicrotask(() => {
              if (harness.tailOnFinish) this.onmessage?.({ data: { type: 'chunk', audio: new Float32Array(8_000).fill(0.03) } })
              this.onmessage?.({ data: { type: 'finished' } })
            })
          }
        },
        close() {},
      }
      constructor() { harness.activeWorklet = this }
      connect() {}
      disconnect() {}
    }
    Object.defineProperty(window, '__syntheticAutoRecognitionHarness', { value: harness })
    Object.defineProperty(window, 'Worker', { value: FakeWorker, configurable: true })
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
    Object.defineProperty(window, 'webkitAudioContext', { value: FakeAudioContext, configurable: true })
    Object.defineProperty(window, 'AudioWorkletNode', { value: FakeWorklet, configurable: true })
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
    navigator.mediaDevices.getUserMedia = async () => {
      harness.captures++
      if (harness.denyNextCapture) { harness.denyNextCapture = false; throw new DOMException('Synthetic microphone denial', 'NotAllowedError') }
      return { getTracks: () => [{ stop() { harness.trackStops++ }, addEventListener() {}, removeEventListener() {} }] } as unknown as MediaStream
    }
  })
}

test.beforeEach(async ({ page, context }) => {
  externalRequests.set(page, [])
  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: new URL(base).hostname, path: '/' }])
  await page.addInitScript(() => {
    // Exercise the real documented scene fallback: these tests cover the meeting,
    // and do not benchmark the unrelated spatial WebGL renderer in headless CI.
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(contextId)) return null
      return getContext.call(this, contextId, ...args)
    } as typeof getContext
    Object.defineProperty(window, '__meetingMicrophoneCalls', { value: 0, writable: true })
    if (!('__syntheticAutoRecognitionHarness' in window)) {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
        ;(window as unknown as { __meetingMicrophoneCalls: number }).__meetingMicrophoneCalls++
        throw new Error('Browser verification never captures real microphone audio')
      }
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

test('English HQ chrome ignores Arabic locale cookie while Arabic meeting content keeps automatic direction', async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ 'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.5' })
  const meeting = await openMeeting(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(meeting).toHaveAttribute('dir', 'ltr')
  await expect(meeting).toHaveAttribute('lang', 'en')
  await expect(meeting.getByRole('combobox', { name: /^Language$/i })).toHaveCount(0)
  for (const name of ['Steve', 'Amaya', 'Noah']) await expect(meeting.getByRole('checkbox', { name: new RegExp(`^${name}`) })).toBeChecked()
  const source = await snapshot(page)
  expect(source.registry.find(item => item.name === 'Steve')?.id).toBe('AG-CEO-001')
  expect(source.registry.find(item => item.name === 'Amaya')?.id).toBe('AG-HR-001')
  expect(source.registry.find(item => item.name === 'Noah')?.id).toBe('AG-HR-002')
  await assertNoOverflow(page)
  await startMeeting(page, 'اجتماع عربي للاختبار المصطنع')
  const arabic = 'ستيف، لخص نطاق الاجتماع المصطنع فقط.'
  await sendText(page, arabic)
  await expect.poll(async () => (await snapshot(page)).record?.events.filter(event => event.type === 'agent-contribution').at(-1)?.data.agentId).toBe('AG-CEO-001')
  await expect(meeting.locator('.bs-hq-meeting__log').first()).toContainText(/SYNTHETIC|تجريبي/)
  await expect(meeting.getByText(arabic, { exact: true })).toHaveAttribute('dir', 'auto')
  await expect(meeting.locator('textarea[maxlength="4000"][rows="3"]')).toHaveAttribute('dir', 'auto')
  await expect(meeting.getByRole('combobox', { name: /^Language$/i })).toHaveCount(0)
  await expect(meeting.locator('.bs-hq-meeting__tiles article').filter({ hasText: 'Amaya' })).toBeVisible()
  expect((await snapshot(page)).record?.language).toBe('en')
  await assertNoOverflow(page)
  await page.screenshot({ path: '/workspace/scratch/hq-meeting-english-arabic-content.png' })
})

test('mobile English keyboard interaction keeps Arabic text usable before voice preparation', async ({ page }) => {
  const meeting = await openMeeting(page, { mobile: true })
  await expect(meeting).toHaveAttribute('dir', 'ltr')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Meeting' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(meeting).toBeVisible()
  await startMeeting(page, 'اجتماع الجوال المصطنع')
  const input = meeting.locator('textarea[maxlength="4000"][rows="3"]')
  await input.focus()
  await expect(input).toBeFocused()
  await page.keyboard.insertText('تظل المداخلة النصية العربية متاحة قبل تجهيز الصوت.')
  await input.locator('xpath=ancestor::form').locator('button[type="submit"]').focus()
  await page.keyboard.press('Enter')
  await expect(meeting.getByText('تظل المداخلة النصية العربية متاحة قبل تجهيز الصوت.', { exact: true })).toHaveAttribute('dir', 'auto')
  await assertNoOverflow(page)
  await page.screenshot({ path: '/workspace/scratch/hq-meeting-mobile-english.png' })
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
  await choose(meeting.locator('textarea[maxlength="4000"][rows="3"]').locator('xpath=ancestor::form').getByRole('combobox'), page, 'Amaya')
  await sendText(page, 'Discuss the synthetic staffing scope while background research continues.')
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
  await page.getByRole('button', { name: 'Meeting' }).click()
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
  await page.getByRole('button', { name: 'Meeting' }).click()
  await expect.poll(async () => (await snapshot(page)).reports.length, { timeout: 20_000 }).toBe(1)
  const returned = await snapshot(page)
  expect(returned.record?.id).toBe(id)
  expect(returned.receipts).toHaveLength(1)
  await page.reload()
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Meeting' }).click()
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
  await installSyntheticLocalVoices(page)
  const meeting = await openMeeting(page)
  const steveVoice = meeting.getByRole('combobox', { name: /Steve/ })
  await steveVoice.click()
  await expect(page.getByRole('option', { name: 'Remote voice must be excluded', exact: true })).toHaveCount(0)
  const steveChoices = await steveVoice.getAttribute('aria-controls')
  await page.locator(`[id="${steveChoices}"]`).getByRole('option', { name: 'Synthetic local English One', exact: true }).click()
  await expect(steveVoice).toHaveAttribute('aria-expanded', 'false')
  await choose(meeting.getByRole('combobox', { name: /Amaya/ }), page, 'Synthetic local English Two')
  await startMeeting(page, 'Synthetic local voice orchestration')
  await sendText(page, 'Steve, give a synthetic demonstration contribution.')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  const first = await page.evaluate(() => {
    const harness = (window as unknown as { __meetingAudioHarness: { spoken: { text: string; voiceURI: string }[]; cancellations: number } }).__meetingAudioHarness
    return { spoken: harness.spoken[0], cancellations: harness.cancellations }
  })
  expect(first.spoken.voiceURI).toBe('synthetic:local:en:one')
  expect(first.spoken.text).toMatch(/SYNTHETIC|تجريبي/)
  const generation = (await snapshot(page)).record!.generation
  const interruptButton = meeting.locator('.bs-hq-meeting__audio .bs-hq-meeting__toolbar button').nth(2)
  await interruptButton.evaluate(element => element.addEventListener('click', () => {
    ;(window as unknown as { __meetingAudioHarness: { interruptIntentAt: number } }).__meetingAudioHarness.interruptIntentAt = performance.now()
  }, { capture: true, once: true }))
  await interruptButton.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { cancellations: number } }).__meetingAudioHarness.cancellations)).toBeGreaterThan(first.cancellations)
  const latency = await page.evaluate(() => {
    const harness = (window as unknown as { __meetingAudioHarness: { interruptIntentAt: number; cancelTimes: number[] } }).__meetingAudioHarness
    return harness.cancelTimes.find(time => time >= harness.interruptIntentAt)! - harness.interruptIntentAt
  })
  expect(latency).toBeGreaterThanOrEqual(0)
  expect(latency).toBeLessThan(500)
  const measurement = { clickEventToMockCancelMs: latency, conditions: 'Headless Chromium; synthetic local voices; no microphone; scene WebGL fallback. Measures browser click capture event to mocked speechSynthesis.cancel, not acoustic stopping latency.' }
  console.log(`Mock browser interruption measurement: ${JSON.stringify(measurement)}`)
  await test.info().attach('mock-browser-interruption-latency', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' })
  await expect.poll(async () => (await snapshot(page)).record!.generation).toBeGreaterThan(generation)
  await page.evaluate(() => {
    const first = (window as unknown as { __meetingAudioHarness: { utterances: { onstart?: () => void; onend?: () => void }[] } }).__meetingAudioHarness.utterances[0]
    first.onstart?.(); first.onend?.()
  })
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  expect(await meeting.locator('.bs-hq-meeting__tile[data-status="speaking"]').count()).toBe(0)
  await sendText(page, 'Amaya, give the next synthetic demonstration contribution.')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(2)
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: { voiceURI: string }[] } }).__meetingAudioHarness.spoken[1].voiceURI)).toBe('synthetic:local:en:two')
  await page.evaluate(() => {
    const first = (window as unknown as { __meetingAudioHarness: { utterances: { onstart?: () => void; onend?: () => void }[] } }).__meetingAudioHarness.utterances[0]
    first.onstart?.(); first.onend?.()
  })
  await expect(meeting.locator('.bs-hq-meeting__tile').filter({ hasText: 'Amaya' })).toHaveAttribute('data-status', 'speaking')
  // A persisted text response arriving after a newer founder interrupt must stay silent.
  let responsePaused = false
  let releaseResponse = () => {}
  const released = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route('**/api/hq/meetings/demo', async route => {
    if (route.request().method() !== 'POST' || route.request().postDataJSON()?.command?.type !== 'text') return route.fallback()
    const response = await route.fetch()
    responsePaused = true
    await released
    await route.fulfill({ response })
  })
  const text = meeting.locator('textarea[maxlength="4000"][rows="3"]')
  await text.fill('Steve, this delayed synthetic response must stay silent after interruption.')
  await text.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
  try {
    await expect.poll(() => responsePaused).toBe(true)
    await interruptButton.click()
  }
  finally { releaseResponse() }
  await expect.poll(async () => (await snapshot(page)).record!.events.filter(event => event.type === 'audio-invalidated' && event.data.reason === 'founder-interruption').length).toBeGreaterThan(1)
  await expect(meeting).toHaveAttribute('aria-busy', 'false')
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(2)
})


test('SYNTHETIC LIVE-PROTOCOL FIXTURE: trusted roster, correlated output, generation fence and authority loss', async ({ page }) => {
  // Every live response below is a synthetic DTO, matching livePresentation's
  // unit fixtures. This test never authenticates or reaches a live HQ backend.
  await installSyntheticLocalVoices(page)
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const source = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (new URL(source, location.href).pathname === '/api/hq/events') {
        const encoder = new TextEncoder()
        const body = new ReadableStream({ start(controller) {
          controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'))
          init?.signal?.addEventListener('abort', () => { try { controller.close() } catch { /* The synthetic stream may already be closed. */ } }, { once: true })
        } })
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      }
      return originalFetch(input, init)
    }
  })
  const stamp = '2026-11-05T12:00:00.000Z'
  const uid = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`
  const roster = { observedAt: stamp, participants: [
    { id: 'AG-CEO-001', name: 'Steve', role: 'CEO', supervisorId: null, conversationAvailable: true, workQualified: true, qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'synthetic-live-protocol:ceo:v1' },
    { id: 'AG-HR-001', name: 'Amaya', role: 'HR Lead', supervisorId: 'AG-CEO-001', conversationAvailable: true, workQualified: true, qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'synthetic-live-protocol:hr:v1' },
    { id: 'AG-HR-002', name: 'Noah', role: 'Recruiter', supervisorId: 'AG-HR-001', conversationAvailable: true, workQualified: true, qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'synthetic-live-protocol:recruiter:v1' },
    { id: 'AG-RES-001', name: 'Nadia', role: 'Research Lead', supervisorId: 'AG-CEO-001', conversationAvailable: true, workQualified: false, qualified: false, allowedTools: [], registryReference: 'synthetic-live-protocol:unqualified:v1' },
  ] }
  type RawContribution = { id: string; meeting_id: string; generation: number; agent_id: string; source_event_id: number; founder_message_id: string; response_message_id: string | null; response_artifact_id: null; response_digest: string | null; response_text: string | null; status: string; error: null; created_at: string; completed_at: null }
  type RawFixture = {
    meeting: { id: string; founder_id: string; title: string; language: string; status: string; connection: string; participants: string[]; floor: string; generation: number; paused: boolean; revision: number; created_at: string; ended_at: null } | null
    events: { id: number; kind: string; actor_id: string; payload: { type: string; text: string; uncertain: boolean }; created_at: string }[]
    contributions: RawContribution[]
    turn: { id: string; agentId: string; generation: number; status: string; language: string; text: string | null } | null
    plans: never[]; tasks: never[]; executionBackend: 'hq-business-tasks'
  }
  const fixture: RawFixture = { meeting: null, events: [], contributions: [], turn: null, plans: [], tasks: [], executionBackend: 'hq-business-tasks' }
  const requests: { type: string; command?: { type: string; text?: string } }[] = []
  const forbiddenDemoRequests: string[] = []
  let denied = false
  await page.route('**/api/hq/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/hq/access') return json({ status: 'founder', user: { displayName: 'SYNTHETIC TRUSTED FOUNDER', detailLabel: 'Synthetic live-protocol fixture; no Auth session' } })
    if (path === '/api/hq/meetings/availability') return json({ demonstration: false, live: true, blockers: [] })
    if (path === '/api/hq/meetings/registry') return json(roster)
    if (path.startsWith('/api/hq/meetings/demo')) { forbiddenDemoRequests.push(path); return json({ error: 'Fixture prohibits demonstration fallback' }, 503) }
    if (path !== '/api/hq/meetings/live') return json({ error: 'Unrelated HQ backend disabled in synthetic protocol fixture' }, 503)
    if (denied) return json({ statusMessage: 'Synthetic protocol fixture revokes authority' }, 401)
    if (request.method() === 'GET') return json(fixture)
    const body = request.postDataJSON()
    requests.push(body)
    if (body.type === 'create') {
      expect(body.participantIds).toEqual(['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-RES-001'])
      fixture.meeting = { id: body.requestId, founder_id: uid(2), title: body.title, language: body.language, status: 'active', connection: 'connected', participants: body.participantIds, floor: 'founder', generation: 0, paused: false, revision: 1, created_at: stamp, ended_at: null }
    }
    else {
      expect(body.type).toBe('command')
      expect(body.meetingId).toBe(fixture.meeting!.id)
      fixture.meeting!.revision++
      if (body.command.type === 'text') {
        fixture.meeting!.generation++
        fixture.meeting!.floor = 'AG-CEO-001'
        fixture.events.push({ id: 1, kind: 'text', actor_id: uid(2), payload: { type: 'text', text: body.command.text, uncertain: false }, created_at: stamp })
        fixture.contributions = [{ id: uid(3), meeting_id: fixture.meeting!.id, generation: fixture.meeting!.generation, agent_id: 'AG-CEO-001', source_event_id: 1, founder_message_id: uid(5), response_message_id: null, response_artifact_id: null, response_digest: null, response_text: null, status: 'thinking', error: null, created_at: stamp, completed_at: null }]
        fixture.turn = { id: uid(3), agentId: 'AG-CEO-001', generation: fixture.meeting!.generation, status: 'thinking', language: 'en', text: 'UNTRUSTED TURN TEXT MUST NEVER BECOME A REPLY' }
      }
      else if (body.command.type === 'interrupt') {
        fixture.meeting!.generation++
        fixture.meeting!.floor = 'founder'
        fixture.contributions[0].status = 'interrupted'
        fixture.turn = null
      }
      else throw new Error(`Unexpected synthetic live command: ${body.command.type}`)
    }
    return json(fixture)
  })
  const meeting = await openMeeting(page, { mode: 'live' })
  await expect(meeting.getByRole('checkbox', { name: /^Steve/ })).toBeChecked()
  await expect(meeting.getByRole('checkbox', { name: /^Amaya/ })).toBeChecked()
  await expect(meeting.getByRole('checkbox', { name: /^Noah/ })).toBeChecked()
  await expect(meeting.getByRole('checkbox', { name: /^Nadia/ })).toBeChecked()
  await choose(meeting.getByRole('combobox', { name: /Steve/ }), page, 'Synthetic local English One')
  const privateTitle = 'SYNTHETIC LIVE-PROTOCOL FIXTURE — no provider'
  const setup = meeting.locator('form').first()
  await setup.locator('input[maxlength="160"]').fill(privateTitle)
  await setup.locator('button[type="submit"]').click()
  await expect(meeting.locator('.bs-hq-meeting__tiles')).toBeVisible()
  await expect(meeting.locator('.bs-hq-meeting__tiles article').first()).toContainText('SYNTHETIC TRUSTED FOUNDER')
  const research = meeting.locator('details:has(textarea[maxlength="2000"])').first()
  await research.locator('summary').click()
  const workOwner = research.getByRole('combobox')
  await workOwner.click()
  const workChoices = await workOwner.getAttribute('aria-controls')
  await expect(page.locator(`[id="${workChoices}"]`).getByRole('option', { name: 'Nadia', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  const founderText = 'SYNTHETIC LIVE-PROTOCOL FIXTURE: Steve, inspect the supplied fixture only.'
  await sendText(page, founderText)
  const transcript = meeting.locator('.bs-hq-meeting__log').first()
  await expect(transcript.locator('li')).toHaveCount(1)
  await expect(meeting.locator('.bs-hq-meeting__tile').filter({ hasText: 'Steve' })).toHaveAttribute('data-status', 'thinking')
  await expect(meeting.getByText('UNTRUSTED TURN TEXT MUST NEVER BECOME A REPLY', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(0)
  const reply = '[SYNTHETIC LIVE-PROTOCOL FIXTURE] Correlated persisted CEO reply.'
  Object.assign(fixture.contributions[0], { status: 'speaking', response_text: reply, response_digest: 'a'.repeat(64), response_message_id: uid(6) })
  Object.assign(fixture.turn!, { status: 'speaking' })
  fixture.meeting!.revision++
  await meeting.locator('header button').click()
  await expect(transcript).toContainText(reply)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: { text: string; voiceURI: string }[] } }).__meetingAudioHarness.spoken[0])).toEqual({ text: reply, voiceURI: 'synthetic:local:en:one' })
  await meeting.locator('.bs-hq-meeting__audio .bs-hq-meeting__toolbar button').nth(2).click()
  await expect(meeting.locator('.bs-hq-meeting__tile').filter({ hasText: 'Steve' })).toHaveAttribute('data-status', 'listening')
  // Historical text remains attributable, but an obsolete turn cannot speak.
  fixture.contributions[0].status = 'speaking'
  fixture.turn = { id: uid(3), agentId: 'AG-CEO-001', generation: fixture.meeting!.generation - 1, status: 'speaking', language: 'en', text: 'UNTRUSTED TURN TEXT MUST NEVER BECOME A REPLY' }
  fixture.meeting!.floor = 'AG-CEO-001'
  fixture.meeting!.revision++
  await meeting.locator('header button').click()
  await expect(meeting.locator('.bs-hq-meeting__tile[data-status="speaking"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __meetingAudioHarness: { spoken: unknown[] } }).__meetingAudioHarness.spoken.length)).toBe(1)
  denied = true
  await meeting.locator('header button').click()
  await expect(meeting.locator('[data-mode="unavailable"]')).toBeVisible()
  await expect(meeting.locator('.bs-hq-meeting__tiles')).toHaveCount(0)
  await expect(meeting.getByText(reply, { exact: true })).toHaveCount(0)
  await expect(meeting.locator('input[maxlength="160"]')).toHaveValue('')
  expect(forbiddenDemoRequests).toEqual([])
  expect(requests.map(request => request.type === 'command' ? request.command!.type : request.type)).toEqual(['create', 'text', 'interrupt'])
})



type AutomaticRecognitionCounts = { workers: number; prepares: number; transcribes: number; captures: number; trackStops: number; terminated: number }
async function recognitionCounts(page: Page): Promise<AutomaticRecognitionCounts> {
  return page.evaluate(() => {
    const h = (window as unknown as { __syntheticAutoRecognitionHarness: { workers: unknown[]; prepares: number; transcribes: number; captures: number; trackStops: number; terminated: number } }).__syntheticAutoRecognitionHarness
    return { workers: h.workers.length, prepares: h.prepares, transcribes: h.transcribes, captures: h.captures, trackStops: h.trackStops, terminated: h.terminated }
  })
}
async function completePreparation(page: Page, failed = false) {
  await page.evaluate(value => (window as unknown as { __syntheticAutoRecognitionHarness: { completePrepare: (failed: boolean) => void } }).__syntheticAutoRecognitionHarness.completePrepare(value), failed)
}
async function emitAutomaticDraft(page: Page, text: string, language: 'ar' | 'en') {
  await page.evaluate(() => (window as unknown as { __syntheticAutoRecognitionHarness: { emitChunk: () => void } }).__syntheticAutoRecognitionHarness.emitChunk())
  await page.evaluate(value => (window as unknown as { __syntheticAutoRecognitionHarness: { completeResult: (text: string, language: 'ar' | 'en') => void } }).__syntheticAutoRecognitionHarness.completeResult(value.text, value.language), { text, language })
}

const downloadConsentName = /^I agree to download the voice recognition model \(about 80 MB plus runtime\)\./
const microphoneConsentName = /^I allow microphone capture for on-device recognition\./

test('synthetic automatic voice fixture: model download and microphone require separate explicit consent; bilingual output stays a draft', async ({ page }) => {
  await installSyntheticAutomaticRecognition(page)
  const meeting = await openMeeting(page)
  await startMeeting(page, 'SYNTHETIC on-device model and capture consent')
  const audio = meeting.locator('.bs-hq-meeting__audio')
  const prepare = audio.getByRole('button', { name: 'Prepare voice recognition', exact: true })
  await expect(audio.getByText('Automatic Arabic / English', { exact: true })).toBeVisible()
  await expect(audio).toContainText('Arabic and English are detected automatically. Pause briefly when switching languages and review the transcript before sending.')
  await expect(meeting.getByRole('combobox', { name: /^(Language|Speech recognition)$/i })).toHaveCount(0)
  await expect(prepare).toBeDisabled()
  expect(await recognitionCounts(page)).toEqual({ workers: 0, prepares: 0, transcribes: 0, captures: 0, trackStops: 0, terminated: 0 })
  await audio.getByRole('checkbox', { name: downloadConsentName }).check()
  await prepare.click()
  await expect.poll(async () => (await recognitionCounts(page)).prepares).toBe(1)
  expect((await recognitionCounts(page)).captures).toBe(0)
  await expect(audio).toContainText(/download|loading|prepar/i)
  await completePreparation(page)
  await expect(audio).toContainText('Voice recognition is ready. Microphone off.')
  const start = audio.getByRole('button', { name: 'Start microphone', exact: true })
  const microphoneConsent = audio.getByRole('checkbox', { name: microphoneConsentName })
  await expect(microphoneConsent).not.toBeChecked()
  await expect(start).toBeDisabled()
  const draft = meeting.locator('textarea[maxlength="4000"][rows="3"]')
  await draft.fill('Reviewed prefix:')
  const before = (await snapshot(page)).record!
  const founderUtterances = before.events.filter(event => event.type === 'founder-utterance').length
  await microphoneConsent.check()
  await start.click()
  await expect(audio).toContainText('Microphone on. Listening…')
  expect((await recognitionCounts(page)).captures).toBe(1)
  const arabic = 'هذه مسودة عربية تحتاج إلى مراجعة.'
  const english = 'English speech stays a reviewable draft.'
  await emitAutomaticDraft(page, arabic, 'ar')
  await expect(draft).toHaveValue(`Reviewed prefix: ${arabic}`)
  await emitAutomaticDraft(page, english, 'en')
  const reviewed = `Reviewed prefix: ${arabic} ${english}`
  await expect(draft).toHaveValue(reviewed)
  await expect(draft).toHaveAttribute('dir', 'auto')
  await expect(meeting.getByText('Uncertain recognition; review before sending.', { exact: true })).toBeVisible()
  await expect(draft.locator('xpath=ancestor::form').getByRole('button', { name: 'Send contribution', exact: true })).toBeDisabled()
  const after = await snapshot(page)
  expect(after.record!.events.filter(event => event.type === 'founder-utterance')).toHaveLength(founderUtterances)
  expect(after.record!.plans).toHaveLength(0)
  expect(after.receipts).toHaveLength(0)
  const overLimit = 'x'.repeat(3990)
  await emitAutomaticDraft(page, overLimit, 'en')
  const fullDraft = `${reviewed} ${overLimit}`
  await expect(draft).toHaveValue(fullDraft)
  await audio.getByRole('button', { name: 'Stop microphone', exact: true }).click()
  await expect(audio.locator('[role="status"]').last()).toContainText('Voice recognition is ready. Microphone off.')
  await expect(start).toBeVisible()
  const send = draft.locator('xpath=ancestor::form').getByRole('button', { name: 'Send contribution', exact: true })
  await expect(send).toBeDisabled()
  await expect(meeting.getByText('This draft is longer than 4,000 characters. Shorten it before sending; the full draft has been kept.', { exact: true })).toBeVisible()
  await expect(draft).toHaveValue(fullDraft)
  await draft.fill(reviewed)
  await expect(send).toBeEnabled()
  await page.evaluate(() => (window as unknown as { __syntheticAutoRecognitionHarness: { emitLateResult: (text: string) => void } }).__syntheticAutoRecognitionHarness.emitLateResult('An obsolete result must not replace the reviewed draft.'))
  await expect(draft).toHaveValue(reviewed)
  expect((await recognitionCounts(page)).trackStops).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Meeting', exact: true }).click()
  await expect(meeting).toBeVisible()
  if (await microphoneConsent.count()) await expect(microphoneConsent).not.toBeChecked()
  expect((await recognitionCounts(page)).captures).toBe(1)
  expect((await snapshot(page)).record!.events.filter(event => event.type === 'founder-utterance')).toHaveLength(founderUtterances)
})

test('synthetic automatic voice fixture: preparation and permission errors preserve drafts; Stop finishes and Close aborts', async ({ page }) => {
  await installSyntheticAutomaticRecognition(page)
  const meeting = await openMeeting(page)
  await startMeeting(page, 'SYNTHETIC preparation and permission failures')
  const audio = meeting.locator('.bs-hq-meeting__audio')
  const prepare = audio.getByRole('button', { name: 'Prepare voice recognition', exact: true })
  await audio.getByRole('checkbox', { name: downloadConsentName }).check()
  await prepare.click()
  await expect.poll(async () => (await recognitionCounts(page)).prepares).toBe(1)
  await completePreparation(page, true)
  await expect(audio).toContainText(/failed|could not|unable/i)
  expect((await recognitionCounts(page)).captures).toBe(0)
  await expect(prepare).toBeEnabled()
  await prepare.click()
  await expect.poll(async () => (await recognitionCounts(page)).prepares).toBe(2)
  await completePreparation(page)
  const start = audio.getByRole('button', { name: 'Start microphone', exact: true })
  const draft = meeting.locator('textarea[maxlength="4000"][rows="3"]')
  await draft.fill('Keep this reviewed draft.')
  await audio.getByRole('checkbox', { name: microphoneConsentName }).check()
  await page.evaluate(() => { (window as unknown as { __syntheticAutoRecognitionHarness: { denyNextCapture: boolean } }).__syntheticAutoRecognitionHarness.denyNextCapture = true })
  await start.click()
  await expect(audio).toContainText(/microphone access was denied|microphone permission.*denied/i)
  await expect(draft).toHaveValue('Keep this reviewed draft.')
  expect((await recognitionCounts(page)).captures).toBe(1)
  await expect(start).toBeEnabled()
  await start.click()
  await expect(audio).toContainText('Microphone on. Listening…')
  await page.evaluate(() => {
    const h = (window as unknown as { __syntheticAutoRecognitionHarness: { emitChunk: () => void; tailOnFinish: boolean } }).__syntheticAutoRecognitionHarness
    h.emitChunk(); h.tailOnFinish = true
  })
  await expect.poll(async () => (await recognitionCounts(page)).transcribes).toBe(1)
  await audio.getByRole('button', { name: 'Stop microphone', exact: true }).click()
  await expect.poll(async () => (await recognitionCounts(page)).trackStops).toBe(1)
  const send = draft.locator('xpath=ancestor::form').getByRole('button', { name: 'Send contribution', exact: true })
  await expect(send).toBeDisabled()
  await expect(audio).toContainText(/finishing|final.*words|remaining.*speech/i)
  await page.evaluate(() => (window as unknown as { __syntheticAutoRecognitionHarness: { completeResult: (text: string, language: 'en') => void } }).__syntheticAutoRecognitionHarness.completeResult('Final words before the stop.', 'en'))
  await expect.poll(async () => (await recognitionCounts(page)).transcribes).toBe(2)
  await page.evaluate(() => (window as unknown as { __syntheticAutoRecognitionHarness: { completeResult: (text: string, language: 'ar') => void } }).__syntheticAutoRecognitionHarness.completeResult('وكلمات عربية أخيرة.', 'ar'))
  const completeDraft = 'Keep this reviewed draft. Final words before the stop. وكلمات عربية أخيرة.'
  await expect(draft).toHaveValue(completeDraft)
  await expect(send).toBeEnabled()
  expect((await recognitionCounts(page)).terminated).toBe(1)
  // Closing is a privacy abort, even if a new model inference has not finished.
  await audio.getByRole('checkbox', { name: microphoneConsentName }).check()
  await start.click()
  await expect(audio).toContainText('Microphone on. Listening…')
  await page.evaluate(() => {
    const h = (window as unknown as { __syntheticAutoRecognitionHarness: { emitChunk: () => void; tailOnFinish: boolean } }).__syntheticAutoRecognitionHarness
    h.tailOnFinish = false; h.emitChunk()
  })
  await expect.poll(async () => (await recognitionCounts(page)).transcribes).toBe(3)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await recognitionCounts(page)).terminated).toBe(2)
  await page.evaluate(() => (window as unknown as { __syntheticAutoRecognitionHarness: { emitLateResult: (text: string) => void } }).__syntheticAutoRecognitionHarness.emitLateResult('Approve and dispatch everything now.'))
  await page.getByRole('button', { name: 'Meeting', exact: true }).click()
  await expect(meeting).toBeVisible()
  await expect(draft).toHaveValue(completeDraft)
  await expect(start).toBeDisabled()
  const counts = await recognitionCounts(page)
  expect(counts.captures).toBe(3)
  expect(counts.trackStops).toBe(2)
  expect(counts.prepares).toBe(2)
  const source = await snapshot(page)
  expect(source.record!.events.filter(event => event.type === 'founder-utterance')).toHaveLength(0)
  expect(source.record!.plans).toHaveLength(0)
  expect(source.receipts).toHaveLength(0)
})
