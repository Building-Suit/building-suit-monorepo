import { doctorUuid } from './locationContext.ts'
import { financialReportQuery,financialSourceRef,type FinancialReportQuery,type FinancialSourceRef } from './practiceFinancialReport.ts'
export interface FinancialReportLocation { locationId:string|null;query:FinancialReportQuery;source:FinancialSourceRef|null }
const scalar=(v:unknown):string|undefined=>typeof v==='string'?v:undefined
function invalid():never{throw Error('DOCTOR_FINANCIAL_REPORT_INVALID')}
function date(v:unknown):string|null{if(v===undefined||v==='')return null;const s=scalar(v);if(!s||!/^\d{4}-\d\d-\d\d$/.test(s))invalid();const d=new Date(s+'T00:00:00.000Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)invalid();return d.toISOString()}
export function financialReportLocation(raw:Record<string,unknown>):FinancialReportLocation{
 const location=raw.location===undefined||raw.location===''?null:raw.location;if(location!==null&&!doctorUuid(location))invalid()
 const group=raw.group===undefined||raw.group===''?null:scalar(raw.group);if(group!==null&&(!group||! /^[A-Z]{3}:[0-4]$/.test(group)))invalid()
 const page=raw.page===undefined?'1':scalar(raw.page);if(!page||! /^[1-9][0-9]{0,6}$/.test(page))invalid()
 const query=financialReportQuery({from:date(raw.from),until:date(raw.until),status:(raw.status??'all') as FinancialReportQuery['status'],metric:(raw.metric??'charges') as FinancialReportQuery['metric'],currency:group?.slice(0,3)??null,exponent:group?Number(group.slice(4)):null,page:Number(page)})
 let source:FinancialSourceRef|null=null
 if(raw.source!==undefined||raw.kind!==undefined||raw.revision!==undefined){const revision=raw.revision===undefined?null:scalar(raw.revision);if(revision!==null&&(!revision||! /^[1-9][0-9]{0,9}$/.test(revision)))invalid();source=financialSourceRef({id:raw.source as string,kind:raw.kind as FinancialSourceRef['kind'],revision:revision===null?null:Number(revision)})}
 return{locationId:location as string|null,query,source}
}
export function financialReportHref(value:FinancialReportLocation):string{
 const q=financialReportQuery(value.query),p=new URLSearchParams()
 if(value.locationId!==null){if(!doctorUuid(value.locationId))invalid();p.set('location',value.locationId)}
 if(q.from){if(!q.from.endsWith('T00:00:00.000Z'))invalid();p.set('from',q.from.slice(0,10))}if(q.until){if(!q.until.endsWith('T00:00:00.000Z'))invalid();p.set('until',q.until.slice(0,10))}
 p.set('status',q.status);p.set('metric',q.metric);if(q.currency)p.set('group',`${q.currency}:${q.exponent}`);p.set('page',String(q.page))
 if(value.source){const r=financialSourceRef(value.source);p.set('kind',r.kind);p.set('source',r.id);if(r.revision!==null)p.set('revision',String(r.revision))}
 return '/financial-reports?'+p.toString()
}
/** Only validated read-only keys survive an authentication return; no private payload or write command. */
export function financialReadReturn(url:URL):string|null{
 try{
  const raw:Record<string,unknown>={};for(const key of new Set(url.searchParams.keys())){const all=url.searchParams.getAll(key);if(all.length!==1)return null;raw[key]=all[0]}
  if(url.pathname==='/financial-reports')return financialReportHref(financialReportLocation(raw))
  if(url.pathname==='/practice-billing')return '/practice-billing'
  if(url.pathname==='/practice-payments'&&doctorUuid(raw.location)&&doctorUuid(raw.charge)){const p=new URLSearchParams({location:String(raw.location),charge:String(raw.charge)});return '/practice-payments?'+p.toString()}
  return null
 }catch{return null}
}
