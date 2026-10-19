import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database}from'../types/database.types'
import type{DoctorIdentity}from'./authController'
import{doctorPrivacyRequest,doctorPrivacySnapshot,type DoctorPrivacyKind}from'./privacyRequests.ts'
export function doctorPrivacyRepository(client:SupabaseClient<Database>){return{
 async load(actor:DoctorIdentity,signal:AbortSignal){const{data,error}=await client.rpc('doctor_privacy_requests').abortSignal(signal);if(error)throw error;return doctorPrivacySnapshot(data,actor)},
 async submit(kind:DoctorPrivacyKind,key:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_submit_privacy_request',{p_kind:kind,p_key:key}).abortSignal(signal);if(error)throw error;const row=doctorPrivacyRequest(data);if(row.kind!==kind)throw Error('DOCTOR_PRIVACY_INVALID');return row},
}}
