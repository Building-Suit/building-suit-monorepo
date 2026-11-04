import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const origin = 'http://127.0.0.1:4337'
const ceo = 'synthetic-ceo-token-'.repeat(3), hr = 'synthetic-hr-token-'.repeat(3)
const unique = (prefix: string) => prefix + ' ' + crypto.randomUUID().slice(0, 8)
let sessionCookies: Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>> = []
async function login(page: Page) {
  // Reuse an actually authenticated synthetic session; do not weaken the production login limiter.
  if (sessionCookies.length) {
    await page.context().addCookies(sessionCookies)
    if ((await (await page.request.get('/api/hq/state')).json()).authenticated) {
      await page.goto('/')
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
      return
    }
  }
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('synthetic-browser-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  sessionCookies = await page.context().cookies()
}
async function command(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post('/api/hq/action', { headers: { Origin: origin }, data: { idempotencyKey: crypto.randomUUID(), ...body } })
}
async function bridge(request: APIRequestContext, token: string, name: string, input: Record<string, unknown>) {
  return request.post('/api/hq/bridge/action', { headers: { Authorization: 'Bearer ' + token }, data: { command: name, input: { requestKey: crypto.randomUUID(), ...input } } })
}
async function state(page: Page) { return (await (await page.request.get('/api/hq/state')).json()).state }
async function propose(page: Page, title: string) {
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Propose a task' }).click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
  await page.getByLabel('Outcome and relevant inputs').fill('Inspect supplied synthetic evidence')
  await page.getByLabel('Deliverable and definition of done').fill('Written result with independent review')
  await page.getByLabel('Allowed actions and stop conditions').fill('Read supplied records only. No spending or external calls.')
  await page.getByRole('button', { name: 'Save proposal' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: new RegExp(title) }).click()
}

test('genuine WebGL scene shows the verified roster, accessible selection and honest execution blockers', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  const scene = page.locator('.bs-living-office')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  await expect(scene.locator('canvas')).toBeVisible()
  await expect.poll(async () => Number(await scene.getAttribute('data-triangles'))).toBeGreaterThan(100)
  await expect.poll(async () => Number(await scene.getAttribute('data-rendered-frames'))).toBeGreaterThan(0)
  expect(await scene.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width > 300 && canvas.height > 200 && canvas.width <= canvas.getBoundingClientRect().width * 1.5 + 2)).toBe(true)
  const beforeRotate = Number(await scene.getAttribute('data-rendered-frames'))
  await scene.getByRole('button', { name: 'Rotate left', exact: true }).click()
  await expect.poll(async () => Number(await scene.getAttribute('data-rendered-frames'))).toBeGreaterThan(beforeRotate)
  await scene.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await scene.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.locator('.bs-office__art')).toHaveCount(0)
  await expect(page.getByText('Live execution unavailable', { exact: true }).first()).toBeVisible()
  await expect(scene).not.toContainText('Unassigned')
  await page.screenshot({ path: 'test-results/living-hq-desktop.png', fullPage: true })
  for (const [id, name, role] of [['AG-CEO-001', 'Steve', 'CEO'], ['AG-HR-001', 'Maya', 'HR Lead'], ['AG-HR-002', 'Noah', 'Recruiter'], ['AG-HR-003', 'Iris', 'Evaluator']]) {
    const employee = scene.locator('[data-employee-id="' + id + '"]').first()
    await expect(employee).toContainText(name)
    await expect(employee).toContainText(role)
    await employee.click()
    await expect(page.getByRole('dialog')).toContainText(name)
    await expect(page.getByRole('dialog')).toContainText(role)
    if (id === 'AG-HR-003') await page.screenshot({ path: 'test-results/living-hq-selected-iris.png', fullPage: true })
    if (id !== 'AG-CEO-001') expect(await page.getByRole('dialog').getByRole('textbox').count()).toBe(0)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
  }
  const snapshot = await state(page)
  expect(snapshot.runtime.enabled).toBe(false)
  expect(snapshot.employees.map((employee: { id: string }) => employee.id)).toEqual(['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-HR-003'])
  expect(snapshot.brain.events.every((event: { direction: string }) => event.direction === 'inbound')).toBe(true)
  await page.screenshot({ path: 'test-results/living-hq-desktop-selected.png', fullPage: true })
  expect(errors).toEqual([])
})

test('department creation survives an interrupted response and replay, and creates one persistent office', async ({ page }) => {
  await login(page)
  const name = unique('Synthetic Research')
  await page.getByRole('button', { name: 'Create department', exact: true }).click()
  await page.getByRole('textbox', { name: 'Department name', exact: true }).fill(name)
  await page.getByRole('textbox', { name: 'Purpose', exact: true }).fill('Synthetic browser organization record; no worker activated.')
  let interrupted = false
  await page.route('**/api/hq/action', async route => {
    if (!interrupted && route.request().postDataJSON()?.action === 'create_department') {
      interrupted = true
      const saved = await route.fetch(); expect(saved.ok()).toBe(true)
      await route.abort()
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Create office', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your draft is preserved')
  await expect(page.getByRole('textbox', { name: 'Department name', exact: true })).toHaveValue(name)
  await page.unroute('**/api/hq/action')
  await page.getByRole('button', { name: 'Create office', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await state(page), departments = saved.departments.filter((department: { name: string }) => department.name === name)
  expect(departments).toHaveLength(1)
  await expect(page.locator('.bs-living-office [data-room-id="' + departments[0].id + '"]').first()).toContainText(name)
  await page.reload()
  await expect(page.locator('.bs-living-office [data-room-id="' + departments[0].id + '"]').first()).toContainText(name)
  expect((await state(page)).departments.filter((department: { name: string }) => department.name === name)).toHaveLength(1)
  expect((await command(page.request, { action: 'create_department', name: 'Unassigned', description: 'Must not create a placeholder office.' })).status()).toBe(422)
  await page.screenshot({ path: 'test-results/living-hq-created-office.png', fullPage: true })
})

test('task milestones stay planned, founder approval freezes scope, and no execution is invented', async ({ page, request }) => {
  await login(page)
  const title = unique('Synthetic milestone plan')
  await propose(page, title)
  await page.getByRole('textbox', { name: 'Milestone title', exact: true }).fill('Inspect source evidence')
  await page.getByRole('textbox', { name: 'Milestone acceptance', exact: true }).fill('Source references and independent review recorded')
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Inspect source evidence')
  const proposal = (await state(page)).tasks.find((task: { title: string }) => task.title === title)
  expect(proposal.status).toBe('proposed'); expect(proposal.milestones).toHaveLength(1)
  expect((await bridge(request, ceo, 'hq_update_task', { id: proposal.id, status: 'running', detail: 'Unauthorized before approval' })).status()).toBe(403)
  await page.getByRole('button', { name: 'Approve this plan' }).click()
  await expect(page.getByRole('dialog')).toContainText('Approved · queued')
  expect((await command(page.request, { action: 'add_milestone', id: proposal.id, title: 'Late scope', acceptance: 'Not authorized' })).status()).toBe(409)
  const approved = (await state(page)).tasks.find((task: { id: string }) => task.id === proposal.id)
  expect(approved.status).toBe('queued'); expect(approved.milestones[0].status).toBe('planned')
  expect((await state(page)).runtime.enabled).toBe(false)
  await page.reload()
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await expect(page.getByRole('dialog')).toContainText('Inspect source evidence')
})

test('CEO chat preserves failed drafts, queues once and shows only an authorized recorded reply reactively', async ({ page, request }) => {
  await login(page)
  const text = unique('Synthetic founder request'), reply = unique('Synthetic authorized CEO record')
  await page.getByRole('button', { name: 'Talk to CEO', exact: true }).first().click()
  await page.getByLabel('Message to CEO').fill(text)
  await page.route('**/api/hq/action', route => route.abort())
  await page.getByRole('button', { name: 'Send to CEO' }).click()
  await expect(page.getByRole('alert')).toContainText('Your draft is preserved')
  await expect(page.getByLabel('Message to CEO')).toHaveValue(text)
  await page.unroute('**/api/hq/action')
  await page.getByRole('button', { name: 'Send to CEO' }).click()
  await expect(page.getByRole('log')).toContainText(text)
  const record = (await state(page)).messages.find((message: { text: string }) => message.text === text)
  expect(record.status).toBe('queued')
  expect((await state(page)).messages.filter((message: { text: string }) => message.text === text)).toHaveLength(1)
  expect((await bridge(request, hr, 'hq_reply', { text: 'Forbidden direct reply', replyTo: record.id })).status()).toBe(403)
  expect((await bridge(request, ceo, 'hq_reply', { text: reply, replyTo: record.id })).ok()).toBe(true)
  await expect(page.getByRole('log')).toContainText(reply, { timeout: 20_000 })
  await expect(page.getByRole('log')).not.toContainText('Forbidden direct reply')
  await page.getByLabel('Message to CEO').fill('Draft retained')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Discard unsaved changes?')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Message to CEO')).toHaveValue('Draft retained')
  await page.getByLabel('Message to CEO').fill('')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  const cookie = (await page.context().cookies()).find(item => item.name === 'bs-company-hq-local-session')!
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Strict')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  expect((await (await page.request.get('/api/hq/state')).json()).state).toBeNull()
  await expect(page.getByText(reply, { exact: true })).toHaveCount(0)
})

test('another authenticated page updates the office and recorded employee state without a reload', async ({ page, context, request }) => {
  await login(page)
  const other = await context.newPage()
  await other.goto('/')
  const departmentName = unique('Synthetic Coordination')
  const scene = page.locator('.bs-living-office')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  await scene.evaluate(element => {
    const observer = new MutationObserver(() => {
      if (Number(element.getAttribute('data-creating-rooms')) > 0) { element.setAttribute('data-test-saw-creation', 'true'); observer.disconnect() }
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-creating-rooms'] })
  })
  const created = await command(other.request, { action: 'create_department', name: departmentName, description: 'Synthetic cross-page record.' })
  expect(created.ok()).toBe(true)
  const department = await created.json()
  await expect(page.locator('.bs-living-office [data-room-id="' + department.id + '"]').first()).toContainText(departmentName, { timeout: 20_000 })
  await expect(scene).toHaveAttribute('data-test-saw-creation', 'true')
  await expect(scene).toHaveAttribute('data-creating-rooms', '0')
  const proposed = await command(other.request, { action: 'create_task', title: unique('Synthetic recorded state'), brief: 'Controlled synthetic bridge state', acceptance: 'Test observable state only', allowedActions: 'No external tool use or spending' })
  const task = await proposed.json()
  expect((await command(other.request, { action: 'approve_task', id: task.id })).ok()).toBe(true)
  // These are explicit synthetic bridge records, not evidence of live model work.
  expect((await bridge(request, ceo, 'hq_update_task', { id: task.id, status: 'running', detail: 'Synthetic browser state transition' })).ok()).toBe(true)
  await expect(page.locator('.bs-living-office [data-employee-id="AG-CEO-001"]').first()).toHaveAttribute('data-status', 'working', { timeout: 20_000 })
  expect((await bridge(request, ceo, 'hq_update_task', { id: task.id, status: 'blocked', detail: 'Synthetic blocked transition' })).ok()).toBe(true)
  await expect(page.locator('.bs-living-office [data-employee-id="AG-CEO-001"]').first()).toHaveAttribute('data-status', 'blocked', { timeout: 20_000 })
  await expect(page.getByText('Live execution unavailable', { exact: true }).first()).toBeVisible()
  await other.close()
})

test('reduced-motion mobile Arabic scene stays selectable, keyboard navigable and within the viewport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  const scene = page.locator('.bs-living-office')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  await expect(scene).toHaveAttribute('data-reduced-motion', 'true')
  await expect(scene.locator('[data-directory-employee-id]')).toHaveCount(4)
  expect(await scene.locator('.bs-living-office__labels button:visible').count()).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'تغيير المظهر' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const iris = scene.locator('[data-directory-employee-id="AG-HR-003"]').first()
  await iris.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toContainText('Iris')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/living-hq-mobile-ar-reduced-motion.png', fullPage: true })
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: 'Talk to CEO', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('WebGL context loss keeps an accessible office directory and does not imply a disconnected worker', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await login(page)
  const scene = page.locator('.bs-living-office')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  await scene.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await expect(scene).toHaveAttribute('data-renderer', 'fallback')
  await scene.locator('[data-directory-employee-id="AG-HR-002"]').first().click()
  await expect(page.getByRole('dialog')).toContainText('Noah')
  await page.keyboard.press('Escape')
  await expect(page.getByText('Live execution unavailable', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/living-hq-accessible-fallback.png', fullPage: true })
  await page.goto('/auth/login')
  expect(errors).toEqual([])
})

test('local invalidation stream requires founder auth and same origin and sends revisions without private data', async ({ request }) => {
  expect((await request.get('/api/hq/updates')).status()).toBe(401)
  const loginResponse = await request.post('/api/hq/auth/login', { headers: { Origin: origin }, data: { password: 'synthetic-browser-password' } })
  expect(loginResponse.ok()).toBe(true)
  const cookie = loginResponse.headers()['set-cookie']!.split(';')[0]!
  expect((await request.get('/api/hq/updates', { headers: { Origin: 'https://unapproved.example', Cookie: cookie } })).status()).toBe(403)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(origin + '/api/hq/updates', { headers: { Cookie: cookie, Origin: origin }, signal: controller.signal })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('cache-control')).toBe('no-store')
    reader = response.body!.getReader()
    const decoder = new TextDecoder(); let buffer = ''
    async function revision() {
      while (!buffer.includes('\n\n')) {
        const chunk = await reader!.read()
        if (chunk.done) throw Error('SSE closed before invalidation')
        buffer += decoder.decode(chunk.value, { stream: true })
      }
      const end = buffer.indexOf('\n\n'), frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
      expect(frame).toMatch(/^event: invalidate\ndata: /)
      const payload = JSON.parse(frame.split('\ndata: ')[1]!)
      expect(Object.keys(payload)).toEqual(['revision'])
      expect(payload.revision).toMatch(/^\d+$/)
      return payload.revision as string
    }
    const first = await revision()
    const saved = await command(request, { action: 'send_message', text: unique('Synthetic private SSE message') })
    expect(saved.ok()).toBe(true)
    expect(await revision()).not.toBe(first)
  } finally {
    clearTimeout(timeout); controller.abort(); void reader?.cancel().catch(() => {})
  }
})

test('synthetic Brain projection starts empty, routes new evidence to Noah, ignores unknown actors and never replays history', async ({ page }) => {
  // This is a renderer/projection fixture, not a Drive read, model run or saved Brain write.
  const known = { id: 'synthetic-brain-noah', direction: 'inbound', agentId: 'AG-HR-002', taskId: 'synthetic-render-fixture', createdAt: new Date().toISOString(), fileCount: 1 }
  const unknown = { ...known, id: 'synthetic-brain-unknown', agentId: 'AG-UNKNOWN-999' }
  let phase: 'empty' | 'fresh' | 'unknown' | 'history' = 'empty', unknownDelivered = false
  await page.addInitScript(() => {
    const observe = () => {
      const scene = document.querySelector('.bs-living-office')
      if (scene && Number(scene.getAttribute('data-brain-pulses')) > 0) {
        const recorded = new Set((document.documentElement.getAttribute('data-test-brain-observed') || '').split(',').filter(Boolean))
        for (const actor of (scene.getAttribute('data-brain-recipients') || '').split(',').filter(Boolean)) recorded.add(actor)
        document.documentElement.setAttribute('data-test-brain-observed', [...recorded].join(','))
      }
    }
    new MutationObserver(observe).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-brain-pulses', 'data-brain-recipients'] })
  })
  await page.route('**/api/hq/state', async route => {
    const response = await route.fetch(), body = await response.json()
    if (body.state) body.state.brain.events = phase === 'empty' ? [] : phase === 'fresh' ? [known] : [known, unknown]
    await route.fulfill({ response, json: body })
    if (phase === 'unknown') unknownDelivered = true
  })
  await login(page)
  const scene = page.locator('.bs-living-office')
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  expect(await scene.getAttribute('data-brain-pulses')).toBe('0')
  expect(await page.locator('html').getAttribute('data-test-brain-observed')).toBeNull()
  phase = 'fresh'
  expect((await command(page.request, { action: 'send_message', text: unique('Synthetic Brain invalidation trigger') })).ok()).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('data-test-brain-observed', 'AG-HR-002', { timeout: 20_000 })
  await expect(scene).toHaveAttribute('data-brain-pulses', '0')
  const before = Number(await scene.getAttribute('data-rendered-frames'))
  phase = 'unknown'
  expect((await command(page.request, { action: 'send_message', text: unique('Synthetic unknown actor invalidation') })).ok()).toBe(true)
  await expect.poll(() => unknownDelivered).toBe(true)
  await expect.poll(async () => Number(await scene.getAttribute('data-rendered-frames'))).toBeGreaterThan(before)
  expect(await scene.getAttribute('data-brain-pulses')).toBe('0')
  expect(await page.locator('html').getAttribute('data-test-brain-observed')).toBe('AG-HR-002')
  phase = 'history'
  await page.reload()
  await expect(scene).toHaveAttribute('data-renderer', 'webgl', { timeout: 20_000 })
  expect(await scene.getAttribute('data-brain-pulses')).toBe('0')
  expect(await page.locator('html').getAttribute('data-test-brain-observed')).toBeNull()
})
