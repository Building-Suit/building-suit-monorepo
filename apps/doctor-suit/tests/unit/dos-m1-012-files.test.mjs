import test from 'node:test'
import assert from 'node:assert/strict'
import { DoctorDocumentFailure,DOCTOR_DOCUMENT_MAX_BYTES,doctorDocumentFilename,doctorDocumentBytes,doctorDocumentMime,doctorDocumentHash,doctorDocumentDisposition } from '../../supabase/functions/doctor-documents/files.ts'
import { createDoctorDocumentHandler } from '../../supabase/functions/doctor-documents/handler.ts'
import { doctorDocumentRequest,doctorDocumentPlan } from '../../supabase/functions/doctor-documents/contracts.ts'
const id = n => `12000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const scope = { practiceId: id(1),locationId: id(2),patientId: id(3),key: id(4) }
const pdf = new TextEncoder().encode('%PDF-1.7\nSynthetic administrative fixture\n%%EOF\n')
function fixture() {
  const calls = []; let denied = false; let bytes = pdf; let committed = false
  const plan = { documentId: id(5),versionId: id(6),objectPath: `${id(1)}/${id(3)}/${id(5)}/${id(7)}.pdf`,mime: 'application/pdf',size: pdf.length,sha256: '',filename: 'synthetic.pdf' }
  const actor = { userId: id(8),sessionId: id(9) }
  const backend = {
    async authenticate() { calls.push('authenticate'); return actor },
    async authorize(value,request,write) { calls.push('authorize'); assert.equal(value,actor); if (request.practiceId!==scope.practiceId || denied || (write && backend.readOnly)) throw new DoctorDocumentFailure(403,'denied'); return { canWrite: !backend.readOnly } },
    async reserve(value,request,material) { calls.push('reserve'); assert.equal(value,actor); assert.equal(request.key,scope.key); return { ...plan,sha256: material.sha256,intentId: id(10),state: committed ? 'committed' : 'reserved',result: committed ? { documentId: id(5),versionId: id(6),version: 1 } : null } },
    async finalize(value,intentId) { calls.push('finalize'); if (denied) throw new DoctorDocumentFailure(403,'denied'); assert.equal(value,actor); assert.equal(intentId,id(10)); committed = true; return { documentId: id(5),versionId: id(6),version: 1 } },
    async plan(value,request,versionId,key) { calls.push(key ? 'audit-plan' : 'plan'); if (denied) throw new DoctorDocumentFailure(403,'denied'); assert.equal(value,actor); assert.equal(request.documentId,id(5)); if (key) { assert.equal(key,scope.key); assert.equal(versionId,id(6)) } return { ...plan,sha256: await doctorDocumentHash(pdf) } },
    async put() { calls.push('put') },
    async get() { calls.push('get'); if (backend.revokeAfterGet) denied = true; return bytes },
  }
  const handler = createDoctorDocumentHandler(() => backend,['http://localhost:4341'])
  const request = (op,data = {},body = op==='upload' ? pdf : undefined,headers = {}) => new Request(`http://localhost/functions/v1/doctor-documents?op=${op}`,{ method: 'POST',headers: { authorization: 'Bearer synthetic.jwt.token',origin: 'http://localhost:4341','content-type': 'application/pdf','x-doctor-document': encodeURIComponent(JSON.stringify({ ...scope,...data })),...headers },body })
  return { calls,backend,handler,request,setBytes(value) { bytes = value },setCommitted() { committed = true } }
}
test('document request rejects injected authority and malformed scope before authentication',async () => {
  assert.throws(() => doctorDocumentRequest(encodeURIComponent(JSON.stringify({ ...scope,actorId: id(8) }))),DoctorDocumentFailure)
  assert.throws(() => doctorDocumentRequest('%'),DoctorDocumentFailure)
  const f = fixture(); const result = await f.handler(f.request('status',{ patientId: '../patient' })); assert.equal(result.status,400); assert.deepEqual(f.calls,[])
})
test('filename, signature, extension and content type validation prevent active or mislabelled uploads',() => {
  assert.equal(doctorDocumentFilename('ملف تجريبي.pdf'),true)
  for (const name of ['../a.pdf','a\\b.pdf','a\nb.pdf','a\u202eb.pdf',' a.pdf']) assert.equal(doctorDocumentFilename(name),false)
  assert.equal(doctorDocumentMime(pdf,'test.pdf','application/pdf'),'application/pdf')
  assert.throws(() => doctorDocumentMime(pdf,'test.png','image/png'),DoctorDocumentFailure)
  assert.throws(() => doctorDocumentMime(new TextEncoder().encode('<script>hi</script>'),'test.pdf','application/pdf'),DoctorDocumentFailure)
  assert.throws(() => doctorDocumentMime(pdf,'test.pdf','text/html'),DoctorDocumentFailure)
  assert.match(doctorDocumentDisposition('ملف.pdf'),/^attachment; filename="document.pdf"; filename\*=UTF-8''/)
})
test('stream size cap and declared length mismatch reject before storage writes',async () => {
  const f = fixture(); const huge = new Uint8Array(DOCTOR_DOCUMENT_MAX_BYTES+1)
  assert.equal((await f.handler(f.request('upload',{ filename: 'a.pdf' },huge))).status,413)
  assert.equal(f.calls.includes('put'),false)
  await assert.rejects(doctorDocumentBytes(f.request('upload',{},pdf,{ 'content-length': String(pdf.length+1) })),DoctorDocumentFailure)
  assert.equal((await f.handler(f.request('upload',{ filename: 'a.pdf' },pdf,{ 'content-length': '9999999999' }))).status,413)
})
test('private upload validates stored bytes before metadata commit and returns no storage locator',async () => {
  const f = fixture(); const result = await f.handler(f.request('upload',{ filename: 'a.pdf' })); assert.equal(result.status,200)
  assert.deepEqual(f.calls,['authenticate','authorize','reserve','put','get','finalize'])
  assert.deepEqual(await result.json(),{ documentId: id(5),versionId: id(6),version: 1 })
  assert.match(result.headers.get('cache-control'),/no-store/)
})
test('committed retry returns original result without rewriting immutable bytes',async () => {
  const f = fixture(); f.setCommitted(); const result = await f.handler(f.request('upload',{ filename: 'a.pdf' })); assert.equal(result.status,200)
  assert.deepEqual(f.calls,['authenticate','authorize','reserve'])
})
test('corrupt stored bytes cannot be published or returned to a caller',async () => {
  const f = fixture(); f.setBytes(new Uint8Array(pdf.length)); assert.equal((await f.handler(f.request('upload',{ filename: 'a.pdf' }))).status,503)
  assert.equal(f.calls.includes('finalize'),false)
  const result = await f.handler(f.request('download',{ documentId: id(5) })); assert.equal(result.status,503); assert.equal(f.calls.includes('audit-plan'),false)
})
test('download rechecks live authority after storage I/O and denies revoked access',async () => {
  const f = fixture(); f.backend.revokeAfterGet = true
  const result = await f.handler(f.request('download',{ documentId: id(5) })); assert.equal(result.status,403)
  assert.deepEqual(f.calls,['authenticate','authorize','plan','get','audit-plan']); assert.deepEqual(await result.json(),{ error: 'denied' })
})
test('successful current-authority delivery is attachment only, no public URL or provider detail',async () => {
  const f = fixture(); const result = await f.handler(f.request('download',{ documentId: id(5) })); assert.equal(result.status,200)
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),pdf)
  assert.match(result.headers.get('content-disposition'),/^attachment;/); assert.equal(result.headers.get('x-content-type-options'),'nosniff')
  assert.match(result.headers.get('content-security-policy'),/sandbox/)
})
test('cross-practice, read-only upload, wrong origin and missing session fail closed',async () => {
  const f = fixture()
  assert.equal((await f.handler(f.request('status',{ practiceId: id(99) }))).status,403)
  f.backend.readOnly = true; assert.equal((await f.handler(f.request('upload',{ filename: 'a.pdf' }))).status,403)
  assert.equal((await f.handler(f.request('status',{},undefined,{ origin: 'https://foreign.invalid' }))).status,403)
  assert.equal((await f.handler(f.request('status',{},undefined,{ authorization: '' }))).status,401)
  assert.equal(f.calls.includes('reserve'),false)
})
test('provider exceptions are sanitized and ambiguous commit cannot trigger destructive cleanup',async () => {
  const f = fixture(); f.backend.finalize = async () => { throw new Error('PRIVATE_PROVIDER_TOKEN_AND_SQL') }
  const result = await f.handler(f.request('upload',{ filename: 'a.pdf' })); assert.equal(result.status,503); assert.equal(await result.text(),'{"error":"unavailable"}')
  assert.equal(f.calls.includes('put'),true); assert.equal('remove' in f.backend,false)
})
test('service plan decoder rejects a foreign or malformed storage path',() => {
  const data = { document_id: id(5),version_id: id(6),object_path: `${id(1)}/${id(3)}/${id(5)}/${id(7)}.pdf`,mime_type: 'application/pdf',byte_size: 12,sha256: 'a'.repeat(64),filename: 'a.pdf' }
  assert.equal(doctorDocumentPlan(data,scope).documentId,id(5))
  assert.throws(() => doctorDocumentPlan({ ...data,object_path: `${id(99)}/${id(3)}/${id(5)}/${id(7)}.pdf` },scope),DoctorDocumentFailure)
  assert.throws(() => doctorDocumentPlan({ ...data,object_path: data.object_path+'/../a.pdf' },scope),DoctorDocumentFailure)
})
test('oversized streaming rejection does not await a stalled transport cancellation',async () => {
  let cancelled = false; let released = false
  const request = { headers: new Headers(),body: { getReader: () => ({ read: async () => ({ done: false,value: new Uint8Array(DOCTOR_DOCUMENT_MAX_BYTES+1) }),cancel: () => { cancelled = true; return new Promise(() => {}) },releaseLock: () => { released = true } }) } }
  const result = await Promise.race([doctorDocumentBytes(request).then(() => 'accepted',error => error),new Promise(resolve => setTimeout(() => resolve('blocked by cancellation'),40))])
  assert.ok(result instanceof DoctorDocumentFailure); assert.equal(result.status,413); assert.equal(cancelled,true); assert.equal(released,true)
})
