import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { parse } from '@vue/compiler-sfc'
import { readPresentationTree } from '../../../../packages/testing/presentation-source.mjs'

const appRoot = new URL('../../app/', import.meta.url).pathname
const workspaceRoot = new URL('../../../../', import.meta.url).pathname

function vueFiles(directory, optional = false) {
  if (optional && !existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

const sources = vueFiles(appRoot).map(file => ({
  file: path.relative(appRoot, file).replaceAll(path.sep, '/'),
  source: readFileSync(file, 'utf8'),
}))

const presentationSources = await Promise.all(sources.map(async item => ({ ...item, source: await readPresentationTree(workspaceRoot, `apps/ledger-suit/app/${item.file}`) })))

test('Ledger reusable controls and tables come from shared UI', () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /<table\b/, `${file} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${file} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:DataTable|Dialog)\b/, `${file} bypasses the Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${file} bypasses shared confirmation`)
  }
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsDataTable')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsRecordActionDialog')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsButton')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsForm')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsSelect')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsCard')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsKpiCard')))
  assert.ok(presentationSources.some(({ source }) => source.includes('<BsStatusBadge')))
})

test('Ledger auth routes use the canonical shared auth and signup contracts', () => {
  const login = presentationSources.find(item => item.file === 'pages/login.vue')?.source || ''
  const signup = presentationSources.find(item => item.file === 'pages/signup.vue')?.source || ''
  const verification = presentationSources.find(item => item.file === 'pages/verify-email.vue')?.source || ''
  const invitation = presentationSources.find(item => item.file === 'pages/accept-invitation.vue')?.source || ''
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
  for (const file of ['pages/login.vue', 'pages/signup.vue', 'pages/verify-email.vue', 'pages/accept-invitation.vue']) {
    const source = sources.find(item => item.file === file).source
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
    const presentation = presentationSources.find(item => item.file === (route || file)).source
    assert.match(presentation, /<BsRecordActionDialog\b/, `${file} does not use the shared record-action dialog`)
    if (route) assert.doesNotMatch(presentation, /:factory=/, `${file} must not inject controllers into presentation`)
  }
})

test('Ledger account and dimension CRUD retain semantic shared commands', () => {
  for (const route of ['accounts', 'accounting-dimensions']) {
    const adapter = sources.find(item => item.file === `pages/${route}.vue`).source
    const presentation = presentationSources.find(item => item.file === `pages/${route}.vue`).source
    assert.match(presentation, /<BsDataTable/)
    assert.match(presentation, /:capabilities=/)
    assert.match(presentation, /<BsRecordActionDialog/)
    assert.match(adapter, /@(?:create|create-policy)=/)
    assert.match(adapter, /@(?:edit|edit-policy)=/)
    assert.match(adapter, /@(?:save-editor|save-policy)=/)
  }
})

test('Suit routes contain no direct dialogs or reusable chrome', () => {
  for (const { file, source } of sources) assert.doesNotMatch(source, /<Bs(?:Dialog|RecordActionDialog|AppShell|UserMenu)\b/, file)
  const layout = sources.find(item => item.file === 'layouts/default.vue').source
  assert.match(layout, /<BsWorkspaceShell\b/)
  const presentation = presentationSources.find(item => item.file === 'layouts/default.vue').source
  assert.match(presentation, /<BsAppShell\b/)
  assert.match(presentation, /<BsUserMenu\b/)
  assert.equal(existsSync(path.join(appRoot, 'components/AccountMenu.vue')), false)
})

test('Ledger has no local Vue component layer or ownership debt', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const ledger = manifest.components.filter(component => component.path.startsWith('apps/ledger-suit/'))
  const actual = vueFiles(path.join(appRoot, 'components'), true)
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
        assert.ok(['template', 'slot', 'NuxtPage', 'NuxtLayout'].includes(node.tag) || node.tag.startsWith('Bs'), `${file}: non-Bs tag ${node.tag}`)
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
  assert.equal(tables, 0, 'data tables belong inside shared page templates')
  assert.ok(presentationSources.some(item => /<BsDataTable/.test(item.source)))
})

test('migrated presentation wrappers are removed and report values are preserved', () => {
  for (const name of ['MoneyText', 'KpiCard', 'LedgerPageHeader', 'AccountingTableDensity', 'RevenueExpenseChart', 'SetupChecklist', 'QuotaUsageMeter', 'UsageMeters']) {
    assert.equal(existsSync(path.join(appRoot, `components/${name}.vue`)), false)
    for (const { file, source } of sources) assert.doesNotMatch(source, new RegExp(`<${name}\\b`), file)
  }
  const reports = sources.find(item => item.file === 'pages/reports.vue').source
  assert.match(reports, /displayReportMoney\(sumTrial\(item.field\)\)/)
  assert.match(reports, /trialBalance.value.map/)
  const dashboard = presentationSources.find(item => item.file === 'pages/dashboard.vue').source
  assert.match(dashboard, /<BsMetricBarChart/)
  assert.match(dashboard, /:table-series=/)
})
