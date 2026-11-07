import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database,Json}from'../types/database.types'
import type{FulfillmentPort}from'./operationalFulfillment'
export function fulfillmentRepository(client:SupabaseClient<Database>):FulfillmentPort{return{
 async load(practice,location,patient,page,signal){const{data,error}=await client.rpc('doctor_fulfillments',{p_practice:practice,p_location:location,p_patient:patient,p_page:page}).abortSignal(signal);if(error)throw error;return data},
 async command(practice,location,patient,id,version,action,input,key,signal){const{data,error}=await client.rpc('doctor_fulfillment_command',{p_practice:practice,p_location:location,p_patient:patient,p_id:id,p_version:version,p_action:action,p_input:input as Json,p_key:key}).abortSignal(signal);if(error)throw error;return data}
}}
