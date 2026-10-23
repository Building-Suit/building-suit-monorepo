import {useRecordAction} from '@building-suit/ux'
import {validClinicalSnapshot,type ClinicalSnapshot} from '@building-suit/contracts'
import type {BsClinicalFields,BsClinicalWorkspaceView} from '@building-suit/ui/utils/clinicalPresentation'
import {nativePatientScopeKey} from '../utils/nativePatients'
import {emptyNativeClinicalFields,nativeClinicalCopy,nativeClinicalChoices,nativeClinicalStateCopy,nativeClinicalStatus,nativeClinicalReading} from '../utils/nativeEncounterPresentation'
export function useDoctorNativeEncounterPage(){
 const service=useDoctorNativeEncounter(),context=useDoctorNativeContext(),shell=useDoctorMobile(),{auth}=useDoctorNativeAuth(),{locale}=useI18n(),confirmation=useConfirmation()
 const arabic=computed(()=>locale.value==='ar'),copy=computed(()=>nativeClinicalCopy(arabic.value)),choices=computed(()=>nativeClinicalChoices(arabic.value)),stateCopy=computed(()=>nativeClinicalStateCopy(arabic.value))
 const scope=computed(()=>auth.identity()&&context.state.phase==='ready'?context.state.current:null),scopeKey=computed(()=>nativePatientScopeKey(scope.value?.context??null))
 const fields=ref<BsClinicalFields>(emptyNativeClinicalFields()),editor=useRecordAction(()=>fields.value)
 const confirmationOpen=ref(false),uploadOpen=ref(false),file=ref<File|null>(null),reason=ref(''),recipient=ref(''),expires=ref('')
 const page=ref(0),search=ref(''),historyPage=ref(0),readingId=ref<string|null>(null),selectedId=ref<string|null>(null)
 let finishing=false,resetting=false
 const pending=computed(()=>service.state.outcome==='submitting')
 const owned=computed(()=>scope.value?.context.portal==='doctor'&&scope.value.context.userId===scope.value.context.doctorId)
 const canDraft=computed(()=>owned.value&&service.state.phase==='ready'&&service.state.catalogue?.available&&service.state.catalogue.capabilities.includes('draft'))
 const reading=computed(()=>service.state.detail?.versions.find(item=>item.id===readingId.value)??service.state.detail?.versions[0]??null)
 function snapshot():ClinicalSnapshot|null{
  const base=service.state.draft
  if(!base)return null
  const value=JSON.parse(JSON.stringify(base)) as ClinicalSnapshot
  value.note.sections=[{key:'entered_note',text:fields.value.note},{key:'review_notes',text:fields.value.reviewNote}]
  return validClinicalSnapshot(value)?value:null
 }
 function error(){return service.state.error==='conflict'?stateCopy.value.conflict:service.state.outcome==='unknown'?stateCopy.value.unknown:service.state.error?copy.value.unavailable:null}
 function reset(){resetting=true;fields.value=emptyNativeClinicalFields();editor.reset();confirmationOpen.value=false;uploadOpen.value=false;file.value=null;reason.value='';recipient.value='';expires.value='';readingId.value=null;selectedId.value=null;historyPage.value=0;void nextTick(()=>{resetting=false})}
 const unregisterClear=context.registerClear(reset)
 const unregisterDirty=context.registerDirty(()=>editor.dirty.value||['unknown','conflict'].includes(service.state.outcome))
 async function reload(){if(editor.visible.value||pending.value)return;await shell.navigate('/encounters');await service.directory(page.value,search.value,true);readingId.value=null;selectedId.value=null}
 async function select(id:string,newPage=0){
  if(editor.visible.value||pending.value)return
  if(await service.load(id,true,newPage)){selectedId.value=id;historyPage.value=newPage;readingId.value=service.state.detail?.versions[0]?.id??null}
 }
 function create(){if(service.create()){fields.value=emptyNativeClinicalFields();editor.create()}}
 function edit(){
  if(!service.edit())return
  const draft=service.state.draft!
  fields.value={...emptyNativeClinicalFields(),patientId:service.state.detail?.encounter.patient_id??'',note:draft.note.sections.find(item=>item.key==='entered_note')?.text??'',reviewNote:draft.note.sections.find(item=>item.key==='review_notes')?.text??''}
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
  if(pending.value)return false
  if(editor.dirty.value||['unknown','conflict'].includes(service.state.outcome))return confirmation.ask({title:stateCopy.value.discardTitle,message:stateCopy.value.discardBody,confirmLabel:stateCopy.value.discard,cancelLabel:copy.value.cancel,tone:'danger'})
  return true
 })
 onBeforeUnmount(()=>{unregisterClear();unregisterDirty();service.clear();reset()})
 const view=computed<BsClinicalWorkspaceView>(()=>{
  const detail=service.state.detail,record=detail?.encounter,catalogue=service.state.catalogue,selected=reading.value
  const format=(stamp:string,timezone=record?.timezone??'UTC')=>`${new Intl.DateTimeFormat(arabic.value?'ar-EG':'en-GB',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:timezone}).format(new Date(stamp))} · ${timezone}`
  const editable=Boolean(canDraft.value&&record&&['draft','in_progress','amended'].includes(record.status)&&selected?.revision===record.version)
  return{title:copy.value.title,description:copy.value.description,scopeLabel:scope.value?`${scope.value.doctorName} · ${scope.value.practiceName} · ${scope.value.locationName}`:'',notice:copy.value.notice,loading:service.state.phase==='loading',pending:pending.value,error:editor.visible.value?null:error(),recipientNotice:service.state.draft?stateCopy.value.unsent:null,available:Boolean(owned.value&&catalogue?.available&&service.state.phase!=='denied'&&service.state.error!=='denied'),page:page.value,total:catalogue?.total??0,scopeKey:scopeKey.value,canCreate:Boolean(canDraft.value),patients:(catalogue?.patients??[]).map(item=>({value:item.id,label:item.name})),
   rows:(catalogue?.rows??[]).map(item=>({id:item.id,patient:item.patient_name,status:nativeClinicalStatus(item.status,arabic.value),date:format(item.updated_at,item.timezone)})),
   detail:record?{id:record.id,patient:catalogue?.patients.find(item=>item.id===record.patient_id)?.name??record.patient_id,status:nativeClinicalStatus(record.status,arabic.value),version:String(record.version),doctor:scope.value?.doctorName??record.responsible_doctor,location:record.location_name,date:format(record.updated_at),canEdit:editable,canStart:false,canFinalize:false,canAmend:false,canWithdraw:false,canRelease:false,canExport:false}:null,
   versions:(detail?.versions??[]).map(item=>({id:item.id,revision:String(item.revision),status:nativeClinicalStatus(item.kind,arabic.value),actor:item.actor_user_id,date:format(item.happened_at),reason:item.reason??'',canPrint:false})),historyPage:historyPage.value,historyTotal:detail?.versions_total??0,releases:[],recipients:[],durations:[],reading:selected?nativeClinicalReading(selected,arabic.value):null,
   documents:[],documentsHref:'',canUpload:false,documentsLoading:false,documentsPage:0,documentsTotal:0,
   editor:{title:service.state.creating?copy.value.create:copy.value.edit,dirty:editor.dirty.value,pending:pending.value,error:editor.error.value??error(),disabled:pending.value||!snapshot()||['unknown','conflict'].includes(service.state.outcome)||(service.state.creating&&!catalogue?.patients.some(item=>item.id===fields.value.patientId)),creating:service.state.creating,readOnly:['unknown','conflict'].includes(service.state.outcome)},
   confirmation:{title:'',description:'',needsReason:false,needsRecipient:false,pending:false,error:null},upload:{pending:false,error:null}}
 })
 function changeSearch(key:string|null,value:string){if(key!==scopeKey.value||editor.visible.value||pending.value)return;page.value=0;search.value=value;void reload()}
 function changePage(key:string|null,value:number){if(key!==scopeKey.value||editor.visible.value||pending.value||!Number.isSafeInteger(value)||value<0)return;page.value=value;void reload()}
 function readVersion(id:string){if(service.state.detail?.versions.some(item=>item.id===id))readingId.value=id}
 return{fields,editorOpen:editor.visible,confirmationOpen,uploadOpen,file,reason,recipient,expires,copy,choices,view,reload,select,create,edit,save,changeSearch,changePage,readVersion,history:(value:number)=>{if(selectedId.value)void select(selectedId.value,value)}}
}
