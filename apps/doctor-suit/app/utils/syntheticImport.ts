import{doctorScopeKey,type DoctorContextScope}from'./contextScope.ts'
export const importMappingVersion='patient-appointment-v1' as const
export interface SyntheticImportSource{mapping_version:typeof importMappingVersion;synthetic:true;rows:unknown[]}
export function parseSyntheticImport(value:string|Uint8Array):SyntheticImportSource{
 const text=typeof value==='string'?value:new TextDecoder('utf-8',{fatal:true}).decode(value)
 if(new TextEncoder().encode(text).length>262144||text.includes('\ufffd')||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text))throw Error('DOCTOR_IMPORT_ENCODING')
 const d=JSON.parse(text)
 const values:[unknown,number][]=[[d,0]];while(values.length){const[v,depth]=values.pop()!;if(depth>16)throw Error('DOCTOR_IMPORT_SOURCE');if(typeof v==='string'&&(v.includes('\ufffd')||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)))throw Error('DOCTOR_IMPORT_ENCODING');if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))values.push([k,depth+1],[x,depth+1])}
 if(!d||typeof d!=='object'||Object.keys(d).length!==3||d.mapping_version!==importMappingVersion||d.synthetic!==true||!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>500)throw Error('DOCTOR_IMPORT_SOURCE')
 return d
}
export function syntheticImportDemo():SyntheticImportSource{return{mapping_version:importMappingVersion,synthetic:true,rows:[{source_id:'P1',kind:'patient',patient_source_id:null,display_name:'Synthetic demonstration person',birth_date:'2000-01-01',phone:'',email:'',starts_at:null,state:null},{source_id:'A1',kind:'appointment',patient_source_id:'P1',display_name:null,birth_date:null,phone:'',email:'',starts_at:'2026-01-01T10:00:00Z',state:'cancelled'}]}}
export interface ImportBatch{id:string;version:number;cursor:number;expected_rows:number;state:'previewing'|'validated'|'review_required'|'discarded';source_ref:string;source_sha256:string;mapping_version:typeof importMappingVersion}
export interface ImportDirectory{practice_id:string;location_id:string;batches:{id:string;source_ref:string;state:string;version:number;created_at:string}[];batch:ImportBatch|null;page:number;total:number;valid:number;invalid:number;review:number;rows:{ordinal:number;source_id:string;kind:string;state:'valid'|'invalid'|'review';errors:string[]}[];can_write:boolean;canonical_write:false;real_import:false;data_mode:'synthetic'}
const states=['previewing','validated','review_required','discarded'],errors=['invalid_shape','invalid_source_id','synthetic_shape_required','synthetic_contact_required','invalid_date','invalid_reference_shape','invalid_state','invalid_kind','duplicate_source_id','unmatched_reference','duplicate_candidate']
export function importDirectory(raw:unknown,practice:string,location:string,batch:string|null,page:number):ImportDirectory{
 const d=raw as ImportDirectory
 if(!d||d.practice_id!==practice||d.location_id!==location||d.page!==page||d.canonical_write!==false||d.real_import!==false||d.data_mode!=='synthetic'||typeof d.can_write!=='boolean'||![d.total,d.valid,d.invalid,d.review].every(v=>Number.isSafeInteger(v)&&v>=0)||d.total!==d.valid+d.invalid+d.review||!Array.isArray(d.rows)||d.rows.length>20||d.rows.length>d.total||!Array.isArray(d.batches)||d.batches.length>100)throw Error('DOCTOR_IMPORT_PROTOCOL')
 if(batch===null?d.batch!==null:!d.batch||d.batch.id!==batch||!states.includes(d.batch.state)||d.batch.mapping_version!==importMappingVersion||!Number.isInteger(d.batch.version)||d.batch.version<1||d.batch.cursor!==d.total||d.batch.expected_rows<d.batch.cursor||d.batch.expected_rows>500||!/^[a-f0-9]{64}$/.test(d.batch.source_sha256))throw Error('DOCTOR_IMPORT_PROTOCOL')
 for(const r of d.rows)if(!r||Object.keys(r).some(k=>!['ordinal','source_id','kind','state','errors'].includes(k))||!Number.isInteger(r.ordinal)||r.ordinal<page*20+1||r.ordinal>(page+1)*20||typeof r.source_id!=='string'||typeof r.kind!=='string'||!['valid','invalid','review'].includes(r.state)||!Array.isArray(r.errors)||r.errors.some(v=>!errors.includes(v))||r.state==='valid'&&r.errors.length!==0||r.state!=='valid'&&r.errors.length===0)throw Error('DOCTOR_IMPORT_PROTOCOL')
 if(d.batch?.state==='validated'&&(d.invalid+d.review!==0||d.batch.cursor!==d.batch.expected_rows)||d.batch?.state==='review_required'&&(d.invalid+d.review===0||d.batch.cursor!==d.batch.expected_rows))throw Error('DOCTOR_IMPORT_PROTOCOL')
 if(new Set(d.rows.map(r=>r.ordinal)).size!==d.rows.length||d.batches.some(b=>typeof b.id!=='string'||typeof b.source_ref!=='string'||!states.includes(b.state)||!Number.isInteger(b.version)||b.version<1))throw Error('DOCTOR_IMPORT_PROTOCOL')
 return d
}
export type ImportAction='create'|'next'|'reconcile'|'discard'
export interface ImportPort{load:(practice:string,location:string,batch:string|null,page:number,signal:AbortSignal)=>Promise<unknown>;command:(practice:string,location:string,batch:string,version:number,action:ImportAction,input:Record<string,unknown>,key:string,signal:AbortSignal)=>Promise<unknown>}
export function importState(){return{directory:null as ImportDirectory|null,batchId:null as string|null,loading:false,pending:false,error:null as 'denied'|'conflict'|'invalid'|'uncertain'|null}}
export function createImportController(port:ImportPort|null,state:ReturnType<typeof importState>,scope:()=>DoctorContextScope|null,key=()=>crypto.randomUUID()){
 let revision=0,readRevision=0,abort=new AbortController(),intent:{fingerprint:string;key:string}|null=null
 const scopeKey=()=>{const s=scope();return s?doctorScopeKey(s,'synthetic-import'):null},valid=(rev:number,expected:string|null)=>rev===revision&&scopeKey()===expected
 function clear(){revision++;abort.abort();abort=new AbortController();intent=null;Object.assign(state,importState())}
 function select(batch:string|null){if(state.pending)return false;clear();state.batchId=batch;return true}
 const failure=(e:unknown)=>{const c=e&&typeof e==='object'&&'code'in e?String(e.code):'';return c==='42501'?'denied':c==='40001'?'conflict':c==='22023'?'invalid':'uncertain'}
 async function load(page=0){const read=++readRevision,s=scope(),batch=state.batchId,rev=revision,expected=scopeKey();state.directory=null;state.error=null;if(!s?.locationId||!port)return false;state.loading=true
 try{const result=await port.load(s.practiceId,s.locationId,batch,page,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]));if(!valid(rev,expected)||read!==readRevision)return false;state.directory=importDirectory(result,s.practiceId,s.locationId,batch,page);return true}catch(e){if(valid(rev,expected)&&read===readRevision){state.error=failure(e);if(state.error==='denied')state.batchId=null}return false}finally{if(valid(rev,expected)&&read===readRevision)state.loading=false}}
 async function command(batch:string,version:number,action:ImportAction,input:Record<string,unknown>){const s=scope(),rev=revision,expected=scopeKey();if(state.pending||!s?.locationId||!port||!state.directory?.can_write)return false
 const fingerprint=JSON.stringify([expected,batch,version,action,input]);if(intent?.fingerprint!==fingerprint)intent={fingerprint,key:key()};state.pending=true;state.error=null
 try{const result=await port.command(s.practiceId,s.locationId,batch,version,action,input,intent.key,AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]))as Record<string,unknown>;if(!valid(rev,expected))return false;if(result.id!==batch||result.version!==version+1||result.canonical_write!==false||result.real_import!==false||!states.includes(String(result.state)))throw Error('DOCTOR_IMPORT_PROTOCOL');intent=null;state.batchId=batch;await load();return true}catch(e){if(valid(rev,expected)){state.error=failure(e);if(state.error==='denied'){state.directory=null;state.batchId=null;intent=null}}return false}finally{if(valid(rev,expected))state.pending=false}}
 return{state,scopeKey,clear,select,load,command}
}
