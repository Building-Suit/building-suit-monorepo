import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database,Json } from '../types/database.types'
import { clinicalDirectory,clinicalDetail,clinicalCommandResult,type ClinicalAction } from './clinical.ts'
export function clinicalRepository(client:SupabaseClient<Database>) {
 return {
  async load(practice:string,location:string,page:number,search:string,signal:AbortSignal) {
   const {data,error}=await client.rpc('doctor_clinical_workspace',{p_practice:practice,p_location:location,p_page:page,p_search:search}).abortSignal(signal)
   if(error)throw error;return clinicalDirectory(data)
  },
  async detail(practice:string,location:string,encounter:string,page:number,signal:AbortSignal) {
   const {data,error}=await client.rpc('doctor_clinical_detail',{p_practice:practice,p_location:location,p_encounter:encounter,p_page:page}).abortSignal(signal)
   if(error)throw error;return clinicalDetail(data,practice,location,encounter)
  },
  async command(practice:string,location:string,encounter:string|null,version:number|null,action:ClinicalAction,input:Json,key:string,signal:AbortSignal) {
   const {data,error}=await client.rpc('doctor_clinical_command',{p_practice:practice,p_location:location,p_encounter:encounter as string,p_expected_version:version as number,p_action:action,p_input:input,p_key:key}).abortSignal(signal)
   if(error)throw error;return clinicalCommandResult(data)
  },

 }
}
