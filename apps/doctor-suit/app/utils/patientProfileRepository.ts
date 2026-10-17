import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { doctorPatientProfile,doctorDocumentDirectory,doctorDocumentHistory,doctorProfileRecord,type DoctorDocumentRow,type DoctorDocumentVersion } from './patientProfile.ts'
import { doctorUuid } from './locationContext.ts'
export interface DoctorProfileScope { practiceId: string; locationId: string; patientId: string }
export function doctorPatientProfileRepository(client: SupabaseClient<Database>,url: string,publicKey: string,transport: typeof fetch = fetch) {
  const args = (scope: DoctorProfileScope) => ({ p_practice: scope.practiceId,p_location: scope.locationId,p_patient: scope.patientId })
  async function fileRequest(scope: DoctorProfileScope,operation: 'status' | 'upload' | 'download',key: string,data: { filename?: string; documentId?: string; expectedVersion?: number; versionId?: string },signal: AbortSignal,file?: File) {
    const session = await client.auth.getSession()
    if (session.error || !session.data.session) throw { code: '42501' }
    const result = await transport(`${url}/functions/v1/doctor-documents?op=${operation}`,{ method: 'POST',headers: { apikey: publicKey,Authorization: `Bearer ${session.data.session.access_token}`,'Content-Type': file?.type || 'application/octet-stream','x-doctor-document': encodeURIComponent(JSON.stringify({ ...scope,key,...data })) },signal,body: file })
    if (!result.ok) {
      if ([401,403].includes(result.status)) throw { code: '42501' }
      if (result.status===409) throw { code: '40001' }
      if ([400,413,415].includes(result.status)) throw { code: '22023' }
      throw { code: 'unavailable' }
    }
    return result
  }
  return {
    async profile(scope: DoctorProfileScope,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_patient_profile',args(scope)).abortSignal(signal); if (error) throw error; return doctorPatientProfile(data,scope.practiceId,scope.patientId) },
    async documents(scope: DoctorProfileScope,page: number,size: number,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_patient_documents',{ ...args(scope),p_page: page,p_size: size }).abortSignal(signal); if (error) throw error; return doctorDocumentDirectory(data,scope.practiceId,scope.patientId) },
    async history(scope: DoctorProfileScope,row: DoctorDocumentRow,page: number,size: number,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_document_history',{ ...args(scope),p_document: row.id,p_page: page,p_size: size }).abortSignal(signal); if (error) throw error; return doctorDocumentHistory(data,row.id) },
    async status(scope: DoctorProfileScope,key: string,signal: AbortSignal) { const response = await fileRequest(scope,'status',key,{},signal); const value: unknown = await response.json(); if (!doctorProfileRecord(value) || value.available!==true || typeof value.canWrite!=='boolean' || value.maxBytes!==5242880 || !Array.isArray(value.mimeTypes) || value.mimeTypes.join(',')!=='application/pdf,image/png,image/jpeg') throw { code: 'unavailable' }; return { canWrite: value.canWrite } },
    async upload(scope: DoctorProfileScope,row: DoctorDocumentRow | null,file: File,key: string,signal: AbortSignal) {
      const response = await fileRequest(scope,'upload',key,{ filename: file.name,...(row ? { documentId: row.id,expectedVersion: row.version } : {}) },signal,file)
      const value: unknown = await response.json()
      if (!doctorProfileRecord(value) || !doctorUuid(value.documentId) || !doctorUuid(value.versionId) || !Number.isSafeInteger(value.version) || Number(value.version)<1 || (row && value.documentId!==row.id)) throw { code: 'unavailable' }
      return { documentId: value.documentId,versionId: value.versionId,version: Number(value.version) }
    },
    async archive(scope: DoctorProfileScope,row: DoctorDocumentRow,key: string,signal: AbortSignal) { const { data,error } = await client.rpc('doctor_archive_document',{ ...args(scope),p_document: row.id,p_expected_version: row.version,p_key: key }).abortSignal(signal); if (error) throw error; if (!doctorProfileRecord(data) || data.document_id!==row.id || !Number.isSafeInteger(data.version) || Number(data.version)<1) throw { code: 'unavailable' } },
    async download(scope: DoctorProfileScope,row: DoctorDocumentRow,version: DoctorDocumentVersion,key: string,signal: AbortSignal) {
      const response = await fileRequest(scope,'download',key,{ documentId: row.id,versionId: version.id },signal)
      if (response.headers.get('content-type')!==version.mime || !response.headers.get('content-disposition')?.startsWith('attachment;')) throw { code: 'unavailable' }
      const reader = response.body?.getReader(); if (!reader) throw { code: 'unavailable' }
      const bytes = new Uint8Array(5242880); let size = 0
      try { for (;;) { const result = await reader.read(); if (result.done) break; size+=result.value.length; if (size>bytes.length) { await reader.cancel(); throw { code: 'unavailable' } } bytes.set(result.value,size-result.value.length) } } finally { reader.releaseLock() }
      if (size!==version.size) throw { code: 'unavailable' }
      return new Blob([bytes.subarray(0,size)],{ type: version.mime })
    },
  }
}
