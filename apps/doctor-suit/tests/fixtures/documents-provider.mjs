// Browser protocol only; actual Auth/Storage/Functions are a separate CI job.
import { randomUUID,createHash } from 'node:crypto'
import { createDoctorDocumentHandler } from '../../supabase/functions/doctor-documents/handler.ts'
import { DoctorDocumentFailure } from '../../supabase/functions/doctor-documents/files.ts'
const bytes = new WeakMap(); const intents = new WeakMap()
const syntheticPdf = Buffer.from('%PDF-1.7\nSynthetic private administrative attachment\n%%EOF\n')
export function seedDocumentProtocol(data) {
  if (data.documentRows) return
  bytes.set(data,new Map()); intents.set(data,new Map()); data.documentRows = []; data.documentVersions = []; data.documentEvents = []; data.documentCommands = {}
  for (const membership of data.memberships) for (const grant of membership.grants) grant.capabilities.push('documents.read',...(grant.capabilities.includes('patients.write') ? ['documents.write'] : []))
  for (const practice of data.practices) {
    const patient = data.patientRows.find(item => item.practice_id===practice.id && item.name.endsWith('02'))
    const location = data.locations.find(item => item.practice_id===practice.id); const id = randomUUID(); const versionId = randomUUID()
    const version = { id: versionId,document_id: id,revision: 1,filename: 'synthetic-private.pdf',mime_type: 'application/pdf',byte_size: syntheticPdf.length,uploaded_by: practice.owner_user_id,uploaded_by_label: data.users.find(item => item.id===practice.owner_user_id).name,uploaded_at: '2026-01-02T00:00:00Z',location_id: location.id,location_name: location.name,timezone: location.timezone,provenance: 'uploaded_unreviewed' }
    const row = { id,practice_id: practice.id,patient_id: patient.id,version: 1,created_by: practice.owner_user_id,created_location_id: location.id,created_at: version.uploaded_at,archived_at: null,current: version }
    data.documentRows.push(row); data.documentVersions.push(version); bytes.get(data).set(versionId,syntheticPdf)
  }
}
function views({ data,actor,capability },scope,write = false) {
  const patient = data.patientRows.find(item => item.id===scope.patientId && item.practice_id===scope.practiceId)
  const location = data.locations.find(item => item.id===scope.locationId && item.practice_id===scope.practiceId && !item.archived_at)
  const read = key => capability(scope.practiceId,scope.locationId,key)
  if (!patient || !location || !read('patients.read') || !read('documents.read') || (write && (!read('documents.write') || patient.archived_at))) throw new DoctorDocumentFailure(403,'denied')
  return { patient,location,canWrite: read('documents.write') && !patient.archived_at,actor }
}
function event(data,row,actor,location,type,versionId = row.current.id) {
  data.documentEvents.push({ id: data.documentEvents.length+1,document_id: row.id,version_id: versionId,event_type: type,actor_user_id: actor.id,actor_label: actor.name,location_id: location.id,location_name: location.name,timezone: location.timezone,happened_at: new Date().toISOString() })
}
export function documentProtocol(environment,rpc,input,send) {
  const { data,actor,capability } = environment
  if (!['doctor_patient_profile','doctor_patient_documents','doctor_document_history','doctor_archive_document'].includes(rpc)) return false
  const patient = data.patientRows.find(item => item.practice_id===input.p_practice && item.id===input.p_patient)
  const location = data.locations.find(item => item.id===input.p_location && item.practice_id===input.p_practice && !item.archived_at)
  if (!patient || !location || !capability(input.p_practice,location.id,'patients.read')) { send({ code: '42501' },403); return true }
  if (rpc==='doctor_patient_profile') {
    const source = data.locations.find(item => item.id===patient.created_location_id)
    const activity = [{ id: 1,event_type: 'patient.created',record_version: 1,actor_user_id: patient.created_by,actor_label: data.users.find(item => item.id===patient.created_by).name,location_id: source.id,location_name: source.name,happened_at: patient.created_at,provenance: 'entered_unverified' }]
    send({ patient,activity,activity_total: 1,source_context: { location_id: source.id,location_name: source.name,actor_label: activity[0].actor_label },documents_read: capability(input.p_practice,location.id,'documents.read'),documents_write: !patient.archived_at && capability(input.p_practice,location.id,'documents.read') && capability(input.p_practice,location.id,'documents.write') }); return true
  }
  let access
  try { access = views(environment,{ practiceId: input.p_practice,locationId: input.p_location,patientId: input.p_patient },rpc==='doctor_archive_document') } catch { send({ code: '42501' },403); return true }
  const rows = data.documentRows.filter(item => item.practice_id===input.p_practice && item.patient_id===input.p_patient)
  if (rpc==='doctor_patient_documents') { const start = (input.p_page || 0)*(input.p_size || 20); send({ rows: rows.slice(start,start+(input.p_size || 20)),total: rows.length,can_write: access.canWrite }); return true }
  const row = rows.find(item => item.id===input.p_document); if (!row) { send({ code: '42501' },403); return true }
  if (rpc==='doctor_document_history') { const versions = data.documentVersions.filter(item => item.document_id===row.id).sort((a,b) => b.revision-a.revision); const start = (input.p_page || 0)*(input.p_size || 20); send({ versions: versions.slice(start,start+(input.p_size || 20)),total: versions.length,events: data.documentEvents.filter(item => item.document_id===row.id).slice(-100).reverse() }); return true }
  const key = `${actor.id}:${input.p_key}`; if (data.documentCommands[key]) { send(data.documentCommands[key]); return true }
  if (row.version!==input.p_expected_version) { send({ code: '40001' },409); return true }
  row.version++; row.archived_at = new Date().toISOString(); event(data,row,actor,access.location,'document.archived')
  const result = { document_id: row.id,version: row.version }; data.documentCommands[key] = result; send(result); return true
}
export async function documentFunction(environment,req,url,rawBytes,res) {
  const { data,actor,sessionId,valid } = environment
  const access = (scope,write = false) => { if (!valid()) throw new DoctorDocumentFailure(401,'session'); return views(environment,scope,write) }
  const plan = (row,version) => ({ documentId: row.id,versionId: version.id,objectPath: `${row.practice_id}/${row.patient_id}/${row.id}/${version.id}.pdf`,mime: version.mime_type,size: version.byte_size,sha256: createHash('sha256').update(bytes.get(data).get(version.id)).digest('hex'),filename: version.filename })
  const backend = {
    async authenticate() { if (!valid()) throw new DoctorDocumentFailure(401,'session'); return { userId: actor.id,sessionId } },
    async authorize(_actor,scope,write) { return { canWrite: access(scope,write).canWrite } },
    async reserve(_actor,request,material) {
      access(request,true); const key = `${actor.id}:${request.key}`; const prior = intents.get(data).get(key)
      const fingerprint = JSON.stringify([request,material]); if (prior) { if (prior.fingerprint!==fingerprint) throw new DoctorDocumentFailure(409,'conflict'); return prior.reservation }
      const row = request.documentId ? data.documentRows.find(item => item.id===request.documentId && item.practice_id===request.practiceId && item.patient_id===request.patientId) : null
      if (request.documentId && (!row || row.version!==request.expectedVersion || row.archived_at)) throw new DoctorDocumentFailure(409,'conflict')
      const reservation = { intentId: randomUUID(),documentId: row?.id || randomUUID(),versionId: randomUUID(),mime: material.mime,size: material.size,sha256: material.sha256,state: 'reserved',result: null,objectPath: 'private-fixture-only' }
      intents.get(data).set(key,{ request,material,reservation,fingerprint }); return reservation
    },
    async put(reservation,value) { if (!bytes.get(data).has(reservation.versionId)) bytes.get(data).set(reservation.versionId,Buffer.from(value)) },
    async get(value) { return bytes.get(data).get(value.versionId) },
    async finalize(_actor,intentId) {
      const intent = [...intents.get(data).values()].find(item => item.reservation.intentId===intentId); const { request,material,reservation } = intent; const view = access(request,true)
      if (reservation.state==='committed') return reservation.result
      let row = data.documentRows.find(item => item.id===request.documentId)
      if (row && row.version!==request.expectedVersion) throw new DoctorDocumentFailure(409,'conflict')
      if (!row) { row = { id: reservation.documentId,practice_id: request.practiceId,patient_id: request.patientId,version: 0,created_by: actor.id,created_location_id: request.locationId,created_at: new Date().toISOString(),archived_at: null }; data.documentRows.unshift(row) }
      const revision = (row.current?.revision || 0)+1
      const version = { id: reservation.versionId,document_id: row.id,revision,filename: material.filename,mime_type: material.mime,byte_size: material.size,uploaded_by: actor.id,uploaded_by_label: actor.name,uploaded_at: new Date().toISOString(),location_id: view.location.id,location_name: view.location.name,timezone: view.location.timezone,provenance: 'uploaded_unreviewed' }
      data.documentVersions.push(version); row.current = version; row.version++; event(data,row,actor,view.location,revision===1 ? 'document.uploaded' : 'document.replaced')
      reservation.state = 'committed'; reservation.result = { documentId: row.id,versionId: version.id,version: row.version }; return reservation.result
    },
    async plan(_actor,request,versionId,key) {
      const view = access(request); const row = data.documentRows.find(item => item.id===request.documentId && item.practice_id===request.practiceId && item.patient_id===request.patientId); const version = row && data.documentVersions.find(item => item.document_id===row.id && item.id===(versionId || request.versionId || row.current.id))
      if (!row || !version) throw new DoctorDocumentFailure(403,'denied')
      if (key && !data.documentCommands[`${actor.id}:${key}`]) { event(data,row,actor,view.location,'document.download_requested',version.id); data.documentCommands[`${actor.id}:${key}`]={ document_id: row.id,version_id: version.id } }
      return plan(row,version)
    },
  }
  const handler = createDoctorDocumentHandler(() => backend,['http://127.0.0.1:4337'])
  const response = await handler(new Request(url,{ method: req.method,headers: req.headers,body: rawBytes?.length ? new Uint8Array(rawBytes) : undefined }))
  for (const [name,value] of response.headers) res.setHeader(name,value)
  res.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()))
}
