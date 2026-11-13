import { doctorLocationDirectory } from './locations.ts'
import { financialReport,financialReportQuery,financialSource,financialSourceRef,type FinancialReportScope,type FinancialReportQuery,type FinancialSourceRef } from './practiceFinancialReport.ts'
/** Feature-owned bounded interface; this does not replace CI-generated database types. */
export interface FinancialReportClient { rpc(name:'doctor_practice_financial_report'|'doctor_practice_financial_source'|'doctor_locations',args:Record<string,unknown>):{abortSignal(signal:AbortSignal):PromiseLike<{data:unknown;error:unknown}>} }
export function practiceFinancialReportRepository(client:FinancialReportClient){
 async function rpc(name:Parameters<FinancialReportClient['rpc']>[0],args:Record<string,unknown>,signal:AbortSignal){const r=await client.rpc(name,args).abortSignal(signal);if(r.error)throw r.error;return r.data}
 return{
  async locations(practiceId:string,page:number,signal:AbortSignal){if(!Number.isSafeInteger(page)||page<1||page>1000000)throw Error('DOCTOR_FINANCIAL_REPORT_INVALID');const result=doctorLocationDirectory(await rpc('doctor_locations',{p_practice:practiceId,p_page:page-1,p_size:25,p_search:''},signal),practiceId);if(result.rows.length!==Math.min(25,Math.max(0,result.total-(page-1)*25)))throw Error('DOCTOR_FINANCIAL_REPORT_INVALID');return result},
  async read(scope:FinancialReportScope,query:FinancialReportQuery,signal:AbortSignal){const s=Object.freeze({...scope}),q=Object.freeze(financialReportQuery(query));return financialReport(await rpc('doctor_practice_financial_report',{p_practice:s.practiceId,p_location:s.locationId,p_from:q.from,p_until:q.until,p_status:q.status,p_metric:q.metric,p_currency:q.currency,p_exponent:q.exponent,p_page:q.page},signal),s,q)},
  async source(scope:FinancialReportScope,source:FinancialSourceRef,signal:AbortSignal){const s=Object.freeze({...scope}),ref=Object.freeze(financialSourceRef(source));return financialSource(await rpc('doctor_practice_financial_source',{p_practice:s.practiceId,p_location:s.locationId,p_kind:ref.kind,p_source:ref.id,p_revision:ref.revision},signal),s,ref)},
 }
}
export type PracticeFinancialReportRepository=ReturnType<typeof practiceFinancialReportRepository>
