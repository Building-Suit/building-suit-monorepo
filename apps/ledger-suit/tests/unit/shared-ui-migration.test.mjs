import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { parse } from '@vue/compiler-sfc'

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
  assert.ok(sources.some(({ source }) => source.includes('<BsStatusBadge')))
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
  const routeForAdapter = {
    AccountStatementClassificationDialog: 'pages/accounts.vue',
    AddTransactionDialog: 'layouts/default.vue',
    CashFlowAllocationDialog: 'pages/reports.vue',
    ControlReconciliationPanel: 'pages/accounts.vue',
    OperationsCenter: 'layouts/default.vue',
    OrganizationSwitcher: 'layouts/default.vue',
    TeamMenu: 'layouts/default.vue',
  }
  for (const file of expected) {
    const name = path.basename(file, '.vue')
    const route = routeForAdapter[name]
    const source = route
      ? readFileSync(path.join(appRoot, `composables/useLedger${name}View.ts`), 'utf8')
      : sources.find(item => item.file === file)?.source
    assert.ok(source, `${file} orchestration is missing`)
    assert.match(source, /useRecordAction\(/, `${file} does not use the shared controller`)
    const presentation = route ? sources.find(item => item.file === route).source : source
    assert.match(presentation, /<BsRecordActionDialog\b/, `${file} does not use the shared record-action dialog`)
    if (route) assert.ok(presentation.includes(`:factory="useLedger${name}View"`), `${file} adapter is not connected`)
  }
})

test('Ledger account CRUD actions are capability-driven by the shared table', () => {
  const accounts = sources.find(item => item.file === 'pages/accounts.vue')?.source || ''
  assert.match(accounts, /<BsDataTable[\s\S]+:capabilities="\{ insert:/)
  assert.match(accounts, /@create="openCreate\(\)"/)
  assert.match(accounts, /@edit="openEdit"/)
  assert.match(accounts, /@archive="archiveAccount"/)
  assert.match(accounts, /<template #row-actions=/)
})

test('Ledger dimension CRUD actions use shared table capabilities and record dialogs', () => {
  const dimensions = sources.find(item => item.file === 'pages/accounting-dimensions.vue')?.source || ''
  assert.match(dimensions, /<BsDataTable[\s\S]+:capabilities="\{ insert:/)
  assert.match(dimensions, /@create="editPolicy\(\)"/)
  assert.match(dimensions, /@edit="editPolicy"/)
  assert.match(dimensions, /<BsRecordActionDialog\s+v-model:visible="policyOpen"/)
  assert.doesNotMatch(dimensions, /<BsForm class="grid gap-4 md:grid-cols-4"/)
})

test('remaining direct dialogs are materially different shared-overlay workflows', () => {
  const allowed = new Set([
    'layouts/default.vue', 'pages/accounts.vue', 'pages/billing.vue',
    'pages/index.vue', 'pages/records/[kind].vue', 'pages/reports.vue',
    'pages/subscribe.vue', 'pages/team.vue', 'pages/transactions.vue',
  ])
  const actual = sources.filter(({ source }) => /<BsDialog\b/.test(source)).map(({ file }) => file)
  assert.deepEqual(actual.sort(), [...allowed].sort())
})

test('Ledger authenticated chrome is adapter-only shared UI', () => {
  for (const file of ['layouts/default.vue', 'pages/platform-admin.vue', 'pages/subscribe.vue']) {
    const source = sources.find(item => item.file === file)?.source || ''
    assert.match(source, /<BsAppShell\b/)
    assert.match(source, /<BsUserMenu\b/)
    assert.doesNotMatch(source, /<SettingsMenu\b|<AccountMenu\b|role="menu"/)
  }
  assert.equal(existsSync(path.join(appRoot, 'components/AccountMenu.vue')), false)
})

test('Ledger has no local Vue component layer or ownership debt', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const ledger = manifest.components.filter(component => component.path.startsWith('apps/ledger-suit/'))
  const actual = vueFiles(path.join(appRoot, 'components'))
    .map(file => `apps/ledger-suit/app/components/${path.basename(file)}`)
    .sort()
  assert.deepEqual(actual, [], 'Ledger presentation must live in shared Bs components')
  assert.deepEqual(ledger, [], 'Removed local components must not retain ownership debt')
  assert.equal(existsSync(path.join(appRoot, 'components/AppLogo.vue')), false)
})

// The final template and column boundaries are exhaustive.
test('all Ledger tables use Bs-owned column schemas and domain cell slots', () => {
  let tables = 0
  for (const { file, source } of sources) {
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [], file)
    assert.equal(descriptor.styles.length, 0, `${file}: local CSS`)
    function visit(node) {
      if (node.type === 1) {
        assert.ok(node.tag === 'template' || node.tag.startsWith('Bs'), `${file}: non-Bs tag ${node.tag}`)
        assert.ok(!node.props.some(prop => prop.type === 6 && ['class', 'style'].includes(prop.name) || prop.type === 7 && prop.name === 'bind' && ['class', 'style', 'pt'].includes(prop.arg?.content)), `${file}: local presentation styling`)
        assert.ok(!['Column', 'ColumnGroup', 'Row', 'DataTable'].includes(node.tag), `${file}: vendor table tag ${node.tag}`)
        if (node.tag === 'BsDataTable') {
          tables++
          assert.ok(node.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'columns'), `${file}: missing Bs columns`)
        }
      }
      for (const child of node.children || []) visit(child)
    }
    if (descriptor.template?.ast) visit(descriptor.template.ast)
    assert.doesNotMatch(source, /#(?:cell|header)-[^=]+="\{\s*data\b/, `${file}: vendor slot scope`)
  }
  assert.ok(tables > 0)
})

test('migrated presentation wrappers are removed and report values are preserved', () => {
  for (const name of ['MoneyText', 'KpiCard', 'LedgerPageHeader', 'AccountingTableDensity', 'RevenueExpenseChart', 'SetupChecklist', 'QuotaUsageMeter', 'UsageMeters']) {
    assert.equal(existsSync(path.join(appRoot, `components/${name}.vue`)), false)
    for (const { file, source } of sources) assert.doesNotMatch(source, new RegExp(`<${name}\\b`), file)
  }
  const reports = sources.find(item => item.file === 'pages/reports.vue').source
  assert.match(reports, /#\[`footer-\$\{column.field\}`\]/)
  assert.match(reports, /:amount="sumTrial\(column.field\)"/)
  const dashboard = sources.find(item => item.file === 'pages/dashboard.vue').source
  assert.match(dashboard, /<BsMetricBarChart/)
  assert.match(dashboard, /:table-series="ledgerPresentation.chartTableSeries"/)
})
