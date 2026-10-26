import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { practiceMoneyCopy } from '../../app/utils/practiceMoneyPresentation'
import { practiceBillingCopy } from '../../app/utils/practiceBillingPresentation'
type Storage = Awaited<ReturnType<BrowserContext['storageState']>>
interface Fixture { origin: string; api: string; storageState: Storage; billing: { reference: string; readonlyStorageState: Storage; readonlyServiceLabel: string } }
for (const ar of [false, true]) test(`DOS-M6-007-C03-${ar ? 'AR' : 'EN'}`, async ({ browser }) => {
 const phase = (description: string) => test.info().annotations.push({ type: 'financial-stage', description })
 phase('fixture')
 if (process.env.DOCTOR_FINANCIAL_ACCEPTANCE !== 'owned-actual-provider') throw Error('Owned financial fixture required')
 const f = JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE ?? '{}') as Fixture
 if (f.origin !== 'http://127.0.0.1:4341' || f.api !== 'http://127.0.0.1:65321' || !Array.isArray(f.storageState?.cookies) || !Array.isArray(f.billing?.readonlyStorageState?.cookies) || !/^SYNTHETIC-BILLING-[a-f0-9-]{36}$/.test(f.billing.reference)) throw Error('Owned practice money target required')
 const copy = practiceMoneyCopy(ar), billingCopy = practiceBillingCopy(ar), locale = ar ? 'AR' : 'EN', service = f.billing.reference + '-' + locale
 async function context(storageState: Storage) {
  const c = await browser.newContext({ storageState, viewport: { width: ar ? 390 : 1280, height: 1000 }, colorScheme: ar ? 'dark' : 'light' })
  await c.route('**/*', route => [f.origin, f.api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
  await c.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: f.origin }]); await c.addInitScript(({ dark }) => localStorage.setItem('building-suit.theme', dark ? 'dark' : 'light'), { dark: ar }); return c
 }
 async function openMoney(page: Page, label: string) { await page.goto(f.origin + '/practice-billing'); await page.getByRole('row').filter({ hasText: label }).getByRole('link', { name: billingCopy.payments, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible() }
 async function confirm(page: Page, title: string) { const dialog = page.getByRole('dialog', { name: title, exact: true }); await dialog.getByRole('button', { name: copy.confirm, exact: true }).click(); await expect(dialog).toBeHidden() }
 async function prepare(page: Page, kind: 'collection' | 'refund', reason: string, amount: string) { const dialog = page.getByRole('dialog', { name: kind === 'collection' ? copy.prepareCollection : copy.prepareRefund, exact: true }); await dialog.getByLabel(copy.amount, { exact: true }).fill(amount); await dialog.getByLabel(copy.reason, { exact: true }).fill(reason); await dialog.getByRole('button', { name: copy.save, exact: true }).click(); await expect(dialog).toBeHidden() }
 const owner = await context(f.storageState); let readonly: BrowserContext | undefined
 try {
  phase('route'); const page = await owner.newPage(); await openMoney(page, service)
  phase('collection_prepare'); await page.getByRole('button', { name: copy.prepareCollection, exact: true }).click(); await prepare(page, 'collection', 'SYNTHETIC_COLLECTION_' + locale, '100.00')
  const collection = page.getByRole('row').filter({ hasText: 'SYNTHETIC_COLLECTION_' + locale })
  let lost = false
  const commands: { p_intent: string; p_revision: number; p_action: string; p_outcome: string; p_key: string }[] = []
  await page.route(f.api + '/rest/v1/rpc/doctor_advance_practice_payment', async route => {
   commands.push(JSON.parse(route.request().postData() ?? '{}'))
   if (lost) return route.continue()
   lost = true; const response = await route.fetch(); expect(response.ok()).toBe(true); await response.dispose(); await route.abort('failed')
  })
  phase('payment_unknown'); await collection.getByRole('button', { name: copy.accept, exact: true }).click(); await confirm(page, copy.accept)
  await expect(page.getByText(copy.unknown, { exact: true })).toBeVisible(); await page.getByRole('button', { name: copy.retry, exact: true }).click()
  await expect(collection.getByRole('button', { name: copy.reconcile, exact: true })).toBeVisible(); expect(commands.length).toBe(2); expect(commands[0]).toEqual(commands[1]); expect(commands[0]!.p_action).toBe('dispatch'); expect(commands[0]!.p_revision).toBe(1); expect(commands[0]!.p_outcome).toBe('accepted')
  await page.unroute(f.api + '/rest/v1/rpc/doctor_advance_practice_payment')
  phase('payment_reconcile'); await collection.getByRole('button', { name: copy.reconcile, exact: true }).click(); await confirm(page, copy.reconcile); await expect(collection).toContainText(ar ? 'مسجل · اصطناعي' : 'Posted · synthetic'); await expect(collection).toContainText('100.00 EGP')
  phase('refund_prepare'); await collection.getByRole('button', { name: copy.refund, exact: true }).click(); await prepare(page, 'refund', 'SYNTHETIC_REFUND_' + locale, '30.00')
  const refund = page.getByRole('row').filter({ hasText: 'SYNTHETIC_REFUND_' + locale }); await refund.getByRole('button', { name: copy.accept, exact: true }).click(); await confirm(page, copy.accept); await refund.getByRole('button', { name: copy.reconcile, exact: true }).click(); await confirm(page, copy.reconcile); await expect(refund).toContainText(ar ? 'مسجل · اصطناعي' : 'Posted · synthetic'); await expect(refund).toContainText('30.00 EGP')
  phase('refund_failure'); await collection.getByRole('button', { name: copy.refund, exact: true }).click(); await prepare(page, 'refund', 'SYNTHETIC_REJECTED_REFUND_' + locale, '20.00')
  const failed = page.getByRole('row').filter({ hasText: 'SYNTHETIC_REJECTED_REFUND_' + locale }); await failed.getByRole('button', { name: copy.reject, exact: true }).click(); await confirm(page, copy.reject); await failed.getByRole('button', { name: copy.reconcile, exact: true }).click(); await confirm(page, copy.reconcile); await expect(failed).toContainText(ar ? 'فشل أو ألغي قبل المحاولة' : 'Failed or cancelled before attempt'); await expect(failed.getByRole('cell').nth(3)).toHaveText('—')
  await expect(page.getByText('110.75 EGP', { exact: true })).toBeVisible(); await expect(collection).toContainText('100.00 EGP')
  phase('direction_and_viewport'); await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  phase('money_read_only'); readonly = await context(f.billing.readonlyStorageState); const blocked = await readonly.newPage(); await openMoney(blocked, f.billing.readonlyServiceLabel)
  await expect(blocked.getByText(copy.readonly, { exact: true })).toBeVisible(); await expect(blocked.getByRole('button', { name: copy.prepareCollection, exact: true })).toHaveCount(0); await expect(blocked.getByRole('button', { name: copy.refund, exact: true })).toHaveCount(0)
  const original = blocked.getByRole('row').filter({ hasText: 'SYNTHETIC_READONLY_COLLECTION_HISTORY' }); await expect(original).toContainText('50.00 EGP'); await expect(original).toContainText('SYN-00000001'); await expect(blocked.getByRole('row').filter({ hasText: 'SYNTHETIC_COLLECTION_' + locale })).toHaveCount(0); await expect(blocked.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
 } finally { for (const c of [owner, readonly]) if (c) { await c.unrouteAll({ behavior: 'ignoreErrors' }); await c.close() } }
})
