import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const catalog = [{ plan_key: 'solo', name: 'Solo', description: 'Independent workspace', display_order: 1, is_purchasable: true, prices: { monthly: { amount_minor: 39900 }, yearly: { amount_minor: 325584 } }, entitlements: { max_members: { limit_value: 1 } } }]
catalog.push({ ...catalog[0]!, plan_key: 'starter', name: 'Starter', display_order: 2, prices: { monthly: { amount_minor: 59900 }, yearly: { amount_minor: 488784 } } })
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`plan impact and manual request activation: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls, goto } = await ledgerFixture(page, locale, ['billing.read', 'billing.manage'], (name, args) => {
      if (name === 'subscription_plan_catalog') return catalog
      if (name === 'subscription_usage_summary') return [{ plan_key: 'starter', subscription_status: 'active', writes_allowed: true, quota_key: 'max_members', used_value: 2, limit_value: 3, remaining_value: 1, is_unlimited: false, is_at_limit: false, is_over_limit: false }]
      if (name === 'plan_change_impact') return { current_plan_key: 'starter', current_interval: 'monthly', target_plan_key: args.p_target_plan_key, target_interval: args.p_target_interval, target_amount_minor: 325584, change_direction: 'downgrade', provider_change_supported: false, requires_manual_handoff: true, would_block_new_activity: true, audit_history_current_days: 90, audit_history_target_days: 30, audit_history_reduced: true, quota_impacts: [{ quota_key: 'max_members', used_value: 2, current_limit_value: 3, target_limit_value: 1, is_over_target: true, will_block_new_activity: true }], feature_impacts: [] }
      return undefined
    })
    await goto('/billing')
    const pricing = page.getByTestId('plan-pricing')
    await pricing.getByRole('radio', { name: copy.billing.yearly, exact: true }).check()
    await pricing.locator('[data-plan="solo"]').getByRole('button').click()
    const impact = page.getByRole('dialog')
    await expect(impact).toContainText(copy.billing.planChange.noDeletion)
    await expect(impact.locator('[data-impact-quota="max_members"]')).toContainText(copy.billing.planChange.blocked)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/billing-impact-ledger-${locale}-${theme}-${width}.png`, fullPage: false, animations: 'disabled' })
    expect(calls.find(call => call.name === 'plan_change_impact')?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_target_plan_key: 'solo', p_target_interval: 'yearly' })
    await impact.getByRole('button', { name: copy.common.close, exact: true }).last().click()
    const before = calls.filter(call => call.name === 'prepare_manual_payment').length
    await page.getByRole('button', { name: copy.billing.manual.requests, exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(copy.billing.manual.empty)
    expect(calls.filter(call => call.name === 'prepare_manual_payment')).toHaveLength(before)
    await page.getByRole('dialog').getByRole('button', { name: copy.common.close, exact: true }).click()
    await expectNoPageOverflow(page)
  })
  test(`standalone checkout preserves annual plan command: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { goto } = await ledgerFixture(page, locale, ['billing.read', 'billing.manage'], name => {
      if (name === 'subscription_plan_catalog') return catalog
      if (name === 'subscription_access_state') return 'checkout_required'
      return undefined
    }, { landing: '/subscribe' })
    let command: object | undefined
    await page.route('**/functions/v1/paymob-checkout', async route => { command = route.request().postDataJSON(); await route.fulfill({ json: { url: '/billing-test-redirect' } }) })
    await page.route('**/billing-test-redirect', route => route.fulfill({ contentType: 'text/html', body: '<main>Payment fixture</main>' }))
    await goto('/subscribe')
    const pricing = page.getByTestId('plan-pricing')
    const policies = pricing.getByTestId('checkout-policy-review')
    await expect(policies.getByRole('link', { name: copy.marketing.terms, exact: true })).toHaveAttribute('href', '/terms')
    await expect(policies.getByRole('link', { name: copy.marketing.refundCancellation, exact: true })).toHaveAttribute('href', '/refund-cancellation')
    await expect(policies.getByRole('link', { name: copy.marketing.privacy, exact: true })).toHaveAttribute('href', '/privacy')
    await expect(pricing.getByTestId('payment-method-branding')).toHaveText(copy.billing.securePayments)
    await expectNoPageOverflow(page)
    await pricing.getByRole('radio', { name: copy.billing.yearly, exact: true }).check()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/billing-checkout-ledger-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await pricing.locator('[data-plan="solo"]').getByRole('button').first().click()
    await expect.poll(() => command).toMatchObject({ organizationId: fixtureOrganization, planKey: 'solo', interval: 'yearly' })
    await expect(page).toHaveURL(/\/billing-test-redirect$/)
  })
}

for (const locale of ['en', 'ar'] as const) {
  test(`manual checkout quote and receipt submission retain evidence identity: ${locale}`, async ({ page }) => {
    const copy = locale === 'ar' ? ar : en
    let payment: Record<string, unknown> | null = null
    let multipart = ''
    const { calls, goto } = await ledgerFixture(page, locale, ['billing.read', 'billing.manage'], (name, args, request) => {
      if (name === 'subscription_plan_catalog') return catalog
      if (name === 'subscription_access_state') return 'checkout_required'
      if (name === 'manual_payment_requests') return new URL(request.url).searchParams.has('id') ? payment : payment ? [payment] : []
      if (name === 'prepare_manual_payment') { payment = { id: args.p_id, organization_id: fixtureOrganization, plan_key: 'solo', billing_interval: 'yearly', amount_minor: 325584, currency_code: 'EGP', instructions: 'Fixture transfer instructions', status: 'draft', evidence_id: null, created_at: '2026-10-01', period_start: '2026-10-01', period_end: '2027-10-01' }; return payment }
      if (name === 'manual_payment_evidence') return multipart ? [{ id: 'receipt-1', filename: 'receipt.png', submitted_at: '2026-10-01' }] : []
      if (name === 'manual_payment_history') return []
      return undefined
    }, { landing: '/subscribe' })
    await page.route('**/functions/v1/manual-payment', async route => { multipart = route.request().postData()!; payment = { ...payment, status: 'submitted', evidence_id: 'receipt-1' }; await route.fulfill({ json: { request: payment } }) })
    await goto('/subscribe')
    const pricing = page.getByTestId('plan-pricing')
    await pricing.getByRole('radio', { name: copy.billing.yearly, exact: true }).check()
    await pricing.locator('[data-plan="solo"]').getByRole('button', { name: copy.billing.manual.choose, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Fixture transfer instructions')
    const prepared = calls.find(call => call.name === 'prepare_manual_payment')
    expect(prepared?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_plan_key: 'solo', p_interval: 'yearly' })
    expect(prepared?.args.p_id).toMatch(/^[\da-f-]{36}$/)
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64') })
    await dialog.getByLabel(copy.billing.manual.reason, { exact: true }).fill('Reviewed receipt evidence')
    await dialog.getByRole('button', { name: copy.billing.manual.submit, exact: true }).click()
    await expect(dialog).toContainText(copy.billing.manual.states.submitted)
    expect(multipart).toContain('Reviewed receipt evidence')
    expect(multipart).toContain(String(prepared?.args.p_id))
    expect(multipart).toMatch(/name="evidenceId"\r\n\r\n[\da-f-]{36}/)
    await expect(dialog).toContainText('receipt.png')
    await dialog.getByRole('button', { name: copy.common.refresh, exact: true }).click()
    await expect(dialog).toContainText('receipt.png')
    expect(calls.filter(call => call.name === 'prepare_manual_payment')).toHaveLength(1)
  })
}
