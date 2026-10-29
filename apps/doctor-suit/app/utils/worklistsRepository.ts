import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database,Json}from'../types/database.types'
import{worklistDirectory,worklistOptions,worklistHistory,worklistResult,type WorklistQuery,type WorklistAction,type WorklistInput}from'./worklists.ts'
import{doctorPatientsRepository}from'./patientsRepository'
export function worklistsRepository(client:SupabaseClient<Database>){const patients=doctorPatientsRepository(client);return{
 async load(practice:string,location:string,q:WorklistQuery,signal:AbortSignal){const{data,error}=await client.rpc('doctor_worklist',{p_practice:practice,p_location:location,p_page:q.page,p_state:q.state,p_mine:q.mine,p_overdue:q.overdue}).abortSignal(signal);if(error)throw error;return worklistDirectory(data,practice,location,q)},
 async options(practice:string,location:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_worklist_options',{p_practice:practice,p_location:location}).abortSignal(signal);if(error)throw error;return worklistOptions(data,practice,location)},
 async history(practice:string,location:string,id:string,page:number,signal:AbortSignal){const{data,error}=await client.rpc('doctor_worklist_history',{p_practice:practice,p_location:location,p_task:id,p_page:page}).abortSignal(signal);if(error)throw error;return worklistHistory(data,practice,location,id,page)},
 async command(practice:string,location:string,id:string,version:number,action:WorklistAction,input:WorklistInput,key:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_worklist_command',{p_practice:practice,p_location:location,p_task:id,p_expected_version:version,p_action:action,p_input:input as Json,p_key:key}).abortSignal(signal);if(error)throw error;return worklistResult(data,id,version)},
 async patients(practice:string,location:string,search:string,signal:AbortSignal){return patients.load(practice,location,{page:0,size:20,search,status:'active'},signal)}
}}
