import { expect, test } from '@playwright/test'
import { installWorkforceFixture } from './workforce-fixture'

/** Entirely synthetic HTTP/CLI observations; never submits a hosted trial. */
test('founder reviews existing trial proof without a direct trial start', async ({ page }) => {
  const fixture = await installWorkforceFixture(page)
  const trialId = '60000000-0000-4000-8000-000000000001'
  let qualifications = 0
  const row = { agentId: 'AG-HR-002', skillFileId: 'synthetic_skill_01' as string | null, eligible: true, qualified: false,
    trialId: null as string | null, status: null as string | null, receiptIssued: false, reviewComplete: false }
  const submitted: Record<string, unknown>[] = []
  await page.route('**/api/hq/trials', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [row] })
    const body = route.request().postDataJSON() as Record<string, unknown>
    submitted.push(body)
    if ('trialId' in body) { row.receiptIssued = true; qualifications++; row.skillFileId = qualifications === 1 ? 'synthetic_skill_02' : null; row.eligible = qualifications === 1 }
    else { row.trialId = trialId; row.status = 'active'; row.eligible = false; row.receiptIssued = false; row.reviewComplete = false }
    return route.fulfill({ json: { accepted: true } })
  })
  await fixture.open()
  await page.getByRole('combobox', { name: 'Workplaces', exact: true }).click()
  await page.getByRole('option', { name: 'Fixture department', exact: true }).click()
  await page.getByRole('button', { name: 'Agent details: Fixture employee 3', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Fixture employee 3', exact: true })
  await expect(panel.getByText('Supervised trial required', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Start supervised trial', exact: true })).toHaveCount(0)
  expect(submitted).toHaveLength(0)
  Object.assign(row, { trialId, status: 'passed', reviewComplete: true, eligible: false })
  await fixture.publish(fixture.snapshot())
  await panel.getByRole('button', { name: 'Approve qualification', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Canonical Active lifecycle is still required')
  await page.getByRole('dialog').getByRole('button', { name: 'Approve qualification', exact: true }).click()
  await expect(panel.getByText('Skill qualification recorded; remaining assigned skills require trials', { exact: true })).toBeVisible()
  expect(submitted).toEqual([{ trialId }])
  await expect(panel.getByRole('button', { name: 'Approve qualification', exact: true })).toHaveCount(0)
  expect(fixture.unexpected).toEqual([])
  expect(fixture.errors).toEqual([])
})
