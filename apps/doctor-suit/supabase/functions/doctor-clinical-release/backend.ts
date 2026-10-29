import {createClient} from 'npm:@supabase/supabase-js@2.116.0'
import type {Database} from '../_shared/database.types.ts'
import {doctorDocumentBackend,type DoctorDocumentConfiguration} from '../doctor-documents/backend.ts'
import {doctorDocumentPlan,documentRecord,documentUuid} from '../doctor-documents/contracts.ts'
import {DoctorDocumentFailure} from '../doctor-documents/files.ts'
import type {ClinicalReleaseBackend} from './handler.ts'
export function clinicalReleaseBackend(configuration:DoctorDocumentConfiguration,authorization:string):ClinicalReleaseBackend {
 const document=doctorDocumentBackend(configuration,authorization)
 const service=createClient<Database>(configuration.url,configuration.serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}})
 return {authenticate:document.authenticate,get:document.get,
  async plan(actor,releaseId,versionId,key){
   const {data,error}=await service.rpc('doctor_clinical_release_delivery',{p_actor:actor.userId,p_session:actor.sessionId,p_release:releaseId,p_version:versionId,...(key?{p_key:key}:{})})
   if(error)throw new DoctorDocumentFailure(error.code==='42501'?403:error.code==='22023'?409:503,error.code==='42501'?'denied':error.code==='22023'?'conflict':'unavailable')
   if(!documentRecord(data)||data.version_id!==versionId||!documentUuid(data.practice_id)||!documentUuid(data.patient_id)||!documentUuid(data.location_id))throw new DoctorDocumentFailure(503,'unavailable')
   return doctorDocumentPlan(data,{practiceId:data.practice_id,locationId:data.location_id,patientId:data.patient_id})
  },
 }
}
