import {useRecordAction} from '@building-suit/ux'
import type {ClinicalSnapshot} from '@building-suit/contracts'
import type {BsClinicalFields,BsClinicalWorkspaceView} from '@building-suit/ui/utils/clinicalPresentation'
import {nativePatientScopeKey} from '../utils/nativePatients'
import {nativePrescriptionFields,nativePrescriptionSnapshot,emptyNativePrescription,emptyNativePrescriptionSegment} from '../utils/nativePrescriptionFields'
import {nativeCommandKey} from '../utils/nativeWebCapabilities'
import {emptyNativeClinicalFields,nativePrescriptionReviewCopy,nativeClinicalCopy,nativeClinicalChoices,nativeClinicalStateCopy,nativeClinicalStatus,nativeClinicalReading} from '../utils/nativeEncounterPresentation'
export function useDoctorNativeEncounterPage(){
 const service=useDoctorNativeEncounter(),review=useDoctorNativePrescriptionReview(),context=useDoctorNativeContext(),shell=useDoctorMobile(),{auth}=useDoctorNativeAuth(),{locale}=useI18n(),confirmation=useConfirmation()
 const arabic=computed(()=>locale.value==='ar'),copy=computed(()=>nativeClinicalCopy(arabic.value)),choices=computed(()=>nativeClinicalChoices(arabic.value)),stateCopy=computed(()=>nativeClinicalStateCopy(arabic.value)),reviewCopy=computed(()=>nativePrescriptionReviewCopy(arabic.value))
 const scope=computed(()=>auth.identity()&&context.state.phase==='ready'?context.state.current:null),scopeKey=computed(()=>nativePatientScopeKey(scope.value?.context??null))
 const fields=ref<BsClinicalFields>(emptyNativeClinicalFields()),editor=useRecordAction(()=>fields.value)
 const confirmationOpen=ref(false),uploadOpen=ref(false),file=ref<File|null>(null),reason=ref(''),recipient=ref(''),expires=ref('')
 const page=ref(0),search=ref(''),historyPage=toRef(service.state,'historyPage'),readingId=ref<string|null>(null),selectedId=ref<string|null>(null)
 const target=ref<{action:'finalize'|'amend'|'withdraw';id:string;version:number}|null>(null)
 let finishing=false,resetting=false
 const pending=computed(()=>service.state.outcome==='submitting'||review.state.phase==='submitting'||review.state.phase==='checking')
 const owned=computed(()=>scope.value?.context.portal==='doctor'&&scope.value.context.userId===scope.value.context.doctorId)
 const canDraft=computed(()=>owned.value&&service.state.phase==='ready'&&service.state.catalogue?.available&&service.state.catalogue.capabilities.includes('draft'))
 const reading=computed(()=>service.state.detail?.versions.find(item=>item.id===readingId.value)??service.state.detail?.versions[0]??null)
 function snapshot():ClinicalSnapshot|null{return service.state.draft?nativePrescriptionSnapshot(fields.value):null}
 function reviewError(){const phase=review.state.phase;return ['stale','expired','denied','invalid','unknown'].includes(phase)?reviewCopy.value[phase as 'stale'|'expired'|'denied'|'invalid'|'unknown']:null}
 function error(){return service.state.error==='conflict'?stateCopy.value.conflict:service.state.outcome==='unknown'?stateCopy.value.unknown:service.state.error?copy.value.unavailable:null}
 function reset(){resetting=true;review.clear();target.value=null;fields.value=emptyNativeClinicalFields();editor.reset();confirmationOpen.value=false;uploadOpen.value=false;file.value=null;reason.value='';recipient.value='';expires.value='';readingId.value=null;selectedId.value=null;historyPage.value=0;void nextTick(()=>{resetting=false})}
 const unregisterClear=context.registerClear(reset)
 const unregisterDirty=context.registerDirty(()=>editor.dirty.value||Boolean(confirmationOpen.value&&reason.value.trim())||['unknown','conflict'].includes(service.state.outcome)||review.state.phase==='unknown')
 async function reload(){if(editor.visible.value||pending.value)return;review.clear();confirmationOpen.value=false;target.value=null;await shell.navigate('/encounters');await service.directory(page.value,search.value,true);readingId.value=null;selectedId.value=null}
 async function select(id:string,newPage=0){
  if(editor.visible.value||confirmationOpen.value||pending.value)return
  review.clear()
  if(await service.load(id,true,newPage)){selectedId.value=id;historyPage.value=newPage;readingId.value=service.state.detail?.versions[0]?.id??null}
 }
 function create(){review.clear();if(service.create()){fields.value=nativePrescriptionFields(service.state.draft!);editor.create()}}
 function edit(){
  if(!service.edit())return
  review.clear()
  fields.value=nativePrescriptionFields(service.state.draft!,service.state.detail?.encounter.patient_id??'')
  editor.edit()
 }
 async function save(){
  const value=snapshot()
  if(!value||(service.state.creating&&!service.patient(fields.value.patientId))||!service.edit(value))return
  finishing=true
  try{
   const done=await editor.run(async()=>{if(!await service.save())throw new Error('Synthetic save not acknowledged')},()=>error()??copy.value.unavailable)
   const id=service.state.acknowledgedId
   if(done&&id){fields.value=emptyNativeClinicalFields();await service.directory(page.value,search.value,true);await select(id)}
  }finally{finishing=false}
 }
 watch(editor.visible,async(visible,previous)=>{
  if(visible||!previous||finishing||resetting)return
  fields.value=emptyNativeClinicalFields()
  if(selectedId.value)await select(selectedId.value,historyPage.value)
  else await reload()
 })
 watch(scopeKey,()=>{reset();page.value=0;search.value='';if(scopeKey.value)void service.directory(0,'',true);else service.clear()},{immediate:true})
 watch(()=>service.state.phase,phase=>{if(phase==='denied')reset()})
 onBeforeRouteLeave(async()=>{
  if(service.state.outcome==='submitting'||review.state.phase==='submitting')return false
  if(editor.dirty.value||Boolean(confirmationOpen.value&&reason.value.trim())||['unknown','conflict'].includes(service.state.outcome)||review.state.phase==='unknown')return confirmation.ask({title:stateCopy.value.discardTitle,message:stateCopy.value.discardBody,confirmLabel:stateCopy.value.discard,cancelLabel:copy.value.cancel,tone:'danger'})
  return true
 })
 onBeforeUnmount(()=>{unregisterClear();unregisterDirty();service.clear();reset()})
 const view=computed<BsClinicalWorkspaceView>(()=>{
  const detail=service.state.detail,record=detail?.encounter,catalogue=service.state.catalogue,selected=reading.value
  const format=(stamp:string,timezone=record?.timezone??'UTC')=>`${new Intl.DateTimeFormat(arabic.value?'ar-EG':'en-GB',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:timezone}).format(new Date(stamp))} · ${timezone}`
  const editable=Boolean(canDraft.value&&record&&['draft','in_progress','amended'].includes(record.status)&&selected?.revision===record.version)
  return{title:copy.value.title,description:copy.value.description,scopeLabel:scope.value?`${scope.value.doctorName} · ${scope.value.practiceName} · ${scope.value.locationName}`:'',notice:copy.value.notice,loading:service.state.phase==='loading',pending:pending.value,error:editor.visible.value||confirmationOpen.value?null:error()??reviewError(),recipientNotice:service.state.draft?stateCopy.value.unsent:null,available:Boolean(owned.value&&catalogue?.available&&service.state.phase!=='denied'&&service.state.error!=='denied'),page:page.value,total:catalogue?.total??0,scopeKey:scopeKey.value,canCreate:Boolean(canDraft.value),patients:(catalogue?.patients??[]).map(item=>({value:item.id,label:item.name})),
   rows:(catalogue?.rows??[]).map(item=>({id:item.id,patient:item.patient_name,status:nativeClinicalStatus(item.status,arabic.value),date:format(item.updated_at,item.timezone)})),
   detail:record?{id:record.id,patient:catalogue?.patients.find(item=>item.id===record.patient_id)?.name??record.patient_id,status:nativeClinicalStatus(record.status,arabic.value),version:String(record.version),doctor:scope.value?.doctorName??record.responsible_doctor,location:record.location_name,date:format(record.updated_at),canEdit:editable,canStart:Boolean(canDraft.value&&record.status==='draft'&&selected?.revision===record.version&&!service.dirty()),canFinalize:Boolean(owned.value&&catalogue?.capabilities.includes('sign')&&['in_progress','amended'].includes(record.status)&&selected?.revision===record.version&&!service.dirty()),canAmend:Boolean(owned.value&&catalogue?.capabilities.includes('review')&&record.status==='finalized'),canWithdraw:Boolean(owned.value&&catalogue?.capabilities.includes('sign')&&record.status==='finalized'),canRelease:false,canExport:false}:null,
   versions:(detail?.versions??[]).map(item=>({id:item.id,revision:String(item.revision),status:nativeClinicalStatus(['active','superseded','withdrawn'].includes(item.version_status)?item.version_status:item.kind,arabic.value),actor:item.actor_user_id,date:format(item.happened_at),reason:item.reason??'',canPrint:false})),historyPage:historyPage.value,historyTotal:detail?.versions_total??0,releases:[],recipients:[],durations:[],reading:selected?nativeClinicalReading(selected,arabic.value):null,
   documents:[],documentsHref:'',canUpload:false,documentsLoading:false,documentsPage:0,documentsTotal:0,
   editor:{title:service.state.creating?copy.value.create:copy.value.edit,dirty:editor.dirty.value,pending:pending.value,error:editor.error.value??error(),disabled:pending.value||!canDraft.value||!snapshot()||['unknown','conflict'].includes(service.state.outcome)||(service.state.creating&&!catalogue?.patients.some(item=>item.id===fields.value.patientId)),creating:service.state.creating,readOnly:!canDraft.value||['unknown','conflict'].includes(service.state.outcome)},
   confirmation:{title:target.value?.action==='amend'?copy.value.amend:target.value?.action==='withdraw'?copy.value.withdraw:reviewCopy.value.title,description:target.value?.action==='finalize'?reviewCopy.value.description.replace('{version}',String(target.value.version)):`${copy.value.syntheticIdentity} · ${copy.value.revision} ${target.value?.version??''}`,needsReason:target.value?.action==='amend'||target.value?.action==='withdraw',needsRecipient:false,pending:review.state.phase==='submitting',error:reviewError()},upload:{pending:false,error:null}}
 })
 function add(kind:'intake'|'prescription'|'order'|'result'|'segment',index?:number){
  if(!editor.visible.value||pending.value||!canDraft.value)return
  review.clear()
  if(kind==='prescription'&&fields.value.prescriptions.length<100)fields.value.prescriptions.push(emptyNativePrescription(nativeCommandKey()))
  if(kind==='segment'&&typeof index==='number'&&fields.value.prescriptions[index]&&fields.value.prescriptions[index]!.segments.length<16)fields.value.prescriptions[index]!.segments.push(emptyNativePrescriptionSegment())
 }
 function remove(kind:'intake'|'prescription'|'order'|'result'|'segment',index:number,segment?:number){
  if(!editor.visible.value||pending.value||!canDraft.value||!Number.isSafeInteger(index)||index<0)return
  review.clear()
  if(kind==='prescription')fields.value.prescriptions.splice(index,1)
  if(kind==='segment'&&typeof segment==='number'&&Number.isSafeInteger(segment)&&segment>=0)fields.value.prescriptions[index]?.segments.splice(segment,1)
 }
 async function refreshAfterAction(id:string){review.clear();confirmationOpen.value=false;target.value=null;await service.directory(page.value,search.value,true);await select(id)}
 async function action(value:'start'|'finalize'|'amend'|'withdraw'|'release'|'revoke_release'){
  if(pending.value||editor.visible.value||service.dirty())return
  const record=service.state.detail?.encounter
  if(!record)return
  if(value==='start'){if(await review.start())await refreshAfterAction(record.id);return}
  if(value==='release'||value==='revoke_release')return
  if(value==='finalize'){
   if(!reading.value||!await review.prepare(reading.value.id))return
  }else review.clear()
  const current=service.state.detail?.encounter
  if(!current)return
  target.value={action:value,id:current.id,version:current.version};reason.value='';confirmationOpen.value=true
 }
 async function confirmAction(){
  const selected=target.value,record=service.state.detail?.encounter
  if(!selected||!record||pending.value||selected.id!==record.id||selected.version!==record.version)return
  const done=selected.action==='finalize'?await review.finalize():await review.transition(selected.action,selected.id,selected.version,reason.value)
  if(done)await refreshAfterAction(selected.id)
 }
 function changeSearch(key:string|null,value:string){if(key!==scopeKey.value||editor.visible.value||pending.value)return;page.value=0;search.value=value;void reload()}
 function changePage(key:string|null,value:number){if(key!==scopeKey.value||editor.visible.value||pending.value||!Number.isSafeInteger(value)||value<0)return;page.value=value;void reload()}
 function readVersion(id:string){if(service.state.detail?.versions.some(item=>item.id===id))readingId.value=id}
 return{fields,editorOpen:editor.visible,confirmationOpen,uploadOpen,file,reason,recipient,expires,copy,choices,view,reload,select,create,edit,save,changeSearch,changePage,readVersion,add,remove,action,confirmAction,history:(value:number)=>{if(selectedId.value)void select(selectedId.value,value)}}
}
