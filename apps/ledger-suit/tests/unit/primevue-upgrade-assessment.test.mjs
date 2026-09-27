import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const repoRoot = new URL('../../../../', import.meta.url)
const read = relative => readFileSync(new URL(relative, repoRoot), 'utf8')
const readJson = relative => JSON.parse(read(relative))

const appManifests = [
  'apps/ledger-suit/package.json',
  'apps/shop-suit/package.json',
  'apps/inventory-suit/package.json',
  'apps/building-suit-docs/package.json',
  'apps/automation-suit/package.json',
]

const allManifests = [
  'package.json',
  ...appManifests,
  'packages/ui/package.json',
  'packages/nuxt-layer/package.json',
]

function filesUnder(relative) {
  return readdirSync(new URL(relative, repoRoot), { withFileTypes: true }).flatMap((entry) => {
    const child = join(relative, entry.name)
    return entry.isDirectory() ? filesUnder(`${child}/`) : [child]
  })
}

test('all Suit consumers remain on the assessed PrimeVue 4.5.5 contract', () => {
  for (const path of allManifests) {
    const manifest = readJson(path)
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
    assert.equal(dependencies.primevue, '4.5.5', `${path} primevue`)
    if (path !== 'packages/ui/package.json') {
      assert.equal(dependencies['@primevue/nuxt-module'], '4.5.5', `${path} @primevue/nuxt-module`)
    }
  }

  for (const path of appManifests) {
    const config = read(path.replace('package.json', 'nuxt.config.ts'))
    assert.match(config, /extends:\s*\['@building-suit\/nuxt-layer'\]/, path)
  }

  const lockfile = read('pnpm-lock.yaml')
  assert.match(lockfile, /^ {2}primevue@4\.5\.5:/m)
  assert.match(lockfile, /^ {2}'@primevue\/nuxt-module@4\.5\.5'/m)
})

test('the shared layer keeps Building Suit styling and the approved component boundary', () => {
  const config = read('packages/nuxt-layer/nuxt.config.ts')
  assert.match(config, /primevue:\s*\{\s*options:\s*\{\s*unstyled:\s*true\s*\}/)
  for (const component of ['Dialog', 'DataTable', 'Column', 'ColumnGroup', 'Row']) {
    assert.ok(config.includes(`'${component}'`), `${component} is missing from the shared allow-list`)
  }

  const productionAppSources = appManifests.flatMap(path => {
    const appRoot = path.replace('/package.json', '/app/')
    return filesUnder(appRoot).filter(file => /\.(?:ts|vue|js|mjs)$/.test(file))
  })
  const directImports = productionAppSources.filter(file => /from ['"]primevue\//.test(read(file)))
  assert.deepEqual(directImports, [], 'product application code must consume the shared layer/wrappers')
})

test('shared table and dialog APIs retain forwarding, policy, and exact-money boundaries', () => {
  const table = read('packages/ui/src/organisms/BsDataTable.vue')
  assert.match(table, /from 'primevue\/datatable'/)
  assert.match(table, /v-bind="forwardedAttrs\(\)"/)
  assert.match(table, /@row-click="emit\('row-click', \$event\)"/)
  assert.match(table, /defineExpose\(\{ exportCSV: exportCsv \}\)/)
  assert.match(table, /csvCell\(data\)/)
  assert.doesNotMatch(table, /\b(?:Number|parseFloat|parseInt)\s*\(/)

  const dialog = read('packages/ui/src/organisms/BsDialog.vue')
  assert.match(dialog, /from 'primevue\/dialog'/)
  assert.match(dialog, /defineModel<boolean>\('visible'/)
  assert.match(dialog, /interactionPolicy\.protectDirtyForms/)
  assert.match(dialog, /restoreFocus\(\)/)
  assert.match(dialog, /@update:visible="requestClose"/)
  assert.doesNotMatch(dialog, /\b(?:Number|parseFloat|parseInt)\s*\(/)
})
