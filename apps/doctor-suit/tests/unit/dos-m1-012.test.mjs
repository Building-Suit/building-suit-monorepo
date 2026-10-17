import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorProfileController,doctorProfileState } from '../../app/utils/patientProfileController.ts'
import { doctorPatientProfile,doctorDocumentDirectory,doctorDocumentHistory } from '../../app/utils/patientProfile.ts'
const id = n => `62000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const stamp = '2026-10-17T00:00:00Z'
const patient = { id: id(3),practice_id: id(1),patient_identity_id: id(30),name: 'Synthetic patient',phone: '',email: '',date_of_birth: null,created_location_id: id(2),created_by: id(9),created_at: stamp,updated_at: stamp,archived_at: null,version: 1,provenance: 'entered_unverified' }
const version = { id: id(5),document_id: id(4),revision: 1,filename: 'synthetic.pdf',mime_type: 'application/pdf',byte_size: 8,uploaded_by: id(9),uploaded_by_label: 'Synthetic doctor',uploaded_at: stamp,location_id: id(2),location_name: 'Synthetic clinic',timezone: 'Etc/UTC',provenance: 'uploaded_unreviewed' }
const rawProfile = () => ({ patient: { ...patient },activity: [{ id: 1,event_type: 'patient.created',record_version: 1,actor_user_id: id(9),actor_label: 'Synthetic doctor',location_id: id(2),location_name: 'Synthetic clinic',happened_at: stamp,provenance: 'entered_unverified' }],activity_total: 1,source_context: { location_id: id(2),location_name: 'Synthetic clinic',actor_label: 'Synthetic doctor' },documents_read: true,documents_write: true })
const rawDocuments = () => ({ rows: [{ id: id(4),practice_id: id(1),patient_id: id(3),version: 1,archived_at: null,current: { ...version } }],total: 1,can_write: true })
const deferred = () => { let resolve; let reject; const promise = new Promise((r,j) => { resolve = r; reject = j }); return { promise,resolve,reject } }
function fixture() {
  let scope = { environment: 'local',portal: 'doctor',userId: id(9),sessionId: id(10),practiceId: id(1),locationId: id(2),grantsVersion: 1 }
  let keyCount = 0; const calls = []
  const repository = {
    profile: async () => doctorPatientProfile(rawProfile(),id(1),id(3)),documents: async () => doctorDocumentDirectory(rawDocuments(),id(1),id(3)),status: async () => ({ canWrite: true }),
    upload: async (...args) => { calls.push(args); return { documentId: id(4),versionId: id(5),version: 1 } },archive: async (...args) => { calls.push(args) },history: async () => ({ versions: [],total: 0,events: [] }),download: async () => new Blob(['private']) }
  const state = doctorProfileState(); const controller = createDoctorProfileController(repository,state,() => scope,() => id(100+(++keyCount)))
  return { state,controller,repository,calls,setScope(value) { scope = value },scope: () => scope }
}
test('profile decoders reject verified provenance, foreign scope and unsafe version metadata',() => {
  assert.equal(doctorPatientProfile(rawProfile(),id(1),id(3)).patient.provenance,'entered_unverified')
  const claims = rawProfile(); claims.patient.provenance = 'verified'; assert.throws(() => doctorPatientProfile(claims,id(1),id(3)))
  assert.throws(() => doctorPatientProfile(rawProfile(),id(1),id(99)))
  const files = rawDocuments(); files.rows[0].current.provenance = 'reviewed'; assert.throws(() => doctorDocumentDirectory(files,id(1),id(3)))
  const unknown = rawDocuments(); unknown.rows[0].current.timezone = 'not/a-zone'; assert.throws(() => doctorDocumentDirectory(unknown,id(1),id(3)))
  const injected = rawDocuments(); injected.rows[0].current.object_path = 'PRIVATE'; assert.equal('object_path' in doctorDocumentDirectory(injected,id(1),id(3)).rows[0].current,false)
  assert.throws(() => doctorDocumentHistory({ versions: [version,version],total: 2,events: [] },id(4)))
})
test('profile and file list load without inventing clinical values; disabled file service preserves metadata',async () => {
  const f = fixture(); f.repository.status = async () => { throw new Error('network') }
  assert.equal(await f.controller.load(id(3)),true); assert.equal(f.state.profile.patient.name,'Synthetic patient'); assert.equal(f.state.documents.total,1)
  assert.equal(f.state.available,false); assert.equal(f.controller.writable(),false); assert.equal(f.state.documentsError,'network')
})
test('uncertain upload retries reuse the same command and file; double clicks issue one write',async () => {
  const f = fixture(); await f.controller.load(id(3)); const file = new File(['%PDF-1.7'],'synthetic.pdf',{ type: 'application/pdf' }); f.controller.choose(file,null)
  f.repository.upload = async (...args) => { f.calls.push(args); throw new Error('lost response') }
  assert.equal(await f.controller.upload(),false); assert.equal(await f.controller.upload(),false)
  assert.equal(f.calls[0][3],f.calls[1][3]); assert.equal(f.calls[0][2],file)
  const pending = deferred(); f.repository.upload = async (...args) => { f.calls.push(args); return pending.promise }
  const first = f.controller.upload(); assert.equal(await f.controller.upload(),false); pending.resolve({ documentId: id(4),versionId: id(5),version: 1 }); assert.equal(await first,true)
  assert.equal(f.state.file,null); assert.equal(f.state.pending,false); assert.equal(f.calls.length,3)
})
test('replacement selection preserves exact logical version and invalid files cannot submit',async () => {
  const f = fixture(); await f.controller.load(id(3)); assert.equal(f.controller.choose(new File(['x'],'script.html',{ type: 'text/html' }),id(4)),false); assert.equal(await f.controller.upload(),false)
  const file = new File(['%PDF-1.7'],'replace.pdf',{ type: 'application/pdf' }); assert.equal(f.controller.choose(file,id(4)),true); await f.controller.upload()
  assert.equal(f.calls[0][1].id,id(4)); assert.equal(f.calls[0][1].version,1)
})
test('late profile and download results are excluded after context or session loss',async () => {
  const f = fixture(); const pending = deferred(); f.repository.profile = () => pending.promise
  const first = f.controller.load(id(3)); f.controller.clear(); f.setScope(null); pending.resolve(doctorPatientProfile(rawProfile(),id(1),id(3)))
  assert.equal(await first,false); assert.equal(f.state.profile,null); assert.equal(f.state.file,null)
  const g = fixture(); await g.controller.load(id(3)); const bytes = deferred(); g.repository.download = () => bytes.promise
  const download = g.controller.download(id(4),id(5)); g.setScope({ ...g.scope(),sessionId: id(99) }); bytes.resolve(new Blob(['private'])); assert.equal(await download,null)
})
test('clear aborts owned requests and prevents a late success/error from repopulating files',async () => {
  const f = fixture(); await f.controller.load(id(3)); f.controller.choose(new File(['pdf'],'a.pdf',{ type: 'application/pdf' }),null)
  const pending = deferred(); let signal; f.repository.upload = async (...args) => { signal = args[4]; return pending.promise }
  const upload = f.controller.upload(); f.controller.clear(); assert.equal(signal.aborted,true); pending.reject(new Error('network'))
  assert.equal(await upload,false); assert.equal(f.state.file,null); assert.equal(f.state.profile,null); assert.equal(f.state.actionError,null)
})
test('capability loss denies writes and downloads while independent B scope never accepts A payload',async () => {
  const f = fixture(); await f.controller.load(id(3)); f.state.profile.documentsWrite = false
  assert.equal(f.controller.choose(new File(['pdf'],'a.pdf',{ type: 'application/pdf' }),null),false); assert.equal(await f.controller.archive(id(4),1),false)
  f.state.available = false; assert.equal(await f.controller.download(id(4),id(5)),null)
  const result = deferred(); f.repository.documents = () => result.promise; const load = f.controller.documents(); f.setScope({ ...f.scope(),practiceId: id(77) }); result.resolve(doctorDocumentDirectory(rawDocuments(),id(1),id(3))); assert.equal(await load,false); assert.equal(f.state.documents,null)
})
test('closed history cannot be refilled by late version results',async () => {
  const f = fixture(); await f.controller.load(id(3)); const result = deferred(); f.repository.history = () => result.promise
  const history = f.controller.history(id(4)); f.controller.closeHistory(); result.resolve({ versions: [],total: 0,events: [] }); assert.equal(await history,false); assert.equal(f.state.history,null); assert.equal(f.state.historyDocumentId,null)
})

test('archive confirmation cannot silently apply to a newly refreshed replacement version',async () => {
  const f = fixture(); await f.controller.load(id(3)); const confirmedVersion = f.state.documents.rows[0].version
  f.state.documents.rows[0].version++
  assert.equal(await f.controller.archive(id(4),confirmedVersion),false); assert.equal(f.state.actionError,'conflict'); assert.equal(f.calls.length,0)
})
