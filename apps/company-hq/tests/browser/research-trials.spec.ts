import { expect, test, type Page } from '@playwright/test'
import { installWorkforceFixture } from './workforce-fixture'

/** Generated projections and intercepted HTTP only; no hosted trial or provider call. */
const trialId = '61000000-0000-4000-8000-000000000001'
const taskId = '62000000-0000-4000-8000-000000000001'
async function researchFixture(page: Page) {
  const fixture = await installWorkforceFixture(page)
  Object.assign(fixture.snapshot().agents[2]!, { id: 'AG-RES-002', name: 'Karim Generated', departmentKey: 'research-market-intelligence' })
  const research = { skillFileId: 'generated_research_skill', eligible: true, qualified: false, trialId: null as string | null,
    taskId: null as string | null, status: null as string | null, receiptIssued: false, reviewComplete: false, bindingCurrent: true }
  const row = { agentId: 'AG-RES-002', skillFileId: 'generated_research_skill', eligible: false, qualified: true,
    trialId: null as string | null, status: null as string | null, receiptIssued: false, reviewComplete: false, publicResearch: research }
  const posts: { path: string; body: Record<string, unknown>; headers: Record<string, string> }[] = []
  await page.route('**/api/hq/trials', route => route.fulfill({ json: [row] }))
  await page.route('**/api/hq/research-trials**', async route => {
    const request = route.request()
    posts.push({ path: new URL(request.url()).pathname, body: request.postDataJSON(), headers: request.headers() })
    await route.fulfill({ status: 500, json: { message: 'Generated controlled failure' } })
  })
  return { fixture, research, row, posts,
    async open() {
      await fixture.open()
      await page.getByRole('combobox', { name: 'Workplaces', exact: true }).click()
      await page.getByRole('option', { name: 'Fixture department', exact: true }).click()
      await page.getByRole('button', { name: 'Agent details: Karim Generated', exact: true }).click()
      return page.getByRole('complementary', { name: 'Karim Generated', exact: true })
    },
  }
}

test('Public Research start needs confirmation and sends one guarded request while pending', async ({ page }) => {
  const f = await researchFixture(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/hq/research-trials', async route => {
    const request = route.request(); f.posts.push({ path: '/api/hq/research-trials', body: request.postDataJSON(), headers: request.headers() })
    await pending
    Object.assign(f.research, { trialId, taskId, status: 'active', eligible: false })
    await route.fulfill({ json: { accepted: true, trialId, status: 'active' } })
  })
  const panel = await f.open()
  const start = panel.getByRole('button', { name: 'Start Public Research trial', exact: true })
  await start.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('one fixed generic public search for up to three results')
  await expect(dialog).toContainText('Starting does not grant qualification')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(f.posts).toHaveLength(0)
  await start.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start trial', exact: true }).click()
  await expect.poll(() => f.posts.length).toBe(1)
  await expect(start).toBeDisabled()
  expect(f.posts[0]!.body).toMatchObject({ skillFileId: 'generated_research_skill' })
  expect(f.posts[0]!.body.requestKey).toMatch(/^[0-9a-f-]{36}$/)
  expect(f.posts[0]!.headers['x-hq-access']).toBe('1'); expect(f.posts[0]!.headers['x-hq-brain']).toBe('1')
  expect(Object.keys(f.posts[0]!.body).sort()).toEqual(['requestKey', 'skillFileId'])
  release()
  await expect(panel.getByText('Public Research trial in progress', { exact: true })).toBeVisible()
  await expect(start).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Approve Public Research qualification', exact: true })).toHaveCount(0)
  expect(f.posts).toHaveLength(1); expect(f.fixture.unexpected).toEqual([]); expect(f.fixture.errors).toEqual([])
})

test('current independently reviewed Public Research proof uses its distinct qualification endpoint', async ({ page }) => {
  const f = await researchFixture(page)
  Object.assign(f.research, { trialId, taskId, status: 'passed', eligible: false, reviewComplete: true })
  Object.assign(f.row, { trialId, status: 'passed', reviewComplete: true })
  await page.route('**/api/hq/research-trials/qualification', async route => {
    f.posts.push({ path: '/api/hq/research-trials/qualification', body: route.request().postDataJSON(), headers: route.request().headers() })
    Object.assign(f.research, { receiptIssued: true, qualified: true })
    await route.fulfill({ json: { accepted: true } })
  })
  const panel = await f.open()
  await expect(panel.getByText('Reviewed Public Research trial ready for qualification', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Approve qualification', exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Approve Public Research qualification', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('independent reviews')
  await page.getByRole('dialog').getByRole('button', { name: 'Approve qualification', exact: true }).click()
  await expect(panel.getByText('Public Research tool qualified', { exact: true })).toBeVisible()
  expect(f.posts.map(({ path, body }) => ({ path, body }))).toEqual([{ path: '/api/hq/research-trials/qualification', body: { trialId } }])
  expect(f.fixture.unexpected).toEqual([]); expect(f.fixture.errors).toEqual([])
})

test('stale binding removes approval and a binding change during confirmation cannot submit', async ({ page }) => {
  const f = await researchFixture(page)
  Object.assign(f.research, { trialId, taskId, status: 'passed', reviewComplete: true, eligible: false })
  const panel = await f.open()
  await panel.getByRole('button', { name: 'Approve Public Research qualification', exact: true }).click()
  f.research.bindingCurrent = false
  await f.fixture.publish(f.fixture.snapshot())
  await expect(panel.getByText('Earlier Public Research evidence is not current; a new trial is required', { exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve qualification', exact: true }).click()
  expect(f.posts).toHaveLength(0)
  await expect(panel.getByRole('button', { name: 'Approve Public Research qualification', exact: true })).toHaveCount(0)
  expect(f.fixture.errors).toEqual([])
})

test('uncertain start is honest and retry preserves the original request identity', async ({ page }) => {
  const f = await researchFixture(page), panel = await f.open()
  for (let attempt = 0; attempt < 2; attempt++) {
    await panel.getByRole('button', { name: 'Start Public Research trial', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start trial', exact: true }).click()
    await expect.poll(() => f.posts.length).toBe(attempt + 1)
    await expect(panel.getByText('Trial action unconfirmed. Refresh before retrying; an uncertain start keeps the same request identity.', { exact: true })).toBeVisible()
  }
  expect(f.posts[0]!.body).toEqual(f.posts[1]!.body)
  await expect(panel.getByText('Public Research tool qualified', { exact: true })).toHaveCount(0)
  expect(f.fixture.unexpected).toEqual([]); expect(f.fixture.errors).toEqual([])
})
