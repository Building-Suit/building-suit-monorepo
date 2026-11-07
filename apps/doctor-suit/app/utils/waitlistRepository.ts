import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database,Json}from'../types/database.types'
import{waitlistDirectory,waitlistHistory,waitlistResult,type WaitlistQuery,type WaitlistAction,type WaitlistInput,type WaitlistRow}from'./waitlist.ts'
import{consultationDirectory}from'./consultations.ts'
import{doctorAppointmentsRepository}from'./appointmentsRepository'
import{doctorPatientsRepository}from'./patientsRepository'
export function waitlistRepository(client:SupabaseClient<Database>){const appointments=doctorAppointmentsRepository(client),patients=doctorPatientsRepository(client);return{
 async load(practice:string,location:string,query:WaitlistQuery,signal:AbortSignal){const{data,error}=await client.rpc('doctor_waitlist',{p_practice:practice,p_location:location,p_page:query.page,p_state:query.state,p_search:query.search}).abortSignal(signal);if(error)throw error;return waitlistDirectory(data,practice,location,query)},
 async history(practice:string,location:string,entry:string,page:number,signal:AbortSignal){const{data,error}=await client.rpc('doctor_waitlist_history',{p_practice:practice,p_location:location,p_entry:entry,p_page:page}).abortSignal(signal);if(error)throw error;return waitlistHistory(data,practice,location,entry,page)},
 async command(practice:string,location:string,entry:string,version:number,action:WaitlistAction,input:WaitlistInput,key:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_waitlist_command',{p_practice:practice,p_location:location,p_entry:entry,p_expected_version:version,p_action:action,p_input:input as Json,p_key:key}).abortSignal(signal);if(error)throw error;const result=waitlistResult(data);if(result.entryId!==entry||result.version!==version+1)throw new Error('DOCTOR_WAITLIST_RESPONSE_INVALID');return result},
 async types(practice:string,location:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_consultation_types',{p_practice:practice,p_location:location}).abortSignal(signal);if(error)throw error;return consultationDirectory(data,practice,location).types},
 async patients(practice:string,location:string,search:string,signal:AbortSignal){return patients.load(practice,location,{page:0,size:20,search,status:'active'},signal)},
 async offers(practice:string,location:string,row:WaitlistRow,date:string,signal:AbortSignal){return appointments.offers(practice,location,date,signal,{typeId:row.type.id,typeVersion:row.type.version})}
}}
