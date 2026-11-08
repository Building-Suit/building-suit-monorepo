import { expect, test } from '@playwright/test'
import { installWorkforceFixture, taskId } from './workforce-fixture'

/** Generated projections only; no real founder session, hire or provider call. */
function staffingSnapshot() {
  return { version: 1, canonicalWriter: 'unavailable', workflows: [{
    id: '70000000-0000-4000-8000-000000000001', sourceTaskId: taskId, planningTaskId: '70000000-0000-4000-8000-000000000002',
    status: 'approval-required', blocker: 'staffing-founder-approval-required', updatedAt: new Date().toISOString(),
    planId: '70000000-0000-4000-8000-000000000003', digest: 'a'.repeat(64), decision: null as string | null, resumeOriginal: null as boolean | null,
    plan: { originalTask: { title: 'Synthetic original request', brief: 'One bounded internal draft.', acceptance: 'No external action.' }, agentId: 'AG-DEV-099', name: 'Synthetic hire', managerId: 'AG-DEV-001', departmentKey: 'development-maintenance', reviewerId: 'AG-HR-003',
      profileDraft: '# Synthetic profile\nInternal bounded drafting only. <script>throw Error("never execute")</script>',
      skills: [{ fileId: 'synthetic_skill_a', sourceVersion: '7' }, { fileId: 'synthetic_skill_b', sourceVersion: '2' }],
      modelPolicy: { model: 'gpt-6.1-terra', effort: 'medium', sourceVersion: '11' },
      trialCriteria: 'Real execution for each skill, same-artifact head and independent review; no external actions.', resumeOriginal: true },
  }] }
}

test('one exact founder decision is confirmed once and remains visibly blocked at writer setup', async ({ page }) => {
  const fixture = await installWorkforceFixture(page), snapshot = staffingSnapshot()
  const submitted: Record<string, unknown>[] = []
  await page.route('**/api/hq/staffing', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: snapshot })
    expect(route.request().headers()['x-hq-brain']).toBe('1')
    expect(route.request().headers()['x-hq-access']).toBe('1')
    submitted.push(route.request().postDataJSON() as Record<string, unknown>)
    snapshot.workflows[0]!.status = 'publication-blocked'; snapshot.workflows[0]!.blocker = 'canonical-writer-setup-required'
    snapshot.workflows[0]!.decision = 'approved'; snapshot.workflows[0]!.resumeOriginal = true
    return route.fulfill({ json: snapshot })
  })
  await fixture.open()
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'Company plans', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Staffing proposals', exact: true })
  await expect(panel.getByText('Synthetic hire · AG-DEV-099', { exact: true })).toBeVisible()
  await expect(panel.getByText('synthetic_skill_b', { exact: true })).toBeVisible()
  await panel.getByText('Complete proposed profile', { exact: true }).click()
  await expect(panel.locator('pre')).toContainText('<script>')
  await panel.getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(submitted).toHaveLength(0)
  await panel.getByRole('checkbox').check()
  await panel.getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Publication remains blocked')
  await page.getByRole('dialog').getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
  await expect(panel.getByText(/Approved · publication blocked/)).toBeVisible()
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toMatchObject({ planId: snapshot.workflows[0]!.planId, digest: 'a'.repeat(64), decision: 'approved', resumeOriginal: true })
  expect(submitted[0]?.requestKey).toMatch(/^[0-9a-f-]{36}$/)
  await expect(panel.getByRole('button', { name: 'Approve this hire plan', exact: true })).toHaveCount(0)
  expect(fixture.taskRequests).toHaveLength(0)
  expect(fixture.snapshot().agents).toHaveLength(10)
  expect(fixture.unexpected).toEqual([]); expect(fixture.errors).toEqual([])
})

test('uncertain decision retries retain the exact key and never imply completed publication', async ({ page }) => {
  const fixture = await installWorkforceFixture(page), snapshot = staffingSnapshot(), submitted: Record<string, unknown>[] = []
  await page.route('**/api/hq/staffing', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: snapshot })
    submitted.push(route.request().postDataJSON() as Record<string, unknown>)
    if (submitted.length === 1) return route.fulfill({ status: 503, json: { error: 'synthetic response loss' } })
    snapshot.workflows[0]!.status = 'publication-blocked'; snapshot.workflows[0]!.blocker = 'canonical-writer-setup-required'
    snapshot.workflows[0]!.decision = 'approved'; snapshot.workflows[0]!.resumeOriginal = false
    return route.fulfill({ json: snapshot })
  })
  await fixture.open(); await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'Company plans', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Staffing proposals', exact: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    await panel.getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
    if (attempt === 0) await expect(panel.getByText(/Decision outcome unconfirmed/)).toBeVisible()
  }
  await expect(panel.getByText(/Approved · publication blocked/)).toBeVisible()
  expect(submitted).toHaveLength(2); expect(submitted[1]).toEqual(submitted[0]); expect(submitted[0]?.resumeOriginal).toBe(false)
  expect(fixture.errors).toEqual([])
})

test('revision drift while confirmation is open cannot emit a stale approval', async ({ page }) => {
  const fixture = await installWorkforceFixture(page), snapshot = staffingSnapshot(), submitted: unknown[] = []
  await page.route('**/api/hq/staffing', route => {
    if (route.request().method() !== 'GET') submitted.push(route.request().postDataJSON())
    return route.fulfill({ json: snapshot })
  })
  await fixture.open(); await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('tab', { name: 'Company plans', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Staffing proposals', exact: true })
  await panel.getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
  snapshot.workflows[0]!.digest = 'b'.repeat(64); snapshot.workflows[0]!.plan.profileDraft += '\nNew revision'
  const refreshed = page.waitForResponse(response => response.url().endsWith('/api/hq/staffing') && response.request().method() === 'GET')
  await fixture.publish(fixture.snapshot()); await refreshed
  await page.getByRole('dialog').getByRole('button', { name: 'Approve this hire plan', exact: true }).click()
  await expect(panel.getByText(/The plan changed or access is unavailable/)).toBeVisible()
  expect(submitted).toHaveLength(0); expect(fixture.errors).toEqual([])
})
