import { expect, test } from '@playwright/test'
import { ledgerFixture, fixtureOrganization } from './atomic-ledger-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
const bank = '47000000-0000-4000-8000-000000000071'
const otherBank = '47000000-0000-4000-8000-000000000072'
const asset = '47000000-0000-4000-8000-000000000073'
const liability = '47000000-0000-4000-8000-000000000074'
const category = '47000000-0000-4000-8000-000000000075'
const accounts = [[bank, 'Cash', 'asset', true], [otherBank, 'Bank', 'asset', true], [asset, 'Equipment', 'asset', false], [liability, 'Loan', 'liability', false]].map(([id, name, type, liquid]) => ({ id, organization_id: fixtureOrganization, code: '101', name, type, subtype: liquid ? 'bank' : 'other', currency: 'EGP', is_liquid: liquid, is_archived: false, is_system: false, system_key: null, parent_account_id: null, account_role: 'posting' }))
const capabilities = ['transactions.read', 'transactions.create', 'transactions.adjust', 'commitments.read', 'commitments.create', 'recurring.read', 'recurring.manage', 'counterparties.read', 'counterparties.manage', 'tags.read', 'tags.manage']
const flows = ['income', 'expense', 'transfer', 'asset_purchase', 'liability_created', 'liability_payment', 'owner_contribution', 'owner_withdrawal', 'adjustment'] as const
function fixture(name: string) {
 if (name === 'accounts') return accounts
 if (name === 'categories') return [{ id: category, name: 'Sales', kind: 'income', default_account_id: null }, { id: category, name: 'Costs', kind: 'expense', default_account_id: null }]
 if (name === 'can_use_feature') return false
 if (name.startsWith('record_') || name === 'create_adjustment') return '47000000-0000-4000-8000-000000000079'
 return undefined
}
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
 test(`workspace shell and journal editor parity: ${locale}, ${theme}, ${width}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  const { calls, goto } = await ledgerFixture(page, locale, capabilities, fixture)
  await goto('/transactions?type=expense')
  await page.getByTestId('financial-help').click()
  const help = page.getByRole('dialog')
  await expect(help.getByRole('heading', { name: copy.financialMap.title, exact: true })).toBeVisible()
  await expect(help.getByText(copy.financialMap.engine.result, { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('financial-help')).toBeFocused()
  await page.getByRole('button', { name: copy.transactionWorkspace.new, exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  await dialog.locator('#flow').selectOption('adjustment')
  await expect(dialog.locator('#reason')).toBeVisible()
  await dialog.locator('#line-amount-0').fill('100')
  await dialog.getByRole('button', { name: copy.add.addLine, exact: true }).click()
  await expect(dialog.locator('[id^="line-account-"]')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('alert').getByRole('button', { name: copy.common.cancel, exact: true }).click()
  await expect(dialog.locator('#line-amount-0')).toHaveValue('100')
  expect(calls.filter(call => call.name === 'create_adjustment')).toHaveLength(0)
  await expectNoPageOverflow(page)
  await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/workspace-journal-${locale}-${theme}-${width}.png`, animations: 'disabled' })
 })
}
for (const locale of ['en', 'ar'] as const) for (const flow of flows) {
 test(`authorized journal command retains its exact payload: ${locale}, ${flow}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const { calls, goto } = await ledgerFixture(page, locale, capabilities, fixture)
  await goto(`/transactions?type=${flow}&create=1`)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  await dialog.locator('#date').fill('2026-10-11')
  if (flow === 'adjustment') {
   await dialog.locator('#descr').fill('Reviewed journal evidence')
   await dialog.locator('#reason').fill('Reviewed accounting reason')
   for (const index of [0, 1]) { await dialog.locator(`#line-account-${index}`).selectOption(index ? asset : bank); await dialog.locator(`#line-amount-${index}`).fill('9007199254740993.25') }
  } else {
   if (flow !== 'liability_payment') await dialog.locator('#amount').fill('123.45')
   if (['income', 'expense'].includes(flow)) await dialog.locator('#cat').selectOption(category)
   if (['expense', 'transfer', 'asset_purchase', 'liability_payment', 'owner_withdrawal'].includes(flow)) await dialog.locator('#src').selectOption(bank)
   if (['income', 'transfer', 'liability_created', 'owner_contribution'].includes(flow)) await dialog.locator('#dest').selectOption(flow === 'transfer' ? otherBank : bank)
   if (flow === 'asset_purchase') await dialog.locator('#asset').selectOption(asset)
   if (['liability_created', 'liability_payment'].includes(flow)) await dialog.locator('#liab').selectOption(liability)
   if (flow === 'liability_payment') await dialog.locator('#principal').fill('123.45')
  }
  await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const command = calls.find(call => call.name === (flow === 'adjustment' ? 'create_adjustment' : `record_${flow}`))
  expect(command?.args).toMatchObject({ p_organization_id: fixtureOrganization, p_transaction_date: '2026-10-11' })
  expect(command?.args.p_idempotency_key).toMatch(/^[\da-f-]{36}$/)
  if (flow === 'adjustment') expect(command?.args).toMatchObject({ p_description: 'Reviewed journal evidence', p_reason: 'Reviewed accounting reason', p_lines: [{ account_id: bank, side: 'debit', amount_minor: '900719925474099325' }, { account_id: asset, side: 'credit', amount_minor: '900719925474099325' }] })
  else expect(command?.args[flow === 'liability_payment' ? 'p_principal_minor' : 'p_amount_minor']).toBe('12345')
 })
}
for (const locale of ['en', 'ar'] as const) for (const kind of ['commitments', 'recurring', 'counterparties', 'tags'] as const) {
 test(`operational creation preserves its authorized adapter: ${locale}, ${kind}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  let tagWrite: unknown
  const { calls, goto } = await ledgerFixture(page, locale, capabilities, (name, args, request) => {
   if (['create_commitment', 'create_recurring_rule', 'create_counterparty'].includes(name)) return bank
   if (name === 'tags' && request.method === 'POST') { tagWrite = args; return [] }
   return fixture(name)
  })
  await goto(`/records/${kind}?create=1`)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  if (kind === 'tags') await dialog.locator('#tag-name').fill('Reviewed tag')
  else if (kind === 'counterparties') await dialog.getByPlaceholder(copy.operations.name, { exact: true }).fill('Reviewed party')
  else {
   await dialog.getByPlaceholder(copy.operations.name, { exact: true }).fill('Reviewed schedule')
   await dialog.getByPlaceholder(copy.transactions.amount, { exact: true }).fill('123.45')
   if (kind === 'recurring') {
    await dialog.locator('select').filter({ has: page.locator(`option[value="${bank}"]`) }).selectOption(bank)
   }
  }
  await dialog.getByRole('button', { name: kind === 'commitments' ? copy.operations.addCommitment : kind === 'recurring' ? copy.operations.addRule : copy.common.save, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  if (kind === 'tags') expect(tagWrite).toMatchObject({ organization_id: fixtureOrganization, name: 'Reviewed tag', color: '#2F77C9' })
  else {
   const command = calls.find(call => call.name === (kind === 'commitments' ? 'create_commitment' : kind === 'recurring' ? 'create_recurring_rule' : 'create_counterparty'))
   expect(command?.args.p_organization_id).toBe(fixtureOrganization)
   if (kind === 'commitments') expect(command?.args).toMatchObject({ p_title: 'Reviewed schedule', p_amount_minor: 12345, p_auto_convert: false, p_reminder_days_before: 3 })
   if (kind === 'recurring') expect(command?.args).toMatchObject({ p_name: 'Reviewed schedule', p_transaction_type: 'expense', p_frequency: 'monthly', p_mode: 'requires_confirmation', p_template: { amount_minor: 12345, source_account_id: bank } })
   if (kind === 'counterparties') expect(command?.args).toMatchObject({ p_name: 'Reviewed party', p_type: 'other' })
  }
 })
}
for (const locale of ['en', 'ar'] as const) {
 test(`missing workspace preserves the owner-onboarding redirect: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  const { calls, goto } = await ledgerFixture(page, locale, [], name => name === 'organization_members' ? [] : fixture(name), { landing: '/signup' })
  await goto('/signup')
  await expect(page).toHaveURL(/\/signup$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: copy.auth.email, exact: true })).toHaveValue('ledger@test.local')
  expect(calls.filter(call => call.name.startsWith('record_') || call.name === 'create_organization')).toHaveLength(0)
  await expectNoPageOverflow(page)
 })
}
for (const locale of ['en', 'ar'] as const) {
 test(`team invitation has one owner and preserves email delivery: ${locale}`, async ({ page }) => {
  const copy = locale === 'ar' ? ar : en
  let invitation: Record<string, unknown> | undefined
  const { goto } = await ledgerFixture(page, locale, ['members.read', 'members.invite'], (name, args, request) => {
   if (name === 'organization_members' && new URL(request.url).searchParams.get('select')?.includes('profile:')) return [{ id: bank, user_id: '47000000-0000-4000-8000-000000000012', role: 'owner', role_id: null, status: 'active', granted_capabilities: [], revoked_capabilities: [], joined_at: '2026-01-01', profile: { email: 'ledger@test.local', full_name: 'Fixture owner', job_title: 'Owner' } }]
   if (name === 'send-invitation') { invitation = args; return { sent: true } }
   return fixture(name)
  })
  await goto('/team')
  await page.getByRole('button', { name: copy.org.invite, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  await dialog.getByLabel(copy.auth.email, { exact: true }).fill('reviewed@example.invalid')
  await dialog.getByRole('button', { name: copy.org.createInvite, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(invitation).toEqual({ organizationId: fixtureOrganization, email: 'reviewed@example.invalid', role: 'viewer', roleId: null })
  await page.getByRole('button', { name: copy.access.permissionsMatrix, exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog').getByRole('table')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
 })
}
