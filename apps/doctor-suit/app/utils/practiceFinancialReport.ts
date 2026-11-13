import { doctorUuid } from './locationContext.ts'
import { practiceMoneyMinor } from './practiceMoney.ts'
import { servicePrice, visitCharge } from './practiceBilling.ts'
export const reportMetrics = ['charges','collections','refunds','outstanding','credit','reserved_collections','reserved_refunds','unknown','discrepancies'] as const
export type ReportMetric = typeof reportMetrics[number]
export type ReportStatus = 'all' | 'outstanding' | 'covered' | 'attention'
export interface FinancialReportScope { userId: string; practiceId: string; locationId: string | null }
export interface FinancialReportQuery { from: string | null; until: string | null; status: ReportStatus; metric: ReportMetric; currency: string | null; exponent: number | null; page: number }
export interface FinancialSourceRef { kind: 'charge' | 'ledger' | 'intent_event'; id: string; revision: number | null }
export interface FinancialContribution extends FinancialSourceRef { metric: ReportMetric; unit: 'minor' | 'count'; locationId: string; chargeId: string; chargeVersionId: string; currency: string; exponent: number; contribution: string; sourceAt: string; issuedAt: string; label: string; state: string; reason: string | null }
export interface FinancialGroup { currency: string; exponent: number; values: Record<ReportMetric,string> }
export interface FinancialReport { observedAt: string; totals: FinancialGroup[]; items: FinancialContribution[]; total: number; query: FinancialReportQuery }
export interface FinancialSource extends FinancialSourceRef { locationId: string; patientName: string; clinicName: string; timezone: string; label: string; amountMinor: string; currency: string; exponent: number; recordedAt: string; state: string; reason: string; receipt: string | null; originalReceipt: string | null; chargeVersionId: string; currentRevision: number | null }
const object = (v: unknown): v is Record<string,unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
function invalid(): never { throw Error('DOCTOR_FINANCIAL_REPORT_INVALID') }
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
function text(v: unknown, max = 500): string { if(typeof v !== 'string' || !v.length || v.length > max || [...v].some(c => c.charCodeAt(0)<32 || c.charCodeAt(0)===127 || c==='<' || c==='>')) invalid(); return v }
function uuid(v: unknown): string { if(!doctorUuid(v)) invalid(); return v as string }
export function reportInstant(v: unknown): string { if(typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) invalid(); return new Date(v).toISOString() }
function money(v: unknown): string { return practiceMoneyMinor(v,false) }
function currency(c: unknown,e: unknown): {currency:string;exponent:number} { if(typeof c !== 'string'||! /^[A-Z]{3}$/.test(c)||!integer(e,0,4))invalid();return{currency:c,exponent:e} }
function flags(v: Record<string,unknown>) { if(v.data_mode!=='synthetic'||v.external_transport_enabled!==false||v.live_collection!==false||v.tax_invoice_available!==false||v.tax_applicability!=='unreviewed'||v.provider_payout!=='unavailable'||v.saas_ledger_included!==false)invalid() }
function ownership(v:Record<string,unknown>,s:FinancialReportScope) { uuid(s.userId);uuid(s.practiceId);if(s.locationId!==null)uuid(s.locationId);if(v.actor_user_id!==s.userId||v.practice_id!==s.practiceId)invalid();flags(v) }
export function financialReportQuery(v: FinancialReportQuery): FinancialReportQuery {
 if(!v || !['all','outstanding','covered','attention'].includes(v.status)||!reportMetrics.includes(v.metric)||!integer(v.page,1,1000000)||(v.currency===null)!==(v.exponent===null))invalid()
 if(v.currency!==null)currency(v.currency,v.exponent)
 const from=v.from===null?null:reportInstant(v.from),until=v.until===null?null:reportInstant(v.until)
 if(from&&until&&Date.parse(from)>=Date.parse(until))invalid()
 return {from,until,status:v.status,metric:v.metric,currency:v.currency,exponent:v.exponent,page:v.page}
}
export function financialSourceRef(v: FinancialSourceRef): FinancialSourceRef { if(!v||!['charge','ledger','intent_event'].includes(v.kind)||!doctorUuid(v.id)||(v.kind==='ledger'?v.revision!==null:!integer(v.revision,1,2147483647)))invalid();return{kind:v.kind,id:v.id,revision:v.revision} }
const keys:Record<ReportMetric,string>={charges:'charges_minor',collections:'collections_minor',refunds:'refunds_minor',outstanding:'outstanding_minor',credit:'credit_minor',reserved_collections:'reserved_collection_minor',reserved_refunds:'reserved_refund_minor',unknown:'unknown_count',discrepancies:'discrepancy_count'}
const reasons=['charge_history_gap','posted_receipt_missing','allocation_missing_or_changed','unaccepted_posted_entry','ledger_status_mismatch','source_currency_mismatch','allocated_balance_outside_charge']
export function financialReport(value: unknown,scope: FinancialReportScope,requested: FinancialReportQuery): FinancialReport {
 const q=financialReportQuery(requested);if(!object(value))invalid();const v=value;ownership(v,scope)
 if(v.location_id!==scope.locationId||v.page!==q.page||v.status!==q.status||v.metric!==q.metric||v.source_currency!==q.currency||v.source_exponent!==q.exponent
 ||(v.from===null?null:reportInstant(v.from))!==q.from||(v.until===null?null:reportInstant(v.until))!==q.until||v.date_basis!=='first_charge_issue_utc_inclusive_start_exclusive_end'||v.balance_basis!=='current_latest_charge_with_full_linked_history'
 ||!integer(v.total)||!Array.isArray(v.items)||v.items.length!==Math.min(25,Math.max(0,v.total-(q.page-1)*25))||!Array.isArray(v.totals))invalid()
 const totals:FinancialGroup[]=v.totals.map(g=>{if(!object(g))invalid();return{...currency(g.currency,g.currency_exponent),values:Object.fromEntries(reportMetrics.map(k=>[k,money(g[keys[k]])])) as Record<ReportMetric,string>}})
 if(new Set(totals.map(g=>g.currency+g.exponent)).size!==totals.length)invalid()
 for(const g of totals){const n=g.values;if(n.discrepancies==='0'&&BigInt(n.charges)+BigInt(n.credit)!==BigInt(n.collections)-BigInt(n.refunds)+BigInt(n.outstanding))invalid()}
 const items:FinancialContribution[]=v.items.map(raw=>{
  if(!object(raw))invalid();const r=raw,ref=financialSourceRef({kind:r.source_kind as FinancialSourceRef['kind'],id:r.source_id as string,revision:r.source_revision as number|null}),c=currency(r.currency,r.currency_exponent)
  if(r.metric!==q.metric||r.unit!==(q.metric==='unknown'||q.metric==='discrepancies'?'count':'minor')||(scope.locationId!==null&&r.location_id!==scope.locationId)||(q.currency!==null&&(c.currency!==q.currency||c.exponent!==q.exponent))||!totals.some(g=>g.currency===c.currency&&g.exponent===c.exponent))invalid()
  if(['charges','outstanding','credit'].includes(q.metric)?ref.kind!=='charge': ['collections','refunds'].includes(q.metric)?ref.kind!=='ledger':['reserved_collections','reserved_refunds','unknown'].includes(q.metric)?ref.kind!=='intent_event':false)invalid()
  const contribution=money(r.contribution),issuedAt=reportInstant(r.cohort_issued_at),state=text(r.state,32)
  if((q.metric==='unknown'||q.metric==='discrepancies')&&contribution!=='1'||(q.metric!=='charges'&&contribution==='0')||(q.from&&issuedAt<q.from)||(q.until&&issuedAt>=q.until))invalid()
  if(q.metric==='discrepancies'?!reasons.includes(String(r.reason_code))||state!=='attention':r.reason_code!==null&&!['prepared','attempt_reconciliation_required'].includes(String(r.reason_code)))invalid()
  if(!['discrepancy','covered','uncollected','partial','posted','pending','unknown','attention'].includes(state))invalid()
  return{...ref,...c,metric:q.metric,unit:r.unit as 'minor'|'count',locationId:uuid(r.location_id),chargeId:uuid(r.charge_id),chargeVersionId:uuid(r.charge_version_id),contribution,sourceAt:reportInstant(r.source_at),issuedAt,label:text(r.source_label,160),state,reason:r.reason_code as string|null}
 })
 if(new Set(items.map(r=>[r.kind,r.id,r.revision,r.reason].join('/'))).size!==items.length)invalid()
 // A page may be a strict subset, but it must never exceed its full-population metric total.
 for(const g of totals){const sum=items.filter(r=>r.currency===g.currency&&r.exponent===g.exponent).reduce((a,r)=>a+BigInt(r.contribution),0n);if(sum>BigInt(g.values[q.metric]))invalid()}
 return{observedAt:reportInstant(v.observed_at),totals,items,total:v.total,query:q}
}
function receipt(v:unknown):string { const r=text(v,20);if(!/^SYN-[0-9]{8,16}$/.test(r))invalid();return r }
export function financialSource(value: unknown,scope: FinancialReportScope,requested:FinancialSourceRef):FinancialSource {
 const ref=financialSourceRef(requested);if(!object(value))invalid();const v=value;ownership(v,scope)
 if(v.requested_location_id!==scope.locationId||v.kind!==ref.kind||v.source_id!==ref.id||v.source_revision!==ref.revision||!object(v.record)||!object(v.details))invalid()
 const locationId=uuid(v.location_id);if(scope.locationId!==null&&scope.locationId!==locationId)invalid();const patientId=uuid(v.patient_id),r=v.record,d=v.details
 const common={...ref,locationId,patientName:text(v.patient_name,200),clinicName:text(v.clinic_name,200),timezone:text(v.timezone,100)}
 try{new Intl.DateTimeFormat('en',{timeZone:common.timezone})}catch{invalid()}
 if(ref.kind==='charge'){
  const s={...scope,locationId},p=servicePrice(d.price,s),c=visitCharge(r,s,{price:p,visitId:uuid(r.visit_id),patientId})
  if(c.id!==ref.id||c.revision!==ref.revision)invalid()
  return{...common,label:c.label,amountMinor:c.amountMinor,currency:c.currency,exponent:c.exponent,recordedAt:c.createdAt,state:'charge_snapshot',reason:c.reason,receipt:null,originalReceipt:null,chargeVersionId:c.id,currentRevision:null}
 }
 if(!object(d.intent))invalid();const i=d.intent,c=currency(i.currency,i.currency_exponent)
 if(!doctorUuid(i.id)||i.practice_id!==scope.practiceId||i.location_id!==locationId||i.patient_id!==patientId||i.doctor_user_id!==scope.userId||!['collection','refund'].includes(String(i.kind))||(i.kind==='collection'?i.original_entry_id!==null:!doctorUuid(i.original_entry_id)))invalid()
 const amount=practiceMoneyMinor(i.amount_minor);if(amount==='0')invalid()
 const base={...common,...c,label:i.kind as string,amountMinor:amount,chargeVersionId:uuid(i.charge_version_id),reason:text(i.reason),originalReceipt:d.original_receipt_label===null||d.original_receipt_label===undefined?null:receipt(d.original_receipt_label)}
 if(ref.kind==='ledger'){
  const n=practiceMoneyMinor(r.receipt_number)
  if(r.id!==ref.id||r.intent_id!==i.id||r.practice_id!==scope.practiceId||r.location_id!==locationId||r.patient_id!==patientId||r.kind!==i.kind||r.original_entry_id!==i.original_entry_id||r.amount_minor!==amount||r.currency!==c.currency||r.currency_exponent!==c.exponent||n==='0'||r.receipt_label!=='SYN-'+n.padStart(8,'0'))invalid()
  // Missing/changed allocations remain visible as discrepancies in the report; never fabricate one here.
  return{...base,recordedAt:reportInstant(r.created_at),state:'posted',receipt:receipt(r.receipt_label),currentRevision:null}
 }
 if(i.id!==ref.id||r.intent_id!==ref.id||r.revision!==ref.revision||!integer(d.current_event_revision,ref.revision!)||!['pending','unknown','failed','posted'].includes(String(r.state)))invalid()
 const valid:Record<string,string[]>={pending:['prepared'],unknown:['attempt_reconciliation_required'],posted:['synthetic_accepted'],failed:['synthetic_rejected','cancelled_before_attempt']}
 if(!valid[String(r.state)]?.includes(String(r.reason_code))||(r.state==='pending'?r.revision!==1:r.state==='unknown'?r.revision!==2:r.reason_code==='cancelled_before_attempt'?r.revision!==2:r.revision!==3))invalid()
 return{...base,recordedAt:reportInstant(r.created_at),state:r.state as string,reason:text(r.reason_code),receipt:null,currentRevision:d.current_event_revision as number}
}
