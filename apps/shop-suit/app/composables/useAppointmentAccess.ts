import {useOverlayState,usePageExitCleanup} from '@building-suit/ux'
import type {BsAppointmentAccessView} from '@building-suit/ui/types/appointmentAccessPresentation'
import type {ShopRpcDatabase} from '~/types/shopCrmRpc'
import {normalizeAppointmentAccessCode,parseAppointmentAccessStatus} from '#shared/appointmentAccess'
export function useAppointmentAccess(canManage:Ref<boolean>,find:(id:string)=>{id:string;customerName:string}|undefined) {
 const {currentId,currentLocationId}=useShop(),user=useSupabaseUser(),{locale}=useI18n(),captureScope=useShopTaskScope(),client=useShopClient<ShopRpcDatabase>().schema('public')
 const selected=ref<string|null>(null),name=ref(''),code=ref(''),loading=ref(false),enabled=ref(false),usablePhone=ref(false)
 const action=useRecordAction(()=>''),{pending,error}=action,{open}=useOverlayState()
 let generation=0
 function clear(){generation++;loading.value=false;code.value='';selected.value=null;name.value='';enabled.value=false;usablePhone.value=false}
 watch(open,value=>{if(!value)clear()},{flush:'sync'})
 watch([currentId,currentLocationId,()=>user.value?.id,canManage],()=>{open.value=false;clear()},{flush:'sync'})
 usePageExitCleanup(()=>{open.value=false;clear()})
 const message=()=>locale.value==='ar'?'تعذر تحديث رمز الوصول. حاول مرة أخرى.':'Could not update access. Please retry.'
 async function show(id:string){const item=find(id),shop=currentId.value,isCurrent=captureScope();if(!item||!shop||!canManage.value)return
  clear();const attempt=generation;selected.value=id;name.value=item.customerName;error.value='';open.value=true;loading.value=true
  try{const response=await client.rpc('appointment_access_status',{p_shop_id:shop,p_appointment_id:id});if(response.error)throw Error('ACCESS_UNAVAILABLE');if(!isCurrent()||generation!==attempt||selected.value!==id||!open.value)return;const status=parseAppointmentAccessStatus(response.data);enabled.value=status.enabled;usablePhone.value=status.usablePhone}catch{if(isCurrent()&&generation===attempt&&selected.value===id)error.value=message()}finally{if(isCurrent()&&generation===attempt&&selected.value===id)loading.value=false}
 }
 async function command(kind:'issue'|'revoke'){
  const shop=currentId.value,id=selected.value,isCurrent=captureScope(),attempt=generation;if(!shop||!id||!canManage.value||loading.value)return
  code.value=''
  await action.run(async()=>{
   if(kind==='issue'){
    const result=await client.rpc('appointment_access_issue',{p_shop_id:shop,p_appointment_id:id});if(result.error||!result.data||!normalizeAppointmentAccessCode(result.data.code))throw Error('ACCESS_UNAVAILABLE')
    if(isCurrent()&&generation===attempt&&selected.value===id&&open.value){code.value=result.data.code;enabled.value=true}
   }else{const result=await client.rpc('appointment_access_revoke',{p_shop_id:shop,p_appointment_id:id});if(result.error)throw Error('ACCESS_UNAVAILABLE');if(isCurrent()&&generation===attempt&&selected.value===id)enabled.value=false}
  },message)
 }
 const view=computed<BsAppointmentAccessView>(()=>{const ar=locale.value==='ar';return{title:(ar?'وصول العميل: ':'Customer access: ')+name.value,help:ar?'إصدار رمز جديد ينهي الوصول السابق فوراً. شاركه فقط عبر قناة متفق عليها؛ لا يرسل النظام أي رسالة.':'Issuing a new code ends earlier access immediately. Share it only through an agreed channel; the system sends no message.',loading:loading.value,pending:pending.value,error:error.value??'',code:code.value,enabled:enabled.value,usablePhone:usablePhone.value,copy:ar?{loading:'جارٍ التحميل',issue:'إصدار رمز الوصول',rotate:'تغيير رمز الوصول',revoke:'إلغاء الوصول',close:'إغلاق',code:'رمز الوصول',phoneRequired:'احفظ هاتفاً صالحاً للموعد أو اربطه بعميل مسجل قبل تفعيل الوصول.',enabled:'الوصول مفعّل',disabled:'الوصول غير مفعّل',oneTime:'يظهر الرمز مرة واحدة فقط. إغلاق هذه النافذة يمحوه من العرض.'}:{loading:'Loading',issue:'Issue access code',rotate:'Rotate access code',revoke:'Revoke access',close:'Close',code:'Access code',phoneRequired:'Save a usable appointment phone or link a saved customer before enabling access.',enabled:'Access enabled',disabled:'Access disabled',oneTime:'This code is shown once. Closing this dialog clears it from view.'}}})
 return{view,open,show,issue:()=>command('issue'),revoke:()=>command('revoke')}
}
