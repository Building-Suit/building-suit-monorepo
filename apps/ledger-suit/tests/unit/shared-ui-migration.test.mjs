import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const appRoot = new URL('../../app/', import.meta.url).pathname
const workspaceRoot = new URL('../../../../', import.meta.url).pathname

function vueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

const sources = vueFiles(appRoot).map(file => ({
  file: path.relative(appRoot, file).replaceAll(path.sep, '/'),
  source: readFileSync(file, 'utf8'),
}))

test('Ledger reusable controls and tables come from shared UI', () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /<table\b/, `${file} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${file} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:DataTable|Dialog)\b/, `${file} bypasses the Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${file} bypasses shared confirmation`)
  }
  assert.ok(sources.some(({ source }) => source.includes('<BsDataTable')))
  assert.ok(sources.some(({ source }) => source.includes('<BsRecordActionDialog')))
  assert.ok(sources.some(({ source }) => source.includes('<BsButton')))
  assert.ok(sources.some(({ source }) => source.includes('<BsForm')))
  assert.ok(sources.some(({ source }) => source.includes('<BsSelect')))
  assert.ok(sources.some(({ source }) => source.includes('<BsCard')))
  assert.ok(sources.some(({ source }) => source.includes('<BsKpiCard')))
  assert.ok(sources.some(({ source }) => source.includes('<StatusBadge')))
})

test('Ledger auth routes use the canonical shared auth and signup contracts', () => {
  const login = sources.find(item => item.file === 'pages/login.vue')?.source || ''
  const signup = sources.find(item => item.file === 'pages/signup.vue')?.source || ''
  const verification = sources.find(item => item.file === 'pages/verify-email.vue')?.source || ''
  const invitation = sources.find(item => item.file === 'pages/accept-invitation.vue')?.source || ''
  assert.match(login, /<BsAuthLayout\b/)
  assert.match(login, /<BsAuthForm\b/)
  assert.match(signup, /<BsAuthLayout\b/)
  assert.match(signup, /<BsAuthForm\b/)
  assert.match(signup, /<BsSignupWizard\b/)
  assert.match(signup, /<BsVerificationForm\b/)
  assert.match(verification, /<BsAuthLayout\b/)
  assert.match(verification, /<BsVerificationForm\b/)
  assert.match(invitation, /<BsAuthLayout\b/)
  assert.match(invitation, /<BsAuthForm\b/)
  assert.match(invitation, /<BsVerificationForm\b/)
  for (const source of [login, signup, verification, invitation]) {
    assert.doesNotMatch(source, /\bls-auth-(?:page|panel|form-shell|card|eyebrow)\b/)
  }
})

test('standard Ledger record actions use the canonical dialog and controller', () => {
  const expected = [
    'components/AccountStatementClassificationDialog.vue',
    'components/AddTransactionDialog.vue',
    'components/CashFlowAllocationDialog.vue',
    'components/ControlReconciliationPanel.vue',
    'components/OperationsCenter.vue',
    'components/OrganizationSwitcher.vue',
    'components/TeamMenu.vue',
    'pages/accounting-dimensions.vue',
    'pages/accounts.vue',
    'pages/bank-reconciliation.vue',
    'pages/fixed-assets.vue',
    'pages/inventory-accounting.vue',
    'pages/migration-center.vue',
    'pages/payables.vue',
    'pages/periods.vue',
    'pages/platform-admin.vue',
    'pages/receivables.vue',
    'pages/records/[kind].vue',
    'pages/tax-vat.vue',
    'pages/team.vue',
  ]
  for (const file of expected) {
    const source = sources.find(item => item.file === file)?.source
    assert.ok(source, `${file} is missing`)
    assert.match(source, /useRecordAction\(/, `${file} does not use the shared controller`)
    assert.match(source, /<BsRecordActionDialog\b/, `${file} does not use the shared record-action dialog`)
  }
})

test('remaining direct dialogs are materially different shared-overlay workflows', () => {
  const allowed = new Set([
    'components/AccountActivityDialog.vue',
    'components/BillingCheckout.vue',
    'components/CsvImportDialog.vue',
    'components/FinancialSystemMap.vue',
    'components/ManualPaymentCheckout.vue',
    'components/TransactionDetailDialog.vue',
    'pages/team.vue',
  ])
  const actual = sources.filter(({ source }) => /<BsDialog\b/.test(source)).map(({ file }) => file)
  assert.deepEqual(actual.sort(), [...allowed].sort())
})

test('every remaining Ledger component is approved product orchestration over shared UI', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const ledger = manifest.components.filter(component => component.path.startsWith('apps/ledger-suit/'))
  const actual = vueFiles(path.join(appRoot, 'components'))
    .map(file => `apps/ledger-suit/app/components/${path.basename(file)}`)
    .sort()
  assert.deepEqual(ledger.map(component => component.path).sort(), actual)
  assert.ok(ledger.every(component => component.classification === 'product-orchestration'))
  assert.ok(ledger.every(component => component.approval === 'BS-UI-LEDGER-MIG-001'))
  assert.ok(ledger.every(component => component.rationale.includes('composes canonical shared UI primitives')))
  assert.equal(existsSync(path.join(appRoot, 'components/AppLogo.vue')), false)
})
