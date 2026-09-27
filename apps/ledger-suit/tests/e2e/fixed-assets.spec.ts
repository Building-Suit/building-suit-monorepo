import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import type { FixedAssetWorkspace } from '../../app/utils/fixedAssets'

const org = '45000000-0000-4000-8000-000000000001'
const actor = '45000000-0000-4000-8000-000000000002'
async function mockApi(page: Page) {
  const posts: Record<string, unknown>[] = []
  const workspace: FixedAssetWorkspace = {
    as_of_date: '2026-09-30',
    accounts: [{ id: 'cost', name: 'Equipment', type: 'asset', subtype: 'equipment', currency: 'EGP', role: 'posting', normal_balance: 'debit', contra_account_id: null }, { id: 'accum', name: 'Accumulated depreciation', type: 'asset', subtype: 'equipment', currency: 'EGP', role: 'posting', normal_balance: 'credit', contra_account_id: 'cost' }],
    acquisition_journals: [],
    assets: [{ id: 'asset-1', code: 'FA-001', name: 'Production machine', status: 'active', currency: 'EGP', acquisition_date: '2026-01-01', in_service_date: '2026-01-16', cost_minor: '120000', accumulated_minor: '15000', nbv_minor: '105000', residual_minor: '12000', method: 'straight_line', life_months: 12, rate_basis_points: null, acquisition_transaction_id: 'journal-acq', cost_account_id: 'cost', accumulated_account_id: 'accum', expense_account_id: 'expense', impairment_account_id: 'impairment', gain_loss_account_id: 'gain-loss', disposal_date: null }],
    schedule: [{ id: 'schedule-1', asset_id: 'asset-1', period_start: '2026-09-01', period_end: '2026-09-30', amount_minor: '9000', closing_nbv_minor: '96000', status: 'scheduled', transaction_id: null, replaces_schedule_id: null }],
    events: [{ id: 'event-1', asset_id: 'asset-1', kind: 'acquisition', date: '2026-01-01', amount_minor: '120000', transaction_id: 'journal-acq', schedule_id: null, reverses_event_id: null, reason: 'Reviewed registration', payload: {}, created_at: '2026-01-01T00:00:00Z' }],
    reconciliation: [{ account_id: 'cost', kind: 'cost', register_minor: '120000', gl_minor: '120000', variance_minor: '0' }, { account_id: 'accum', kind: 'accumulated_depreciation', register_minor: '15000', gl_minor: '15000', variance_minor: '0' }],
  }
  const capabilities = ['assets.read', 'assets.register', 'assets.depreciate', 'assets.adjust', 'assets.dispose', 'assets.reverse']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'assets@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'Asset workspace', slug: 'asset-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_fixed_asset_workspace')) body = workspace
    else if (path.endsWith('/post_asset_depreciation')) { posts.push(route.request().postDataJSON()); body = 'journal-depreciation' }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return posts
}

for (const locale of ['en', 'ar'] as const) test(`${locale}: fixed-asset register, schedule, NBV, and reconciliation are usable`, async ({ page, context }) => {
  const copy = locale === 'en' ? en : ar
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  const posts = await mockApi(page)
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel(copy.auth.email).fill('assets@test.local')
  await page.getByLabel(copy.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await page.goto('/fixed-assets')
  await expect(page.getByRole('heading', { name: copy.assets.title, exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(page.getByRole('table', { name: copy.assets.registerTitle })).toContainText('FA-001')
  await expect(page.locator('[data-assets-nbv]')).toContainText('1,050')
  await expect(page.locator('[data-assets-reconciled="true"]')).toContainText(copy.assets.reconciled)
  await page.getByRole('button', { name: copy.assets.post, exact: true }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toMatchObject({ p_schedule_id: 'schedule-1', p_organization_id: org })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: copy.assets.schedule, exact: true })).toBeVisible()
})
