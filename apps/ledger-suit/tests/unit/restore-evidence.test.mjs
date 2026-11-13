import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { compareRestoreEvidence as compare } from '../../scripts/compare-restore-evidence.mjs'
import { assertTenantStoragePath, tenantTables, excludedTenantTables } from '../../scripts/export-organization-portability.mjs'

function snapshot(environmentId = 'source') {
  return {
    schema_version: 'ls-ops-001-v2',
    migration_history_digest: 'a'.repeat(32),
    environment_id: environmentId,
    organization_id: '11111111-1111-4111-8111-111111111111',
    from_date: '2036-01-01',
    to_date: '2036-01-31',
    ledger: {
      journals: '8', entries: '16', posted_debits_minor: '900719925474099312345',
      posted_credits_minor: '900719925474099312345', unbalanced_journals: '0',
      posted_identity_digest: 'identity', posted_entry_digest: 'entries',
    },
    reports: { trial_balance_digest: 'tb', balance_sheet_digest: 'bs', profit_loss_digest: 'pl' },
    configuration: { accounts_digest: 'accounts' },
    preserved_operations: { recurring_rules_digest: 'recurring' },
    attachments: { count: '1', bytes: '3', metadata_count: '1', receipt_metadata_count: '0', metadata_conflicts: '0', metadata_digest: 'metadata' },
  }
}

function attachments(environmentId = 'source') {
  return {
    schema_version: 'ls-ops-001-attachments-v2',
    environment_id: environmentId,
    organization_id: '11111111-1111-4111-8111-111111111111',
    objects: [{ storage_bucket: 'attachments', storage_key: '11111111-1111-4111-8111-111111111111/transaction/id/file.pdf',
      path: 'objects/attachments/11111111-1111-4111-8111-111111111111/transaction/id/file.pdf',
      size_bytes: '3', sha256: createHash('sha256').update('pdf').digest('hex') }],
  }
}

function exportManifest(value) {
  return {
    schema_version: 'ls-ops-001-portability-v2', environment_id: value.environment_id,
    organization_id: value.organization_id, from_date: value.from_date, to_date: value.to_date,
    excluded_tenant_tables: structuredClone(excludedTenantTables),
    tables: tenantTables.map(([table]) => ({ table,
      rows: table === 'transactions' ? value.ledger.journals : table === 'transaction_entries' ? value.ledger.entries : table === 'attachments' ? '1' : '0',
      files: [{ path: `tables/${table}/page-000001.json`, sha256: 'b'.repeat(64) }] })),
    reports: ['profit-loss', 'balance-sheet', 'trial-balance', 'cash-flow'].map(name => ({ path: `reports/${name}.csv`, sha256: 'c'.repeat(64) })),
    attachment_manifest_sha256: 'd'.repeat(64),
  }
}
function compareRestoreEvidence(source, restored, sourceObjects, restoredObjects, sourceExport = exportManifest(source), restoredExport = exportManifest(restored)) {
  return compare(source, restored, sourceObjects, restoredObjects, sourceExport, restoredExport)
}

test('restore comparison preserves exact bigint strings and attachment bytes', () => {
  const result = compareRestoreEvidence(snapshot(), snapshot('restored'), attachments(), attachments('restored'))
  assert.equal(result.result, 'exact_match')
  assert.equal(result.attachment_bytes, '3')
})

test('restore comparison refuses same-instance evidence', () => {
  assert.throws(() => compareRestoreEvidence(snapshot(), snapshot(), attachments(), attachments('restored')),
    /second isolated environment/)
})

test('restore comparison rejects changed financial or attachment evidence', () => {
  const changedLedger = snapshot('restored')
  changedLedger.ledger.posted_credits_minor = '900719925474099312344'
  assert.throws(() => compareRestoreEvidence(snapshot(), changedLedger, attachments(), attachments('restored')),
    /ledger differs/)

  const changedAttachments = attachments('restored')
  changedAttachments.objects[0].sha256 = 'different'
  assert.throws(() => compareRestoreEvidence(snapshot(), snapshot('restored'), attachments(), changedAttachments),
    /attachment object bytes differ/)
})

test('restore comparison rejects empty or unbalanced source evidence', () => {
  const empty = snapshot()
  empty.ledger.journals = '0'
  assert.throws(() => compareRestoreEvidence(empty, snapshot('restored'), attachments(), attachments('restored')),
    /at least one journal/)

  const unbalanced = snapshot()
  unbalanced.ledger.unbalanced_journals = '1'
  assert.throws(() => compareRestoreEvidence(unbalanced, snapshot('restored'), attachments(), attachments('restored')),
    /unbalanced journal/)
  const unposted = snapshot()
  unposted.ledger.posted_debits_minor = '0'
  unposted.ledger.posted_credits_minor = '0'
  assert.throws(() => compareRestoreEvidence(unposted, snapshot('restored'), attachments(), attachments('restored')),
    /posted financial amounts/)
})

test('restore rehearsal rejects absent, mismatched or foreign attachment evidence', () => {
  const empty = attachments()
  empty.objects = []
  assert.throws(() => compareRestoreEvidence(snapshot(), snapshot('restored'), empty, attachments('restored')),
    /at least one attachment object/)
  const count = snapshot()
  count.attachments.count = '2'
  assert.throws(() => compareRestoreEvidence(count, structuredClone({ ...count, environment_id: 'restored' }), attachments(), attachments('restored')),
    /metadata\/object counts differ/)
  const bytes = snapshot()
  bytes.attachments.bytes = '4'
  assert.throws(() => compareRestoreEvidence(bytes, structuredClone({ ...bytes, environment_id: 'restored' }), attachments(), attachments('restored')),
    /byte totals differ/)
  const foreign = attachments()
  foreign.objects[0].storage_key = '22222222-2222-4222-8222-222222222222/transaction/id/file.pdf'
  assert.throws(() => compareRestoreEvidence(snapshot(), snapshot('restored'), foreign, attachments('restored')),
    /foreign attachment path/)
  assert.throws(() => compareRestoreEvidence(snapshot(), snapshot('restored'), attachments('another-source'), attachments('restored')),
    /source attachment environment differs/)
})

test('restore comparison rejects missing newer financial tables, changed payloads and migration history', () => {
  const source = snapshot(), restored = snapshot('restored')
  const missing = exportManifest(restored)
  missing.tables = missing.tables.filter(table => table.table !== 'fx_open_items')
  assert.throws(() => compareRestoreEvidence(source, restored, attachments(), attachments('restored'), exportManifest(source), missing),
    /current financial table inventory differs/)
  const changed = exportManifest(restored)
  changed.tables.find(table => table.table === 'migration_original_rows').files[0].sha256 = 'e'.repeat(64)
  assert.throws(() => compareRestoreEvidence(source, restored, attachments(), attachments('restored'), exportManifest(source), changed),
    /financial export pages differ/)
  restored.migration_history_digest = 'f'.repeat(32)
  assert.throws(() => compareRestoreEvidence(source, restored, attachments(), attachments('restored')), /migration history differs/)
})

test('portability inventory is unique and keeps attachment paths tenant scoped', () => {
  assert.equal(new Set(tenantTables.map(([table]) => table)).size, tenantTables.length)
  assert.deepEqual(
    assertTenantStoragePath('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/transaction/id/file.pdf'),
    ['11111111-1111-4111-8111-111111111111', 'transaction', 'id', 'file.pdf'],
  )
  assert.throws(() => assertTenantStoragePath(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222/transaction/id/file.pdf',
  ), /foreign attachment path/)
  assert.throws(() => assertTenantStoragePath(
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111/../secret',
  ), /unsafe attachment path/)
})

test('portability inventory names current tenant tables and valid direct filters', () => {
  const migrationRoot = new URL('../../supabase/migrations/', import.meta.url)
  const sql = readdirSync(migrationRoot)
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => readFileSync(new URL(name, migrationRoot), 'utf8'))
    .join('\n')
    .toLowerCase()
  for (const [table, filter, , order = 'id.asc'] of tenantTables) {
    const marker = new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${table}\\s*\\(`, 'i')
    const match = marker.exec(sql)
    assert.ok(match, `${table} is not created by the Ledger migration chain`)
    if (!filter.includes('.')) {
      const definition = sql.slice(match.index, match.index + 5000)
      assert.match(definition, new RegExp(`\\b${filter}\\s+`), `${table}.${filter}`)
      for (const clause of order.split(',')) {
        const column = clause.split('.')[0]
        assert.match(definition, new RegExp(`\\b${column}\\s+`), `${table}.${column}`)
      }
    }
  }
})
