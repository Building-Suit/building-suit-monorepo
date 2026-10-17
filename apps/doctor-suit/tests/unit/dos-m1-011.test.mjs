import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorPatientDate,doctorPatientToday,doctorPatientRow,doctorPatientDirectory,doctorPatientDuplicates,doctorPatientResult,validDoctorPatientForm } from '../../app/utils/patients.ts'
import { createDoctorPatientsController,doctorPatientsState,doctorPatientFailure } from '../../app/utils/patientsController.ts'
const id = n => `81000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const scope = { environment: 'local',portal: 'doctor',userId: id(1),sessionId: id(2),practiceId: id(3),locationId: id(4),grantsVersion: 1,locationVersion: 1,timezone: 'Africa/Cairo' }
const form = () => ({ name: 'Synthetic person',phone: '',email: '',dateOfBirth: '' })
const row = { ...form(),id: id(5),practiceId: scope.practiceId,identityId: id(6),createdLocationId: scope.locationId,createdBy: scope.userId,createdAt: '2026-10-17T00:00:00Z',updatedAt: '2026-10-17T00:00:00Z',archivedAt: null,version: 1,provenance: 'entered_unverified' }
const dto = { id: row.id,practice_id: row.practiceId,patient_identity_id: row.identityId,name: row.name,phone: '',email: '',date_of_birth: null,created_location_id: row.createdLocationId,created_by: row.createdBy,created_at: row.createdAt,updated_at: row.updatedAt,archived_at: null,version: 1,provenance: 'entered_unverified' }
const query = { page: 0,size: 25,search: '',status: 'active' }
const deferred = () => { let resolve; let reject; const promise = new Promise((yes,no) => { resolve = yes; reject = no }); return { promise,resolve,reject } }
function fixture(overrides = {},canWrite = true) {
  let current = scope; let keys = 0
  const state = doctorPatientsState()
  const repository = { load: async () => ({ rows: [row],total: 1,canWrite }),duplicates: async () => ({ rows: [],total: 0,reviewKey: null }),write: async () => ({ patientId: row.id,version: 2 }),archive: async () => ({ patientId: row.id,version: 2 }),...overrides }
  const controller = createDoctorPatientsController(repository,state,() => current,() => id(100+keys++),() => '2026-10-17')
  return { state,controller,scope: value => { current = value } }
}
test('DOS-M1-011: recorded minimum fields validate without clinical or identity assumptions', () => {
  assert.equal(validDoctorPatientForm({ ...form(),name: 'س',dateOfBirth: '2000-02-29' },'2026-10-17'),true)
  for (const name of ['', ' '.repeat(3),'x'.repeat(161)]) assert.equal(validDoctorPatientForm({ ...form(),name },'2026-10-17'),false)
  for (const dateOfBirth of ['2001-02-29','2026-10-18','0000-01-01','17/10/2000']) assert.equal(validDoctorPatientForm({ ...form(),dateOfBirth },'2026-10-17'),false)
  assert.equal(doctorPatientDate('0001-01-01'),true)
  assert.equal(validDoctorPatientForm({ ...form(),email: 'bad' },'2026-10-17'),false)
  assert.equal(doctorPatientToday('Pacific/Honolulu',new Date('2026-10-17T01:00:00Z')),'2026-10-16')
})
test('DOS-M1-011: patient DTOs reject foreign practice and verification claims; extra metadata is not projected', () => {
  assert.deepEqual(doctorPatientRow({ ...dto,token_hash: 'private' },scope.practiceId),row)
  for (const extra of [{ practice_id: id(9) },{ provenance: 'verified' },{ version: 0 },{ date_of_birth: '2025-02-30' },{ archived_at: 'bad' }]) assert.throws(() => doctorPatientRow({ ...dto,...extra },scope.practiceId),/RESPONSE_INVALID/)
  assert.throws(() => doctorPatientDirectory({ rows: [dto,dto],total: 2,can_write: true },scope.practiceId),/RESPONSE_INVALID/)
  assert.throws(() => doctorPatientDirectory({ rows: [],total: 0,can_write: 'yes' },scope.practiceId),/RESPONSE_INVALID/)
  assert.throws(() => doctorPatientDuplicates({ rows: [dto],total: 1,review_key: null },scope.practiceId),/RESPONSE_INVALID/)
  assert.deepEqual(doctorPatientResult({ patient_id: row.id,version: 2,clinical: 'not projected' }),{ patientId: row.id,version: 2 })
})
test('DOS-M1-011: a lost create response retries the exact intent without rediscovering its own committed duplicate', async () => {
  const calls = []; let fail = true; let reviews = 0
  const f = fixture({ duplicates: async () => { reviews++; return { rows: [],total: 0,reviewKey: null } },write: async (...args) => { calls.push(args.slice(0,-1)); if (fail) throw new Error('Synthetic uncertain save'); return { patientId: row.id,version: 1 } } })
  await f.controller.load(query)
  assert.equal(await f.controller.write(null,form()),false)
  assert.equal(f.state.error,'network')
  f.controller.changed(null,{ ...form(),name: ' Synthetic person ' })
  fail = false; assert.equal(await f.controller.write(null,{ ...form(),name: ' Synthetic person ' }),true)
  assert.deepEqual(calls[0],calls[1]); assert.equal(reviews,1)
  assert.equal(await f.controller.write(null,{ ...form(),name: 'Synthetic other' }),true)
  assert.notEqual(calls[1][4],calls[2][4])
})
test('DOS-M1-011: newly discovered duplicates always require a separate explicit review submit', async () => {
  let writes = 0; const calls = []
  const f = fixture({ duplicates: async () => ({ rows: [row],total: 1,reviewKey: 'a'.repeat(64) }),write: async (...args) => { writes++; calls.push(args); return { patientId: id(9),version: 1 } } })
  await f.controller.load(query)
  assert.equal(await f.controller.write(null,form(),true),false); assert.equal(writes,0); assert.equal(f.state.error,'review')
  assert.equal(await f.controller.write(null,form(),false),false); assert.equal(writes,0)
  assert.equal(await f.controller.write(null,form(),true),true); assert.equal(writes,1); assert.equal(calls[0][5],'a'.repeat(64))
})
test('DOS-M1-011: changing duplicate form material invalidates reviewed evidence', async () => {
  let reads = 0; let writes = 0
  const f = fixture({ duplicates: async () => { reads++; return { rows: [row],total: 1,reviewKey: String(reads).repeat(64) } },write: async () => { writes++ } })
  await f.controller.load(query); await f.controller.write(null,form())
  f.controller.changed(null,{ ...form(),phone: '123' }); assert.equal(f.state.duplicates,null)
  assert.equal(await f.controller.write(null,{ ...form(),phone: '123' },true),false)
  assert.equal(reads,2); assert.equal(writes,0)
})
test('DOS-M1-011: server reports a newly changed duplicate set without silently saving it', async () => {
  let reads = 0; let writes = 0
  const f = fixture({ duplicates: async () => { reads++; return { rows: [row],total: 1,reviewKey: String(reads).repeat(64) } },write: async () => { writes++; throw { code: '40001',message: 'DOCTOR_PATIENT_DUPLICATE_REVIEW' } } })
  await f.controller.load(query); await f.controller.write(null,form())
  assert.equal(await f.controller.write(null,form(),true),false); assert.equal(f.state.error,'review'); assert.equal(f.state.duplicates,null)
  assert.equal(await f.controller.write(null,form(),true),false); assert.equal(reads,2); assert.equal(writes,1)
})
test('DOS-M1-011: uncertain duplicate saves retain exactly reviewed evidence and command key', async () => {
  const calls = []; let fail = true
  const f = fixture({ duplicates: async () => ({ rows: [row],total: 1,reviewKey: 'a'.repeat(64) }),write: async (...args) => { calls.push(args.slice(0,-1)); if (fail) throw new Error('Synthetic lost response'); return { patientId: id(9),version: 1 } } })
  await f.controller.load(query); await f.controller.write(null,form())
  await f.controller.write(null,form(),true); fail = false
  assert.equal(await f.controller.write(null,form(),true),true); assert.deepEqual(calls[0],calls[1])
})
test('DOS-M1-011: old patient search results cannot restore another location or session', async () => {
  const wait = deferred(); let signal
  const f = fixture({ load: (_practice,_location,_query,value) => { signal = value; return wait.promise } })
  const loading = f.controller.load(query)
  f.controller.clear(); f.scope({ ...scope,sessionId: id(8) })
  assert.equal(signal.aborted,true); wait.resolve({ rows: [row],total: 1,canWrite: true })
  assert.equal(await loading,false); assert.equal(f.state.directory,null)
})
test('DOS-M1-011: duplicate submits and directory refresh cannot interrupt a pending patient save', async () => {
  const wait = deferred(); let writes = 0
  const f = fixture({ write: async () => { writes++; return wait.promise } })
  await f.controller.load(query); const saving = f.controller.write(null,form())
  await Promise.resolve(); await Promise.resolve()
  assert.equal(await f.controller.write(null,form()),false)
  assert.equal(await f.controller.load(query),false)
  wait.resolve({ patientId: row.id,version: 1 }); assert.equal(await saving,true); assert.equal(writes,1)
})
test('DOS-M1-011: context replacement suppresses late writes and duplicate previews', async () => {
  const wait = deferred(); let writes = 0
  const f = fixture({ duplicates: () => wait.promise,write: async () => { writes++ } })
  await f.controller.load(query); const saving = f.controller.write(null,form())
  f.controller.clear(); f.scope(null); wait.resolve({ rows: [row],total: 1,reviewKey: 'a'.repeat(64) })
  assert.equal(await saving,false); assert.equal(writes,0); assert.equal(f.state.duplicates,null)
  assert.equal(f.state.directory,null); assert.equal(f.state.pending,false)
})
test('DOS-M1-011: late accepted command cannot announce success after the selected scope is replaced', async () => {
  const wait = deferred(); const f = fixture({ write: () => wait.promise })
  await f.controller.load(query); const saving = f.controller.write(null,form())
  await Promise.resolve(); await Promise.resolve(); f.controller.clear(); f.scope(null)
  wait.resolve({ patientId: row.id,version: 1 }); assert.equal(await saving,false); assert.equal(f.state.pending,false)
})
test('DOS-M1-011: missing/read-only directories, foreign records and stale versions do not dispatch writes', async () => {
  let writes = 0; const f = fixture({ write: async () => { writes++ } },false)
  assert.equal(await f.controller.write(null,form()),false); await f.controller.load(query)
  assert.equal(await f.controller.write(null,form()),false)
  f.state.directory.canWrite = true
  for (const value of [{ ...row,practiceId: id(8) },{ ...row,version: 2 },{ ...row,archivedAt: row.createdAt }]) assert.equal(await f.controller.write(value,form()),false)
  assert.equal(writes,0)
})
test('DOS-M1-011: a conflicting update preserves the newer record and reports a safe conflict', async () => {
  const f = fixture({ write: async () => { throw { code: '40001',message: 'DOCTOR_PATIENT_CONFLICT',details: 'sensitive synthetic transport detail' } } })
  await f.controller.load(query); assert.equal(await f.controller.write(row,form()),false)
  assert.equal(f.state.error,'conflict'); assert.equal(f.state.directory.rows[0].version,1)
  assert.equal(doctorPatientFailure(new Error('private details')),'network')
})
test('DOS-M1-011: archive has a stable retry intent and never mutates or deletes directory rows optimistically', async () => {
  const calls = []; let fail = true
  const f = fixture({ archive: async (...args) => { calls.push(args.slice(0,-1)); if (fail) throw new Error('Synthetic lost response'); return { patientId: row.id,version: 2 } } })
  await f.controller.load(query); assert.equal(await f.controller.archive(row),false)
  fail = false; assert.equal(await f.controller.archive(row),true); assert.deepEqual(calls[0],calls[1])
  assert.equal(f.state.directory.rows.length,1); assert.equal(f.state.directory.rows[0].archivedAt,null)
})
