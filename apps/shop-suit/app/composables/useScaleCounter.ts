import { useShopScopeStore } from '~/stores/scope'
import { createSicsScale, type SicsScaleState } from '@building-suit/ux/sicsScale'
import type { BsScaleCaptureForm, BsScaleCaptureView } from '@building-suit/ui/types/scaleCapturePresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { ScaleCaptureResolution, ScaleCounterContext, ScaleDeviceChoice } from '~/types/scales'
import { scaleStockQuantity, verifyScaleCapture } from '~/utils/scaleMeasurement.js'
import { scaleCaptureCopy, scaleFailure } from '~/utils/scaleCaptureCopy'
import { measurementUnits } from '~/utils/measurement'
type Command = ShopRpcDatabase['public']['Functions']['record_scale_capture']['Args']
const emptyContext = (): ScaleCounterContext => ({ profiles:[],items:[],total:0,page:1,pageSize:20,selected:null,factor:null,canConfigure:false })
function checkedContext(value: ScaleCounterContext | null): ScaleCounterContext {
 if (!value || !Array.isArray(value.profiles) || value.profiles.length>50 || value.profiles.some(p=>typeof p.id!=='string'||typeof p.serialNumber!=='string'||typeof p.label!=='string'||!Number.isSafeInteger(p.revision)||!p.serialOptions)
  || !Array.isArray(value.items) || value.items.length>20 || value.items.some(p=>typeof p.id!=='string'||typeof p.name!=='string') || !Number.isSafeInteger(value.total) || value.total<0
  || typeof value.canConfigure!=='boolean' || value.selected && (!value.selected.measurement || value.selected.itemType!=='product')) throw new Error('INVALID_SCALE_CONTEXT_RESPONSE')
 return value
}
export function useScaleCounter(online: Readonly<Ref<boolean>>, blocked: () => boolean, add: (resolution: ScaleCaptureResolution) => void) {
 const scope=useShopScopeStore()
 const {currentId,currentLocationId,current}=useShop(),user=useSupabaseUser(),{locale}=useI18n(),rpc=useShopClient<ShopRpcDatabase>().schema('public'),captureScope=useShopTaskScope(),confirmation=useConfirmation()
 const ar=computed(()=>locale.value==='ar'),open=ref(false),form=ref<BsScaleCaptureForm>({profileId:'',productId:''}),context=shallowRef(emptyContext()),products=ref<{id:string;name:string}[]>([])
 const loading=ref(false),loadError=ref(false),error=ref(''),saving=ref(false),frozen=shallowRef<Command|null>(null),connectedDevice=shallowRef<ScaleDeviceChoice|null>(null)
 const state=shallowRef<SicsScaleState>({status:'disconnected',serial:null,canTare:false,canConnect:true,reading:null,error:null})
 const controller=createSicsScale({onState:value=>{state.value=value}})
 let generation=0,page=1,search='',lastAppend=false,disposed=false
 const readingContext=ref('')
 const copy=computed(()=>scaleCaptureCopy(ar.value,!!frozen.value)),locked=computed(()=>saving.value||!!frozen.value)
 const busy=computed(()=>['connecting','reading','taring','disconnecting'].includes(state.value.status))
 const identity=()=>JSON.stringify([form.value.productId,context.value.selected?.measurement.revision,context.value.factor?.id??null,context.value.factor?.revision??null])
 function unit(code:string){const item=measurementUnits.find(u=>u.code===code);return (ar.value?item?.nameAr:item?.nameEn)||code}
 async function load(append=false,selectionOnly=false){
  if(!open.value||!currentId.value||!currentLocationId.value||!online.value)return
  const token=++generation,valid=captureScope(),next=append?page+1:1;lastAppend=append;loading.value=true;loadError.value=false
  try{
   const r=await rpc.rpc('scale_counter_context',{p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_search:search.trim()||null,p_page:next,p_product_id:form.value.productId||null})
   if(!valid()||disposed||token!==generation||!open.value)return;if(r.error)throw r.error
   const data=checkedContext(r.data),previous=identity();if(form.value.productId&&data.selected?.id!==form.value.productId)throw new Error('INVALID_SCALE_CONTEXT_RESPONSE');context.value=data
   if(!selectionOnly){page=next;products.value=append?[...products.value,...data.items.filter(row=>!products.value.some(p=>p.id===row.id))]:data.items}
   if(!form.value.profileId&&data.profiles[0])form.value={...form.value,profileId:data.profiles[0].id}
   const device=connectedDevice.value,currentProfile=data.profiles.find(p=>p.id===device?.id)
   if(device&&(!currentProfile||currentProfile.revision!==device.revision)){await controller.disconnect();connectedDevice.value=null;error.value=scaleFailure(new Error('SCALE_DEVICE_CONTEXT_CHANGED'),ar.value)}
   if(state.value.reading&&previous!==identity()){controller.forgetReading();readingContext.value=''}
  }catch(cause){if(valid()&&token===generation&&!disposed){loadError.value=true;error.value=scaleFailure(cause,ar.value)}}
  finally{if(valid()&&token===generation&&!disposed)loading.value=false}
 }
 async function show(){if(blocked()||!currentId.value||!currentLocationId.value)return;error.value='';form.value={profileId:'',productId:''};context.value=emptyContext();products.value=[];page=1;search='';readingContext.value='';open.value=true;await load()}
 async function connect(){
  if(locked.value||busy.value||!online.value||blocked())return
  const device=context.value.profiles.find(p=>p.id===form.value.profileId),valid=captureScope();if(!device)return
  error.value='';readingContext.value=''
  try{await controller.connect(device.serialOptions,device.serialNumber);if(valid()&&open.value&&!disposed)connectedDevice.value=structuredClone(device);else await controller.disconnect()}
  catch(cause){if(valid()&&!disposed)error.value=scaleFailure(cause,ar.value)}
 }
 async function disconnect(){if(locked.value)return;await controller.disconnect();connectedDevice.value=null;readingContext.value=''}
 async function read(){
  if(locked.value||busy.value||!online.value||blocked()||loading.value||loadError.value||!context.value.selected||!connectedDevice.value)return
  const valid=captureScope(),identityBefore=identity();error.value=''
  try{await controller.read();if(!valid()||disposed||!open.value||identityBefore!==identity()){controller.forgetReading();return}readingContext.value=identityBefore;scaleStockQuantity(controller.currentReading().net,controller.currentReading().unit,context.value.selected,context.value.factor)}
  catch(cause){if(valid()&&!disposed)error.value=scaleFailure(cause,ar.value)}
 }
 async function tare(){
  if(locked.value||busy.value||blocked()||!state.value.canTare)return
  const valid=captureScope();if(!await confirmation.ask(ar.value?'ضع الوعاء الفارغ ثم أكّد خصم وزنه على الميزان. ستُلغى القراءة السابقة.':'Place the empty container, then confirm setting its tare on the scale. The previous reading will be cleared.'))return
  if(!valid()||disposed||!open.value)return
  error.value='';readingContext.value='';try{await controller.tare(true)}catch(cause){if(valid()&&!disposed)error.value=scaleFailure(cause,ar.value)}
 }
 function profile(id:string){if(locked.value||busy.value||!state.value.canConnect)return;controller.forgetReading();connectedDevice.value=null;readingContext.value='';form.value={...form.value,profileId:id};error.value=''}
 function product(id:string){if(locked.value||busy.value)return;controller.forgetReading();readingContext.value='';form.value={...form.value,productId:id};error.value='';void load(false,true)}
 function query(value:string){if(locked.value)return;search=value.slice(0,120);void load()}
 function more(){if(!loading.value&&products.value.length<context.value.total&&!locked.value)void load(true)}
 async function submit(){
  if(saving.value||blocked()||!online.value||!currentId.value||!currentLocationId.value)return
  const valid=captureScope();let created=false
  try{
   if(!frozen.value){
    const device=connectedDevice.value,selected=context.value.selected,reading=controller.currentReading()
    if(!device||!selected||readingContext.value!==identity()||selected.id!==form.value.productId||loading.value||loadError.value)throw new Error('SCALE_CONTEXT_CHANGED')
    scaleStockQuantity(reading.net,reading.unit,selected,context.value.factor)
    frozen.value=structuredClone({p_request_id:crypto.randomUUID(),p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_product_id:selected.id,p_device_id:device.id,p_device_revision:device.revision,
     p_reading:{tareBefore:reading.tareBefore,stable:reading.stable,tareAfter:reading.tareAfter,serial:reading.serial,readAt:reading.readAt,confirmed:true},p_factor_id:context.value.factor?.id??null,p_factor_revision:context.value.factor?.revision??null})
   }
   saving.value=true;error.value='';const command=frozen.value
   const saved=await rpc.rpc('record_scale_capture',command);if(!valid()||disposed)return
   if(saved.error){if(saved.error.code&&(/^[0-9A-Z]{5}$/.test(saved.error.code)&&!saved.error.code.startsWith('08')||/^PGRST20[234]$/.test(saved.error.code)))frozen.value=null;throw saved.error}
   if(!saved.data||typeof saved.data.id!=='string'||typeof saved.data.quantity!=='string')throw new Error('UNCONFIRMED_SCALE_CAPTURE')
   const resolved=await rpc.rpc('get_scale_capture',{p_shop_id:command.p_shop_id,p_location_id:command.p_location_id,p_capture_id:saved.data.id});if(!valid()||disposed)return
   if(resolved.error){if(resolved.error.code&&/^[0-9A-Z]{5}$/.test(resolved.error.code)&&!resolved.error.code.startsWith('08'))frozen.value=null;throw resolved.error}
   const result=verifyScaleCapture(resolved.data) as ScaleCaptureResolution
   if(result.id!==saved.data.id||result.item.id!==command.p_product_id||result.quantity!==saved.data.quantity)throw new Error('INVALID_SCALE_CAPTURE_RESPONSE')
   created=true;frozen.value=null;add(result);open.value=false;controller.forgetReading()
  }catch(cause){if(valid()&&!disposed){if(created)frozen.value=null;error.value=frozen.value?(ar.value?'لم تتأكد نتيجة حفظ الوزن. أعد نفس الطلب قبل وزن بند آخر.':'The capture result is unconfirmed. Retry the same request before weighing another line.'):scaleFailure(cause,ar.value)}}
  finally{if(valid()&&!disposed)saving.value=false}
 }
 const quantity=computed(()=>{try{return state.value.reading&&context.value.selected?scaleStockQuantity(state.value.reading.net,state.value.reading.unit,context.value.selected,context.value.factor):''}catch{return ''}})
 const view=computed<BsScaleCaptureView>(()=>{
  const c=copy.value,s=state.value,device=connectedDevice.value,reading=s.reading,browser=typeof navigator!=='undefined'&&typeof (navigator as Navigator&{serial?:{requestPort?:unknown}}).serial?.requestPort==='function'
  const statuses=ar.value?{disconnected:'غير متصل',connecting:'جارٍ التوصيل',ready:'جاهز',reading:'جارٍ انتظار قراءة ثابتة',taring:'جارٍ ضبط وزن الوعاء',disconnecting:'جارٍ الفصل',error:'تحتاج مراجعة'}:{disconnected:'Disconnected',connecting:'Connecting',ready:'Ready',reading:'Waiting for stable weight',taring:'Setting tare',disconnecting:'Disconnecting',error:'Needs attention'}
  return{available:!!currentId.value&&!!currentLocationId.value&&current.value?.business_mode!=='service',loading:loading.value,error:error.value||(s.error?scaleFailure(new Error(s.error),ar.value):''),
   notice:!online.value?(ar.value?'اتصل لتأكيد قراءة الميزان، أو تابع البيع بإدخال الكمية يدويًا.':'Connect to confirm a scale reading, or continue the sale with a manually entered quantity.'):!browser?scaleFailure(new Error('SCALE_BROWSER_UNSUPPORTED'),ar.value):ar.value?'راجع الصنف والوزن الصافي والوحدة ثم أكّد الإضافة. البيع اليدوي متاح دائمًا.':'Review the product, net weight and unit before confirming. Manual entry remains available.',status:statuses[s.status],pending:saving.value,locked:locked.value,dirty:!!reading,
   canConnect:browser&&online.value&&s.canConnect&&!!form.value.profileId&&!loading.value&&!locked.value&&!blocked(),canDisconnect:!s.canConnect&&s.status!=='disconnecting'&&!locked.value,
   canRead:s.status==='ready'&&!!device&&!!context.value.selected&&!loading.value&&!loadError.value&&!locked.value&&online.value&&!blocked(),canTare:s.status==='ready'&&s.canTare&&!locked.value&&!blocked(),
   canSubmit:!saving.value&&online.value&&!blocked()&&(!!frozen.value||s.status==='ready'&&!!reading&&!!quantity.value&&readingContext.value===identity()&&!loading.value&&!loadError.value),deviceLocked:!s.canConnect||busy.value||locked.value,productLocked:busy.value||locked.value,
   profiles:context.value.profiles.map(p=>({value:p.id,label:`${p.label} · ${p.model} · ${p.serialNumber}`})),products:products.value,productLoading:loading.value,productError:loadError.value?error.value:null,productHasMore:products.value.length<context.value.total,
   fields:reading?[{label:c.stockQuantity,value:quantity.value&&context.value.selected?`${quantity.value} ${unit(context.value.selected.measurement.baseUnitCode)}`:'—'},{label:c.net,value:`${reading.net} ${unit(reading.unit)}`},{label:c.tareWeight,value:`${reading.tare} ${unit(reading.unit)}`},{label:c.gross,value:`${reading.gross} ${unit(reading.unit)}`}]:[],
   factorNotice:context.value.factor?`${c.factor}: ${context.value.factor.kgPerBaseUnit} kg / ${unit(context.value.factor.baseUnitCode)} · ${context.value.factor.evidenceReference}`:'',deviceNotice:device?`${device.model} · ${device.serialNumber}`:'',setupTo:context.value.canConfigure?'/weighing-setup':undefined}
 })
 watch(open,value=>{if(!value){generation++;loading.value=false;readingContext.value='';connectedDevice.value=null;void controller.disconnect()}})
 watch([()=>scope.actorId,()=>scope.revision,currentId,currentLocationId,()=>user.value?.id],()=>{generation++;frozen.value=null;saving.value=false;open.value=false;form.value={profileId:'',productId:''};context.value=emptyContext();products.value=[];error.value='';readingContext.value='';connectedDevice.value=null;void controller.disconnect()},{flush:'sync'})
 watch(online,value=>{if(!value){readingContext.value='';connectedDevice.value=null;void controller.disconnect()}})
 onScopeDispose(()=>{disposed=true;generation++;void controller.disconnect()})
 return{open,form,view,copy,show,profile,product,query,more,retry:()=>load(lastAppend),connect,disconnect,read,tare,submit}
}
