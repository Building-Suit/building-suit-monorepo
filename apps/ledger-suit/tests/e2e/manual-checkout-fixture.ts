import type { Page } from '@playwright/test'

/** Synthetic recipient only. Never copy these instructions into a live configuration. */
export async function manualCheckoutFixture(page: Page) {
  const commands: Record<string, unknown>[] = []
  const instructions = 'SYNTHETIC InstaPay instructions — no real recipient; do not transfer funds.'
  let payment: Record<string, unknown> | null = null
  let onlineCalls = 0
  await page.route('**/rest/v1/manual_payment_requests*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('id') ? payment : payment ? [payment] : [] }))
  for (const table of ['manual_payment_evidence', 'manual_payment_history']) await page.route(`**/rest/v1/${table}*`, route => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/prepare_manual_payment', async route => {
    const args = route.request().postDataJSON() as Record<string, unknown>
    commands.push(args)
    const monthly: Record<string, number> = { solo: 39900, starter: 59900, business: 109900 }
    const yearly: Record<string, number> = { solo: 325584, starter: 488784, business: 896784 }
    const amount = (args.p_interval === 'yearly' ? yearly : monthly)[String(args.p_plan_key)]
    if (!amount) { await route.fulfill({ status: 400, json: { message: 'INVALID_PLAN' } }); return }
    payment = { id: args.p_id, organization_id: args.p_organization_id, plan_key: args.p_plan_key, billing_interval: args.p_interval, amount_minor: amount, currency_code: 'EGP', instructions, status: 'draft', evidence_id: null, created_at: '2026-10-01', period_start: null, period_end: null }
    await route.fulfill({ json: payment })
  })
  await page.route('**/functions/v1/paymob-checkout', async route => { onlineCalls++; await route.fulfill({ status: 410, json: { error: 'Online enrollment retired' } }) })
  return { commands, instructions, onlineCalls: () => onlineCalls }
}
