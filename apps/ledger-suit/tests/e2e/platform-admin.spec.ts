// Mocked transport validates UI behavior only. SQL/Edge tests prove authorization.
import { expect, test, type Page } from '@playwright/test'
const id = 'd0000000-0000-4000-8000-000000000004'
const payment = 'd0000000-0000-4000-8000-000000000010'
const evidence = 'd0000000-0000-4000-8000-000000000011'
async function setup(page: Page, role: 'observer' | 'billing_operator' | 'platform_admin' | null, arabic = false) {
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {} }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.mock`
  const commands: Record<string, string>[] = []
  const reads: Record<string, string>[] = []
  const unexpected: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/auth/v1/**', async route => {
    const data = route.request().url().includes('/token') ? { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh', user } : user
    await route.fulfill({ json: data })
  })
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url()
    const args = route.request().postDataJSON()
    if (url.endsWith('/rpc/platform_admin_read')) {
      reads.push(args)
      const data = args.p_resource === 'identity' ? [{ id, role }]
        : args.p_resource === 'payments' ? [{ id: payment, organization_id: 'org', evidence_id: evidence, plan_key: 'solo', amount_minor: 39900, currency_code: 'EGP', status: 'submitted' }]
          : args.p_resource === 'organizations' ? [{ id: 'd0000000-0000-4000-8000-000000000020', name: 'Alpha Company', status: 'active', access_state: 'active', operator_suspended: false }]
            : args.p_resource === 'subscriptions' ? [{ id: 'd0000000-0000-4000-8000-000000000021', organization_id: 'd0000000-0000-4000-8000-000000000020', organization_name: 'Alpha Company', plan_key: 'solo', status: 'active', access_state: 'active', provider: 'manual', billing_interval: 'monthly' }]
              : args.p_resource === 'support' ? (role === 'platform_admin' ? [{ id: 'd0000000-0000-4000-8000-000000000022', organization_id: 'd0000000-0000-4000-8000-000000000020', requester_email: 'owner@example.test', subject: 'Need help', customer_message: 'Original request', status: 'open', priority: 'high', reminder_delivery_status: 'not_configured' }] : [])
                : args.p_resource === 'status' ? [{ id: 'ledger', pending_payments: 1, unprocessed_billing_events: 0, failed_billing_events: 0, open_support_requests: 1, suspended_organizations: 0, support_reminder_delivery: 'not_configured' }] : []
      await route.fulfill({ json: role ? { ok: true, data } : { ok: false, error: 'OPERATOR_REQUIRED' } })
    } else if (url.includes('/rpc/platform_admin_')) {
      commands.push({ ...args, rpc: url.split('/').at(-1)! })
      await route.fulfill({ json: { ok: true, data: { payment: { status: 'approved' } } } })
    } else { unexpected.push(url); await route.fulfill({ json: [] }) }
  })
  if (arabic) await page.context().addCookies([{ name: 'building-suit-locale', value: 'ar', url: test.info().project.use.baseURL! }])
  await page.goto('/platform-admin')
  await expect(page).toHaveURL(/\/login\?operator=1/)
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.locator('#email').fill('operator@example.test')
  await page.locator('#password').fill('synthetic-password')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL('/platform-admin')
  return { commands, reads, unexpected, errors }
}

test('tenant account is denied and no global rows are rendered', async ({ page }) => {
  const state = await setup(page, null)
  await expect(page.getByRole('alert')).toHaveText('This account does not have platform operator access.')
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('combobox')).toBeDisabled()
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})

test('dedicated billing operator reaches shell without tenancy and submits reasoned command', async ({ page }) => {
  const state = await setup(page, 'billing_operator')
  await expect(page.getByText('Billing operator — payment review')).toBeVisible()
  await page.getByRole('combobox').selectOption('payments')
  await page.getByRole('button', { name: 'Review payment', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Record decision' })).toBeDisabled()
  await dialog.getByRole('combobox').selectOption('approved')
  await dialog.getByRole('textbox', { name: 'Reason (visible to the customer)' }).fill('Transfer verified')
  await dialog.getByRole('textbox', { name: 'Internal case reference / context' }).fill('Case 42')
  await dialog.getByRole('button', { name: 'Record decision' }).click()
  await page.getByRole('dialog', { name: 'Confirm', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Review recorded successfully.')).toBeVisible()
  expect(state.commands).toHaveLength(1)
  expect(state.commands[0]).toMatchObject({ p_request_id: payment, p_evidence_id: evidence, p_action: 'approved', p_reason: 'Transfer verified', p_context: 'Case 42' })
  expect(state.commands[0]?.p_command_id).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByText('Billing operator — payment review')).toBeVisible()
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})

test('Arabic mobile observer gets read-only review and an explicit empty support queue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page, 'observer', true)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const operationalView = page.getByRole('combobox', { name: 'العرض التشغيلي' })
  await operationalView.selectOption('support')
  await expect(page.getByText('لا توجد سجلات.')).toBeVisible()
  await operationalView.selectOption('payments')
  await page.getByRole('button', { name: 'مراجعة الدفعة', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'تسجيل القرار' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.commands).toEqual([])
  expect(state.errors).toEqual([])
})

test('platform administrator filters companies and opens bounded controls', async ({ page }) => {
  const state = await setup(page, 'platform_admin')
  await expect(page.getByText('Platform administrator — bounded commercial operations')).toBeVisible()
  await page.getByRole('combobox', { name: 'Operational view' }).selectOption('organizations')
  await page.getByRole('textbox', { name: 'Search' }).fill('Alpha')
  await page.getByRole('combobox', { name: 'Status or role' }).selectOption('active')
  await Promise.all([
    page.waitForResponse((response) => {
      if (!response.url().endsWith('/rpc/platform_admin_read')) return false
      const args = response.request().postDataJSON()
      return args.p_resource === 'organizations' && args.p_search === 'Alpha' && args.p_status === 'active'
    }),
    page.getByRole('button', { name: 'Apply' }).click(),
  ])
  expect(state.reads.at(-1)).toMatchObject({ p_resource: 'organizations', p_search: 'Alpha', p_status: 'active' })
  await page.getByRole('button', { name: 'Suspend writes' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Record decision' })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('Security hold')
  await dialog.getByRole('textbox', { name: 'Internal case reference / context' }).fill('Case ACCESS-1')
  await dialog.getByRole('button', { name: 'Record decision' }).click()
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/rpc/platform_admin_set_access')),
    page.getByRole('dialog', { name: 'Confirm', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click(),
  ])
  expect(state.commands.at(-1)).toMatchObject({ rpc: 'platform_admin_set_access', p_action: 'suspend', p_reason: 'Security hold' })
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})
