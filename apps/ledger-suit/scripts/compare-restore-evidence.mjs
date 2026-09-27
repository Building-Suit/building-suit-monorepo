import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function compareRestoreEvidence(source, restored, sourceAttachments, restoredAttachments) {
  assert.equal(source.schema_version, 'ls-ops-001-v1', 'unsupported source evidence schema')
  assert.equal(restored.schema_version, source.schema_version, 'evidence schema differs')
  assert.notEqual(source.environment_id, restored.environment_id, 'restore must use a second isolated environment')
  assert.equal(source.organization_id, restored.organization_id, 'organization identity differs')
  assert.equal(source.from_date, restored.from_date, 'report start differs')
  assert.equal(source.to_date, restored.to_date, 'report end differs')
  assert.match(source.ledger.journals, /^[1-9]\d*$/, 'source fixture must contain at least one journal')
  assert.equal(source.ledger.unbalanced_journals, '0', 'source contains an unbalanced journal')
  assert.equal(restored.ledger.unbalanced_journals, '0', 'restore contains an unbalanced journal')

  for (const section of ['ledger', 'reports', 'configuration', 'preserved_operations', 'attachments']) {
    assert.deepEqual(restored[section], source[section], `${section} differs after restore`)
  }

  assert.equal(sourceAttachments.schema_version, 'ls-ops-001-attachments-v1')
  assert.equal(restoredAttachments.schema_version, sourceAttachments.schema_version)
  assert.notEqual(sourceAttachments.environment_id, restoredAttachments.environment_id,
    'attachment comparison must use a second isolated environment')
  assert.equal(sourceAttachments.organization_id, source.organization_id)
  assert.equal(restoredAttachments.organization_id, restored.organization_id)
  assert.deepEqual(restoredAttachments.objects, sourceAttachments.objects,
    'attachment object bytes differ after restore')

  return {
    organization_id: source.organization_id,
    journals: source.ledger.journals,
    entries: source.ledger.entries,
    attachment_objects: String(sourceAttachments.objects.length),
    attachment_bytes: source.attachments.bytes,
    result: 'exact_match',
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2)
  if (paths.length !== 4) {
    console.error('Usage: node compare-restore-evidence.mjs SOURCE.json RESTORED.json SOURCE-ATTACHMENTS.json RESTORED-ATTACHMENTS.json')
    process.exitCode = 2
  } else {
    try {
      const result = compareRestoreEvidence(...paths.map(readJson))
      console.log(JSON.stringify(result))
    } catch (error) {
      console.error(`FAIL: ${error.message}`)
      process.exitCode = 1
    }
  }
}
