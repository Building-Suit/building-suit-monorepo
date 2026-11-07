import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database}from'../types/database.types'
import type{ReportQuery}from'./operationalReports'
export function operationalReportsRepository(client:SupabaseClient<Database>){return async(practice:string,location:string,q:ReportQuery,signal:AbortSignal)=>{const{data,error}=await client.rpc('doctor_operational_report',{p_practice:practice,p_location:location,p_from:q.from,p_to:q.to,p_kind:q.kind,p_page:q.page}).abortSignal(signal);if(error)throw error;return data}}
