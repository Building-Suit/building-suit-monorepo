// Real browser requests only: no Auth/REST/Edge interception or session injection.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { billingContext, digest, readJson, root, writePrivate } from './native-billing-context.mjs'
const mode = process.argv[2]
assert.ok(['baseline', 'verify'].includes(mode))
assert.equal(process.argv.length, 3)
const c = billingContext()
const state = readJson(path.join(c.directory, 'fixture-state.json'))
const { chromium, expect } = createRequire(path.join(root, 'package.json'))('@playwright/test')
const copy = readJson(path.join(root, 'apps/ledger-suit/i18n/locales/en.json'))
const launch = { headless: true }
if (process.env.LEDGER_CHROMIUM_EXECUTABLE_PATH) launch.executablePath = process.env.LEDGER_CHROMIUM_EXECUTABLE_PATH
const browser = await chromium.launch(launch)
const origins = new Set()
const errors = []
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  page = await context.newPage()
  page.on('request', request => { try { origins.add(new URL(request.url()).origin) } catch { /* Non-network browser URL. */ } })
  page.on('pageerror', error => errors.push(error.name))
  const login = async role => {
    await page.goto('http://127.0.0.1:60830' + (role === 'operator' ? '/platform-admin' : '/login'))
    await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
    await page.getByLabel(copy.auth.email).fill(state.actors[role].email)
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
    await expect(page.getByLabel(copy.auth.password)).toBeVisible()
    await page.getByLabel(copy.auth.password).fill(state.actors[role].password)
    const submit = page.getByRole('button', { name: copy.auth.signIn, exact: true })
    await expect(submit).toHaveCount(1); await submit.click()
  }
  await login('operator')
  await expect(page).toHaveURL(/\/platform-admin$/, { timeout: 20000 })
  await page.getByRole('combobox', { name: copy.admin.view, exact: true }).selectOption('payments')
  const row = page.getByRole('row').filter({ hasText: state.replacementEvidence })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: copy.admin.review, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: copy.admin.inspect, exact: true }).click()
  const link = dialog.getByRole('link', { name: copy.admin.openReceipt, exact: true })
  await expect(link).toBeVisible()
  const target = new URL(await link.getAttribute('href'))
  assert.ok(target.pathname.startsWith('/storage/v1/object/sign/manual-payment-receipts/'))
  if (mode === 'baseline') assert.equal(target.origin, 'http://kong:8000', 'Expected old internal-host link was not reproduced')
  else {
    assert.equal(target.origin, c.url)
    const response = await context.request.get(target.href)
    assert.equal(response.status(), 200)
    assert.match((await response.body()).toString(), /Synthetic local billing proof/)
    await dialog.getByRole('button', { name: copy.common.cancel, exact: true }).click()
    await expect(link).toHaveCount(0)
  }
  let customerFlow = false
  if (mode === 'verify' && !state.browserUiApproved) {
    await context.close()
    const customer = await browser.newContext({ viewport: { width: 390, height: 900 } })
    page = await customer.newPage()
    if (!state.browserRequest) c.psql("update public.subscriptions set current_period_start=now()-interval '2 months',current_period_end=now()-interval '1 month' where organization_id=:'org'::uuid", { org: state.organization })
    await login('owner')
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 })
    await page.goto('http://127.0.0.1:60830/billing')
    if (!state.browserRequest) {
      const pricing = page.getByTestId('plan-pricing')
      await pricing.getByRole('radio', { name: copy.billing.monthly, exact: true }).check()
      const quoted = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/rpc/prepare_manual_payment'))
      await pricing.locator('[data-plan="starter"]').getByRole('button').first().click()
      const response = await quoted; assert.equal(response.status(), 200)
      const payment = await response.json(); state.browserRequest = payment.id
      assert.equal(String(payment.amount_minor), '59900')
      writePrivate(path.join(c.directory, 'fixture-state.json'), state)
    } else await page.getByRole('button', { name: copy.billing.manual.requests, exact: true }).click()
    const paymentDialog = page.getByRole('dialog')
    await expect(paymentDialog).toContainText('Synthetic local transfer instructions')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
    if (!state.browserEvidence) {
      await paymentDialog.locator('input[type="file"]').setInputFiles({ name: 'synthetic-receipt.png', mimeType: 'image/png', buffer: png })
      await paymentDialog.getByLabel(copy.billing.manual.reason).fill('Reviewed native browser synthetic receipt')
      const submitted = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/functions/v1/manual-payment'))
      await paymentDialog.getByRole('button', { name: copy.billing.manual.submit, exact: true }).click()
      const response = await submitted; assert.equal(response.status(), 200)
      const result = await response.json(); state.browserEvidence = result.request.evidence_id
      assert.equal(result.request.id, state.browserRequest)
      writePrivate(path.join(c.directory, 'fixture-state.json'), state)
    }
    await expect(paymentDialog).toContainText(copy.billing.manual.states.submitted)
    await expect(paymentDialog).toContainText('synthetic-receipt.png')
    await customer.close()
    const reviewer = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    page = await reviewer.newPage(); await login('operator')
    await expect(page).toHaveURL(/\/platform-admin$/, { timeout: 20000 })
    await page.getByRole('combobox', { name: copy.admin.view, exact: true }).selectOption('payments')
    await page.getByRole('row').filter({ hasText: state.browserEvidence }).getByRole('button', { name: copy.admin.review, exact: true }).click()
    const reviewDialog = page.getByRole('dialog')
    await reviewDialog.getByRole('button', { name: copy.admin.inspect, exact: true }).click()
    const receiptLink = reviewDialog.getByRole('link', { name: copy.admin.openReceipt, exact: true })
    await expect(receiptLink).toBeVisible()
    assert.equal(new URL(await receiptLink.getAttribute('href')).origin, c.url)
    const opened = reviewer.waitForEvent('page'); await receiptLink.click(); const imagePage = await opened
    await imagePage.waitForLoadState('load')
    await expect.poll(() => imagePage.evaluate(() => document.querySelector('img')?.naturalWidth)).toBe(1)
    await imagePage.close()
    await reviewDialog.getByRole('combobox', { name: copy.admin.action, exact: true }).selectOption('approved')
    await reviewDialog.getByLabel(copy.admin.paymentReason).fill('Matched synthetic native receipt')
    await reviewDialog.getByLabel(copy.admin.context).fill('LS-BILL-NATIVE-001 native browser')
    await reviewDialog.getByRole('button', { name: copy.admin.submit, exact: true }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.equal(c.psql("select status from public.manual_payment_requests where id=:'request'::uuid", { request: state.browserRequest }), 'approved')
    assert.equal(c.psql("select sha256 from public.manual_payment_evidence where id=:'evidence'::uuid", { evidence: state.browserEvidence }), digest(png))
    const financial = digest(c.psql("select to_jsonb(t)::text from public.transactions t where organization_id=:'org'::uuid order by id; select to_jsonb(e)::text from public.transaction_entries e where organization_id=:'org'::uuid order by id;", { org: state.organization }))
    assert.equal(financial, state.financialFingerprint)
    state.browserUiApproved = true; writePrivate(path.join(c.directory, 'fixture-state.json'), state)
    customerFlow = true
  }
  assert.equal(errors.length, 0)
  const evidence = { task: c.owner.task, date: new Date().toISOString().slice(0, 10), mode, browser: browser.version(), authentication: 'Actual email/password UI and native GoTrue; dedicated local operator', receipt_link_origin: target.origin, receipt_token_disclosed: false, api_interception: false, session_injection: false, customer_mobile_quote_upload_and_operator_desktop_preview_approval: customerFlow || state.browserUiApproved === true, network_origins: [...origins].sort(), result: mode === 'baseline' ? 'internal_gateway_link_reproduced' : 'pass' }
  writePrivate(path.join(c.directory, `browser-${mode}-result.json`), evidence)
  console.log(JSON.stringify(evidence))
} catch (error) {
  let diagnostic = error?.stack || String(error)
  for (const actor of Object.values(state.actors)) diagnostic = diagnostic.replaceAll(actor.password, '[REDACTED]')
  for (const value of Object.values(c.credentials)) diagnostic = diagnostic.replaceAll(value, '[REDACTED]')
  writePrivate(path.join(c.directory, `browser-${mode}-error.log`), diagnostic)
  if (page) writePrivate(path.join(c.directory, `browser-${mode}-body.txt`), await page.locator('body').innerText().catch(() => 'Unavailable'))
  console.log('Native browser check failed; inspect the owned private diagnostics.')
  process.exitCode = 1
} finally { await browser.close() }
