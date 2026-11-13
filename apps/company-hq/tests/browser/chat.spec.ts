import { expect, test, type Locator, type Page } from '@playwright/test'
import type { HqAgentSnapshot } from '../../shared/types/agents'
import { installWorkforceFixture, lessonId, taskId, workforceSnapshot } from './workforce-fixture'

const founderId = '50000000-0000-4000-8000-000000000001'
const completedId = '50000000-0000-4000-8000-000000000004'

/** Synthetic events exercise the real wire parser and product projections. */
function chatSnapshot(): HqAgentSnapshot {
  const snapshot = workforceSnapshot(), now = new Date().toISOString()
  snapshot.conversationId = '40000000-0000-4000-8000-000000000001'
  snapshot.agents = snapshot.agents.map(agent => agent.id === 'AG-HR-001' ? { ...agent, name: 'Amaya Fixture' } : agent)
  snapshot.messages = [
    { id: founderId, role: 'founder', agentId: 'AG-CEO-001', text: 'Make this chat clear and easy to follow.', createdAt: now, replyTo: null },
    { id: '50000000-0000-4000-8000-000000000002', role: 'assistant', agentId: 'AG-CEO-001', text: '@Amaya Fixture please review the task. **Keep the conversation concise.**', createdAt: now, replyTo: founderId, kind: 'handoff', mentions: [{ agentId: 'AG-HR-001', name: 'Amaya Fixture' }] },
    { id: '50000000-0000-4000-8000-000000000003', role: 'assistant', agentId: 'AG-HR-001', text: 'I understand. I will prepare the task and acceptance criteria.', createdAt: now, replyTo: founderId, kind: 'acknowledgement' },
    { id: completedId, role: 'assistant', agentId: 'AG-HR-001', text: 'I created the task. @Unknown is plain text. <img src=x onerror="window.untrustedRan=true">', createdAt: now, replyTo: founderId, kind: 'task-result', taskId },
  ]
  snapshot.tasks = [{ id: taskId, title: 'Clear conversation task', brief: 'Present the real discussion and its task receipts.', acceptance: 'Founder and agent messages have distinct positions and safe content.', assigneeId: 'AG-HR-001', status: 'completed', createdAt: now, updatedAt: now, completedAt: now, repairCount: 0, deliverable: 'A reviewed fixture deliverable.', reviewSummary: 'Fixture acceptance reviewed.', error: null }]
  return snapshot
}

async function assertMessageSides(panel: Locator) {
  await expect(panel).not.toHaveClass(/-enter-active/)
  const founder = await panel.locator('[data-role="founder"] .bs-hq-chat__bubble').boundingBox()
  const agent = await panel.locator('[data-role="ceo"] .bs-hq-chat__bubble').boundingBox()
  const founderRow = await panel.locator('[data-role="founder"]').boundingBox()
  const agentAvatar = await panel.locator('[data-role="ceo"] .bs-hq-chat__avatar').boundingBox()
  expect(founder).not.toBeNull(); expect(agent).not.toBeNull()
  expect(founderRow).not.toBeNull(); expect(agentAvatar).not.toBeNull()
  expect(founder!.x + founder!.width).toBeGreaterThan(agent!.x + agent!.width)
  expect(Math.abs(founder!.x + founder!.width - founderRow!.x - founderRow!.width)).toBeLessThanOrEqual(1)
  expect(agentAvatar!.x + agentAvatar!.width).toBeLessThanOrEqual(agent!.x)
}

async function assertNoOverflow(page: Page, panel: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const composer = await panel.locator('.bs-hq-chat__composer').boundingBox()
  const bounds = await panel.boundingBox()
  expect(composer).not.toBeNull(); expect(bounds).not.toBeNull()
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
  expect(await panel.locator('.bs-hq-chat__transcript').evaluate(element => element.clientHeight)).toBeGreaterThan(30)
}

test('Chat preserves the workspace camera and selection and renders safe messages on opposite sides', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  await fixture.publish(chatSnapshot())
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('combobox', { name: 'Workplaces', exact: true }).click()
  await page.getByRole('option', { name: 'Fixture department', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fixture department', exact: true })).toBeVisible()
  // Selection's existing camera animation must settle before Chat opens.
  await page.waitForTimeout(700)
  const zoom = await page.locator('.bs-hq-layout__zoom-value').innerText()
  const workplace = await page.locator('.bs-hq-layout__workplace-picker .bs-select-label').innerText()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const panel = page.locator('.bs-hq-layout__chat-panel')
  await expect(panel.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible()
  await expect(panel.locator('.bs-hq-chat__message')).toHaveCount(4)
  await expect(page.locator('.bs-hq-layout__zoom-value')).toHaveText(zoom)
  await expect(page.locator('.bs-hq-layout__workplace-picker .bs-select-label')).toHaveText(workplace)
  await assertMessageSides(panel)
  await expect(panel.locator('[data-role="ceo"] .bs-hq-chat__avatar')).toHaveClass(/avatar--ceo/)
  await expect(panel.locator('.bs-hq-chat__mention')).toHaveText(['@Amaya Fixture'])
  await expect(panel.locator('.bs-hq-chat__emphasis')).toHaveText('Keep the conversation concise.')
  await expect(panel.getByText('I created the task. @Unknown is plain text. <img src=x onerror="window.untrustedRan=true">', { exact: true })).toBeVisible()
  await expect(panel.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { untrustedRan?: boolean }).untrustedRan)).toBeUndefined()
  await assertNoOverflow(page, panel)
  await panel.locator('.bs-hq-chat__transcript').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: '/tmp/hq-chat-desktop.png' })
  await panel.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.bs-hq-layout__zoom-value')).toHaveText(zoom)
  await expect(page.locator('.bs-hq-layout__workplace-picker .bs-select-label')).toHaveText(workplace)
  expect(fixture.unexpected).toEqual([])
  expect(fixture.errors).toEqual([])
})

test('task links and published Brain receipts open the exact sibling detail and return focus to Chat', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = chatSnapshot(), now = new Date().toISOString()
  snapshot.lessons = [
    { id: lessonId, sourceType: 'task', sourceId: taskId, status: 'proposed', summary: 'Published conversation lesson', body: 'Learned: concise handoffs make the discussion easier to follow.', agentId: 'AG-HR-001', createdAt: now, reviewedAt: null, publishedAt: null, publicationReference: null },
    { id: '30000000-0000-4000-8000-000000000002', sourceType: 'conversation', sourceId: founderId, status: 'accepted', summary: 'Accepted but unpublished', body: 'This proposal has not entered Brain.', agentId: 'AG-CEO-001', createdAt: now, reviewedAt: now, publishedAt: null, publicationReference: null },
  ]
  await fixture.publish(snapshot)
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const chat = page.locator('.bs-hq-layout__chat-panel'), detail = page.locator('.bs-hq-layout__conversation-detail')
  await expect(chat.locator('.bs-hq-chat__message')).toHaveCount(4)
  await expect(chat.locator('.bs-hq-chat__learning')).toHaveCount(0)
  const composer = chat.getByLabel('Message Steve', { exact: false })
  await composer.fill('Keep my unfinished draft.')
  const taskLink = chat.getByRole('button', { name: 'Open task · Clear conversation task', exact: true })
  await taskLink.click()
  await expect(detail.getByRole('heading', { name: 'Clear conversation task', exact: true })).toBeVisible()
  await expect(detail.getByText('A reviewed fixture deliverable.', { exact: true })).toBeVisible()
  await expect(chat).toBeVisible()
  await expect(composer).toHaveValue('Keep my unfinished draft.')
  await detail.getByRole('heading', { name: 'Tasks', exact: true }).press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(taskLink).toBeFocused()
  await fixture.publish({ ...snapshot, lessons: snapshot.lessons!.map(lesson => lesson.id === lessonId ? { ...lesson, status: 'published', reviewedAt: now, publishedAt: now, publicationReference: 'https://drive.google.com/file/d/fixture_chat_receipt/view' } : lesson) })
  const learning = chat.getByRole('button', { name: 'Brain updated · Published conversation lesson', exact: true })
  await expect(learning).toBeVisible()
  await expect(chat.locator('.bs-hq-chat__learning button')).toHaveCount(1)
  await learning.click()
  await expect(detail.getByRole('heading', { name: 'Published conversation lesson', exact: true })).toBeVisible()
  await expect(detail.getByText('Learned: concise handoffs make the discussion easier to follow.', { exact: true })).toBeVisible()
  await expect(detail.getByRole('heading', { name: 'Accepted but unpublished', exact: true })).toHaveCount(0)
  await detail.getByRole('heading', { name: 'Learning', exact: true }).press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(learning).toBeFocused()
  await expect(composer).toHaveValue('Keep my unfinished draft.')
  await composer.press('Escape')
  await expect(chat).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeFocused()
  expect(fixture.unexpected).toEqual([])
  expect(fixture.errors).toEqual([])
})

test('Arabic mobile keeps founder messages on the physical right and detail navigation returns to the preserved Chat', async ({ page, context }) => {
  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = await installWorkforceFixture(page)
  await fixture.open()
  const snapshot = chatSnapshot()
  snapshot.messages[0]!.text = 'أريد محادثة واضحة وسهلة المتابعة.'
  snapshot.messages[1]!.text = '@Amaya Fixture راجعي المهمة وحافظي على اختصار المحادثة.'
  await fixture.publish(snapshot)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'المحادثة', exact: true }).click()
  const chat = page.locator('.bs-hq-layout__chat-panel'), detail = page.locator('.bs-hq-layout__conversation-detail')
  await expect(chat.locator('.bs-hq-chat__message')).toHaveCount(4)
  await assertMessageSides(chat)
  await assertNoOverflow(page, chat)
  await chat.locator('.bs-hq-chat__transcript').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: '/tmp/hq-chat-mobile.png' })
  const taskLink = chat.getByRole('button', { name: 'فتح المهمة · Clear conversation task', exact: true })
  await taskLink.click()
  await expect(detail.getByRole('heading', { name: 'Clear conversation task', exact: true })).toBeVisible()
  await expect(chat).toBeHidden()
  await expect(chat).toHaveAttribute('inert', '')
  await detail.getByRole('heading', { name: 'المهام', exact: true }).press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(chat).toBeVisible()
  await expect(taskLink).toBeFocused()
  expect(fixture.unexpected).toEqual([])
  expect(fixture.errors).toEqual([])
})
