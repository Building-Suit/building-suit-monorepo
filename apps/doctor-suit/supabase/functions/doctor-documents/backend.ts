import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import type { Database } from '../_shared/database.types.ts'
import { DOCTOR_DOCUMENT_BUCKET,DOCTOR_DOCUMENT_MAX_BYTES,DoctorDocumentFailure } from './files.ts'
import { documentRecord,documentUuid,doctorDocumentOutcome,doctorDocumentPlan,type DoctorDocumentBackend,type DocumentScope } from './contracts.ts'
export interface DoctorDocumentConfiguration { url: string; publicKey: string; serviceKey: string }
function checked(error: unknown): void {
  if (!error) return
  const code = documentRecord(error) ? error.code : null
  if (code==='42501' || code==='PGRST301' || code==='PGRST302') throw new DoctorDocumentFailure(403,'denied')
  if (code==='40001' || code==='22023') throw new DoctorDocumentFailure(409,'conflict')
  throw new DoctorDocumentFailure(503,'unavailable')
}
export function doctorDocumentBackend(configuration: DoctorDocumentConfiguration,authorization: string): DoctorDocumentBackend {
  // Both clients are request-local. The user client never receives service credentials.
  const options = { auth: { persistSession: false,autoRefreshToken: false,detectSessionInUrl: false },global: { fetch: (input: RequestInfo | URL,init?: RequestInit) => fetch(input,{ ...init,signal: AbortSignal.timeout(20000) }) } }
  const user = createClient<Database>(configuration.url,configuration.publicKey,{ ...options,global: { ...options.global,headers: { Authorization: authorization } } })
  const service = createClient<Database>(configuration.url,configuration.serviceKey,options)
  async function privateBucket() {
    const { data,error } = await service.storage.getBucket(DOCTOR_DOCUMENT_BUCKET)
    if (error || !data || data.public || Number(data.file_size_limit)!==DOCTOR_DOCUMENT_MAX_BYTES || !Array.isArray(data.allowed_mime_types)
      || data.allowed_mime_types.length!==3 || !['application/pdf','image/png','image/jpeg'].every(mime => data.allowed_mime_types!.includes(mime))) throw new DoctorDocumentFailure(503,'unavailable')
  }
  const scope = (value: DocumentScope) => ({ p_practice: value.practiceId,p_location: value.locationId,p_patient: value.patientId })
  return {
    async authenticate() {
      const identity = await user.auth.getUser(authorization.slice(7))
      if (identity.error || !identity.data.user) throw new DoctorDocumentFailure(401,'session')
      const marker = await user.rpc('doctor_runtime_contract')
      if (marker.error || !documentRecord(marker.data) || marker.data.product!=='doctor-suit' || marker.data.version!==1 || marker.data.data_mode!=='synthetic') throw new DoctorDocumentFailure(503,'unavailable')
      const result = await user.rpc('doctor_session_context')
      if (result.error || !documentRecord(result.data) || result.data.product!=='doctor-suit' || result.data.user_id!==identity.data.user.id || !documentUuid(result.data.user_id) || !documentUuid(result.data.session_id)) throw new DoctorDocumentFailure(401,'session')
      return { userId: result.data.user_id,sessionId: result.data.session_id }
    },
    async authorize(_actor,request,write) {
      const { data,error } = await user.rpc('doctor_patient_profile',scope(request)); checked(error)
      if (!documentRecord(data) || !documentRecord(data.patient) || data.patient.id!==request.patientId || data.patient.practice_id!==request.practiceId || data.documents_read!==true || (write && data.documents_write!==true)) throw new DoctorDocumentFailure(403,'denied')
      return { canWrite: data.documents_write===true }
    },
    async reserve(actor,request,material) {
      const { data,error } = await service.rpc('doctor_reserve_document',{ ...scope(request),p_actor: actor.userId,p_session: actor.sessionId,p_filename: material.filename,p_mime: material.mime,p_size: material.size,p_sha: material.sha256,p_key: request.key,...(request.documentId ? { p_document: request.documentId } : {}),...(request.expectedVersion ? { p_expected_version: request.expectedVersion } : {}) }); checked(error)
      if (!documentRecord(data) || !documentUuid(data.intent_id) || !['reserved','committed'].includes(String(data.state))) throw new DoctorDocumentFailure(503,'unavailable')
      const plan = doctorDocumentPlan({ ...data,filename: material.filename },request)
      const result = data.state==='committed' ? doctorDocumentOutcome(data.result) : null
      if (result && (result.documentId!==plan.documentId || result.versionId!==plan.versionId)) throw new DoctorDocumentFailure(503,'unavailable')
      return { ...plan,intentId: data.intent_id,state: data.state as 'reserved' | 'committed',result }
    },
    async finalize(actor,intentId) {
      const { data,error } = await service.rpc('doctor_finalize_document',{ p_actor: actor.userId,p_session: actor.sessionId,p_intent: intentId }); checked(error)
      return doctorDocumentOutcome(data)
    },
    async plan(actor,request,versionId,key) {
      if (!request.documentId) throw new DoctorDocumentFailure(400,'invalid')
      const { data,error } = await service.rpc('doctor_document_delivery',{ ...scope(request),p_actor: actor.userId,p_session: actor.sessionId,p_document: request.documentId,...(versionId || request.versionId ? { p_version: versionId || request.versionId! } : {}),...(key ? { p_key: key } : {}) }); checked(error)
      const plan = doctorDocumentPlan(data,request)
      if (plan.documentId!==request.documentId || ((versionId || request.versionId) && plan.versionId!==(versionId || request.versionId))) throw new DoctorDocumentFailure(503,'unavailable')
      return plan
    },
    async put(reservation,bytes) {
      await privateBucket()
      const result = await service.storage.from(DOCTOR_DOCUMENT_BUCKET).upload(reservation.objectPath,new Uint8Array(bytes),{ contentType: reservation.mime,upsert: false,cacheControl: '0' })
      // A retry may find the first attempt's immutable object. The handler reads
      // and checks its exact length/hash before committing metadata.
      if (result.error && String(result.error.statusCode)!=='409' && String(result.error.statusCode)!=='400') throw new DoctorDocumentFailure(503,'unavailable')
    },
    async get(plan) {
      await privateBucket()
      const { data,error } = await service.storage.from(DOCTOR_DOCUMENT_BUCKET).download(plan.objectPath)
      if (error || !data || data.size!==plan.size || data.size>DOCTOR_DOCUMENT_MAX_BYTES) throw new DoctorDocumentFailure(503,'unavailable')
      return new Uint8Array(await data.arrayBuffer())
    },
  }
}
