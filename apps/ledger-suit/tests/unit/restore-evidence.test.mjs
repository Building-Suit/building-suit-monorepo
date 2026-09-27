import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { compareRestoreEvidence } from '../../scripts/compare-restore-evidence.mjs'
import { assertTenantStoragePath, tenantTables } from '../../scripts/export-organization-portability.mjs'

function snapshot(environmentId = 'source') {
  return {
    schema_version: 'ls-ops-001-v1',
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
    attachments: { count: '1', bytes: '900719925474099312345', metadata_digest: 'metadata' },
  }
}

function attachments(environmentId = 'source') {
  return {
    schema_version: 'ls-ops-001-attachments-v1',
    environment_id: environmentId,
    organization_id: '11111111-1111-4111-8111-111111111111',
    objects: [{ storage_key: 'org/transaction/id/file.pdf', size_bytes: '3', sha256: 'abc' }],
  }
}

test('restore comparison preserves exact bigint strings and attachment bytes', () => {
  const result = compareRestoreEvidence(snapshot(), snapshot('restored'), attachments(), attachments('restored'))
  assert.equal(result.result, 'exact_match')
  assert.equal(result.attachment_bytes, '900719925474099312345')
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
