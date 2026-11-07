import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../types/database.types'
import {consultationDirectory,consultationType,type ConsultationInput} from './consultations.ts'
export function consultationsRepository(client:SupabaseClient<Database>){return{
 async load(practice:string,location:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_consultation_types',{p_practice:practice,p_location:location}).abortSignal(signal);if(error)throw error;return consultationDirectory(data,practice,location)},
 async write(practice:string,location:string,id:string,version:number,input:ConsultationInput,key:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_write_consultation_type',{p_practice:practice,p_location:location,p_type:id,p_expected_version:version,p_input:{...input},p_key:key}).abortSignal(signal);if(error)throw error;return consultationType(data,practice)}
}}
