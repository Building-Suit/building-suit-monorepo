/** Synthetic entered-data contracts. Validation never recommends treatment. */
export type ClinicalStatus = 'draft' | 'in_progress' | 'finalized' | 'amended' | 'withdrawn'
export type ClinicalAction = 'create' | 'save' | 'start' | 'finalize' | 'amend' | 'withdraw' | 'release' | 'revoke_release'
export interface ClinicalObservation { id:string;kind:'history'|'allergy'|'observation';knowledge:'missing'|'unknown'|'none_reported'|'reported';text:string;value:string;unit:string;source:'patient'|'staff'|'clinician' }
export interface ClinicalSegment { kind:'interval'|'weekdays'|'as_needed';start_date:string;end_date:string;timezone:string;interval_minutes:number|null;weekdays:number[];times:string[];instructions:string }
export interface ClinicalPrescription { id:string;medicine:{identity:string;label:string;provenance:'synthetic_manual';source_version:'manual-synthetic-v1';strength:string;form:string};dose:{amount:string;unit:string;route:string};start_date:string;end_date:string;segments:ClinicalSegment[];instructions:string }
export interface ClinicalOrder { id:string;kind:'follow_up'|'lab'|'imaging'|'referral';request:string;due_at:string|null;state:'requested'|'tracking'|'cancelled';reason:string }
export interface ClinicalResult { id:string;order_id:string;document_version_id:string|null;stage:'requested'|'uploaded'|'received'|'reviewed'|'released';annotation:string }
export interface ClinicalSnapshot { intake:ClinicalObservation[];note:{template_id:'synthetic-neutral';template_version:1;sections:{key:'entered_note'|'review_notes';text:string}[]};prescriptions:ClinicalPrescription[];orders:ClinicalOrder[];results:ClinicalResult[] }
export interface ClinicalRow { id:string;patient_id:string;patient_name:string;status:ClinicalStatus;version:number;updated_at:string;location_name:string;timezone:string }
export interface ClinicalDirectory { available:boolean;data_mode:'synthetic';clinical_approval:false;live_prescribing:false;rows:ClinicalRow[];patients:{id:string;name:string}[];total:number;capabilities:string[] }
export interface ClinicalVersion { id:string;revision:number;kind:ClinicalStatus;source_version_id:string|null;snapshot:ClinicalSnapshot;canonical_snapshot:string;snapshot_sha256:string;reason:string|null;actor_user_id:string;happened_at:string;version_status:'active'|'superseded'|'withdrawn'|'draft';synthetic_attestation:true;professional_signature:false }
export interface ClinicalDetail { encounter:{id:string;practice_id:string;patient_id:string;location_id:string;responsible_doctor:string;location_name:string;timezone:string;status:ClinicalStatus;version:number;active_version_id:string|null;created_by:string;created_at:string;updated_at:string;data_mode:'synthetic'};versions:ClinicalVersion[];versions_total:number;events:{id:number;version_id:string;action:string;actor_user_id:string;happened_at:string}[];events_total:number;releases:{id:string;version_id:string;recipient_user_id:string;released_at:string;expires_at:string;unavailable:boolean}[];recipients:{id:string;name:string}[];recipients_total?:number;recipient_limit?:number;data_mode:'synthetic';clinical_approval:false;live_prescribing:false }
export interface ClinicalCommandResult { encounter_id:string;version:number;version_id:string;status:ClinicalStatus;release_id:string|null;data_mode:'synthetic';clinical_approval:false;live_prescribing:false }
export interface ClinicalReleased {release_id:string;version_id:string;revision:number;snapshot_sha256:string;responsible_doctor:string;patient_id:string;location_name:string;timezone:string;finalized_at:string;expires_at:string;prescriptions:ClinicalPrescription[];results:ClinicalResult[];orders:ClinicalOrder[];documents:{id:string;filename:string;mime:string;size:number;sha256:string}[];doctor_name:string;patient_name:string;data_mode:'synthetic';clinical_approval:false;professional_signature:false;live_prescribing:false}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const statuses = ['draft','in_progress','finalized','amended','withdrawn']
export const clinicalUuid = (value:unknown):value is string => typeof value==='string' && uuid.test(value)
export const clinicalObject = (value:unknown):value is Record<string,unknown> => Boolean(value) && typeof value==='object' && !Array.isArray(value)
const text = (value:unknown,max:number,empty=false):value is string => typeof value==='string' && value.length<=max && (empty || Boolean(value.trim())) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
const shape = (value:unknown,keys:string[]):value is Record<string,unknown> => clinicalObject(value) && Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key))
const date = (value:unknown):value is string => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value
const instant = (value:unknown):value is string => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const list = (value:unknown,max=100):value is Record<string,unknown>[] => Array.isArray(value) && value.length<=max && value.every(clinicalObject) && value.every(item=>clinicalUuid(item.id)) && new Set(value.map(item=>item.id)).size===value.length
function timezone(value:unknown) { if(typeof value!=='string')return false;try {new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false} }
export function emptyClinicalSnapshot():ClinicalSnapshot {return {intake:[],note:{template_id:'synthetic-neutral',template_version:1,sections:[{key:'entered_note',text:''},{key:'review_notes',text:''}]},prescriptions:[],orders:[],results:[]}}
export function validClinicalSegments(value:unknown,start:unknown,end:unknown):value is ClinicalSegment[] {
 if(!date(start)||!date(end)||end<start||!Array.isArray(value)||value.length<1||value.length>16)return false
 for(const segment of value){
  if(!shape(segment,['kind','start_date','end_date','timezone','interval_minutes','weekdays','times','instructions']) || !['interval','weekdays','as_needed'].includes(String(segment.kind)) || !date(segment.start_date)||!date(segment.end_date)||segment.end_date<segment.start_date||segment.start_date<start||segment.end_date>end||!timezone(segment.timezone)||!text(segment.instructions,1000))return false
  const days=segment.weekdays,times=segment.times
  if(!Array.isArray(days)||days.length>7||new Set(days).size!==days.length||!days.every(day=>Number.isInteger(day)&&day>=1&&day<=7)||!Array.isArray(times)||times.length>24||new Set(times).size!==times.length||!times.every(time=>typeof time==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)))return false
  if(segment.kind==='interval'&&(!Number.isInteger(segment.interval_minutes)||Number(segment.interval_minutes)<1||Number(segment.interval_minutes)>525600||days.length!==0||times.length!==1))return false
  if(segment.kind==='weekdays'&&(segment.interval_minutes!==null||!days.length||!times.length))return false
  if(segment.kind==='as_needed'&&(segment.interval_minutes!==null||days.length||times.length))return false
 }
 for(let a=0;a<value.length;a++)for(let b=a+1;b<value.length;b++)if(value[a].start_date<=value[b].end_date&&value[b].start_date<=value[a].end_date)return false
 return true
}
export function validClinicalSnapshot(value:unknown,finalize=false):value is ClinicalSnapshot {
 if(!shape(value,['intake','note','prescriptions','orders','results'])||new TextEncoder().encode(JSON.stringify(value)).length>131072||![value.intake,value.prescriptions,value.orders,value.results].every(items=>list(items)))return false
 const intake=value.intake as Record<string,unknown>[],rx=value.prescriptions as Record<string,unknown>[],orders=value.orders as Record<string,unknown>[],results=value.results as Record<string,unknown>[]
 for(const item of intake)if(!shape(item,['id','kind','knowledge','text','value','unit','source'])||!['history','allergy','observation'].includes(String(item.kind))||!['missing','unknown','none_reported','reported'].includes(String(item.knowledge))||!['patient','staff','clinician'].includes(String(item.source))||!text(item.text,4000,true)||!text(item.value,120,true)||!text(item.unit,80,true)||(item.knowledge!=='reported'&&(item.text!==''||item.value!==''||item.unit!=='')))return false
 const note=value.note
 if(!shape(note,['template_id','template_version','sections'])||note.template_id!=='synthetic-neutral'||note.template_version!==1||!Array.isArray(note.sections)||note.sections.length!==2||new Set(note.sections.map(section=>clinicalObject(section)?section.key:null)).size!==2)return false
 for(const section of note.sections)if(!shape(section,['key','text'])||!['entered_note','review_notes'].includes(String(section.key))||!text(section.text,10000,!finalize||section.key!=='entered_note'))return false
 for(const item of rx){
  if(!shape(item,['id','medicine','dose','start_date','end_date','segments','instructions'])||!shape(item.medicine,['identity','label','provenance','source_version','strength','form'])||!shape(item.dose,['amount','unit','route']))return false
  const medicine=item.medicine,dose=item.dose
  if(medicine.provenance!=='synthetic_manual'||medicine.source_version!=='manual-synthetic-v1'||![medicine.identity,medicine.label,medicine.strength,medicine.form].every(field=>text(field,200))||!text(dose.amount,30)||!/^\d{1,12}(\.\d{1,6})?$/.test(dose.amount)||Number(dose.amount)<=0||!text(dose.unit,80)||!text(dose.route,120)||!text(item.instructions,4000)||!validClinicalSegments(item.segments,item.start_date,item.end_date))return false
 }
 for(const item of orders)if(!shape(item,['id','kind','request','due_at','state','reason'])||!['follow_up','lab','imaging','referral'].includes(String(item.kind))||!['requested','tracking','cancelled'].includes(String(item.state))||!text(item.request,4000)||!text(item.reason,500,item.state!=='cancelled')||(item.due_at!==null&&!instant(item.due_at)))return false
 for(const item of results)if(!shape(item,['id','order_id','document_version_id','stage','annotation'])||!orders.some(order=>order.id===item.order_id)||!['requested','uploaded','received','reviewed','released'].includes(String(item.stage))||!text(item.annotation,4000,true)||(item.document_version_id!==null&&!clinicalUuid(item.document_version_id))||(item.document_version_id===null&&item.stage!=='requested'))return false
 return true
}
function safeEnvelope(value:unknown):value is Record<string,unknown>{return clinicalObject(value)&&value.data_mode==='synthetic'&&value.clinical_approval===false&&value.live_prescribing===false}
const unavailable = ():never => {throw new Error('DOCTOR_CLINICAL_RESPONSE_INVALID')}
export function clinicalDirectory(value:unknown):ClinicalDirectory {
 if(!safeEnvelope(value)||typeof value.available!=='boolean'||!Number.isSafeInteger(value.total)||Number(value.total)<0||!Array.isArray(value.rows)||value.rows.length>20||!Array.isArray(value.patients)||value.patients.length>50||!Array.isArray(value.capabilities)||!value.capabilities.every(cap=>['read','draft','review','sign','release','export'].includes(String(cap))))return unavailable()
 if(!value.rows.every(row=>clinicalObject(row)&&clinicalUuid(row.id)&&clinicalUuid(row.patient_id)&&text(row.patient_name,160)&&statuses.includes(String(row.status))&&Number.isSafeInteger(row.version)&&Number(row.version)>0&&instant(row.updated_at)&&text(row.location_name,160)&&timezone(row.timezone))||!value.patients.every(row=>clinicalObject(row)&&clinicalUuid(row.id)&&text(row.name,160)))return unavailable()
 if(!value.available&&(value.rows.length||value.patients.length||value.capabilities.length||value.total!==0))return unavailable()
 return value as unknown as ClinicalDirectory
}
export function clinicalDetail(value:unknown,practice:string,location:string,encounter:string):ClinicalDetail {
 if(!safeEnvelope(value)||!clinicalObject(value.encounter)||value.encounter.id!==encounter||value.encounter.practice_id!==practice||value.encounter.location_id!==location||!clinicalUuid(value.encounter.patient_id)||!clinicalUuid(value.encounter.responsible_doctor)||!statuses.includes(String(value.encounter.status))||!Number.isSafeInteger(value.encounter.version)||Number(value.encounter.version)<1||!Array.isArray(value.versions)||value.versions.length>20||!Number.isSafeInteger(value.versions_total)||Number(value.versions_total)<value.versions.length||!Array.isArray(value.events)||value.events.length>100||!Number.isSafeInteger(value.events_total)||Number(value.events_total)<value.events.length||!Array.isArray(value.releases)||value.releases.length>100)return unavailable()
 if((value.recipients_total!==undefined||value.recipient_limit!==undefined)&&(!Number.isSafeInteger(value.recipients_total)||Number(value.recipients_total)<(Array.isArray(value.recipients)?value.recipients.length:0)||value.recipient_limit!==100))return unavailable()
 if(!Array.isArray(value.recipients)||value.recipients.length>100||!value.recipients.every(item=>clinicalObject(item)&&clinicalUuid(item.id)&&text(item.name,400))||!value.releases.every(item=>clinicalObject(item)&&clinicalUuid(item.id)&&clinicalUuid(item.version_id)&&clinicalUuid(item.recipient_user_id)&&instant(item.released_at)&&instant(item.expires_at)&&typeof item.unavailable==='boolean')||!value.events.every(item=>clinicalObject(item)&&Number.isSafeInteger(item.id)&&clinicalUuid(item.version_id)&&clinicalUuid(item.actor_user_id)&&instant(item.happened_at)&&['create','save','start','finalize','amend','withdraw','release','revoke_release','export','download'].includes(String(item.action))))return unavailable()
 for(const version of value.versions)if(!clinicalObject(version)||!clinicalUuid(version.id)||!Number.isSafeInteger(version.revision)||!statuses.includes(String(version.kind))||!validClinicalSnapshot(version.snapshot)||typeof version.canonical_snapshot!=='string'||!text(version.snapshot_sha256,64)||!(/^[0-9a-f]{64}$/).test(version.snapshot_sha256)||version.synthetic_attestation!==true||version.professional_signature!==false||!['active','superseded','withdrawn','draft'].includes(String(version.version_status))||!clinicalUuid(version.actor_user_id)||!instant(version.happened_at))return unavailable()
 return value as unknown as ClinicalDetail
}
/** Verify the exact server canonical bytes before a revision can be reviewed or printed. */
export async function verifyClinicalDetail(value:unknown,practice:string,location:string,encounter:string):Promise<ClinicalDetail> {
 const detail=clinicalDetail(value,practice,location,encounter)
 const sorted=(item:unknown):unknown=>Array.isArray(item)?item.map(sorted):clinicalObject(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,sorted(item[key])])):item
 for(const version of detail.versions){
  const bytes=new TextEncoder().encode(version.canonical_snapshot)
  if(bytes.length>131072)return unavailable()
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
  let source:unknown;try{source=JSON.parse(version.canonical_snapshot)}catch{return unavailable()}
  if(hash!==version.snapshot_sha256||JSON.stringify(sorted(source))!==JSON.stringify(sorted(version.snapshot)))return unavailable()
 }
 return detail
}
export function clinicalCommandResult(value:unknown):ClinicalCommandResult {
 if(!safeEnvelope(value)||!clinicalUuid(value.encounter_id)||!clinicalUuid(value.version_id)||!Number.isSafeInteger(value.version)||Number(value.version)<1||!statuses.includes(String(value.status))||(value.release_id!==null&&!clinicalUuid(value.release_id)))return unavailable()
 return value as unknown as ClinicalCommandResult
}
export function clinicalReleased(value:unknown,release:string):ClinicalReleased {
 const keys=['release_id','version_id','revision','snapshot_sha256','responsible_doctor','patient_id','location_name','timezone','finalized_at','expires_at','prescriptions','results','orders','documents','doctor_name','patient_name','data_mode','clinical_approval','professional_signature','live_prescribing']
 if(!shape(value,keys)||!safeEnvelope(value)||value.release_id!==release||!clinicalUuid(value.version_id)||!clinicalUuid(value.responsible_doctor)||!clinicalUuid(value.patient_id)||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||typeof value.snapshot_sha256!=='string'||!(/^[0-9a-f]{64}$/).test(value.snapshot_sha256)||!text(value.location_name,160)||!text(value.doctor_name,120)||!text(value.patient_name,160)||!timezone(value.timezone)||!instant(value.finalized_at)||!instant(value.expires_at)||value.professional_signature!==false||!Array.isArray(value.documents)||value.documents.length>100)return unavailable()
 const snapshot={...emptyClinicalSnapshot(),prescriptions:value.prescriptions,orders:value.orders,results:value.results}
 if(!validClinicalSnapshot(snapshot)||!snapshot.results.every(result=>result.stage==='released'))return unavailable()
 for(const document of value.documents)if(!shape(document,['id','filename','mime','size','sha256'])||!clinicalUuid(document.id)||!text(document.filename,160)||!['application/pdf','image/png','image/jpeg'].includes(String(document.mime))||!Number.isSafeInteger(document.size)||Number(document.size)<1||Number(document.size)>5242880||typeof document.sha256!=='string'||!(/^[0-9a-f]{64}$/).test(document.sha256)||!snapshot.results.some(result=>result.document_version_id===document.id))return unavailable()
 const documents=value.documents
 if(snapshot.results.some(result=>!documents.some((document:unknown)=>clinicalObject(document)&&document.id===result.document_version_id)))return unavailable()
 return value as unknown as ClinicalReleased
}
export async function verifyClinicalExport(value:unknown,digest=(bytes:Uint8Array)=>crypto.subtle.digest('SHA-256',bytes as BufferSource)):Promise<string> {
 if(!shape(value,['canonical_manifest','sha256'])||typeof value.canonical_manifest!=='string'||new TextEncoder().encode(value.canonical_manifest).length>8388608||typeof value.sha256!=='string'||!(/^[0-9a-f]{64}$/).test(value.sha256))return unavailable()
 const hash=async(text:string)=>[...new Uint8Array(await digest(new TextEncoder().encode(text)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
 if(await hash(value.canonical_manifest)!==value.sha256)return unavailable()
 let manifest:unknown;try{manifest=JSON.parse(value.canonical_manifest)}catch{return unavailable()}
 if(!safeEnvelope(manifest)||manifest.format!=='doctor-clinical-export-v1'||!Array.isArray(manifest.versions)||manifest.versions.length!==manifest.versions_total||!Array.isArray(manifest.document_provenance)||manifest.document_provenance.length!==manifest.documents_total||!Array.isArray(manifest.events)||manifest.events.length!==manifest.events_total||manifest.storage_bytes_included!==false||manifest.retention_policy!=='unapproved_no_erasure')return unavailable()
 let revision=0;const ids=new Set<string>()
 for(const version of manifest.versions){
  if(!clinicalObject(version)||!clinicalUuid(version.id)||ids.has(version.id)||version.revision!==++revision||typeof version.canonical_snapshot!=='string'||typeof version.sha256!=='string'||await hash(version.canonical_snapshot)!==version.sha256||((revision===1)?version.source_version_id!==null:version.source_version_id!==manifest.versions[revision-2].id))return unavailable()
  let snapshot:unknown;try{snapshot=JSON.parse(version.canonical_snapshot)}catch{return unavailable()};if(!validClinicalSnapshot(snapshot))return unavailable();ids.add(version.id)
 }
 if(!clinicalObject(manifest.encounter)||manifest.encounter.version!==revision||!manifest.events.every(event=>clinicalObject(event)&&ids.has(String(event.version_id))))return unavailable()
 return value.canonical_manifest
}
