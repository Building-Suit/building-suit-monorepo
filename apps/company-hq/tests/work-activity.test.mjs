import test from 'node:test'
import assert from 'node:assert/strict'
import { hqWorkActivity } from '../app/utils/hqWorkActivity.ts'

const now = Date.parse('2026-11-05T21:00:00Z'), fresh = new Date(now - 10_000).toISOString()
const snapshot = () => ({
  agents: [{ id: 'AG-CEO-001', name: 'Steve', status: 'working', lastSeenAt: fresh, taskId: 'task-a' }],
  jobs: [
    { id: 'old', agentId: 'AG-HR-001', status: 'blocked', kind: 'task-work', createdAt: fresh },
    { id: 'queue', agentId: 'AG-HR-001', status: 'queued', kind: 'task-report', createdAt: fresh, startedAt: null },
    { id: 'review', agentId: 'AG-CEO-001', status: 'working', kind: 'ceo-review', founderMessageId: 'request', createdAt: fresh, startedAt: fresh },
  ],
  messages: [{ role: 'assistant', replyTo: 'request', taskId: 'task-a' }],
  tasks: [{ id: 'task-a', title: 'Acquisition plan', assigneeId: 'AG-HR-001', status: 'review' }],
})
test('current work names the actual reviewer, stage and task; old failed stages stay out', () => {
  const items = hqWorkActivity(snapshot(), true, now)
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { id: 'review', agentId: 'AG-CEO-001', agentName: 'Steve', stage: 'ceo-review', state: 'working', createdAt: fresh, startedAt: fresh, taskId: 'task-a', taskTitle: 'Acquisition plan' })
  assert.equal(items[1].state, 'queued')
})
test('host loss, stale observations and a mismatched agent job cannot claim live work', () => {
  assert.equal(hqWorkActivity(snapshot(), false, now)[0].state, 'unconfirmed')
  assert.equal(hqWorkActivity(snapshot(), true, now + 151_000)[0].state, 'unconfirmed')
  const changed = snapshot(); changed.agents[0].taskId = 'other'
  assert.equal(hqWorkActivity(changed, true, now)[0].state, 'unconfirmed')
})
test('missing/ambiguous transcript coverage never invents a task link; no jobs means no work', () => {
  const value = snapshot(); value.messages.push({ replyTo: 'request', taskId: 'task-b' })
  assert.equal(hqWorkActivity(value, true, now)[0].taskId, undefined)
  value.jobs = []
  assert.deepEqual(hqWorkActivity(value, true, now), [])
})
