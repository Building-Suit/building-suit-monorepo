import { expect, test } from '@playwright/test'
import type { HqAgentJob, HqAgentSnapshot } from '../../shared/types/agents'
import { installWorkforceFixture, taskId, workforceSnapshot } from './workforce-fixture'

const oldMessageId = '50000000-0000-4000-8000-000000000020'
const messageId = '50000000-0000-4000-8000-000000000021'
const intakeId = '60000000-0000-4000-8000-000000000021'
const recoveryId = '60000000-0000-4000-8000-000000000001'

function job(status: HqAgentJob['status'], options: Partial<HqAgentJob> = {}): HqAgentJob {
  const now = new Date().toISOString()
  return { id: intakeId, agentId: 'AG-CEO-001', kind: 'conversation-intake', founderMessageId: messageId, recoveryOf: null,
    status, createdAt: now, startedAt: status === 'queued' ? null : now, completedAt: status === 'blocked' || status === 'completed' ? now : null,
    error: status === 'blocked' ? 'stage-output-invalid' : null, ...options }
}
function conversation(): HqAgentSnapshot {
  const snapshot = workforceSnapshot(), now = new Date().toISOString()
  return { ...snapshot, conversationId: '40000000-0000-4000-8000-000000000001',
    agents: snapshot.agents.map(agent => agent.id === 'AG-HR-001' ? { ...agent, name: 'Amaya Fixture' } : agent),
    messages: [
      { id: oldMessageId, role: 'founder', agentId: 'AG-CEO-001', text: 'An earlier request.', createdAt: new Date(Date.now() - 1000).toISOString(), replyTo: null },
      { id: messageId, role: 'founder', agentId: 'AG-CEO-001', text: 'Please handle my current request.', createdAt: now, replyTo: null },
    ],
    jobs: [job('blocked', { id: '60000000-0000-4000-8000-000000000020', founderMessageId: oldMessageId, createdAt: new Date(Date.now() - 1000).toISOString() })],
  }
}

test('a failed current intake is visible as a message-linked receipt without inventing an assistant reply', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = conversation()
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, job('queued')] })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const composer = page.getByRole('textbox', { name: 'Message Steve', exact: true })
  await composer.fill('Keep my next draft while this request updates.')
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, job('blocked')] })
  const receipt = page.locator('.bs-hq-chat__request-progress')
  await expect(receipt).toHaveCount(1)
  await expect(receipt).toHaveAttribute('data-request-state', 'recovery-needed')
  await expect(receipt).toContainText('Steve Fixture')
  await expect(receipt).toContainText('This request needs recovery.')
  await expect(receipt.locator('xpath=..').locator('[data-role="founder"]')).toContainText('Please handle my current request.')
  await expect(page.locator('.bs-hq-chat__message:not([data-role="founder"])')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /retry/i })).toHaveCount(0)
  await expect(composer).toHaveValue('Keep my next draft while this request updates.')
  await expect(composer).toBeFocused()
  await expect(page.getByText('Worker connected · Agents working: 0', { exact: true })).toBeVisible()
  await page.locator('.bs-hq-layout__chat-panel').screenshot({ path: '/tmp/hq-chat-intake-progress-desktop.png' })
  expect(fixture.errors).toEqual([])
})

test('queued and working intake, explicit recovery and actual handoff/acknowledgment follow their source records', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = conversation()
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, job('queued')] })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const receipt = page.locator('.bs-hq-chat__request-progress')
  await expect(receipt).toHaveText('Steve FixtureQueued to work on this request.')
  const working = { ...snapshot, jobs: [...snapshot.jobs, job('working')], agents: snapshot.agents.map(agent => agent.id === 'AG-CEO-001' ? { ...agent, status: 'working' as const, taskId: intakeId, lastSeenAt: new Date().toISOString() } : agent) }
  await fixture.publish(working)
  await expect(receipt).toHaveAttribute('data-request-state', 'working')
  await expect(receipt).toContainText('Working on this request.')
  await expect(page.getByText('Worker connected · Agents working: 1', { exact: true })).toBeVisible()
  // Recovery has the same millisecond timestamp and a lower UUID: lineage,
  // rather than UUID/time ordering, must select it over its failed source.
  const failed = job('blocked')
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, failed, job('queued', { id: recoveryId, recoveryOf: intakeId, createdAt: failed.createdAt })] })
  await expect(receipt).toHaveAttribute('data-recovering', 'true')
  await expect(receipt).toContainText('Recovery is queued for this request.')
  await fixture.publish({ ...working, jobs: [...snapshot.jobs, failed, job('working', { id: recoveryId, recoveryOf: intakeId, createdAt: failed.createdAt })] })
  await expect(receipt).toContainText('Recovering this request.')
  const now = new Date().toISOString()
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, failed, job('completed', { id: recoveryId, recoveryOf: intakeId, createdAt: failed.createdAt })], messages: [...snapshot.messages,
    { id: '50000000-0000-4000-8000-000000000022', role: 'assistant', agentId: 'AG-CEO-001', text: '@Amaya Fixture review the request and prepare its next steps.', createdAt: now, replyTo: messageId, kind: 'handoff', mentions: [{ agentId: 'AG-HR-001', name: 'Amaya Fixture' }] },
    { id: '50000000-0000-4000-8000-000000000023', role: 'assistant', agentId: 'AG-HR-001', text: 'I understand the request and will prepare the agreed task.', createdAt: now, replyTo: messageId, kind: 'acknowledgement' },
  ] })
  await expect(receipt).toHaveCount(0)
  await expect(page.locator('.bs-hq-chat__message[data-kind="handoff"]')).toContainText('Steve Fixture')
  await expect(page.locator('.bs-hq-chat__message[data-kind="acknowledgement"]')).toContainText('Amaya Fixture')
  await expect(page.locator('.bs-hq-chat__mention')).toHaveText('@Amaya Fixture')
  await expect(page.locator('.bs-hq-chat__message:not([data-role="founder"])')).toHaveCount(2)
  expect(fixture.errors).toEqual([])
})

test('old or legacy jobs do not label a new request; matching failures have accessible Arabic copy', async ({ page, context }) => {
  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = conversation()
  const legacy = job('blocked', { id: '60000000-0000-4000-8000-000000000030' })
  delete legacy.kind; delete legacy.founderMessageId; delete legacy.recoveryOf
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, legacy] })
  await page.getByRole('button', { name: 'المحادثة', exact: true }).click()
  const receipt = page.locator('.bs-hq-chat__request-progress')
  await expect(page.locator('.bs-hq-chat__message')).toHaveCount(2)
  await expect(receipt).toHaveCount(0)
  await fixture.publish({ ...snapshot, jobs: [...snapshot.jobs, job('blocked')] })
  await expect(receipt).toHaveAttribute('role', 'status')
  await expect(receipt).toHaveAttribute('aria-live', 'polite')
  await expect(receipt).toContainText('يحتاج هذا الطلب إلى متابعة')
  await expect(receipt).toContainText('Steve Fixture')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.bs-hq-layout__chat-panel').screenshot({ path: '/tmp/hq-chat-intake-progress-mobile.png' })
  expect(fixture.errors).toEqual([])
})


test('actual task execution remains visible after handoff and acknowledgment through failure, recovery, review and final report', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = conversation(), now = new Date().toISOString()
  const stageTime = new Date(Date.now() + 1000).toISOString().slice(0, -1)
  const workId = '60000000-0000-4000-8000-000000000033'
  const supervisorId = '60000000-0000-4000-8000-000000000003'
  const recoveredAckId = '60000000-0000-4000-8000-000000000004'
  const recoveredWorkId = '60000000-0000-4000-8000-000000000005'
  const reviewId = '60000000-0000-4000-8000-000000000002'
  const reportId = '60000000-0000-4000-8000-000000000034'
  const messages: HqAgentSnapshot['messages'] = [...snapshot.messages,
    { id: '50000000-0000-4000-8000-000000000022', role: 'assistant', agentId: 'AG-CEO-001', text: '@Amaya Fixture review the request and deliver the task.', createdAt: now, replyTo: messageId, kind: 'handoff', taskId, mentions: [{ agentId: 'AG-HR-001', name: 'Amaya Fixture' }] },
    { id: '50000000-0000-4000-8000-000000000023', role: 'assistant', agentId: 'AG-HR-001', text: 'I understand the task and will prepare its deliverable.', createdAt: now, replyTo: messageId, kind: 'acknowledgement', taskId },
  ]
  const task = { id: taskId, title: 'Current source-linked task', brief: 'Prepare the requested deliverable.', acceptance: 'Submit it for actual review.', assigneeId: 'AG-HR-001', status: 'working' as const, createdAt: now, updatedAt: now, completedAt: null, repairCount: 0, deliverable: null, reviewSummary: null, error: null }
  const agents = snapshot.agents.map(agent => agent.id === 'AG-HR-001' ? { ...agent, status: 'working' as const, taskId, lastSeenAt: now } : agent)
  const baseJobs = [...snapshot.jobs, job('completed'), job('completed', { id: '60000000-0000-4000-8000-000000000032', kind: 'task-ack', agentId: 'AG-HR-001' })]
  const work = job('working', { id: workId, kind: 'task-work', agentId: 'AG-HR-001', createdAt: `${stageTime}000Z` })
  // Later unrelated/learning failures must not replace this request's work.
  const distractions = [
    job('blocked', { id: '60000000-0000-4000-8000-000000000070', kind: 'task-work', founderMessageId: oldMessageId, createdAt: `${stageTime}009Z` }),
    job('blocked', { id: '60000000-0000-4000-8000-000000000071', kind: 'lesson-extract', createdAt: `${stageTime}009Z` }),
  ]
  await fixture.publish({ ...snapshot, agents, messages, tasks: [task], jobs: [...baseJobs, work, ...distractions] })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const receipt = page.locator('.bs-hq-chat__request-progress')
  const composer = page.getByRole('textbox', { name: 'Message Steve', exact: true })
  await composer.fill('Keep my next request draft.')
  await expect(receipt).toHaveAttribute('data-request-state', 'working')
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt).toContainText('Working on this request.')
  await expect(receipt.locator('xpath=..').locator('[data-kind="acknowledgement"]')).toContainText('I understand the task')
  // An older request may finish after this request's acknowledgment. Its
  // actual report and completed task must neither hide nor reanchor this work.
  const oldTaskId = '10000000-0000-4000-8000-000000000050'
  await fixture.publish({ ...snapshot, agents, messages: [...messages,
    { id: '50000000-0000-4000-8000-000000000050', role: 'assistant', agentId: 'AG-CEO-001', text: 'The earlier task is complete.', createdAt: now, replyTo: oldMessageId, kind: 'task-result', taskId: oldTaskId },
  ], tasks: [task, { ...task, id: oldTaskId, status: 'completed', completedAt: now, deliverable: 'Earlier task output.' }], jobs: [...baseJobs, work, ...distractions] })
  await expect(page.locator('.bs-hq-chat__message[data-kind="task-result"]')).toContainText('The earlier task is complete.')
  await expect(receipt).toHaveAttribute('data-request-state', 'working')
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt.locator('xpath=..').locator('[data-kind="acknowledgement"]')).toContainText('I understand the task')
  const failed = { ...work, status: 'blocked' as const, completedAt: now, error: 'provider-output-invalid' }
  await fixture.publish({ ...snapshot, agents, messages, tasks: [{ ...task, status: 'blocked', completedAt: now, error: 'provider-output-invalid' }], jobs: [...baseJobs, failed, ...distractions] })
  await expect(receipt).toHaveAttribute('data-request-state', 'recovery-needed')
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt).toContainText('This request needs recovery.')
  await expect(page.locator('.bs-hq-chat__message:not([data-role="founder"])')).toHaveCount(2)
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('Keep my next request draft.')
  await page.locator('.bs-hq-layout__chat-panel').screenshot({ path: '/tmp/hq-chat-task-progress-desktop.png' })
  // The owner helper queues a real supervisor route, not a direct rerun of
  // Amaya's failed work. Only its audit links back to the failed source.
  const recovery = job('queued', { id: supervisorId, kind: 'task-route', recoveryOf: workId, createdAt: `${stageTime}001Z` })
  await fixture.publish({ ...snapshot, agents, messages, tasks: [{ ...task, status: 'queued' }], jobs: [...baseJobs, failed, recovery, ...distractions] })
  await expect(receipt).toHaveAttribute('data-recovering', 'true')
  await expect(receipt).toContainText('Steve Fixture')
  await expect(receipt).toContainText('Recovery is queued for this request.')
  await expect(page.locator('.bs-hq-chat__message:not([data-role="founder"])')).toHaveCount(2)
  await fixture.publish({ ...snapshot, agents, messages, tasks: [task], jobs: [...baseJobs, failed, { ...recovery, status: 'working', startedAt: now }, ...distractions] })
  await expect(receipt).toContainText('Recovering this request.')
  const recovered = { ...recovery, status: 'completed' as const, startedAt: now, completedAt: now }
  const routedMessages: HqAgentSnapshot['messages'] = [...messages,
    { id: '50000000-0000-4000-8000-000000000024', role: 'assistant', agentId: 'AG-CEO-001', text: '@Amaya Fixture retain every criterion and prepare the repaired task.', createdAt: now, replyTo: messageId, kind: 'handoff', taskId, mentions: [{ agentId: 'AG-HR-001', name: 'Amaya Fixture' }] },
  ]
  const acknowledgment = job('working', { id: recoveredAckId, kind: 'task-ack', agentId: 'AG-HR-001', createdAt: `${stageTime}002Z` })
  await fixture.publish({ ...snapshot, agents, messages: routedMessages, tasks: [task], jobs: [...baseJobs, failed, recovered, acknowledgment, ...distractions] })
  await expect(receipt).toHaveAttribute('data-request-state', 'working')
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt.locator('xpath=..').locator('[data-kind="handoff"]')).toContainText('retain every criterion')
  const recoveredMessages: HqAgentSnapshot['messages'] = [...routedMessages,
    { id: '50000000-0000-4000-8000-000000000025', role: 'assistant', agentId: 'AG-HR-001', text: 'I understand the remedy and will keep all original criteria.', createdAt: now, replyTo: messageId, kind: 'acknowledgement', taskId },
  ]
  const acknowledged = { ...acknowledgment, status: 'completed' as const, completedAt: now }
  const repairedWork = job('working', { id: recoveredWorkId, kind: 'task-work', agentId: 'AG-HR-001', createdAt: `${stageTime}003Z` })
  await fixture.publish({ ...snapshot, agents, messages: recoveredMessages, tasks: [task], jobs: [...baseJobs, failed, recovered, acknowledged, repairedWork, ...distractions] })
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt.locator('xpath=..').locator('[data-kind="acknowledgement"]')).toContainText('keep all original criteria')
  const repaired = { ...repairedWork, status: 'completed' as const, completedAt: now }
  // The next review has a lower UUID and differs by one microsecond: exact
  // stage time ordering must select it over the completed repaired work.
  const review = job('working', { id: reviewId, kind: 'ceo-review', createdAt: `${stageTime}004Z` })
  const recoveredJobs = [...baseJobs, failed, recovered, acknowledged, repaired]
  await fixture.publish({ ...snapshot, agents, messages: recoveredMessages, tasks: [{ ...task, status: 'review' }], jobs: [...recoveredJobs, review, ...distractions] })
  await expect(receipt).toHaveAttribute('data-request-state', 'working')
  await expect(receipt).toContainText('Steve Fixture')
  await expect(receipt).toContainText('Working on this request.')
  const report = job('working', { id: reportId, kind: 'task-report', agentId: 'AG-HR-001', createdAt: `${stageTime}005Z` })
  await fixture.publish({ ...snapshot, agents, messages: recoveredMessages, tasks: [{ ...task, status: 'review' }], jobs: [...recoveredJobs, { ...review, status: 'completed', completedAt: now }, report, ...distractions] })
  await expect(receipt).toContainText('Amaya Fixture')
  await expect(receipt).toContainText('Working on this request.')
  const completed = { ...snapshot, agents, messages: [...recoveredMessages,
    { id: '50000000-0000-4000-8000-000000000026', role: 'assistant' as const, agentId: 'AG-HR-001', text: 'The reviewed task is complete. Its deliverable is available.', createdAt: now, replyTo: messageId, kind: 'task-result' as const, taskId },
  ], tasks: [{ ...task, status: 'completed' as const, completedAt: now, deliverable: 'Actual fixture deliverable.' }], jobs: [...recoveredJobs, { ...review, status: 'completed' as const, completedAt: now }, { ...report, status: 'completed' as const, completedAt: now }, ...distractions] }
  await fixture.publish(completed)
  await expect(receipt).toHaveCount(0)
  await expect(page.locator('.bs-hq-chat__message[data-kind="task-result"]')).toContainText('The reviewed task is complete.')
  await expect(page.locator('.bs-hq-chat__message:not([data-role="founder"])')).toHaveCount(5)
  // A completed task is also sufficient evidence when its older report falls
  // outside the bounded transcript; learning failures remain independent.
  await fixture.publish({ ...completed, messages: recoveredMessages })
  await expect(receipt).toHaveCount(0)
  await expect(composer).toHaveValue('Keep my next request draft.')
  expect(fixture.errors).toEqual([])
})
