import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildAmendmentPayload, guardedAmendmentSQL } from '../lib/guarded-task-amendment.mjs'
const read = name => JSON.parse(readFileSync(new URL(`../../../docs/shared/upcoming-task-readiness.${name}.json`, import.meta.url)))
const input = { snapshot: read('snapshot'), configuration: read('configuration'), reconciliation: read('reconciliation'), schemaGuard: read('schema-guard') }

test('guarded amendment preserves exact approved set, gates, original source scopes and command registry', () => {
  const p = buildAmendmentPayload(input)
  assert.equal(p.tasks.length,24); assert.equal(p.workstreams.length,2)
  for (const task of p.tasks) {
    assert.equal(task.before.status,'planned');assert.equal(task.after.status,'planned')
    for (const path of task.before.metadata.source_allowed_paths ?? []) assert.ok(task.after.metadata.source_allowed_paths.includes(path))
    for (const key of ['publication_resolved_scopes','publication_exact_paths','blocking_decision_ids','source_record']) assert.deepEqual(task.after.metadata[key],task.before.metadata[key])
  }
  const bad = structuredClone(input);bad.schemaGuard.active_targets=1
  assert.throws(()=>buildAmendmentPayload(bad),/idle_target/)
})

test('transaction fails closed, uses only exact metadata updates and audit inserts, and defaults to rollback', () => {
  const p = buildAmendmentPayload(input), sql = guardedAmendmentSQL(p)
  assert.ok(sql.endsWith('ROLLBACK;\n'))
  for (const guard of ['SERIALIZABLE','FOR UPDATE NOWAIT','concurrent_task_change','concurrent_registry_change','concurrent_dependency_change','concurrent_admission_generation_change','control_schema_changed_reinspect_required','exact_old_task_predicate_failed','existing_unresolved_scope_removed','metadata_must_not_grant_publication_authority','protected_control_history_changed','amendment_replay_drift']) assert.ok(sql.includes(guard),guard)
  assert.deepEqual([...sql.matchAll(/UPDATE control\.([a-z_]+) AS \w+ SET/g)].map(x=>x[1]),['workstreams','tasks'])
  assert.equal([...sql.matchAll(/INSERT INTO control\.([a-z_]+)/g)].every(x=>x[1]==='audit_events'),true)
  const statements=sql.replace(/\$reviewed_payload\$[\s\S]*?\$reviewed_payload\$/,'')
  assert.ok(!/^\s*(?:CREATE (?:FUNCTION|TABLE)|ALTER |DELETE FROM)|DISABLE TRIGGER|session_replication_role|control\.authorize_\w+\s*\(/im.test(statements))
  assert.ok(guardedAmendmentSQL(p,{commit:true}).endsWith('COMMIT;\n'))
  assert.throws(()=>guardedAmendmentSQL({...p,amendment_id:'$reviewed_payload$'}),/delimiter_conflict/)
})
