import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertTenantStoragePath, tenantTables, excludedTenantTables } from './export-organization-portability.mjs'

export function compareRestoreEvidence(source, restored, sourceAttachments, restoredAttachments, sourceExport, restoredExport) {
  assert.equal(source.schema_version, 'ls-ops-001-v2', 'unsupported source evidence schema; recapture with current tooling')
  assert.equal(restored.schema_version, source.schema_version, 'evidence schema differs')
  assert.notEqual(source.environment_id, restored.environment_id, 'restore must use a second isolated environment')
  assert.equal(source.organization_id, restored.organization_id, 'organization identity differs')
  assert.equal(source.from_date, restored.from_date, 'report start differs')
  assert.equal(source.to_date, restored.to_date, 'report end differs')
  assert.match(source.migration_history_digest, /^[a-f0-9]{32}$/, 'migration history digest required')
  assert.equal(restored.migration_history_digest, source.migration_history_digest, 'migration history differs')
  assert.match(source.ledger.journals, /^[1-9]\d*$/, 'source fixture must contain at least one journal')
  assert.equal(source.ledger.unbalanced_journals, '0', 'source contains an unbalanced journal')
  assert.equal(restored.ledger.unbalanced_journals, '0', 'restore contains an unbalanced journal')
  assert.match(source.ledger.posted_debits_minor, /^\d+$/, 'source debit total must be an exact decimal string')
  assert.ok(BigInt(source.ledger.posted_debits_minor) > 0n, 'source must include posted financial amounts')
  assert.equal(source.ledger.posted_credits_minor, source.ledger.posted_debits_minor, 'source debit/credit totals differ')

  for (const section of ['ledger', 'reports', 'configuration', 'preserved_operations', 'attachments']) {
    assert.deepEqual(restored[section], source[section], `${section} differs after restore`)
  }

  assert.equal(sourceAttachments.schema_version, 'ls-ops-001-attachments-v2')
  assert.equal(restoredAttachments.schema_version, sourceAttachments.schema_version)
  assert.notEqual(sourceAttachments.environment_id, restoredAttachments.environment_id,
    'attachment comparison must use a second isolated environment')
  assert.equal(sourceAttachments.environment_id, source.environment_id, 'source attachment environment differs')
  assert.equal(restoredAttachments.environment_id, restored.environment_id, 'restored attachment environment differs')
  assert.equal(sourceAttachments.organization_id, source.organization_id)
  assert.equal(restoredAttachments.organization_id, restored.organization_id)
  assert.ok(Array.isArray(sourceAttachments.objects) && sourceAttachments.objects.length > 0,
    'restore rehearsal must include at least one attachment object')
  assert.equal(source.attachments.count, String(sourceAttachments.objects.length), 'attachment metadata/object counts differ')
  assert.equal(source.attachments.metadata_conflicts, '0', 'conflicting object metadata sizes')
  const keys = new Set()
  let bytes = 0n
  for (const object of sourceAttachments.objects) {
    assertTenantStoragePath(source.organization_id, object.storage_key)
    assert.ok(typeof object.storage_bucket === 'string' && object.storage_bucket.length > 0, 'attachment bucket required')
    assert.ok(!['.', '..'].includes(object.storage_bucket), 'invalid attachment bucket')
    assert.equal(object.path, `objects/${encodeURIComponent(object.storage_bucket)}/${object.storage_key}`, 'object file path differs')
    const key = `${object.storage_bucket}/${object.storage_key}`
    assert.ok(!keys.has(key), 'duplicate attachment object')
    keys.add(key)
    assert.match(object.sha256, /^[a-f0-9]{64}$/, 'attachment SHA-256 required')
    assert.match(object.size_bytes, /^[1-9]\d*$/, 'attachment byte size must be an exact positive decimal string')
    bytes += BigInt(object.size_bytes)
  }
  assert.equal(source.attachments.bytes, String(bytes), 'attachment metadata/object byte totals differ')
  assert.deepEqual(restoredAttachments.objects, sourceAttachments.objects,
    'attachment object bytes differ after restore')

  for (const [snapshot, manifest] of [[source, sourceExport], [restored, restoredExport]]) {
    assert.equal(manifest?.schema_version, 'ls-ops-001-portability-v2', 'current complete portability manifest required')
    for (const key of ['environment_id', 'organization_id', 'from_date', 'to_date']) assert.equal(manifest[key], snapshot[key], `export ${key} differs`)
    assert.deepEqual(manifest.tables.map(table => table.table).sort(), tenantTables.map(([table]) => table).sort(), 'current financial table inventory differs')
    assert.deepEqual(manifest.excluded_tenant_tables, excludedTenantTables, 'excluded table dispositions differ')
    for (const table of manifest.tables) {
      assert.match(table.rows, /^(0|[1-9]\d*)$/, 'export row count must be an exact decimal string')
      assert.ok(Array.isArray(table.files) && table.files.length > 0, `export pages required: ${table.table}`)
      for (const [i, file] of table.files.entries()) {
        assert.equal(file.path, `tables/${table.table}/page-${String(i + 1).padStart(6, '0')}.json`, 'invalid table page path')
        assert.match(file.sha256, /^[a-f0-9]{64}$/, 'table page digest required')
      }
    }
    const rows = table => manifest.tables.find(item => item.table === table).rows
    assert.equal(rows('transactions'), snapshot.ledger.journals, 'journal export count differs')
    assert.equal(rows('transaction_entries'), snapshot.ledger.entries, 'entry export count differs')
    assert.equal(rows('manual_payment_evidence'), snapshot.attachments.receipt_metadata_count, 'receipt export count differs')
    assert.equal(String(BigInt(rows('attachments')) + BigInt(rows('manual_payment_evidence'))), snapshot.attachments.metadata_count, 'storage metadata export count differs')
    assert.deepEqual(manifest.reports.map(file => file.path).sort(), ['balance-sheet', 'cash-flow', 'profit-loss', 'trial-balance'].map(name => `reports/${name}.csv`), 'report inventory differs')
    for (const file of manifest.reports) assert.match(file.sha256, /^[a-f0-9]{64}$/, 'report digest required')
  }
  assert.deepEqual(restoredExport.tables, sourceExport.tables, 'financial export pages differ after restore')
  assert.deepEqual(restoredExport.reports, sourceExport.reports, 'report CSV bytes differ after restore')

  return {
    organization_id: source.organization_id,
    journals: source.ledger.journals,
    entries: source.ledger.entries,
    attachment_objects: String(sourceAttachments.objects.length),
    attachment_bytes: source.attachments.bytes,
    result: 'exact_match',
    schema_version: source.schema_version,
    exported_tables: sourceExport.tables.length,
  }
}

export function verifyPortabilityFiles(manifest, attachments, manifestPath) {
  const root = realpathSync(dirname(manifestPath))
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  const read = name => {
    const file = realpathSync(resolve(root, name))
    assert.ok(file.startsWith(`${root}${sep}`), 'export file escaped package root')
    return readFileSync(file)
  }
  for (const table of manifest.tables) {
    let rows = 0n
    for (const page of table.files) {
      const bytes = read(page.path)
      assert.equal(digest(bytes), page.sha256, `export disk hash differs: ${page.path}`)
      // Parse only to count rows; never reserialize or calculate monetary data.
      const values = JSON.parse(bytes)
      assert.ok(Array.isArray(values), 'table page must contain a JSON array')
      rows += BigInt(values.length)
    }
    assert.equal(String(rows), table.rows, `export disk row count differs: ${table.table}`)
  }
  for (const report of manifest.reports) assert.equal(digest(read(report.path)), report.sha256, `report disk hash differs: ${report.path}`)
  const attachmentBytes = read('attachments-manifest.json')
  assert.equal(digest(attachmentBytes), manifest.attachment_manifest_sha256, 'attachment manifest disk hash differs')
  assert.deepEqual(JSON.parse(attachmentBytes), attachments, 'attachment manifest file differs from supplied evidence')
  for (const object of attachments.objects) {
    const bytes = read(object.path)
    assert.equal(digest(bytes), object.sha256, `object disk hash differs: ${object.path}`)
    assert.equal(String(bytes.length), object.size_bytes, `object disk byte count differs: ${object.path}`)
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2)
  if (paths.length !== 6) {
    console.error('Usage: node compare-restore-evidence.mjs SOURCE.json RESTORED.json SOURCE-ATTACHMENTS.json RESTORED-ATTACHMENTS.json SOURCE-EXPORT-MANIFEST.json RESTORED-EXPORT-MANIFEST.json')
    process.exitCode = 2
  } else {
    try {
      const evidence = paths.map(readJson)
      const result = compareRestoreEvidence(...evidence)
      verifyPortabilityFiles(evidence[4], evidence[2], paths[4])
      verifyPortabilityFiles(evidence[5], evidence[3], paths[5])
      console.log(JSON.stringify(result))
    } catch (error) {
      console.error(`FAIL: ${error.message}`)
      process.exitCode = 1
    }
  }
}
