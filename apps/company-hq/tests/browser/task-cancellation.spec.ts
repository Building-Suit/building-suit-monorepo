import { expect, test, type Page, type Route } from '@playwright/test'
import { installWorkforceFixture, taskId } from './workforce-fixture'

/** Generated HTTP projections only. Never cancels hosted work. */
async function cancellation(page: Page) {
  const fixture = await installWorkforceFixture(page), now = new Date().toISOString()
  fixture.snapshot().tasks = [{ id: taskId, title: 'Generated stale trial task', brief: 'Keep original brief', acceptance: 'Keep original criteria', assigneeId: 'AG-HR-002', status: 'working', createdAt: now, updatedAt: now, completedAt: null, repairCount: 0, deliverable: 'Original immutable draft', reviewSummary: 'Original review evidence', error: null }]
  const posts: { path: string; headers: Record<string, string> }[] = []
  const handler = { reply: async (route: Route) => { fixture.snapshot().tasks![0]!.status = 'canceled'; await route.fulfill({ json: fixture.snapshot() }) } }
  await page.route(url => url.pathname.endsWith('/cancel'), async route => {
    const request = route.request(); posts.push({ path: new URL(request.url()).pathname, headers: request.headers() }); await handler.reply(route)
  })
  async function open() {
    await fixture.open(); await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await page.getByRole('button', { name: /Generated stale trial task/ }).click()
    return page.locator('.bs-hq-layout__conversation-detail')
  }
  return { fixture, posts, handler, open }
}
test('cancel confirms exact task, defaults to keeping it, then preserves original evidence', async ({ page }) => {
  const f = await cancellation(page), panel = await f.open(), cancel = panel.getByRole('button', { name: 'Cancel task', exact: true })
  await cancel.click(); const dialog = page.getByRole('dialog', { name: 'Cancel this task?', exact: true })
  await expect(dialog).toContainText(taskId); await expect(dialog).toContainText('Generated stale trial task'); await expect(dialog).toContainText('Existing drafts and review history will remain')
  await expect(dialog.getByRole('button', { name: 'Keep task', exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Keep task', exact: true }).click(); expect(f.posts).toHaveLength(0); await expect(cancel).toBeFocused()
  await cancel.click(); await dialog.getByRole('button', { name: 'Cancel task', exact: true }).click()
  await expect(panel).toContainText('Task cancellation confirmed.'); await expect(cancel).toHaveCount(0)
  await expect(panel).toContainText('Original immutable draft'); await expect(panel).toContainText('Original review evidence')
  expect(f.posts).toHaveLength(1); expect(f.posts[0]!.path).toBe(`/api/hq/tasks/${taskId}/cancel`); expect(f.posts[0]!.headers['x-hq-access']).toBe('1')
  expect(f.fixture.unexpected).toEqual([]); expect(f.fixture.errors).toEqual([])
})
test('pending cancellation is single-shot and an uncertain result requires a new explicit confirmation', async ({ page }) => {
  const f = await cancellation(page); let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  f.handler.reply = async route => { await held; await route.fulfill({ status: 500, json: { message: 'Generated uncertain transport' } }) }
  const panel = await f.open(); await panel.getByRole('button', { name: 'Cancel task', exact: true }).dblclick()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel task', exact: true }).click()
  await expect.poll(() => f.posts.length).toBe(1); await expect(panel.getByRole('button', { name: 'Canceling task…', exact: true })).toBeDisabled()
  release(); await expect(panel).toContainText('Cancellation is unconfirmed.'); expect(f.posts).toHaveLength(1)
  await panel.getByRole('button', { name: 'Cancel task', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Keep task', exact: true }).click()
  expect(f.posts).toHaveLength(1); expect(f.fixture.errors).toEqual([])
})
test('task completing while confirmation is open cannot be canceled', async ({ page }) => {
  const f = await cancellation(page), panel = await f.open()
  await panel.getByRole('button', { name: 'Cancel task', exact: true }).click()
  f.fixture.snapshot().tasks![0]!.status = 'completed'; await f.fixture.publish(f.fixture.snapshot())
  await expect(panel.getByRole('button', { name: 'Cancel task', exact: true })).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel task', exact: true }).click()
  expect(f.posts).toHaveLength(0); await expect(panel).toContainText('Original immutable draft'); expect(f.fixture.errors).toEqual([])
})
test('older task keeps cancellation feedback while detail reload is delayed', async ({ page }) => {
  const f = await cancellation(page)
  await page.route(url => url.pathname === '/api/hq/agents', route => route.fulfill({ json: { ...f.fixture.snapshot(), tasks: [] } }))
  let detailReads = 0, release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route(url => url.pathname === '/api/hq/tasks' && url.searchParams.has('taskId'), async route => {
    detailReads += 1
    if (detailReads >= 4) await held
    await route.fulfill({ json: { counts: { running: 0, waiting: 0, done: 1 }, items: f.fixture.snapshot().tasks } })
  })
  const panel = await f.open(); await panel.getByRole('button', { name: 'Cancel task', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel task', exact: true }).click()
  await expect.poll(() => detailReads).toBeGreaterThanOrEqual(4); release()
  await expect(panel).toContainText('Task cancellation confirmed.'); await expect(panel).toContainText('Original immutable draft'); expect(f.posts).toHaveLength(1)
})
