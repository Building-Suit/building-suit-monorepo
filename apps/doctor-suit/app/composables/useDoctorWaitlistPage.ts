import{usePageRevalidation,useRecordAction}from'@building-suit/ux'
import type{BsWaitlistAction,BsWaitlistView}from'@building-suit/ui/utils/waitlistPresentation'
import{emptyWaitlistFields,emptyWaitlistOffer,waitlistCopy,waitlistCreateInput,waitlistOfferChoice,waitlistActionLabel,waitlistStateLabel}from'../utils/waitlistPresentation'
import{waitlistStates,type WaitlistQuery,type WaitlistRow,type WaitlistInput}from'../utils/waitlist'
import{doctorAvailabilityToday,doctorMinuteClock}from'../utils/availability'
import{doctorAppointmentReason}from'../utils/appointments'
export function useDoctorWaitlistPage(){
 const app=useNuxtApp(),context=useDoctorContext(),service=app.$doctorWaitlist,{locale}=useI18n(),ar=computed(()=>locale.value==='ar'),copy=computed(()=>waitlistCopy(ar.value)),hydrated=ref(false),scopeKey=computed(()=>service.scopeKey())
 const fields=ref(emptyWaitlistFields()),offerFields=ref(emptyWaitlistOffer()),reason=ref(''),filter=ref('all'),page=ref(0),searchValue=ref('')
 const editor=useRecordAction(()=>fields.value),offerEditor=useRecordAction(()=>offerFields.value),confirmation=useRecordAction(()=>({reason:reason.value}))
 const newId=ref<string|null>(null),offering=shallowRef<WaitlistRow|null>(null),target=shallowRef<{row:WaitlistRow;action:Exclude<BsWaitlistAction,'offer'|'history'>}|null>(null),historyTarget=ref<string|null>(null),historyOpen=ref(false)
 let expiryIntent:{fingerprint:string;instant:string}|null=null
 const query=():WaitlistQuery=>({page:page.value,state:filter.value as WaitlistQuery['state'],search:searchValue.value})
 function reset(){editor.reset();offerEditor.reset();confirmation.reset();fields.value=emptyWaitlistFields();offerFields.value=emptyWaitlistOffer();newId.value=null;offering.value=null;target.value=null;reason.value='';historyTarget.value=null;historyOpen.value=false;expiryIntent=null;service.discard()}
 const unregister=context.registerClear(()=>{reset();service.clear()})
 watch(scopeKey,()=>{reset();service.clear();page.value=0;filter.value='all';searchValue.value='';if(hydrated.value)void load()},{flush:'sync'})
 onMounted(()=>{hydrated.value=true;void load()});onBeforeUnmount(()=>{unregister();reset();service.clear()})
 watch(editor.visible,v=>{if(!v&&!editor.pending.value){service.discard();fields.value=emptyWaitlistFields();newId.value=null}})
 watch(offerEditor.visible,v=>{if(!v&&!offerEditor.pending.value){service.discard();offerFields.value=emptyWaitlistOffer();offering.value=null;expiryIntent=null}})
 watch(confirmation.visible,v=>{if(!v&&!confirmation.pending.value){service.discard();target.value=null;reason.value=''}})
 watch(historyOpen,v=>{if(!v){historyTarget.value=null;service.state.history=null}})
 function error(value:string|null){return!value?null:value==='denied'?(ar.value?'غير مصرح بهذه الطلبات أو غير متاح لهذه النسخة.':'These requests are not permitted or are unavailable in this edition.'):value==='conflict'?(ar.value?'تغير الطلب أو الموعد أو الإعدادات. أعد التحميل وراجع الحالة الحالية.':'The request, slot or rules changed. Reload and review the current request.'):value==='invalid'?(ar.value?'راجع التواريخ والأوقات والإذن والحقول المطلوبة.':'Check the dates, times, permission and required fields.'):(ar.value?'لم تتأكد النتيجة. أعد المحاولة بنفس القيم للاحتفاظ بقصد العملية.':'The outcome is uncertain. Retry with the same values to retain the operation intent.')}
 async function denied(){if(service.state.actionError==='denied'||Object.values(service.state.errors).includes('denied')){reset();await context.refresh()}}
 async function load(){const done=await service.load(query());await denied();return done}
 async function reload(){if(service.state.pending)return;reset();await context.refresh();return load()}
 usePageRevalidation(async()=>{await context.refresh();await load();if(service.state.directory&&!service.state.directory.canManage&&(editor.visible.value||offerEditor.visible.value||confirmation.visible.value))reset()},()=>hydrated.value&&Boolean(scopeKey.value)&&!service.state.pending)
 const createInput=computed(()=>waitlistCreateInput(fields.value,service.state.types))
 const choice=computed(()=>waitlistOfferChoice(offerFields.value,offering.value,service.state.offers))
 const row=(id:string)=>service.state.directory?.rows.find(v=>v.id===id)
 async function create(){if(!service.state.directory?.canManage||service.state.pending)return;reset();newId.value=crypto.randomUUID();editor.create();await Promise.all([service.types(),service.patients()]);await denied()}
 async function types(){await service.types();await denied()}
 async function patients(value=''){fields.value.patientId='';await service.patients(value);await denied()}
 async function save(){const input=createInput.value,id=newId.value;if(!editor.visible.value||!input||!id||!service.state.patients?.rows.some(p=>p.id===input.patient_id))return
  const done=await editor.run(async()=>{if(!await service.command(id,0,'create',input)){await denied();throw new Error('WAITLIST_COMMAND_FAILED')}},()=>error(service.state.actionError)??copy.value.notice);if(done){reset();await load()}}
 async function action(id:string,action:BsWaitlistAction){const item=row(id);if(!item||service.state.pending)return
  if(action==='history'){historyTarget.value=item.id;historyOpen.value=true;await service.history(item.id);await denied();return}
  if(action==='offer'){if(!item.canOffer)return;service.discard();offering.value={...item};offerFields.value=emptyWaitlistOffer();expiryIntent=null;offerEditor.create();return}
  const allowed=action==='accept'?item.canAccept:action==='cancel'?item.canCancel:action==='revoke_contact'?item.canRevokeContact:item.canExpire;if(!allowed)return
  service.discard();target.value={row:{...item},action};reason.value='';confirmation.create()
 }
 async function offerDate(){offerFields.value.minute=null;expiryIntent=null;if(offering.value&&offerEditor.visible.value){await service.offers(offering.value,offerFields.value.date);await denied()}}
 async function submitOffer(){const c=choice.value,item=offering.value;if(!c||!item||!offerEditor.visible.value)return
  const fingerprint=JSON.stringify([scopeKey.value,item.id,item.version,offerFields.value]);if(expiryIntent?.fingerprint!==fingerprint)expiryIntent={fingerprint,instant:new Date(Date.now()+c.holdMinutes*60000).toISOString()}
  const input={date:c.date,minute:c.minute,schedule_version:c.schedule_version,location_version:c.location_version,expires_at:expiryIntent.instant}
  const done=await offerEditor.run(async()=>{if(!await service.command(item.id,item.version,'offer',input)){await denied();throw new Error('WAITLIST_OFFER_FAILED')}},()=>error(service.state.actionError)??copy.value.notice);if(done){reset();await load()}
 }
 async function confirmAction(){const t=target.value;if(!t||!confirmation.visible.value||t.action!=='expire'&&!doctorAppointmentReason(reason.value))return;const input:WaitlistInput=t.action==='expire'?{}:{reason:reason.value.trim()}
  const done=await confirmation.run(async()=>{if(!await service.command(t.row.id,t.row.version,t.action,input)){await denied();throw new Error('WAITLIST_ACTION_FAILED')}},()=>error(service.state.actionError)??copy.value.notice);if(done){reset();await load()}}
 async function changeFilter(){if(service.state.pending)return;page.value=0;await load()}
 async function search(value:string){if(service.state.pending)return;searchValue.value=value;page.value=0;await load()}
 async function changePage(value:number){if(service.state.pending||!Number.isSafeInteger(value)||value<0)return;page.value=value;await load()}
 async function historyPage(value:number){if(historyTarget.value){await service.history(historyTarget.value,value);await denied()}}
 const today=computed(()=>doctorAvailabilityToday(context.state.current?.timezone??'Etc/UTC')),latest=computed(()=>new Date(Date.parse(today.value+'T00:00:00Z')+365*86400000).toISOString().slice(0,10))
 const stamp=(value:string|null,zone:string)=>{if(!value)return'';const d=new Date(value);return`${doctorAvailabilityToday(zone,d)} ${new Intl.DateTimeFormat('en-GB',{timeZone:zone,hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).format(d)} · ${zone}`}
 const block=(value:string|null)=>!value?'':({contact_permission:ar.value?'إذن التواصل غير مسجل':'Contact permission is not recorded',patient_archived:ar.value?'سجل المريض مؤرشف':'Patient record is archived',request_window_elapsed:ar.value?'انتهت الفترة المطلوبة':'Requested window has elapsed',clinic_changed:ar.value?'تغير إعداد العيادة؛ يلزم طلب مراجع جديد':'Clinic configuration changed; a newly reviewed request is required',type_changed:ar.value?'تغير النوع؛ يلزم طلب مراجع جديد':'Type changed; a newly reviewed request is required'}[value]??'')
 const view=computed<BsWaitlistView>(()=>{const s=service.state,d=s.directory;return{
  checkedAt:d?stamp(d.observedAt,d.timezone):'',loading:!hydrated.value||s.loading.directory,pending:s.pending,error:error(s.errors.directory),denied:hydrated.value&&!scopeKey.value?(ar.value?'اختر عيادة مصرحاً بها.':'Choose an authorized clinic.'):s.errors.directory==='denied'?error(s.errors.directory):null,canCreate:hydrated.value&&Boolean(d?.canManage),page:d?.page??page.value,total:d?.total??0,states:['all',...waitlistStates].map(value=>({value,label:waitlistStateLabel(value,ar.value)})),
  rows:(d?.rows??[]).map(r=>({id:r.id,patient:r.patientName,type:`${r.type.name} · v${r.type.version}`,window:`${r.dateFrom} – ${r.dateTo} · ${doctorMinuteClock(r.minuteStart)} – ${doctorMinuteClock(r.minuteEnd)} · ${r.timezone}`,state:waitlistStateLabel(r.state,ar.value),permission:r.contactPermission?(ar.value?'مسجل لهذا الطلب':'Recorded for this request'):(ar.value?'غير مسجل':'Not recorded'),offer:r.startsAt&&r.endsAt?`${stamp(r.startsAt,r.timezone)} – ${stamp(r.endsAt,r.timezone)}`:'',expires:stamp(r.expiresAt,r.timezone),blocked:block(r.blocker),actions:([...(r.canOffer?['offer']:[]),...(r.canAccept?['accept']:[]),...(r.canCancel?['cancel']:[]),...(r.canRevokeContact?['revoke_contact']:[]),...(r.canExpire?['expire']:[]),'history']as BsWaitlistAction[]).map(value=>({value,label:waitlistActionLabel(value,ar.value)}))})),
  patients:s.patients?.rows.map(p=>({value:p.id,label:p.name}))??[],types:s.types.filter(t=>t.active).map(t=>({value:t.id,label:`${t.name} · ${t.duration_minutes}`})),
  editor:{title:copy.value.create,dirty:editor.dirty.value,pending:editor.pending.value||s.pending,error:editor.error.value,disabled:!createInput.value||s.loading.patients||s.loading.types,patientsLoading:s.loading.patients,patientsError:error(s.errors.patients),typesLoading:s.loading.types,typesError:error(s.errors.types),minDate:today.value,maxDate:latest.value},
  offerEditor:{title:waitlistActionLabel('offer',ar.value),summary:offering.value?`${offering.value.patientName} · ${offering.value.type.name}`:'',dirty:offerEditor.dirty.value,pending:offerEditor.pending.value||s.pending,error:offerEditor.error.value,disabled:!choice.value,loading:s.loading.offers,queryError:error(s.errors.offers),minDate:offering.value&&offering.value.dateFrom>today.value?offering.value.dateFrom:today.value,maxDate:offering.value?.dateTo??latest.value,timezone:offering.value?.timezone??'',slots:s.offers?.slots.filter(slot=>slot.available&&offering.value&&slot.minute>=offering.value.minuteStart&&slot.minute+offering.value.type.duration_minutes<=offering.value.minuteEnd).map(slot=>({value:slot.minute,label:doctorMinuteClock(slot.minute)}))??[]},
  confirmation:{title:target.value?waitlistActionLabel(target.value.action,ar.value):'',description:target.value?.action==='accept'?(ar.value?'سجّل القبول الصريح لهذا الطلب الاصطناعي. يُثبت الموعد بعد نجاح الحفظ فقط، دون إرسال رسالة خارجية.':'Record the explicit acceptance of this synthetic request. The appointment is confirmed only after saving; no external message is sent.'):copy.value.notice,reasonRequired:target.value?.action!=='expire',dirty:confirmation.dirty.value,pending:confirmation.pending.value||s.pending,error:confirmation.error.value,disabled:target.value?.action!=='expire'&&!doctorAppointmentReason(reason.value)},
  history:{title:copy.value.history,loading:s.loading.history,error:error(s.errors.history),total:s.history?.total??0,page:s.history?.page??0,rows:s.history?.events.map(e=>({id:e.id,action:waitlistActionLabel(e.action,ar.value),actor:e.actor,at:stamp(e.at,d?.timezone??context.state.current?.timezone??'Etc/UTC'),reason:e.reason??'',version:String(e.version)}))??[]}
 }})
 return{context,copy,view,fields,offerFields,reason,filter,editorOpen:editor.visible,offerOpen:offerEditor.visible,confirmationOpen:confirmation.visible,historyOpen,reload,create,save,action,offerDate,submitOffer,confirmAction,patients,types,changeFilter,search,changePage,historyPage}
}
