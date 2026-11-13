import test from 'node:test'
import assert from 'node:assert/strict'
import {
  reconciliationFixture, exactRetirementSql, migrationSql, compatibilityFile, assignmentFile,
  currentState, verifyRetirementEffects, verifyGreetingAndClaimFences,
  installLateFailure, removeLateFailure, verifyAssignmentOnly,
} from './retirement-reconciliation-checks.mjs'

test('PGlite preliminary recovery: late rollback, intentional retirement, and descriptive assignment preserve history', { timeout: 120000 }, async t => {
  const f = await reconciliationFixture(), { h } = f, { db } = h
  try {
    const sql = await exactRetirementSql()
    await installLateFailure(db)
    const before = await currentState(db)
    await assert.rejects(db.exec(sql), /RETIREMENT_SYNTHETIC_LATE_FAILURE/)
    await db.exec('rollback')
    assert.deepEqual(await currentState(db), before, 'late DDL failure rolls back every application row, function, trigger and grant')
    await removeLateFailure(db)
    await db.exec(sql)
    await verifyRetirementEffects(f, before)
    await verifyGreetingAndClaimFences(h)
    await db.exec(await migrationSql(compatibilityFile))
    const installed = await currentState(db)
    await assert.rejects(db.exec(sql), /already exists/)
    await db.exec('rollback')
    assert.deepEqual(await currentState(db), installed, 'retirement is non-idempotent and its duplicate attempt is atomic')
    await verifyAssignmentOnly(db, async () => db.exec(await migrationSql(assignmentFile)))
    const assigned = await currentState(db)
    await assert.rejects(db.exec(await migrationSql(assignmentFile)), /HQ_RETAIL_ASSIGNMENT_PREDECESSOR_MISMATCH/)
    await db.exec('rollback')
    assert.deepEqual(await currentState(db), assigned)
    await verifyGreetingAndClaimFences(h)
    t.diagnostic('PGlite proves scoped SQL behavior only. Supabase CLI ledger selection and native concurrency are separate tests.')
  } finally { await f.close() }
})
