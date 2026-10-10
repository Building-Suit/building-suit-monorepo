import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const appRoot = new URL('../../app/', import.meta.url).pathname
const workspaceRoot = new URL('../../../../', import.meta.url).pathname

function vueFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

const sources = vueFiles(appRoot).map(file => ({
  file: path.relative(appRoot, file).replaceAll(path.sep, '/'),
  source: readFileSync(file, 'utf8'),
}))

test('Shop reusable controls and tables come from shared UI', () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /<table\b/, `${file} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${file} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:DataTable|Dialog)\b/, `${file} bypasses the Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${file} bypasses shared confirmation`)
  }
  for (const component of ['BsDataTable', 'BsRecordActionDialog', 'BsButton', 'BsForm', 'BsSelect', 'BsCard', 'BsKpiCard', 'BsStatusBadge']) {
    assert.ok(sources.some(({ source }) => source.includes(`<${component}`)), `Shop does not consume ${component}`)
  }
})

test('Shop auth routes use the canonical shared auth and signup contracts', () => {
  const layout = sources.find(item => item.file === 'layouts/auth.vue')?.source || ''
  const login = sources.find(item => item.file === 'pages/auth/login.vue')?.source || ''
  const signup = sources.find(item => item.file === 'pages/auth/signup.vue')?.source || ''
  const recovery = sources.filter(item => ['pages/auth/forgot-password.vue', 'pages/auth/reset-password.vue'].includes(item.file))
  assert.match(layout, /<BsAuthLayout\b/)
  assert.match(login, /<BsAuthForm\b/)
  assert.match(signup, /<BsAuthForm\b/)
  assert.match(signup, /<BsSignupWizard\b/)
  assert.match(signup, /<BsVerificationForm\b/)
  assert.match(signup, /useVerificationTimer\(\)/)
  assert.equal(existsSync(path.join(appRoot, 'composables/useShopVerificationTimer.ts')), false)
  for (const { source } of recovery) assert.match(source, /<BsAuthForm\b/)
  for (const source of [login, signup, ...recovery.map(item => item.source)]) {
    assert.doesNotMatch(source, /\bls-auth-(?:card|eyebrow)\b/)
  }
})

test('standard Shop record actions use the canonical dialog and controller', () => {
  const expected = [
    'pages/catalog-import.vue',
    'pages/appointments/index.vue',
    'pages/cash-shifts.vue',
    'pages/customers/[id].vue',
    'pages/customers/index.vue',
    'pages/expenses/index.vue',
    'pages/inventory/index.vue',
    'pages/platform-admin.vue',
    'pages/products/index.vue',
    'pages/purchases/[id].vue',
    'pages/purchases/index.vue',
    'pages/sales/[id]/index.vue',
    'pages/sales/index.vue',
    'pages/services/index.vue',
    'pages/team.vue',
  ]
  for (const file of expected) {
    const source = sources.find(item => item.file === file)?.source
    assert.ok(source, `${file} is missing`)
    assert.match(source, /useRecordAction\(/, `${file} does not use the shared controller`)
    assert.match(source, /<BsRecordActionDialog\b/, `${file} does not use the shared record-action dialog`)
  }
})

test('Shop catalog category CRUD uses the canonical record dialog', () => {
  const catalog = sources.find(item => item.file === 'pages/catalog-import.vue')?.source || ''
  assert.match(catalog, /useRecordAction\(/)
  assert.match(catalog, /<BsRecordActionDialog v-model:visible="categoryOpen"/)
  assert.doesNotMatch(catalog, /<BsForm class="mt-4 flex flex-col gap-3 md:flex-row"/)
})

test('Shop CRUD tables use shared capabilities, toolbar controls, pagination, and row actions', () => {
  for (const file of ['pages/products/index.vue', 'pages/services/index.vue']) {
    const source = sources.find(item => item.file === file)?.source || ''
    assert.match(source, /<BsDataTable[\s\S]+:capabilities="\{ insert:/, `${file} lacks shared capabilities`)
    assert.match(source, /searchable/, `${file} lacks shared search`)
    assert.match(source, /paginator/, `${file} lacks shared pagination`)
    assert.match(source, /@create=/, `${file} lacks shared create action`)
    assert.match(source, /@edit=/, `${file} lacks shared edit action`)
    assert.doesNotMatch(source, /<nav v-if="[^"]*total > pageSize"/, `${file} retains local pagination`)
  }
  const customers = sources.find(item => item.file === 'pages/customers/index.vue')?.source || ''
  assert.match(customers, /:capabilities="\{ insert: canManage \}"/)
  assert.match(customers, /@create="openCreate"/)
  const settings = sources.find(item => item.file === 'pages/settings.vue')?.source || ''
  assert.match(settings, /<BsDataTable[\s\S]+copy\.locationsTitle/)
  assert.match(settings, /<BsRecordActionDialog v-model:visible="locationDialogOpen"/)
  assert.doesNotMatch(settings, /<BsForm v-if="canManage && \(editingLocationId/)
})

test('remaining direct dialogs are materially different shared-overlay workflows', () => {
  const allowed = new Set([
    'pages/appointments/index.vue',
    'pages/platform-admin.vue',
  ])
  const actual = sources.filter(({ source }) => /<BsDialog\b/.test(source)).map(({ file }) => file)
  assert.deepEqual(actual.sort(), [...allowed].sort())
})

test('Shop authenticated chrome is adapter-only shared UI', () => {
  const layouts = sources.filter(({ file }) => file.startsWith('layouts/'))
  for (const file of ['layouts/default.vue', 'layouts/platform-admin.vue']) {
    const source = layouts.find(item => item.file === file)?.source || ''
    assert.match(source, /<BsAppShell\b/)
    assert.match(source, /<BsUserMenu\b/)
    assert.doesNotMatch(source, /<SettingsMenu\b|accountOpen|role="menu"/)
  }
})

test('Shop has no local Vue components or ownership exceptions', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  assert.deepEqual(manifest.components.filter(component => component.path.startsWith('apps/shop-suit/')), [])
  assert.deepEqual(vueFiles(path.join(appRoot, 'components')), [])
})

test('every Shop template conforms to the exhaustive zero-native contract', async () => {
  const { auditSuitTemplates } = await import('../../../../tooling/checks/suit-template-boundaries.mjs')
  const audit = await auditSuitTemplates({ root: workspaceRoot })
  assert.deepEqual(audit.parseFailures.filter(failure => failure.startsWith('apps/shop-suit/')), [])
  assert.deepEqual(audit.debt.filter(item => item.file.startsWith('apps/shop-suit/')), [])
})

test('remaining authenticated root mutations use shared action dialogs', () => {
  for (const file of ['pages/settings.vue', 'pages/billing.vue', 'pages/dashboard.vue', 'pages/platform-admin.vue']) {
    const source = sources.find(item => item.file === file)?.source || ''
    assert.doesNotMatch(source, /<BsForm\b/, `${file} retains a root mutation form`)
    assert.match(source, /<BsRecordActionDialog\b/)
    assert.match(source, /useRecordAction\(/)
  }
})
