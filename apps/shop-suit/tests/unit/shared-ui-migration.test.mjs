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

test('Shop reusable controls and tables come from shared UI', () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /<table\b/, `${file} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${file} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:DataTable|Dialog)\b/, `${file} bypasses the Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${file} bypasses shared confirmation`)
  }
  for (const component of ['BsDataTable', 'BsRecordActionDialog', 'BsButton', 'BsForm', 'BsSelect', 'BsCard', 'BsKpiCard', 'StatusBadge']) {
    assert.ok(sources.some(({ source }) => source.includes(`<${component}`)), `Shop does not consume ${component}`)
  }
})

test('standard Shop record actions use the canonical dialog and controller', () => {
  const expected = [
    'components/PlatformPlanAdmin.vue',
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

test('remaining direct dialogs are materially different shared-overlay workflows', () => {
  const allowed = new Set([
    'layouts/default.vue',
    'pages/appointments/index.vue',
    'pages/platform-admin.vue',
  ])
  const actual = sources.filter(({ source }) => /<BsDialog\b/.test(source)).map(({ file }) => file)
  assert.deepEqual(actual.sort(), [...allowed].sort())
})

test('every remaining Shop component is approved product orchestration over shared UI', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const shop = manifest.components.filter(component => component.path.startsWith('apps/shop-suit/'))
  const actual = vueFiles(path.join(appRoot, 'components'))
    .map(file => `apps/shop-suit/app/components/${path.basename(file)}`)
    .sort()
  assert.deepEqual(shop.map(component => component.path).sort(), actual)
  assert.ok(shop.every(component => component.classification === 'product-orchestration'))
  assert.ok(shop.every(component => component.approval === 'BS-UI-SHOP-MIG-001'))
  assert.ok(shop.every(component => component.rationale.includes('composes canonical shared UI primitives')))
  assert.equal(existsSync(path.join(appRoot, 'components/AppLogo.vue')), false)
})
