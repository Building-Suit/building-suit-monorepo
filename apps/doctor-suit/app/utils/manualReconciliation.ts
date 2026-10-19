import type{DoctorIdentity}from'./authController'
import{doctorUuid}from'./locationContext.ts'
export const manualReportStatuses=['all','submitted','under_review','rejected','funds_verified','activated']as const
export type ManualReportStatus=typeof manualReportStatuses[number]
export interface ManualReportQuery{review:boolean;from:string|null;until:string|null;status:ManualReportStatus;page:number}
export interface ManualReportCurrency{currency:string;exponent:number;notices:number;claimed:string;pendingCount:number;pending:string;rejectedCount:number;rejected:string;verifiedCount:number;verified:string;activatedCount:number;activated:string;awaitingCount:number;awaiting:string;attention:number;discrepancies:number}
export interface ManualReportItem{id:string;subscriberId:string;intentId:string;quoteId:string;termsId:string;createdAt:string;status:Exclude<ManualReportStatus,'all'>;revision:number;amount:string;currency:string;exponent:number;attention:boolean;discrepancy:boolean;fundsId:string|null;received:string|null;receivedCurrency:string|null;receivedAt:string|null;verifiedAt:string|null;fundsBound:boolean;periodId:string|null;startedAt:string|null;endsAt:string|null;periodBound:boolean}
export interface ManualReport{observedAt:string;query:ManualReportQuery;total:number;currencies:ManualReportCurrency[];items:ManualReportItem[]}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const count=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0
const money=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,37})$/.test(v)
const individualMoney=(v:unknown):v is string=>money(v)&&BigInt(v)>0n&&BigInt(v)<=9000000000000000n
const currency=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z]{3}$/.test(v)
const time=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
function invalid():never{throw Error('DOCTOR_MANUAL_RECONCILIATION_CONTRACT_INVALID')}
export function manualReportQuery(q:ManualReportQuery){if(typeof q.review!=='boolean'||!count(q.page)||q.page<1||q.page>1000000||!manualReportStatuses.includes(q.status)||q.from!==null&&!time(q.from)||q.until!==null&&!time(q.until)||q.from&&q.until&&Date.parse(q.from)>=Date.parse(q.until))invalid();return q}
export function manualReportWindow(from:string,to:string):{from:string|null;until:string|null}{
 function day(v:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))invalid();const d=new Date(`${v}T00:00:00.000Z`);if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==v||v<'0001-01-01')invalid();return d}
 const start=from?day(from).toISOString():null,end=to?new Date(+day(to)+86400000).toISOString():null
 if(end&&end.length!==24||start&&end&&start>=end)invalid();return{from:start,until:end}
}
export function manualReportAmount(minor:string,exponent:number,currencyCode:string){if(!money(minor)||!count(exponent)||exponent>4||!currency(currencyCode))invalid();const padded=minor.padStart(exponent+1,'0');return`${exponent?`${padded.slice(0,-exponent)}.${padded.slice(-exponent)}`:padded} ${currencyCode}`}
export function decodeManualReport(v:unknown,actor:DoctorIdentity,query:ManualReportQuery):ManualReport{
 manualReportQuery(query)
 if(!record(v)||v.actor_user_id!==actor.userId||v.review_queue!==query.review||v.scope!=='saas_manual_only'||v.data_mode!=='synthetic'||v.totals_scope!=='filtered_full_population'||v.date_basis!=='notice_created_at'||!time(v.observed_at)||v.status!==query.status||v.page!==query.page||v.page_size!==25||!count(v.total)||v.live_activation!==false||v.patient_revenue_included!==false||v.invoices_available!==false||v.settlement_available!==false||v.independent_financial_review!=='pending'||!Array.isArray(v.currencies)||!Array.isArray(v.items))invalid()
 for(const[k,expected]of[['from',query.from],['until',query.until]]as const)if(expected===null?v[k]!==null:!time(v[k])||Date.parse(v[k])!==Date.parse(expected))invalid()
 const currencies=v.currencies.map(c=>{
  if(!record(c)||!currency(c.currency)||!count(c.currency_exponent)||c.currency_exponent>4||!count(c.notices)||c.notices<1)invalid()
  for(const k of['pending_count','rejected_count','verified_count','activated_count','awaiting_activation_count','attention_count','discrepancy_count'])if(!count(c[k])||c[k]>c.notices)invalid()
  for(const k of['claimed_minor','pending_minor','rejected_minor','verified_minor','activated_minor','awaiting_activation_minor'])if(!money(c[k]))invalid()
  const row={currency:c.currency,exponent:c.currency_exponent,notices:c.notices,claimed:c.claimed_minor as string,pendingCount:c.pending_count as number,pending:c.pending_minor as string,rejectedCount:c.rejected_count as number,rejected:c.rejected_minor as string,verifiedCount:c.verified_count as number,verified:c.verified_minor as string,activatedCount:c.activated_count as number,activated:c.activated_minor as string,awaitingCount:c.awaiting_activation_count as number,awaiting:c.awaiting_activation_minor as string,attention:c.attention_count as number,discrepancies:c.discrepancy_count as number}
  if(row.verifiedCount!==row.activatedCount+row.awaitingCount||BigInt(row.verified)!==BigInt(row.activated)+BigInt(row.awaiting)||!row.discrepancies&&(row.notices!==row.pendingCount+row.rejectedCount+row.verifiedCount||BigInt(row.claimed)!==BigInt(row.pending)+BigInt(row.rejected)+BigInt(row.verified)))invalid()
  return row
 })
 if(new Set(currencies.map(c=>`${c.currency}:${c.exponent}`)).size!==currencies.length||currencies.reduce((n,c)=>n+c.notices,0)!==v.total)invalid()
 const items=v.items.map(n=>{
  if(!record(n)||!doctorUuid(n.id)||!doctorUuid(n.subscriber_user_id)||!query.review&&n.subscriber_user_id!==actor.userId||!doctorUuid(n.intent_id)||!doctorUuid(n.quote_id)||!doctorUuid(n.terms_id)||!time(n.created_at)||!manualReportStatuses.slice(1).includes(n.status as never)||query.status!=='all'&&n.status!==query.status||!count(n.revision)||!individualMoney(n.amount_minor)||!currency(n.currency)||!count(n.currency_exponent)||n.currency_exponent>4)invalid()
  for(const k of['requires_attention','discrepancy','funds_bound','period_bound'])if(typeof n[k]!=='boolean')invalid()
  for(const k of['funds_id','period_id'])if(n[k]!==null&&!doctorUuid(n[k]))invalid()
  for(const k of['received_at','verified_at','period_started_at','period_ends_at'])if(n[k]!==null&&!time(n[k]))invalid()
  if(n.received_minor!==null&&!individualMoney(n.received_minor)||n.received_currency!==null&&!currency(n.received_currency)||n.funds_bound&&(!n.funds_id||n.received_minor!==n.amount_minor||n.received_currency!==n.currency||!n.received_at||!n.verified_at)||n.period_bound&&(!n.funds_bound||!n.period_id||!time(n.period_started_at)||!time(n.period_ends_at)||Date.parse(n.period_started_at)>=Date.parse(n.period_ends_at)))invalid()
  if((n.funds_id===null)!==(n.received_minor===null&&n.received_currency===null&&n.received_at===null&&n.verified_at===null)||(n.period_id===null)!==(n.period_started_at===null&&n.period_ends_at===null))invalid()
  if(!currencies.some(c=>c.currency===n.currency&&c.exponent===n.currency_exponent)||query.from&&Date.parse(n.created_at)<Date.parse(query.from)||query.until&&Date.parse(n.created_at)>=Date.parse(query.until))invalid()
  return{id:n.id,subscriberId:n.subscriber_user_id,intentId:n.intent_id,quoteId:n.quote_id,termsId:n.terms_id,createdAt:n.created_at,status:n.status as ManualReportItem['status'],revision:n.revision,amount:n.amount_minor,currency:n.currency,exponent:n.currency_exponent,attention:n.requires_attention as boolean,discrepancy:n.discrepancy as boolean,fundsId:n.funds_id as string|null,received:n.received_minor as string|null,receivedCurrency:n.received_currency as string|null,receivedAt:n.received_at as string|null,verifiedAt:n.verified_at as string|null,fundsBound:n.funds_bound as boolean,periodId:n.period_id as string|null,startedAt:n.period_started_at as string|null,endsAt:n.period_ends_at as string|null,periodBound:n.period_bound as boolean}
 })
 if(items.length!==Math.min(25,Math.max(0,v.total-(query.page-1)*25))||new Set(items.map(n=>n.id)).size!==items.length)invalid()
 return{observedAt:v.observed_at,query:{...query},total:v.total,currencies,items}
}
