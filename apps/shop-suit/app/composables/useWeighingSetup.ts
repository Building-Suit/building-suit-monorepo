import { useShopScopeStore } from '~/stores/scope'
import { normalizeDecimalText } from '@building-suit/ux'
import type { BsWeighingForm, BsWeighingPicker, BsWeighingRow, BsWeighingView } from '@building-suit/ui/types/weighingSetupPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { WeighingSetupContext, WeighingSetupKind, WeighingSetupRecord, WeighingSetupValues } from '~/types/scales'
import type { ProductMeasurementOptions } from '~/types/measurement'
import { approvedFactorDecimal } from '~/utils/scaleMeasurement.js'
import { scaleFailure } from '~/utils/scaleCaptureCopy'
import { weighingSetupCopy } from '~/utils/weighingSetupCopy'
import { measurementUnits } from '~/utils/measurement'
type Command=ShopRpcDatabase['public']['Functions']['weighing_setup_command']['Args']
const empty=():WeighingSetupContext=>({items:[],total:0,page:1,pageSize:20,record:null,history:[],historyTotal:0,historyPage:1,canManage:false})
function checked(value:WeighingSetupContext|null,kind:WeighingSetupKind){
 const row=(r:WeighingSetupRecord)=>r&&typeof r.id==='string'&&typeof r.active==='boolean'&&Number.isSafeInteger(r.revision)&&typeof r.evidence_reference==='string'&&(kind==='device'?'serial_number' in r&&typeof r.serial_number==='string'&&!!r.serial_options:'kg_per_base_unit' in r&&typeof r.kg_per_base_unit==='string'&&typeof r.product_name==='string')
 if(!value||!Array.isArray(value.items)||value.items.length>20||value.items.some(r=>!row(r))||!Array.isArray(value.history)||value.history.length>20||value.history.some(e=>!e.snapshot||!row(e.snapshot.current))||value.record&&!row(value.record)||!Number.isSafeInteger(value.total)||typeof value.canManage!=='boolean')throw new Error('INVALID_WEIGHING_RESPONSE')
 return value
}
export function useWeighingSetup(){
 const scope=useShopScopeStore()
 const {currentId,currentLocationId}=useShop(),user=useSupabaseUser(),{locale}=useI18n(),rpc=useShopClient<ShopRpcDatabase>().schema('public'),captureScope=useShopTaskScope()
 const ar=computed(()=>locale.value==='ar'),copy=computed(()=>weighingSetupCopy(ar.value)),mode=ref<WeighingSetupKind>('device'),search=ref(''),term=ref(''),page=ref(1),historyPage=ref(1)
 const editorOpen=ref(false),historyOpen=ref(false),historyId=ref<string|null>(null),historyKind=ref<WeighingSetupKind>('device'),saving=ref(false),frozen=shallowRef<Command|null>(null),editorError=ref('')
 const editor=shallowRef<{id:string|null;revision:number;record:WeighingSetupRecord|null}>({id:null,revision:0,record:null})
 const blank=():BsWeighingForm=>({label:'',model:'',serialNumber:'',baudRate:'9600',dataBits:'8',stopBits:'1',parity:'none',flowControl:'none',productId:'',kgPerBaseUnit:'',evidenceReference:'',active:false,confirmed:false,reason:''})
 const form=ref(blank()),measurement=shallowRef<ProductMeasurementOptions|null>(null),unitLoading=ref(false),locked=computed(()=>saving.value||!!frozen.value),{dirty}=useRecordAction(()=>form.value,editorOpen)
 const productPicker=reactive(usePurchaseEntityPicker('product'));let measureGeneration=0
 useDebouncedChange(search,value=>{term.value=value.trim();page.value=1},250)
 watch(mode,()=>{page.value=1;search.value='';term.value=''})
 const {data,pending,error,refresh}=useShopQuery(()=>`shop-data:weighing-setup:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${mode.value}:${term.value}:${page.value}`,async()=>{
  if(!currentId.value||!currentLocationId.value)return empty()
  const r=await rpc.rpc('weighing_setup_context',{p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_kind:mode.value,p_search:term.value||null,p_page:page.value});if(r.error)throw r.error;return checked(r.data,mode.value)
 },{scope:'location',default:empty})
 const {data:historyData,pending:historyPending,error:historyError,refresh:refreshHistory}=useShopQuery(()=>`shop-data:weighing-history:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${historyKind.value}:${historyId.value}:${historyPage.value}`,async()=>{
  if(!currentId.value||!currentLocationId.value||!historyId.value)return empty()
  const r=await rpc.rpc('weighing_setup_context',{p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_kind:historyKind.value,p_id:historyId.value,p_history_page:historyPage.value});if(r.error)throw r.error;return checked(r.data,historyKind.value)
 },{scope:'location',enabled:()=>historyOpen.value,default:empty})
 function unit(code:string){const u=measurementUnits.find(row=>row.code===code);return(ar.value?u?.nameAr:u?.nameEn)||code}
 function date(value:string){const time=new Date(value);return Number.isNaN(time.getTime())?'—':new Intl.DateTimeFormat(ar.value?'ar-EG':'en-EG',{dateStyle:'medium',timeStyle:'short'}).format(time)}
 async function loadMeasurement(id:string){
  const token=++measureGeneration,valid=captureScope();measurement.value=null;unitLoading.value=!!id;if(!id||!currentId.value)return
  try{const r=await rpc.rpc('product_measurement_options',{p_shop_id:currentId.value,p_product_id:id});if(!valid()||token!==measureGeneration||!editorOpen.value||form.value.productId!==id)return;if(r.error)throw r.error
   const m=r.data;if(!m||m.status!=='active'||!Number.isSafeInteger(m.revision)||measurementUnits.find(u=>u.code===m.baseUnitCode)?.dimension!=='length')throw new Error('APPROVED_MASS_LENGTH_REQUIRED')
   measurement.value=m
   const prior=editor.value.record;if(prior&&'measurement_revision' in prior&&(prior.measurement_revision!==m.revision||prior.base_unit_code!==m.baseUnitCode)){form.value={...form.value,kgPerBaseUnit:'',confirmed:false};editorError.value=ar.value?'تغيرت وحدة الصنف. راجع العلاقة وأدخل معاملًا جديدًا للوحدة المعروضة.':'The product unit changed. Review the relationship and enter a new factor for the displayed unit.'}
  }catch(cause){if(valid()&&token===measureGeneration)editorError.value=scaleFailure(cause,ar.value)}finally{if(valid()&&token===measureGeneration)unitLoading.value=false}
 }
 function product(id:string){if(locked.value||editor.value.id)return;form.value={...form.value,productId:id,confirmed:false};editorError.value='';void loadMeasurement(id)}
 function create(){if(locked.value||pending.value||error.value||!data.value.canManage)return;measureGeneration++;measurement.value=null;unitLoading.value=false;editor.value={id:null,revision:0,record:null};form.value=blank();editorError.value='';editorOpen.value=true}
 function edit(id:string){if(locked.value||!data.value.canManage)return;const r=data.value.items.find(row=>row.id===id);if(!r)return
  editor.value={id:r.id,revision:r.revision,record:structuredClone(toRaw(r))};form.value={...blank(),active:r.active,evidenceReference:r.evidence_reference,...('serial_number' in r?{label:r.label,model:r.model,serialNumber:r.serial_number,baudRate:String(r.serial_options.baudRate),dataBits:String(r.serial_options.dataBits),stopBits:String(r.serial_options.stopBits),parity:r.serial_options.parity,flowControl:r.serial_options.flowControl}:{productId:r.product_id,kgPerBaseUnit:r.kg_per_base_unit})};editorError.value='';editorOpen.value=true;if('product_id' in r)void loadMeasurement(r.product_id)
 }
 function history(id:string){if(locked.value)return;historyKind.value=mode.value;historyId.value=id;historyPage.value=1;historyOpen.value=true}
 async function submit(){
  if(saving.value||!currentId.value||!currentLocationId.value)return
  const valid=captureScope();let confirmed=false
  try{
   if(!frozen.value){
    const f=form.value;if(f.evidenceReference.trim().length<3||f.evidenceReference.length>500||f.reason.trim().length<3||f.reason.length>500||f.active&&!f.confirmed)throw new Error('INVALID_APPROVAL')
    let values:WeighingSetupValues={active:f.active,confirmed:f.confirmed,evidenceReference:f.evidenceReference.trim()}
    if(mode.value==='device'){
     const baud=Number(normalizeDecimalText(f.baudRate)),bits=Number(f.dataBits),stops=Number(f.stopBits)
     if(!f.label.trim()||f.label.length>120||!f.model.trim()||f.model.length>120||!f.serialNumber.trim()||f.serialNumber.length>64||[...f.serialNumber].some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)>126||ch==='"'||ch==='\\')||![1200,2400,4800,9600,19200,38400,57600,115200].includes(baud)||![7,8].includes(bits)||![1,2].includes(stops)||!['none','even','odd'].includes(f.parity)||!['none','hardware'].includes(f.flowControl))throw new Error('INVALID_APPROVAL')
     values={...values,label:f.label.trim(),model:f.model.trim(),serialNumber:f.serialNumber.trim(),serialOptions:{baudRate:baud,dataBits:bits as 7|8,stopBits:stops as 1|2,parity:f.parity as 'none'|'even'|'odd',flowControl:f.flowControl as 'none'|'hardware'}}
    }else{
     if(!f.productId||unitLoading.value||f.active&&!measurement.value)throw new Error('APPROVED_MASS_LENGTH_REQUIRED')
     const prior=editor.value.record,m=measurement.value
     values={...values,productId:f.productId,kgPerBaseUnit:approvedFactorDecimal(normalizeDecimalText(f.kgPerBaseUnit)),baseUnitCode:m?.baseUnitCode||(prior&&'base_unit_code' in prior?prior.base_unit_code:''),measurementRevision:m?.revision||(prior&&'measurement_revision' in prior?prior.measurement_revision:0)}
    }
    frozen.value={p_request_id:crypto.randomUUID(),p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_kind:mode.value,p_id:editor.value.id,p_revision:editor.value.revision,p_values:values,p_reason:f.reason.trim()}
   }
   saving.value=true;editorError.value='';const command=frozen.value,r=await rpc.rpc('weighing_setup_command',command);if(!valid())return
   if(r.error){if(r.error.code&&/^[0-9A-Z]{5}$/.test(r.error.code)&&!r.error.code.startsWith('08'))frozen.value=null;throw r.error}
   if(!r.data||typeof r.data.id!=='string'||!Number.isSafeInteger(r.data.revision)||r.data.kind!==command.p_kind||command.p_id&&r.data.id!==command.p_id)throw new Error('UNCONFIRMED_WEIGHING_APPROVAL')
   frozen.value=null;confirmed=true;await refresh()
  }catch(cause){if(valid()&&!confirmed)editorError.value=frozen.value?(ar.value?'لم تتأكد نتيجة الاعتماد. أعد نفس الطلب قبل تغيير القيم.':'The approval result is unconfirmed. Retry the same request before changing its values.'):scaleFailure(cause,ar.value)}
  finally{if(valid()){saving.value=false;if(confirmed)editorOpen.value=false}}
 }
 function fields(r:WeighingSetupRecord){const c=copy.value;return[{label:c.name,value:'label' in r?r.label:r.product_name},{label:'serial_number' in r?c.serial:c.factor,value:'serial_number' in r?r.serial_number:`${r.kg_per_base_unit} kg / ${unit(r.base_unit_code)}`},{label:c.evidence,value:r.evidence_reference},{label:c.revision,value:String(r.revision)},{label:c.date,value:date(r.approved_at)},{label:c.active,value:r.active?(ar.value?'نعم':'Yes'):(ar.value?'لا':'No')}]}
 const rows=computed<BsWeighingRow[]>(()=>data.value.items.map(r=>({id:r.id,name:'label' in r?r.label:r.product_name,detail:'model' in r?r.model:unit(r.base_unit_code),value:'serial_number' in r?r.serial_number:r.kg_per_base_unit,evidence:r.evidence_reference,status:r.active?(ar.value?'نشط':'Active'):(ar.value?'غير نشط':'Inactive'),revision:String(r.revision)})))
 const products=computed<BsWeighingPicker>(()=>({options:productPicker.options(form.value.productId?{id:form.value.productId,name:editor.value.record&&'product_name' in editor.value.record?editor.value.record.product_name:productPicker.items.find(r=>r.id===form.value.productId)?.name||form.value.productId}:undefined),loading:productPicker.pending,error:productPicker.error,hasMore:productPicker.hasMore}))
 const view=computed<BsWeighingView>(()=>({available:!!currentId.value&&!!currentLocationId.value,loading:pending.value,error:error.value?scaleFailure(error.value,ar.value):'',locked:locked.value,canManage:!pending.value&&!error.value&&data.value.canManage,total:data.value.total,modes:[{value:'device',label:copy.value.devices},{value:'factor',label:copy.value.factors}],
  editor:{title:editor.value.id?copy.value.edit:copy.value.add,pending:saving.value,dirty:dirty.value,error:editorError.value,identityLocked:!!editor.value.id,unit:measurement.value?unit(measurement.value.baseUnitCode):editor.value.record&&'base_unit_code' in editor.value.record?unit(editor.value.record.base_unit_code):'',unitLoading:unitLoading.value,
   notice:mode.value==='device'?(ar.value?'فعّل فقط جهاز MT-SICS مدعومًا بعد التحقق من رقمه التسلسلي وإعداداته ووضع القراءة عند الطلب.':'Activate only a supported MT-SICS device after verifying its serial number, settings and on-demand mode.'):(ar.value?'أدخل علاقة موثقة تخص هذا الصنف ووحدة مخزونه المعروضة. لا يوجد تحويل عام بين الوزن والطول، ولا يشمل هذا المسار البكرات المتتبعة.':'Enter a documented relationship for this product and its displayed stock unit. There is no universal mass/length conversion; individually tracked reels use their physical length.')},
  history:{title:copy.value.history,loading:historyPending.value,error:historyError.value?scaleFailure(historyError.value,ar.value):'',total:historyData.value.historyTotal,fields:historyData.value.record?fields(historyData.value.record):[],events:historyData.value.history.map(e=>({id:e.id,revision:String(e.revision),reason:e.reason,changes:fields(e.snapshot.current).map(f=>`${f.label}: ${f.value}`).join(' · '),actor:e.actor_name||'—',date:date(e.created_at)}))}}))
 watch([()=>scope.actorId,()=>scope.revision,currentId,currentLocationId,()=>user.value?.id],()=>{measureGeneration++;editorOpen.value=false;historyOpen.value=false;frozen.value=null;saving.value=false;form.value=blank();measurement.value=null;unitLoading.value=false;editorError.value='';historyId.value=null;page.value=1;historyPage.value=1;mode.value='device';search.value='';term.value=''},{flush:'sync'})
 watch(editorOpen,value=>{if(!value){measureGeneration++;unitLoading.value=false}});onScopeDispose(()=>{measureGeneration++})
 return{mode,search,page,historyPage,editorOpen,historyOpen,form,copy,view,rows,products,productPicker,refresh,refreshHistory,create,edit,history,submit,product}
}
