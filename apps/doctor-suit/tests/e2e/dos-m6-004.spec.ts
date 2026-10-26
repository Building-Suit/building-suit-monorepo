import { financialNoticeDiagnostic } from './financial-notice-diagnostics'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { manualPaymentCopy } from '../../app/utils/manualPaymentPresentation'
interface Notice { id: string; subscriber_user_id: string; intent_id: string; quote_id: string; terms_id: string; amount_minor: string; currency: string; currency_exponent: number; status: string; revision: number; period_id: string | null; independent_verification_required: boolean; automatic_verification: boolean; live_acceptance_enabled: boolean; history: { revision: number; action: string; actor: string; reason: string; at: string }[] }
interface Fixture { origin: string; api: string; storageState: Awaited<ReturnType<BrowserContext['storageState']>>; reference: string; notice: Notice; currentNotice: Notice; reviewerId: string; period: { id: string; started_at: string; ends_at: string } }
for (const ar of [false, true]) test(`DOS-M6-004-C01-${ar ? 'AR' : 'EN'}`, async ({ browser }) => {
  const phase = (description: string) => test.info().annotations.push({ type: 'financial-stage', description })
  phase('fixture')
  if (process.env.DOCTOR_FINANCIAL_ACCEPTANCE !== 'owned-actual-provider') throw Error('Owned financial fixture required')
  const f = JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE ?? '{}') as Fixture, copy = manualPaymentCopy(ar)
  if (f.origin !== 'http://127.0.0.1:4341' || f.api !== 'http://127.0.0.1:65321' || !Array.isArray(f.storageState?.cookies)) throw Error('Owned financial target rejected')
  phase('source_binding')
  const n = f.currentNotice
  for (const key of ['id', 'subscriber_user_id', 'intent_id', 'quote_id', 'terms_id', 'amount_minor', 'currency', 'currency_exponent'] as const) expect(n[key]).toBe(f.notice[key])
  expect(f.notice.status).toBe('submitted'); expect(f.notice.period_id).toBeNull()
  expect(n.status).toBe('activated'); expect(n.revision).toBe(2); expect(n.period_id).toBe(f.period.id)
  expect(n.automatic_verification).toBe(false); expect(n.live_acceptance_enabled).toBe(false); expect(n.independent_verification_required).toBe(true)
  phase('review_history')
  expect(n.history.map(h => [h.revision, h.action])).toEqual([[1, 'funds_verified'], [2, 'activated']])
  for (const h of n.history) { expect(h.actor).toBe(f.reviewerId); expect(h.actor).not.toBe(n.subscriber_user_id); expect(h.reason.trim().length).toBeGreaterThan(1); expect(Number.isFinite(Date.parse(h.at))).toBe(true) }
  phase('entitlement')
  const end = new Date(f.period.started_at); end.setUTCMonth(end.getUTCMonth() + 12)
  expect(Date.parse(f.period.ends_at)).toBe(end.getTime())
  phase('context')
  const context = await browser.newContext({ storageState: f.storageState, viewport: { width: ar ? 390 : 1280, height: 1000 }, colorScheme: ar ? 'dark' : 'light' })
  let diagnosticPage:Page|undefined
  try {
    await context.route('**/*', route => [f.origin, f.api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
    await context.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: f.origin }])
    await context.addInitScript(({ dark }) => localStorage.setItem('building-suit.theme', dark ? 'dark' : 'light'), { dark: ar })
    phase('route')
    const page = await context.newPage(); diagnosticPage=page; await page.goto(f.origin + '/payment-notices')
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible()
    phase('notice_row')
    await page.getByRole('row').filter({ hasText: f.reference }).getByRole('button', { name: copy.open, exact: true }).click()
    phase('notice_detail')
    await expect(page.getByRole('heading', { name: copy.details, exact: true })).toBeVisible()
    phase('quote_identity')
    for (const value of [n.id, n.intent_id, n.quote_id, n.terms_id, f.period.id]) await expect(page.getByText(value, { exact: true }).last()).toBeVisible()
    phase('review_history')
    await expect(page.getByRole('heading', { name: copy.history, exact: true })).toBeVisible()
    await expect(page.getByText(ar ? /^1 · تم التحقق من الأموال — لم يُفعّل/ : /^1 · Funds verified — not activated/)).toBeVisible()
    await expect(page.getByText(ar ? /^2 · فترة اصطناعية مفعّلة/ : /^2 · Synthetic period activated/)).toBeVisible()
    phase('money')
    await expect(page.getByText('2439.84 EGP', { exact: true }).last()).toBeVisible()
    phase('direction_and_viewport')
    await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  } catch(error) { await financialNoticeDiagnostic(diagnosticPage,test.info());throw error } finally { await context.unrouteAll({ behavior: 'ignoreErrors' }); await context.close() }
})
