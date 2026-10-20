import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database,Json}from'../types/database.types'
import type{ImportPort}from'./syntheticImport'
export function syntheticImportRepository(client:SupabaseClient<Database>):ImportPort{return{
 async load(practice,location,batch,page,signal){const{data,error}=await client.rpc('doctor_import_preview',{p_practice:practice,p_location:location,p_batch:batch as string,p_page:page}).abortSignal(signal);if(error)throw error;return data},
 async command(practice,location,batch,version,action,input,key,signal){const{data,error}=await client.rpc('doctor_import_command',{p_practice:practice,p_location:location,p_batch:batch,p_version:version,p_action:action,p_input:input as Json,p_key:key}).abortSignal(signal);if(error)throw error;return data}
}}
