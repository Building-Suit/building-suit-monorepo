import {doctorScopeKey,type DoctorContextScope} from './contextScope.ts'
export const messageStates=['queued','claimed','sent','delivered','failed','unknown'] as const
export interface MessageStatus{id:string;patient_id:string;state:typeof messageStates[number];version:number;attempts:number;blocker:string|null;purpose:string;recipient_kind:string;template:string;expires_at:string;created_at:string;data_mode:'synthetic';external_delivery:false}
const keys=['id','patient_id','state','version','attempts','blocker','purpose','recipient_kind','template','expires_at','created_at','data_mode','external_delivery']
export function messageDirectory(raw:unknown,patient:string,page:number):{rows:MessageStatus[];total:number;page:number}{
 if(!raw||typeof raw!=='object')throw Error('DOCTOR_OUTBOX_PROTOCOL')
 const d=raw as Record<string,unknown>
 if(d.external_delivery!==false||d.data_mode!=='synthetic'||d.page!==page||!Number.isSafeInteger(d.total)||Number(d.total)<0||!Array.isArray(d.rows)||d.rows.length>20)throw Error('DOCTOR_OUTBOX_PROTOCOL')
 const rows=d.rows as MessageStatus[]
 for(const r of rows)if(!r||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||r.patient_id!==patient||!messageStates.includes(r.state)||r.external_delivery!==false||r.data_mode!=='synthetic'||!Number.isInteger(r.version)||r.version<1||!Number.isInteger(r.attempts)||r.attempts<0||r.attempts>3||!['patient','guardian'].includes(r.recipient_kind)||!['appointment_reminder','administrative_follow_up','marketing'].includes(r.purpose)||r.template!==r.purpose+'_v1'||typeof r.id!=='string'||!Number.isFinite(Date.parse(r.created_at))||!Number.isFinite(Date.parse(r.expires_at))||(r.blocker!==null&&!['consent_unavailable','guardian_unavailable','contact_unavailable','patient_archived','clinic_archived','edition_disabled','expired','retry_exhausted','transport_rejected','transport_timeout','lease_expired','acceptance_unknown'].includes(r.blocker)))throw Error('DOCTOR_OUTBOX_PROTOCOL')
 if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.length>Number(d.total))throw Error('DOCTOR_OUTBOX_PROTOCOL')
 return{rows,total:Number(d.total),page}
}
export function messageOutboxState(){return{loading:false,error:null as 'denied'|'unavailable'|null,directory:null as ReturnType<typeof messageDirectory>|null}}
export function createMessageOutboxReader(load:((practice:string,location:string,patient:string,page:number,signal:AbortSignal)=>Promise<unknown>)|null,state:ReturnType<typeof messageOutboxState>,scope:()=>DoctorContextScope|null){
 let revision=0,abort=new AbortController()
 const scopeKey=()=>{const s=scope();return s?doctorScopeKey(s,'message-outbox'):null}
 function clear(){revision++;abort.abort();abort=new AbortController();Object.assign(state,messageOutboxState())}
 async function read(patient:string,page=0){clear();const rev=revision,key=scopeKey(),s=scope();if(!s?.locationId||!load){state.error='denied';return false}state.loading=true
  try{const result=await load(s.practiceId,s.locationId,patient,page,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]));if(rev!==revision||key!==scopeKey())return false;state.directory=messageDirectory(result,patient,page);return true}
  catch(e){if(rev===revision&&key===scopeKey()){state.directory=null;state.error=e&&typeof e==='object'&&'code'in e&&e.code==='42501'?'denied':'unavailable'}return false}
  finally{if(rev===revision&&key===scopeKey())state.loading=false}
 }
 return{state,scopeKey,clear,read}
}
