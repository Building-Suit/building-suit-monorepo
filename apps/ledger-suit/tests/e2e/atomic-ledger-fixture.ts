import { expect, type Page } from '@playwright/test'
import { navigateFixture, trackRouteCoverage } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
export const fixtureOrganization = '47000000-0000-4000-8000-000000000011'
export const fixtureActor = '47000000-0000-4000-8000-000000000012'
export async function ledgerFixture(page: Page, locale: 'en' | 'ar', capabilities: string[], handler: (name: string, args: Record<string, unknown>, request: { url: string; method: string }) => unknown, options: { landing?: string; login?: string } = {}) {
  trackRouteCoverage(page)
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const user = { id: fixtureActor, aud: 'authenticated', role: 'authenticated', email: 'ledger@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    const name = path.split('/').pop()!
    const args = route.request().method() === 'POST' ? route.request().postDataJSON() ?? {} : {}
    if (path.includes('/rpc/')) calls.push({ name, args })
    let body: unknown = handler(name, args, { url: route.request().url(), method: route.request().method() })
    if (body === undefined) {
      body = []
      if (path.includes('/auth/v1/token')) {
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
        body = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: fixtureActor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user }
      }
      else if (path.endsWith('/auth/v1/user')) body = user
      else if (name === 'organization_members') body = [{ role: 'owner', role_id: null, organizations: { id: fixtureOrganization, name: 'Fixture workspace', slug: 'fixture-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
      else if (name === 'my_capabilities') body = capabilities
      else if (name === 'subscription_access_state') body = 'active'
      else if (name === 'subscriptions') body = { status: 'active', cancel_at_period_end: false }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  async function goto(path: string) {
    const copy = locale === 'ar' ? ar : en
    await page.goto(options.login ?? '/login')
    await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
    await page.getByLabel(copy.auth.email).fill('ledger@test.local')
    // The shared sign-in template reveals the password after the email step.
    // Follow the real interaction instead of bypassing authentication in fixtures.
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
    await expect(page.getByLabel(copy.auth.password)).toBeVisible()
    await page.getByLabel(copy.auth.password).fill('fixture-password')
    const submit = page.getByRole('button', { name: copy.auth.signIn, exact: true })
    // The outgoing email arrow and incoming password arrow briefly coexist.
    await expect(submit).toHaveCount(1)
    await submit.click()
    await expect(page).toHaveURL(new RegExp(options.landing ?? '/dashboard'))
    await navigateFixture(page, path)
  }
  return { calls, goto }
}
