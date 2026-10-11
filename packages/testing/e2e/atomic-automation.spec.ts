import { mkdir } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { expectNoPageOverflow, navigateFixture } from '../browser-foundation'

const dashboard = {
  generatedAt: '2026-10-11T12:00:00Z', selectedSuit: null, database: { database: 'fixture', user: 'reader', server_addr: null, server_port: null }, runtimeTelemetryAvailable: false,
  summary: { total_tasks: 2, finished_tasks: 1, unfinished_tasks: 1, in_progress_tasks: 0, verification_tasks: 0, blocked_tasks: 0, failed_tasks: 1, planned_tasks: 0, ready_tasks: 0, open_blocking_decisions: 0, running_workflows: 0, running_executions: 0 },
  suits: [{ slug: 'fixture', display_name: 'Fixture Suit' }], tasks: [{ task_id: 'T-1', suit_slug: 'fixture', title: 'Repair recorded failure', status: 'failed', risk_level: 'low', model_profile: 'standard', updated_at: '2026-10-11T12:00:00Z' }, { task_id: 'T-2', suit_slug: 'fixture', title: 'Completed fixture', status: 'complete', risk_level: 'low', model_profile: 'standard', updated_at: '2026-10-11T12:00:00Z' }], workflowRuns: [], executions: [], verificationResults: [], decisions: [], pullRequests: [], events: [], runtimeExecutions: [], incidents: [],
}
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`Automation adapters preserve workflows: ${locale}, ${theme}, ${width}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let savedPolicy: Record<string, unknown> | undefined
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      let body: unknown = {}
      if (path === '/api/dashboard') body = dashboard
      if (path === '/api/operator/status') body = { writesEnabled: true }
      if (path === '/api/policies') body = { policies: [{ policy_id: 'standard', display_name: 'Fixture retry', active: true, max_attempts: 2, attempt_profiles: ['standard', 'deep'] }] }
      if (path === '/api/operator/policies') { savedPolicy = route.request().postDataJSON(); body = { ok: true } }
      if (path === '/api/projects') body = { projects: [], workstreams: [] }
      if (path === '/api/operator/projects/validate') body = { valid: true }
      if (path === '/api/tasks/T-1') body = { packet: { project: { slug: 'fixture' }, workstream: { slug: 'frontend' }, task: { task_id: 'T-1', title: 'Repair recorded failure', status: 'failed' }, retry_policy: { policy_id: 'standard', max_attempts: 2, attempt_profiles: ['standard', 'deep'] } }, executions: [{ execution_id: 1, attempt: 1, status: 'succeeded', model_profile: 'standard', engine_stage: 'verification', parent_sha: 'fixture-parent' }], verificationRuns: [], verificationChecks: [], events: [], failures: [], pullRequests: [] }
      await route.fulfill({ json: body })
    })
    // The first SSR request has no database credentials. All workflow data is synthetic client-side API traffic.
    await page.goto('http://127.0.0.1:4324/n8n')
    await expect.poll(() => page.locator('#__nuxt').evaluate(root => Boolean((root as HTMLElement & { __vue_app__?: unknown }).__vue_app__))).toBe(true)
    await navigateFixture(page, '/')
    const tasks = page.getByRole('region', { name: locale === 'ar' ? 'المهام' : 'Tasks', exact: true })
    await expect(tasks.getByText('Repair recorded failure')).toBeVisible()
    await expect(tasks.getByText('Completed fixture')).toHaveCount(0)
    await page.getByRole('checkbox').check()
    await expect(tasks.getByText('Completed fixture')).toBeVisible()
    await expectNoPageOverflow(page)
    await navigateFixture(page, '/policies')
    await expect(page.getByRole('heading', { name: 'Fixture retry' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Display name', { exact: true })).toHaveValue('Fixture retry')
    await dialog.getByLabel('Display name', { exact: true }).fill('Edited fixture')
    await dialog.getByRole('button', { name: 'Validate and save' }).click()
    await expect.poll(() => savedPolicy?.display_name).toBe('Edited fixture')
    expect(savedPolicy?.attempt_profiles).toEqual(['standard', 'deep'])
    await expect(dialog).toBeHidden()
    await navigateFixture(page, '/projects')
    await page.getByRole('button', { name: 'Register project' }).click()
    await expect(page.getByRole('dialog').getByLabel('Activate immediately')).not.toBeChecked()
    await page.getByRole('dialog').getByRole('button', { name: 'Validate / dry-run' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Configuration is valid. No data was changed.' })).toBeVisible()
    await page.keyboard.press('Escape')
    await navigateFixture(page, '/tasks/T-1')
    await expect(page.getByRole('heading', { name: 'T-1 · Repair recorded failure' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy reverify command' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy publish command' })).toHaveCount(0)
    await expectNoPageOverflow(page)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    const screenshot = `.local/atomic-template-evidence/screenshots/automation-detail-${locale}-${theme}-${width}.png`
    await page.screenshot({ path: screenshot, fullPage: true })
    await testInfo.attach('automation-detail', { path: screenshot, contentType: 'image/png' })
    expect(errors).toEqual([])
    await context.close()
  })
}
