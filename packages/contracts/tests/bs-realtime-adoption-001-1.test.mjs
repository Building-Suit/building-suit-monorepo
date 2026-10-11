import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const matrix = JSON.parse(read('docs/shared/realtime-adoption.json'))
function files(path) {
  return readdirSync(new URL(path, root), { withFileTypes: true }).flatMap(entry => {
    const child = `${path}/${entry.name}`
    return entry.isDirectory() ? files(child) : [child]
  })
}

test('review covers every other active Suit with source-backed decisions and keeps Shop independent', () => {
  const suits = readdirSync(fileURLToPath(new URL('apps/', root)))
    .filter(name => name.endsWith('-suit') && name !== 'shop-suit').sort()
  assert.deepEqual(matrix.decisions.map(row => row.suit).sort(), suits)
  assert.equal(matrix.taskId, 'BS-REALTIME-ADOPTION-001')
  assert.equal(matrix.requirementId, 'BS-LAUNCH-R14')
  assert.equal(matrix.shopLaunchIndependent, true)
  for (const row of matrix.decisions) {
    assert.ok(['adopted', 'not-needed', 'blocked'].includes(row.status))
    assert.ok(row.workflows.length && row.reason && row.evidence.length && row.unblock.length)
    for (const evidence of row.evidence) {
      assert.ok(evidence.path.startsWith(`apps/${row.suit}/`) || evidence.path.startsWith('docs/architecture/'))
      assert.ok(read(evidence.path).includes(evidence.anchor), `Revisit ${row.suit}: ${evidence.path} no longer supports ${evidence.anchor}`)
    }
  }
})

test('Ledger delivery remains unproven rather than silently enabling a no-op subscription', () => {
  assert.equal(matrix.decisions.find(row => row.suit === 'ledger-suit').status, 'blocked')
  const migrations = files('apps/ledger-suit/supabase/migrations').filter(path => path.endsWith('.sql'))
  assert.ok(migrations.length)
  for (const path of migrations) {
    assert.doesNotMatch(read(path), /(?:create|alter)\s+publication\b/i, `Publication added in ${path}; revisit delivery and adoption evidence`)
  }
  const journal = read('apps/ledger-suit/app/composables/useTransactionWorkspace.ts')
  assert.match(journal, /watch\(revision/)
  assert.match(journal, /\.abortSignal\(signal\)/)
  assert.doesNotMatch(journal, /sessionId/, 'Session scope changed; revisit Ledger lifecycle integration')
})

test('Inventory has no current business reader; Automation retains server reads and bounded polling', () => {
  assert.equal(matrix.decisions.find(row => row.suit === 'inventory-suit').status, 'not-needed')
  const inventoryPages = files('apps/inventory-suit/app/pages').filter(path => path.endsWith('.vue'))
  assert.deepEqual(inventoryPages, ['apps/inventory-suit/app/pages/index.vue'])
  assert.doesNotMatch(read(inventoryPages[0]), /useFetch|useAsyncData|useLazyAsyncData|useSupabaseClient/)
  assert.equal(matrix.decisions.find(row => row.suit === 'automation-suit').status, 'blocked')
  const dashboard = read('apps/automation-suit/app/pages/index.vue')
  assert.match(dashboard, /useFetch<DashboardResponse>\('\/api\/dashboard'/)
  assert.match(dashboard, /Math\.max\(5,/)
  assert.match(dashboard, /onBeforeUnmount\(.*clearInterval/)
  assert.match(read('apps/automation-suit/server/utils/controlDb.ts'), /postgres\(connectionString/)
})

test('reviewed products introduce no local Postgres Changes subscription framework', () => {
  for (const row of matrix.decisions) {
    for (const path of files(`apps/${row.suit}/app`).filter(path => /\.(vue|ts|js)$/.test(path))) {
      assert.doesNotMatch(read(path), /['"]postgres_changes['"]/, `${path}: subscriptions must use packages/data-access`)
    }
  }
})
