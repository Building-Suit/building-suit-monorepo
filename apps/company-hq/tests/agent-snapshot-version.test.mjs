/** Deployment compatibility for existing open tabs. No hosted reads/writes. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const require = createRequire(new URL('../package.json', import.meta.url))
const nuxt = createRequire(require.resolve('nuxt/package.json'))
// Match the app's Nitro server runtime rather than Nuxt's separate H3 tooling.
const runtime = createRequire(nuxt.resolve('nitropack/package.json'))
const h3 = pathToFileURL(runtime.resolve('h3')).href
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'h3' && context.parentURL?.endsWith('/server/utils/hqAgents.ts')) return nextResolve(h3, context)
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
    && (context.parentURL?.endsWith('/server/utils/hqAgents.ts') || context.parentURL?.includes('/shared/types/'))) {
    return nextResolve(specifier + '.ts', context)
  }
  return nextResolve(specifier, context)
} })
const { hqAgentSnapshot } = await import('../server/utils/hqAgents.ts')
const event = value => {
  const headers = value === undefined ? {} : { 'x-hq-chat-progress': value }
  return { headers: new Headers(headers), node: { req: { headers } } }
}
function snapshot() {
  const now = new Date().toISOString()
  return { agents: [], messages: [], jobs: [{ id: randomUUID(), agentId: 'AG-CEO-001', status: 'blocked',
    createdAt: now, startedAt: now, completedAt: now, error: 'response-too-large', kind: 'conversation-intake',
    founderMessageId: randomUUID(), recoveryOf: null }], runtime: { connected: true, lastSeenAt: now }, conversationId: randomUUID() }
}

test('existing open tabs retain the exact legacy job shape after metadata deployment', () => {
  const input = snapshot()
  const expected = ['id', 'agentId', 'status', 'createdAt', 'startedAt', 'completedAt', 'error'].sort()
  for (const request of [undefined, event(), event('0'), event('unknown')]) {
    const result = hqAgentSnapshot(input, request)
    assert.deepEqual(Object.keys(result.jobs[0]).sort(), expected)
    assert.equal(result.jobs[0].id, input.jobs[0].id)
    assert.equal(result.jobs[0].status, 'blocked')
  }
  assert.equal(input.jobs[0].kind, 'conversation-intake')
})

test('capable clients receive validated progress metadata and legacy database responses stay compatible', () => {
  const input = snapshot()
  assert.deepEqual(hqAgentSnapshot(input, event('1')), input)
  const legacy = hqAgentSnapshot(input)
  assert.deepEqual(hqAgentSnapshot(legacy, event('1')), legacy)
})

test('presentation negotiation cannot hide malformed data or leaked worker authority', () => {
  for (const request of [event(), event('1')]) {
    const input = snapshot()
    input.jobs[0].workerId = randomUUID()
    assert.throws(() => hqAgentSnapshot(input, request), error => error.statusCode === 503)
  }
})
