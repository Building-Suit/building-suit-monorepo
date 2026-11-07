import { expect, type Page } from '@playwright/test'
import type { HqAgentSnapshot } from '../../shared/types/agents'

const departmentId = '10000000-0000-4000-8000-000000000001'
export const taskId = '20000000-0000-4000-8000-000000000001'
export const lessonId = '30000000-0000-4000-8000-000000000001'
const ids = ['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-HR-003', 'AG-RES-001', 'AG-SALES-001', 'AG-CS-001', 'AG-SOC-001', 'AG-EMAIL-001', 'AG-DEV-001']

/** Synthetic browser projections only; no Auth session, worker or provider is created. */
export function workforceSnapshot(): HqAgentSnapshot {
  const now = new Date().toISOString()
  return {
    version: 2, conversationId: null, messages: [], jobs: [], tasks: [], lessons: [],
    runtime: { connected: true, lastSeenAt: now },
    agents: ids.map((id, index) => ({
      id, name: index === 0 ? 'Steve Fixture' : `Fixture employee ${index + 1}`,
      role: index === 0 ? 'CEO' : index === 1 ? 'HR Lead' : 'Fixture specialist',
      departmentId: index === 0 ? null : departmentId, departmentKey: index === 0 ? null : 'fixture-team',
      deskIndex: Math.max(0, index - 1), status: index === 0 ? 'idle' : 'offline', taskId: null,
      lastSeenAt: index === 0 ? now : null, profileFileId: `fixture_profile_${index}`,
      skillFileIds: [], lifecycle: 'active', model: 'gpt-fixture', effort: 'high',
      managerId: index === 0 ? null : ids[0]!, capability: 'bounded-drafting',
    })),
  }
}

/** Match the live roster's role-key fallback without using hosted records. */
export function canonicalRoleFallbacks(snapshot: HqAgentSnapshot): HqAgentSnapshot {
  const departments: Record<string, string> = {
    'AG-HR-002': 'hr-agent-development', 'AG-HR-003': 'hr-agent-development',
    'AG-RES-001': 'research-market-intelligence', 'AG-SALES-001': 'customer-acquisition-partnerships',
    'AG-CS-001': 'customer-success-onboarding', 'AG-SOC-001': 'social-community',
    'AG-EMAIL-001': 'email-lifecycle', 'AG-DEV-001': 'development-maintenance',
  }
  return { ...snapshot, agents: snapshot.agents.map(agent => departments[agent.id] ? { ...agent, role: departments[agent.id]!, departmentKey: departments[agent.id]!, departmentId: null } : agent) }
}

export async function installWorkforceFixture(page: Page, options: { founder?: boolean; rejectTasks?: boolean } = {}) {
  let snapshot = workforceSnapshot()
  const requests: string[] = [], taskRequests: Record<string, unknown>[] = [], chatRequests: Record<string, unknown>[] = [], unexpected: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // This open browser-only stream accepts explicit change frames. Ending an
  // SSE mock would instead exercise reconnect timers and obscure push behavior.
  await page.addInitScript(() => {
    // This suite covers the workforce DOM and supported no-WebGL fallback.
    // Software rasterization of the entire ocean is a separate visual test.
    const originalContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value(contextId: string, ...args: unknown[]) {
      return contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl' ? null : Reflect.apply(originalContext, this, [contextId, ...args])
    } })
    const originalFetch = window.fetch.bind(window)
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined
    const encoder = new TextEncoder()
    const fixture = { connections: 0, emit(topic: string, data: unknown = {}) { stream?.enqueue(encoder.encode(`event: ${topic}\ndata: ${JSON.stringify(data)}\n\n`)) } }
    Object.assign(window, { __hqWorkforceStream: fixture })
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (new URL(url, location.href).pathname !== '/api/hq/events') return originalFetch(input, init)
      fixture.connections += 1
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller; fixture.emit('ready')
          init?.signal?.addEventListener('abort', () => { stream = undefined; controller.close() }, { once: true })
        },
        cancel() { stream = undefined },
      })
      return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    }
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    requests.push(`${request.method()} ${path}`)
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/hq/meetings/availability') return json({ demonstration: false, live: false, blockers: [] })
    if (path === '/api/hq/trials') return json([])
    if (path === '/api/hq/access') return json(options.founder === false ? { status: 'anonymous' } : { status: 'founder', user: { displayName: 'Founder fixture', detailLabel: 'founder@example.invalid' } })
    if (path === '/api/hq/company') return json({ plans: [], departments: [{ id: departmentId, name: 'Fixture department', nameAr: 'قسم تجريبي', approvedAt: new Date(Date.now() - 1000).toISOString(), agents: snapshot.agents.slice(1).map(({ id, name }) => ({ id, name })) }] })
    if (path === '/api/brain') return json({ status: 'connected', source: 'google-drive', observedAt: new Date().toISOString(), notes: [], count: 0, partial: false })
    if (path === '/api/hq/agents') return json(snapshot)
    if (path === '/api/hq/tasks' && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      taskRequests.push(body)
      if (options.rejectTasks) return json({ statusCode: 503, message: 'Fixture unavailable' }, 503)
      const now = new Date().toISOString()
      snapshot = { ...snapshot, tasks: [{ id: taskId, title: String(body.title), brief: String(body.brief), acceptance: String(body.acceptance), assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : null, status: 'queued', createdAt: now, updatedAt: now, completedAt: null, repairCount: 0, deliverable: null, reviewSummary: null, error: null }] }
      return json(snapshot)
    }
    if (path === '/api/hq/ceo/messages' && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      chatRequests.push(body)
      snapshot = { ...snapshot, conversationId: '40000000-0000-4000-8000-000000000001', messages: [{ id: '50000000-0000-4000-8000-000000000001', role: 'founder', agentId: ids[0]!, text: String(body.prompt), createdAt: new Date().toISOString(), replyTo: null }] }
      return json(snapshot)
    }
    unexpected.push(`${request.method()} ${path}`)
    return json({ message: 'Unmocked fixture API' }, 500)
  })
  return {
    requests, taskRequests, chatRequests, unexpected, errors, snapshot: () => snapshot,
    async open() {
      await page.goto('/')
      // SSR buttons are visible before Vue attaches their listeners. The
      // founder display is a mounted, freshly fetched identity projection.
      await expect.poll(() => requests.includes('GET /api/hq/access'), { timeout: 15000 }).toBe(true)
      if (options.founder !== false) await expect(page.getByText('Founder fixture', { exact: true })).toBeVisible({ timeout: 15000 })
    },
    async publish(value: HqAgentSnapshot) {
      snapshot = value
      await page.evaluate(() => (window as unknown as { __hqWorkforceStream: { emit(topic: string): void } }).__hqWorkforceStream.emit('agents'))
    },
  }
}
