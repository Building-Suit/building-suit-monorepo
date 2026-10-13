import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
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


function presentationFor(file) {
  const source = sources.find(item => item.file === file)?.source || ''
  const entry = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/atomic-template-route-inventory.json'), 'utf8')).entries.find(entry => entry.source === `apps/shop-suit/app/${file}`)
  return entry?.destination ? readFileSync(path.join(workspaceRoot, entry.destination), 'utf8') : source
}

test('Shop reusable controls and tables come from shared UI', async () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /<table\b/, `${file} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${file} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:DataTable|Dialog)\b/, `${file} bypasses the Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${file} bypasses shared confirmation`)
  }
  const presentation = (await Promise.all(sources.map(({ file }) => readPresentationTree(workspaceRoot, `apps/shop-suit/app/${file}`)))).join('\n')
  for (const component of ['BsDataTable', 'BsRecordActionDialog', 'BsButton', 'BsForm', 'BsSelect', 'BsCard', 'BsKpiCard', 'BsStatusBadge']) {
    assert.ok(presentation.includes(`<${component}`), `Shop does not consume ${component}`)
  }
})

test('Shop auth routes use the canonical shared auth and signup contracts', async () => {
  const layout = sources.find(item => item.file === 'layouts/auth.vue')?.source || ''
  const login = sources.find(item => item.file === 'pages/auth/login.vue')?.source || ''
  const signup = sources.find(item => item.file === 'pages/auth/signup.vue')?.source || ''
  const recovery = sources.filter(item => ['pages/auth/forgot-password.vue', 'pages/auth/reset-password.vue'].includes(item.file))
  assert.match(layout, /<BsProductAuthFrame\b/)
  assert.match(login, /<BsSignInPage\b/)
  assert.match(signup, /<BsSignupPage\b/)
  const enrollment = await readPresentationTree(workspaceRoot, 'apps/shop-suit/app/pages/auth/signup.vue')
  assert.match(enrollment, /<BsSignupWizard\b/)
  assert.match(enrollment, /<BsVerificationForm\b/)
  assert.match(signup, /useVerificationTimer\(\)/)
  assert.equal(existsSync(path.join(appRoot, 'composables/useShopVerificationTimer.ts')), false)
  for (const { source } of recovery) assert.match(source, /<BsPasswordRecoveryPage\b/)
  for (const source of [login, signup, ...recovery.map(item => item.source)]) {
    assert.doesNotMatch(source, /\bls-auth-(?:card|eyebrow)\b/)
  }
})

test('standard Shop record actions use the canonical dialog and controller', async () => {
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
    const entry = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/atomic-template-route-inventory.json'), 'utf8')).entries.find(entry => entry.source === `apps/shop-suit/app/${file}`)
    const presentation = entry?.destination ? await readPresentationTree(workspaceRoot, entry.destination) : source
    assert.match(presentation, /<BsRecordActionDialog\b|<BsAccessIdentityEditor\b|<BsAccessRoleEditor\b/, `${file} does not delegate to shared record-action presentation`)
  }
})

test('Shop catalog category CRUD uses the canonical record dialog', () => {
  const catalog = sources.find(item => item.file === 'pages/catalog-import.vue')?.source || ''
  assert.match(catalog, /useRecordAction\(/)
  assert.match(presentationFor('pages/catalog-import.vue'), /<BsRecordActionDialog v-model:visible="categoryOpen"/)
  assert.doesNotMatch(catalog, /<BsForm class="mt-4 flex flex-col gap-3 md:flex-row"/)
})

test('Shop CRUD tables use shared capabilities, toolbar controls, pagination, and row actions', () => {
  for (const file of ['pages/products/index.vue', 'pages/services/index.vue']) {
    const source = presentationFor(file)
    assert.match(source, /<BsDataTable[\s\S]+:capabilities="\{ insert:/, `${file} lacks shared capabilities`)
    assert.match(source, /searchable/, `${file} lacks shared search`)
    assert.match(source, /paginator/, `${file} lacks shared pagination`)
    assert.match(source, /@create=/, `${file} lacks shared create action`)
    assert.match(source, /@edit=/, `${file} lacks shared edit action`)
    assert.doesNotMatch(source, /<nav v-if="[^"]*total > pageSize"/, `${file} retains local pagination`)
  }
  const customers = presentationFor('pages/customers/index.vue')
  assert.match(customers, /:capabilities="\{ insert: canManage \}"/)
  assert.match(customers, /@create=/)
  const settings = presentationFor('pages/settings.vue')
  assert.match(settings, /<BsDataTable[\s\S]+copy\.locationsTitle/)
  assert.match(settings, /<BsRecordActionDialog v-model:visible="locationDialogOpen"/)
  assert.doesNotMatch(settings, /<BsForm v-if="canManage && \(editingLocationId/)
})

test('Suit routes do not own direct overlay presentation', () => {
  const actual = sources.filter(({ source }) => /<BsDialog\b/.test(source)).map(({ file }) => file)
  assert.deepEqual(actual, [])
})

test('Shop authenticated chrome is adapter-only shared UI', async () => {
  for (const file of ['layouts/default.vue', 'layouts/platform-admin.vue']) {
    const source = await readPresentationTree(workspaceRoot, `apps/shop-suit/app/${file}`)
    assert.match(source, /<BsAppShell\b/)
    assert.match(source, /<BsUserMenu\b/)
    assert.doesNotMatch(sources.find(item => item.file === file)?.source || '', /<SettingsMenu\b|accountOpen|role="menu"/)
  }
})

test('Shop has no local Vue components or ownership exceptions', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  assert.deepEqual(manifest.components.filter(component => component.path.startsWith('apps/shop-suit/')), [])
  assert.deepEqual(vueFiles(path.join(appRoot, 'components'), true), [])
})

test('every Shop template conforms to the exhaustive zero-native contract', async () => {
  const { auditSuitTemplates } = await import('../../../../tooling/checks/suit-template-boundaries.mjs')
  const audit = await auditSuitTemplates({ root: workspaceRoot })
  assert.deepEqual(audit.parseFailures.filter(failure => failure.startsWith('apps/shop-suit/')), [])
  assert.deepEqual(audit.debt.filter(item => item.file.startsWith('apps/shop-suit/')), [])
})

test('remaining authenticated root mutations use shared action dialogs', async () => {
  for (const file of ['pages/settings.vue', 'pages/dashboard.vue', 'pages/platform-admin.vue']) {
    const source = sources.find(item => item.file === file)?.source || ''
    assert.doesNotMatch(source, /<BsForm\b/, `${file} retains a root mutation form`)
    assert.match(await readPresentationTree(workspaceRoot, `apps/shop-suit/app/${file}`), /<BsRecordActionDialog\b/)
    assert.match(source, /useRecordAction\(/)
  }
})

test('Shop billing no longer exposes manual mutation or upload orchestration', () => {
  const source = sources.find(item => item.file === 'pages/billing.vue')?.source || ''
  assert.doesNotMatch(source, /submit_shop_billing_notice|redeem_shop_private_offer|reserve_shop_billing_payment_evidence|storage\.from/)
  assert.match(source, /transfer: null, evidence: null, showEvidence: false/)
  assert.match(source, /disabled: !checkoutReady\.value/)
})
