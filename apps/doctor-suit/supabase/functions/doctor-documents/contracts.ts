import { DoctorDocumentFailure,type DoctorFileMime } from './files.ts'
export interface DocumentActor { userId: string; sessionId: string }
export interface DocumentScope { practiceId: string; locationId: string; patientId: string }
export interface DocumentRequest extends DocumentScope { key: string; documentId: string | null; versionId: string | null; expectedVersion: number | null; filename: string | null }
export interface DocumentOutcome { documentId: string; versionId: string; version: number }
export interface DocumentPlan { documentId: string; versionId: string; objectPath: string; mime: DoctorFileMime; size: number; sha256: string; filename: string }
export interface DocumentReservation extends Omit<DocumentPlan,'filename'> { intentId: string; state: 'reserved' | 'committed'; result: DocumentOutcome | null }
export interface DocumentMaterial { filename: string; mime: DoctorFileMime; size: number; sha256: string }
export interface DoctorDocumentBackend {
  authenticate(): Promise<DocumentActor>
  authorize(actor: DocumentActor,scope: DocumentScope,write: boolean): Promise<{ canWrite: boolean }>
  reserve(actor: DocumentActor,request: DocumentRequest,material: DocumentMaterial): Promise<DocumentReservation>
  finalize(actor: DocumentActor,intentId: string): Promise<DocumentOutcome>
  plan(actor: DocumentActor,request: DocumentRequest,versionId?: string,key?: string): Promise<DocumentPlan>
  put(reservation: DocumentReservation,bytes: Uint8Array): Promise<void>
  get(plan: Omit<DocumentPlan,'filename'>): Promise<Uint8Array>
}
export const documentRecord = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
export const documentUuid = (value: unknown): value is string => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export function doctorDocumentRequest(value: string | null): DocumentRequest {
  if (!value || value.length>4096) throw new DoctorDocumentFailure(400,'invalid')
  let data: unknown
  try { data = JSON.parse(decodeURIComponent(value)) } catch { throw new DoctorDocumentFailure(400,'invalid') }
  if (!documentRecord(data) || Object.keys(data).some(key => !['practiceId','locationId','patientId','key','documentId','versionId','expectedVersion','filename'].includes(key))
    || !documentUuid(data.practiceId) || !documentUuid(data.locationId) || !documentUuid(data.patientId) || !documentUuid(data.key)
    || !(data.documentId===undefined || data.documentId===null || documentUuid(data.documentId))
    || !(data.versionId===undefined || data.versionId===null || documentUuid(data.versionId))
    || !(data.expectedVersion===undefined || data.expectedVersion===null || (Number.isSafeInteger(data.expectedVersion) && Number(data.expectedVersion)>0))
    || !(data.filename===undefined || data.filename===null || typeof data.filename==='string')) throw new DoctorDocumentFailure(400,'invalid')
  return { practiceId: data.practiceId.toLowerCase(),locationId: data.locationId.toLowerCase(),patientId: data.patientId.toLowerCase(),key: data.key.toLowerCase(),
    documentId: typeof data.documentId==='string' ? data.documentId.toLowerCase() : null,versionId: typeof data.versionId==='string' ? data.versionId.toLowerCase() : null,
    expectedVersion: typeof data.expectedVersion==='number' ? data.expectedVersion : null,filename: typeof data.filename==='string' ? data.filename : null }
}
export function doctorDocumentOutcome(value: unknown): DocumentOutcome {
  if (!documentRecord(value) || !documentUuid(value.document_id) || !documentUuid(value.version_id) || !Number.isSafeInteger(value.version) || Number(value.version)<1) throw new DoctorDocumentFailure(503,'unavailable')
  return { documentId: value.document_id,versionId: value.version_id,version: Number(value.version) }
}
export function doctorDocumentPlan(value: unknown,scope: DocumentScope): DocumentPlan {
  if (!documentRecord(value) || !documentUuid(value.document_id) || !documentUuid(value.version_id) || typeof value.object_path!=='string'
    || !value.object_path.startsWith(`${scope.practiceId}/${scope.patientId}/${value.document_id}/`)
    || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(?:pdf|png|jpg)$/.test(value.object_path)
    || !['application/pdf','image/png','image/jpeg'].includes(String(value.mime_type)) || !Number.isSafeInteger(value.byte_size) || Number(value.byte_size)<1 || Number(value.byte_size)>5242880
    || typeof value.sha256!=='string' || !/^[a-f0-9]{64}$/.test(value.sha256) || typeof value.filename!=='string') throw new DoctorDocumentFailure(503,'unavailable')
  return { documentId: value.document_id,versionId: value.version_id,objectPath: value.object_path,mime: value.mime_type as DoctorFileMime,size: Number(value.byte_size),sha256: value.sha256,filename: value.filename }
}
