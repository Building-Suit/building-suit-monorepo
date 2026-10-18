import type{SupabaseClient}from'@supabase/supabase-js'
import type{Database}from'../types/database.types'
import type{DoctorIdentity}from'./authController'
import{decodeManualReport,manualReportQuery,type ManualReportQuery}from'./manualReconciliation.ts'
export function doctorManualReportRepository(client:Pick<SupabaseClient<Database>,'rpc'>){return{
 async read(actor:DoctorIdentity,query:ManualReportQuery,signal:AbortSignal){
  manualReportQuery(query)
  // PostgreSQL accepts nullable timestamp bounds; Meta omits argument nullability.
  const args={p_review_queue:query.review,p_from:query.from,p_until:query.until,p_status:query.status,p_page:query.page}
  const{data,error}=await client.rpc('doctor_manual_payment_reconciliation',args as unknown as Database['public']['Functions']['doctor_manual_payment_reconciliation']['Args']).abortSignal(signal)
  if(error)throw error;return decodeManualReport(data,actor,query)
 },
}}
