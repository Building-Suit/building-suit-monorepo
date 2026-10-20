import {downloadBlob,openPrintSession,usePrivateSessionLifecycle} from '@building-suit/ux'
import {renderReportDocument,renderPendingPrintDocument} from '@building-suit/ui/utils/reportDocument'
import type {BsReleasedClinicalView} from '@building-suit/ui/utils/clinicalPresentation'
import {clinicalCopy,clinicalChoices} from '../utils/clinicalPresentation'
export function useDoctorClinicalRelease(){
 const app=useNuxtApp(),service=app.$doctorClinicalRelease,auth=useDoctorAuth(),route=useRoute(),{locale}=useI18n(),ar=computed(()=>locale.value==='ar'),copy=computed(()=>clinicalCopy(ar.value))
 const id=computed(()=>String(route.params.id??'')),scope=computed(()=>JSON.stringify([auth.state.identity?.userId,auth.state.identity?.sessionId,id.value]))
 let printSession:ReturnType<typeof openPrintSession>=null
 const expires=computed(()=>service.state.release?.expires_at??null),pending=computed(()=>service.state.pending)
 const reload=async()=>{await service.load(id.value)}
 const clear=()=>{service.clear();printSession?.close();printSession=null}
 watch(scope,()=>{clear();if(import.meta.client&&!document.hidden&&auth.state.identity)void reload()},{flush:'sync'})
 onMounted(()=>{if(!document.hidden&&auth.state.identity)void reload()})
 onBeforeUnmount(clear)
 usePrivateSessionLifecycle(expires,pending,{clear:service.clear,suspend:clear,expire:()=>{clear();service.state.error='denied'},refresh:reload})
 const date=(value:string,timezone:string)=>new Intl.DateTimeFormat(ar.value?'ar':'en',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(new Date(value))
 const view=computed<BsReleasedClinicalView>(()=>{
  const value=service.state.release,c=copy.value,choices=clinicalChoices(ar.value)
  return {title:ar.value?'نسخة اصطناعية متاحة لمستلم محدد':'Released synthetic record',notice:c.notice,loading:service.state.loading,pending:service.state.pending,available:Boolean(value),unavailable:ar.value?'هذه النسخة غير متاحة أو انتهت مدتها أو سُحبت صلاحية الوصول إليها.':'This version is unavailable, expired or no longer authorized.',error:service.state.error==='network'?(ar.value?'تعذر التحقق من الإتاحة الحالية. أعد المحاولة.':'Current access could not be verified. Retry.'):null,
   metadata:value?[{label:c.patient,value:value.patient_name},{label:c.actor,value:value.doctor_name},{label:c.revision,value:String(value.revision)},{label:ar.value?'العيادة':'Clinic',value:`${value.location_name} · ${value.timezone}`},{label:c.date,value:date(value.finalized_at,value.timezone)},{label:ar.value?'ينتهي الوصول في':'Access ends',value:date(value.expires_at,value.timezone)}]:[],
   prescriptions:value?.prescriptions.map(item=>({id:item.id,name:item.medicine.label,identity:item.medicine.identity,strength:item.medicine.strength,form:item.medicine.form,amount:`${item.dose.amount} ${item.dose.unit}`,route:item.dose.route,segments:item.segments.map(s=>[choices.segmentKinds.find(choice=>choice.value===s.kind)?.label,`${s.start_date} – ${s.end_date}`,s.timezone,s.interval_minutes===null?'':`${c.interval}: ${s.interval_minutes}`,s.weekdays.join(','),s.times.join(','),s.instructions].filter(Boolean).join(' · ')).join('\n'),instructions:item.instructions}))??[],
   results:value?.results.map(item=>({id:item.id,order:value.orders.find(order=>order.id===item.order_id)?.request??'',annotation:item.annotation}))??[],documents:value?.documents.map(item=>({id:item.id,name:item.filename}))??[]}
 })
 async function download(versionId:string){const expected=scope.value,result=await service.download(versionId);if(result&&scope.value===expected)downloadBlob(result.filename,result.blob)}
 async function print(){
  const expected=scope.value,c=copy.value;printSession?.close();printSession=openPrintSession(renderPendingPrintDocument(c.print,ar.value?'rtl':'ltr',c.notice));const session=printSession;if(!session)return
  if(!await service.load(id.value)||scope.value!==expected||!service.state.release){session.close();return}
  const value=service.state.release,rows=view.value.prescriptions.map(item=>[item.name,item.identity,item.strength,item.form,item.amount,item.route,item.segments,item.instructions])
  session.print(renderReportDocument([c.name,c.identity,c.strength,c.form,c.amount,c.route,c.segments,c.instructions],rows,new Set(),{title:c.print,organization:value.doctor_name,currency:String(value.revision),generatedAt:date(value.finalized_at,value.timezone),direction:ar.value?'rtl':'ltr',labels:{organization:c.actor,currency:c.revision,generatedAt:c.date,warning:c.status},filters:view.value.metadata,warning:c.notice}))
 }
 return {copy,view,reload,download,print}
}
