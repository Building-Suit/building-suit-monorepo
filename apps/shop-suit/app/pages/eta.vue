<script setup lang="ts">
import type { BsEtaCopy, BsEtaForm, BsEtaRow } from '@building-suit/ui/types/etaPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
definePageMeta({ layout: 'default', middleware: ['auth'] })
const { currentId } = useShop()
const user = useSupabaseUser()
const { locale } = useI18n()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const blank = (): BsEtaForm => ({ profile:{legalName:'',rin:'',activityCode:''},branches:[],items:[],reason:'' })
const form = ref<BsEtaForm>(blank())
const pending = ref(false), message = ref(''), offset = ref(0)
const invoice = ref(''), buyerName = ref(''), buyerId = ref(''), paymentMethod = ref('C')
const action = useRecordAction(()=>form.value)
const { visible:editor, dirty } = action
interface Configuration {profile:BsEtaForm['profile'];branches:Omit<BsEtaForm['branches'][number],'name'|'configured'>[];items:Omit<BsEtaForm['items'][number],'name'|'configured'>[]}
interface Settings {sales:{id:string;label:string}[];configuration:Configuration|null;locations:{id:string;name:string}[];items:{id:string;name:string;sourceType:string}[];documents:{id:string;invoice_id:string;invoice_number:string;state:string;document_uuid:string|null;submission_uuid:string|null;error_code:string|null}[]}
const {data,pending:loading,error,refresh}=useAsyncData(
 ()=>`shop-data:eta:${user.value?.id ?? 'none'}:${currentId.value ?? 'none'}:${offset.value}`,
 async ():Promise<Settings|null>=>{
  if (!currentId.value) return null
  const result=await rpc.rpc('eta_settings',{p_shop_id:currentId.value,p_offset:offset.value})
  if (result.error) throw result.error
  return result.data as Settings
 },{watch:[currentId,offset],default:()=>null},
)
const ar=computed(()=>locale.value==='ar')
const copy=computed<BsEtaCopy>(()=>ar.value?{
 title:'الربط مع مصلحة الضرائب',help:'إعداد هوية التاجر وأكواد الفروع والأصناف منفصل عن حساب الضريبة. التصدير المبدئي بالجنيه المصري فقط. حفظ الإعدادات لا يفعّل الإرسال ولا يثبت الامتثال.',
 edit:'تعديل الإعدادات',save:'حفظ',cancel:'إلغاء',loading:'جار التحميل',error:'تعذر التحميل أو ليس لديك صلاحية مدير لكل المواقع.',retry:'تحديث',saved:'اتحفظت الإعدادات.',noContext:'اختار النشاط الأول.',legalName:'الاسم القانوني',rin:'رقم التسجيل الضريبي (٩ أرقام)',activityCode:'كود النشاط',branches:'الفروع وأجهزة البيع',items:'أكواد الأصناف والخدمات',configured:'إعداد للتصدير',branchCode:'كود الفرع لدى المصلحة',deviceSerialNumber:'الرقم التسلسلي لجهاز البيع',country:'الدولة',governate:'المحافظة',regionCity:'المدينة أو المنطقة',street:'الشارع',buildingNumber:'رقم المبنى',itemType:'نوع الكود',itemCode:'كود GS1 أو EGS',unitType:'كود الوحدة لدى المصلحة',reason:'سبب التعديل',status:'الحالة',setup:'الإرسال الحي غير مفعّل. يلزم إعداد مزود الاختبار على الخادم وأكواد معتمدة. الفاتورة الإلكترونية للشركات تحتاج مسارًا منفصلًا وتوقيع CAdES-BES. تفعيل الإنتاج يحتاج مراجعة إلزام التاجر ودليل قبول خارجي من المصلحة.',history:'حالة المستندات',empty:'لا توجد مستندات في قائمة الإرسال.',invoice:'إيصال البيع',reference:'مرجع الإرسال',details:'الإجراء المطلوب',queue:'إضافة إيصال مستهلك لقائمة الإرسال',buyerName:'اسم المشتري عند اللزوم',buyerId:'الرقم القومي عند اللزوم (١٤ رقمًا)',paymentMethod:'طريقة الدفع: C نقدي، V فيزا، O أخرى',previous:'السابق',next:'التالي',
 }:{
 title:'ETA submission',help:'Merchant identity and branch/item codes are separate from tax calculation. Initial export supports EGP only. Saving settings does not activate submission or establish compliance.',
 edit:'Edit setup',save:'Save',cancel:'Cancel',loading:'Loading',error:'Could not load, or manager access to every location is required.',retry:'Refresh',saved:'Configuration saved.',noContext:'Choose a business first.',legalName:'Legal name',rin:'Tax RIN (9 digits)',activityCode:'Activity code',branches:'Branches and POS devices',items:'Item and service codes',configured:'Configure for export',branchCode:'ETA branch code',deviceSerialNumber:'POS serial number',country:'Country',governate:'Governorate',regionCity:'City or region',street:'Street',buildingNumber:'Building number',itemType:'Code type',itemCode:'GS1 or EGS code',unitType:'ETA unit code',reason:'Reason for change',status:'Status',setup:'Live submission is inactive. Server preproduction provider setup and verified codes are required. B2B eInvoice requires a separate adapter and CAdES-BES signing. Production activation requires taxpayer mandate review and external ETA acceptance evidence.',history:'Submission status',empty:'No documents queued.',invoice:'Sale receipt',reference:'Submission reference',details:'Required action',queue:'Queue B2C receipt',buyerName:'Buyer name when required',buyerId:'National ID when required (14 digits)',paymentMethod:'Payment: C cash, V Visa, O other',previous:'Previous',next:'Next',
})
const stateLabels=computed<Record<string,string>>(()=>ar.value?{queued:'في الانتظار',prepared:'جاهز',retry:'إعادة المحاولة مؤجلة',submitting:'جار الإرسال',submitted:'مُرسل؛ التحقق لم يكتمل',valid:'صالح لدى المصلحة',invalid:'غير صالح لدى المصلحة',cancelled:'ملغى',uncertain:'يحتاج مطابقة خارجية؛ لا تعيد الإرسال',blocked:'غير مدعوم أو الإعداد ناقص'}:{queued:'Queued',prepared:'Prepared',retry:'Retry scheduled',submitting:'Submitting',submitted:'Submitted; validation pending',valid:'ETA valid',invalid:'ETA invalid',cancelled:'Cancelled',uncertain:'External reconciliation required; do not resubmit',blocked:'Unsupported or configuration incomplete'})
const setupStatus=computed(()=>{
 const config=data.value?.configuration
 if (!config) return ar.value?'بيانات التاجر غير مكتملة. احفظ الاسم القانوني ورقم التسجيل وكود النشاط أولًا.':'Merchant setup is missing. Save legal name, RIN and activity code first.'
 const missingBranches=(data.value?.locations??[]).filter(location=>!config.branches.some(branch=>branch.locationId===location.id)).length
 const missingItems=(data.value?.items??[]).filter(item=>!config.items.some(code=>code.sourceId===item.id && code.sourceType===item.sourceType)).length
 return ar.value?`فروع بدون إعداد: ${missingBranches}. أصناف بدون أكواد: ${missingItems}. الأكواد تحتاج تأكيد لدى المصلحة.`:`Branches missing setup: ${missingBranches}. Items missing codes: ${missingItems}. Codes still require ETA verification.`
})
function usefulError(code:string|null|undefined) {
 if (!code) return ''
 if (/CONFIGURATION|BRANCH|ITEM|PROVIDER|CONTRACT/.test(code)) return ar.value?'راجع بيانات التاجر والفرع والأكواد وإعداد المزود على الخادم.':'Review merchant, branch, item codes and server provider setup.'
 if (/EGP/.test(code)) return ar.value?'التصدير متاح بالجنيه المصري فقط؛ البيع نفسه غير مقيد.':'Export supports EGP only; operational sales remain available.'
 if (/BUYER/.test(code)) return ar.value?'راجع هوية المشتري وطريقة الدفع. بيانات الهوية إلزامية عند حد المصلحة.':'Check buyer identity and payment. Identity is mandatory at the ETA threshold.'
 if (/LEGACY|PRECISION|ROUNDING|EQUATION|TREATMENT|RATE/.test(code)) return ar.value?'المستند غير مدعوم للتصدير بأمان. لن يتم تقريب أو تعديل الأصل.':'This snapshot cannot be exported safely. Original amounts are preserved.'
 if (/UNKNOWN/.test(code)) return ar.value?'راجع نتيجة الإرسال لدى المصلحة قبل أي إجراء.':'Reconcile the outcome with ETA before further action.'
 if (/INVALID|REJECTED/.test(code)) return ar.value?'راجع رفض المصلحة. تصحيح المستند ليس مرتجع بيع.':'Review ETA rejection. Document correction is separate from a sale return.'
 if (/AUTHENTICATION/.test(code)) return ar.value?'مسؤول الخادم يحتاج مراجعة إعداد وصول جهاز البيع.':'Server operator must review POS access setup.'
 return ar.value?'تعذر تنفيذ الطلب. راجع البيانات والصلاحية ثم حاول مجددًا.':'Could not complete the request. Check values and permissions, then retry.'
}
const records=computed<BsEtaRow[]>(()=> (data.value?.documents??[]).map(row=>({id:row.id,invoice:row.invoice_number,state:stateLabels.value[row.state]??row.state,reference:row.submission_uuid??row.document_uuid??'—',help:usefulError(row.error_code)})))
function edit() {
 const config=data.value?.configuration
 form.value={profile:config?.profile?{...config.profile}:blank().profile,reason:'',
 branches:(data.value?.locations??[]).map(location=>{
  const saved=config?.branches.find(branch=>branch.locationId===location.id)
  return {locationId:location.id,name:location.name,configured:Boolean(saved),branchCode:saved?.branchCode??'',deviceSerialNumber:saved?.deviceSerialNumber??'',address:saved?{...saved.address}:{country:'EG',governate:'',regionCity:'',street:'',buildingNumber:''}}
 }),items:(data.value?.items??[]).map(item=>{
  const saved=config?.items.find(code=>code.sourceId===item.id && code.sourceType===item.sourceType)
  return {sourceId:item.id,sourceType:item.sourceType,name:item.name,configured:Boolean(saved),itemType:saved?.itemType??'EGS',itemCode:saved?.itemCode??'',unitType:saved?.unitType??''}
 })}
 message.value='';action.edit()
}
async function save() {
 const shopId=currentId.value
 if (!shopId || pending.value) return
 pending.value=true;message.value=''
 try {
  const configuration={profile:form.value.profile,branches:form.value.branches.filter(b=>b.configured).map(({locationId,branchCode,deviceSerialNumber,address})=>({locationId,branchCode,deviceSerialNumber,address})),items:form.value.items.filter(i=>i.configured).map(({sourceId,sourceType,itemType,itemCode,unitType})=>({sourceId,sourceType,itemType,itemCode,unitType}))}
  const result=await rpc.rpc('save_eta_configuration',{p_request_id:crypto.randomUUID(),p_shop_id:shopId,p_configuration:configuration,p_reason:form.value.reason})
  if (result.error) throw result.error
  if (currentId.value===shopId) {await refresh();action.complete();message.value=copy.value.saved}
 } catch (failure) {if (currentId.value===shopId) message.value=usefulError((failure as {message?:string}).message)} finally {pending.value=false}
}
async function queue() {
 const shopId=currentId.value
 if (!shopId || pending.value) return
 pending.value=true;message.value=''
 try {
  const result=await rpc.rpc('queue_eta_receipt',{p_request_id:crypto.randomUUID(),p_shop_id:shopId,p_invoice_id:invoice.value,p_buyer:{type:'P',...(buyerName.value?{name:buyerName.value}:{}),...(buyerId.value?{id:buyerId.value}:{})},p_payment_method:paymentMethod.value})
  if (result.error) throw result.error
  if (currentId.value===shopId) {await refresh();message.value=stateLabels.value.queued??''}
 } catch (failure) {if (currentId.value===shopId) message.value=usefulError((failure as {message?:string}).message)} finally {pending.value=false}
}
watch([currentId,()=>user.value?.id],()=>{action.complete();form.value=blank();message.value='';offset.value=0;invoice.value='';buyerName.value='';buyerId.value=''})
</script>
<template>
 <BsEtaSettingsPage v-model:form="form" v-model:editor="editor" v-model:invoice="invoice" v-model:buyer-name="buyerName" v-model:buyer-id="buyerId" v-model:payment-method="paymentMethod" :copy="copy" :available="Boolean(currentId)" :loading="loading" :error="Boolean(error)" :pending="pending" :dirty="dirty" :message="message" :setup-status="setupStatus" :records="records" :sales="data?.sales ?? []" :can-previous="offset > 0" :can-next="records.length === 50" @edit="edit" @save="save" @queue="queue" @retry="refresh()" @previous="offset = Math.max(0,offset - 50)" @next="offset += 50" />
</template>
