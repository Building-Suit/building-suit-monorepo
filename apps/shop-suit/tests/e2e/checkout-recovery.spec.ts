import { expect, test, type Page, type WebSocketRoute } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'
const one = '11111111-1111-4111-8111-111111111111', two = '22222222-2222-4222-8222-222222222222'
const limits = { active_locations: 1, active_members: 1, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 }
const publicOrder = (id = one, state = 'paid') => ({ orderId: id, state, currency: 'EGP', amountMinor: 284784, planName: 'Solo', createdAt: id === one ? '2026-10-13T18:44:00Z' : '2026-10-13T20:06:44Z', sessionId: `cs_test_${id === one ? 'first' : 'second'}`, url: state === 'open' ? 'https://checkout.xpay.app/c/cs_test_first' : null })
async function setup(page: Page, locale: 'en' | 'ar', initial: 'paid' | 'pending' | 'expired', sockets?: { active?: WebSocketRoute; frame?: unknown[]; filters?: Record<string, unknown>[] }) {
  let status = initial
  const fixture = await pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shop_public_plan_catalog') return [{ id: 'public-1', name: 'Solo', slug: 'solo', catalog_terms_id: 'terms-1', plan_variant: 'standard', variant_name: 'Standard', price_amount: 2847.84, currency: 'EGP', billing_interval: 'annual', trial_days: 7, features: {}, resource_limits: limits, is_purchasable: true, is_coming_soon: false }]
    if (name === 'shop_billing_read') return { subscription: { planName: status === 'paid' ? 'Solo' : 'Trial plan', planSlug: 'solo', planVariant: 'standard', billingInterval: 'annual', accessState: status === 'paid' ? 'active' : 'trialing', status: status === 'paid' ? 'active' : 'trialing', periodStart: '2026-10-13T20:06:28Z', periodEnd: '2028-10-13T20:06:28Z', currency: 'EGP', priceAmount: 2847.84, listPriceAmount: 2847.84, effectivePriceAmount: 2847.84, priceSource: 'catalog', trialDaysRemaining: 7 }, availablePlans: [{ planId: 'public-1', planSlug: 'solo', planName: 'Solo', catalogTermsId: 'terms-1', planVariant: 'standard', variantName: 'Standard', billingInterval: 'annual', currency: 'EGP', listPriceAmount: 2847.84, effectivePriceAmount: 2847.84, priceSource: 'catalog', resourceLimits: limits, blockers: [] }], usage: { resources: Object.entries(limits).map(([resource, limit]) => ({ resource, limit, used: resource === 'active_members' || resource === 'active_locations' ? 1 : 0, remaining: limit, unlimited: false, atLimit: false, overLimit: false })), limits }, submissions: [] }
    if (name === 'shop_xpay_order_read') return (status === 'paid' ? [publicOrder(two), publicOrder(one)] : [publicOrder(one, status)]).map(order => ({ ...order, id: order.orderId, description: order.planName }))
    if (name === 'shop-xpay-checkout') {
      if (args.action === 'status') return { ready: true, mode: 'test', orders: status === 'paid' ? [publicOrder(two), publicOrder(one)] : [publicOrder(one, status)] }
      if (args.orderId) return publicOrder(String(args.orderId), status)
      return { ...publicOrder(two, 'open'), url: 'https://checkout.xpay.app/c/cs_test_second' }
    }
    return undefined
  }, sockets ? '33333333-3333-4333-8333-333333333333' : undefined)
  if (sockets) await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    sockets.active = socket
    socket.onMessage(raw => {
      if (typeof raw !== 'string') return
      const frame = JSON.parse(raw)
      if (frame[3] === 'phx_join') {
        sockets.frame = frame
        sockets.filters = frame[4].config.postgres_changes.map((filter: Record<string, unknown>, i: number) => ({ ...filter, id: i + 1 }))
        socket.send(JSON.stringify([frame[0], frame[1], frame[2], 'phx_reply', { status: 'ok', response: { postgres_changes: sockets.filters } }]))
      } else socket.send(JSON.stringify([frame[0], frame[1], frame[2], 'phx_reply', { status: 'ok', response: {} }]))
    })
  })
  return { ...fixture, paid() { status = 'paid' } }
}
for (const locale of ['en', 'ar'] as const) test(`two paid terms: clear active state, no third payment CTA, return/reload/replay ${locale}`, async ({ page }) => {
  const fixture = await setup(page, locale, 'paid')
  await fixtureGoto(page, `/billing?xpayOrder=${one}`)
  const panel = page.getByTestId('hosted-checkout')
  await expect(panel).toContainText(locale === 'en' ? 'Your subscription is active' : 'اشتراكك فعّال')
  await expect(panel.getByRole('button', { name: locale === 'en' ? 'Continue to your shop' : 'المتابعة إلى متجرك', exact: true })).toBeVisible()
  await expect(panel.getByRole('link', { name: locale === 'en' ? 'Contact us' : 'تواصل معنا', exact: true })).toHaveAttribute('href', '/contact')
  await expect(panel.getByRole('button', { name: /Continue to X-Pay|Check payment status|تحقق من حالة الدفع/ })).toHaveCount(0)
  await expect(panel).not.toContainText(/Test checkout|no real funds|دفع تجريبي/)
  await expect(page.getByRole('main')).toContainText(locale === 'en' ? '2028' : '٢٠٢٨')
  await page.screenshot({ path: `/tmp/checkout-confirmed-${locale}.png`, fullPage: true })
  await fixtureGoto(page, '/billing')
  await expect(panel).toContainText(locale === 'en' ? 'Your subscription is active' : 'اشتراكك فعّال')
  await fixtureGoto(page, `/billing?xpayOrder=${one}`)
  await expect(panel).toContainText(locale === 'en' ? 'Your subscription is active' : 'اشتراكك فعّال')
  expect(fixture.calls.filter(call => call.name === 'shop-xpay-checkout' && call.args.requestId)).toHaveLength(0)
})
test('pending return confirms automatically from a late scoped version event, with no data polling or new checkout', async ({ page }) => {
  const sockets: { active?: WebSocketRoute; frame?: unknown[]; filters?: Record<string, unknown>[] } = {}
  const fixture = await setup(page, 'en', 'pending', sockets)
  await fixtureGoto(page, `/billing?xpayOrder=${one}`)
  const panel = page.getByTestId('hosted-checkout')
  await expect(panel).toContainText('Confirming your payment')
  await expect(panel.getByRole('button', { name: 'Continue to X-Pay', exact: true })).toHaveCount(0)
  await expect.poll(() => !!sockets.frame).toBe(true)
  await page.clock.install(); await page.clock.runFor(1000)
  const reads = fixture.calls.length
  await page.clock.fastForward(90000)
  expect(fixture.calls).toHaveLength(reads)
  fixture.paid()
  const frame = sockets.frame!, filter = sockets.filters!.find(item => item.event === 'UPDATE' && item.filter === 'scope_key=eq.shop-1:all:billing')!
  sockets.active!.send(JSON.stringify([frame[0], null, frame[2], 'postgres_changes', { ids: [filter.id], data: { schema: 'public', table: 'shop_realtime_versions', type: 'UPDATE', commit_timestamp: '2026-10-13T20:08:15Z', record: { scope_key: 'shop-1:all:billing', revision: 2 }, old_record: {} } }]))
  await page.clock.runFor(1000)
  await expect(panel).toContainText('Your subscription is active')
  expect(fixture.calls.filter(call => call.name === 'shop-xpay-checkout' && call.args.requestId)).toHaveLength(0)
})
test('verified expired checkout can start again; renewal after success requires a separate explicit confirmation', async ({ page }) => {
  const fixture = await setup(page, 'en', 'expired')
  await fixtureGoto(page, `/billing?xpayOrder=${one}`)
  await expect(page.getByTestId('hosted-checkout').getByRole('button', { name: 'Continue to X-Pay', exact: true })).toBeEnabled()
  fixture.paid(); await fixtureGoto(page, '/billing')
  await page.getByRole('button', { name: 'Renew this plan', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm', exact: true })
  await expect(dialog).toContainText('This is another payment')
  expect(fixture.calls.filter(call => call.name === 'shop-xpay-checkout' && call.args.requestId)).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByTestId('hosted-checkout')).toContainText('Your subscription is active')
})
