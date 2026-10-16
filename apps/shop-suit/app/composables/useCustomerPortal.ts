import {useFreshPageOnRestore,usePageExitCleanup,usePrivateSessionLifecycle} from '@building-suit/ux'
import type {BsCustomerPortalView} from '@building-suit/ui/types/customerPortalPresentation'
import {parseCustomerPortal,websitePortalUrl,type CustomerPortal,type PortalBucket,type PortalStatus} from '#shared/customerPortal'
import {publicWebsiteQuery,websitePageUrl,type PublicWebsiteProfile} from '#shared/publicWebsite'
export function useCustomerPortal() {
 const route=useRoute(),config=useRuntimeConfig(),event=useRequestEvent(),{setLocale}=useI18n()
 if(!isTenantWebsiteRequest())throw createError({statusCode:404,statusMessage:'Not Found'})
 const query=publicWebsiteQuery(new URL(route.fullPath,'https://portal.invalid').searchParams)
 if(query.page!==1)throw createError({statusCode:404,statusMessage:'Not Found'})
 const slug=String(import.meta.server?event?.node.req.headers.host:window.location.host).split('.')[0]!.toLowerCase(),locale=query.locale,ar=locale==='ar'
 // Only published public identity is serialized. History and factors are plain,
 // component-scoped refs and never use AsyncData, Nuxt state or browser storage.
 const brand=useState<PublicWebsiteProfile>(`portal-brand:${config.public.appEnvironment}:${slug}:${locale}`,()=>event?.context.websitePage?.payload.profile)
 if(!brand.value)throw createError({statusCode:404,statusMessage:'Not Found'})
 const form=ref({code:'',phone:''}),history=shallowRef<CustomerPortal|null>(null),expiresAt=ref<string|null>(null),bucket=ref<PortalBucket>('upcoming'),page=ref(1),loading=ref(false),error=ref('')
 const command=useRecordAction(()=>''),busy=computed(()=>command.pending.value||loading.value)
 let generation=0,read:AbortController|undefined,write:AbortController|undefined
 const ended=()=>ar?'انتهى الوصول. أدخل الرمز والهاتف للتحقق مرة أخرى.':'Access has ended. Enter your code and phone to verify again.'
 const unavailable=()=>ar?'تعذر التحقق من الوصول. حاول مرة أخرى.':'Could not check access. Please try again.'
 function clearHistory(){generation++;read?.abort();read=undefined;history.value=null;loading.value=false}
 function clearSession(){clearHistory();expiresAt.value=null;form.value={code:'',phone:''}}
 function expire(){clearSession();error.value=ended()}
 async function refresh(){
  clearHistory();const attempt=generation,controller=new AbortController();read=controller;loading.value=true
  try{
   const raw=await $fetch('/api/website/customer-portal',{method:'POST',body:{bucket:bucket.value,page:page.value},cache:'no-store',signal:controller.signal})
   if(attempt!==generation)return
   const data=parseCustomerPortal(raw)
   if(!data){const hadAccess=Boolean(expiresAt.value);clearSession();error.value=hadAccess?ended():'';return}
   if(data.bucket!==bucket.value||data.page!==page.value)throw Error('INVALID_PORTAL_RESPONSE')
   history.value=data;expiresAt.value=data.expiresAt;error.value=''
  }catch{if(attempt===generation){clearSession();error.value=unavailable()}}
  finally{if(attempt===generation)loading.value=false}
 }
 async function verify(){
  if(busy.value)return
  const payload={...form.value};clearSession();error.value='';const attempt=generation;write=new AbortController()
  await command.run(async()=>{
   const result=await $fetch('/api/website/appointment-access/verify',{method:'POST',body:payload,cache:'no-store',signal:write!.signal}) as {ok?:boolean;expiresAt?:unknown}
   if(attempt!==generation)return
   const expiry=typeof result.expiresAt==='string'?Date.parse(result.expiresAt):NaN
   if(result.ok!==true||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+600000)throw Error('ACCESS_UNAVAILABLE')
   expiresAt.value=result.expiresAt as string;bucket.value='upcoming';page.value=1;await refresh()
  },()=>attempt===generation?(ar?'تعذر التحقق. راجع الرمز والهاتف وحاول مرة أخرى.':'Could not verify access. Check the code and phone and try again.'):'')
 }
 async function logout(){if(busy.value)return;clearSession();error.value='';const attempt=generation;write=new AbortController()
  await command.run(async()=>{const result=await $fetch('/api/website/appointment-access/logout',{method:'POST',body:{},cache:'no-store',signal:write!.signal}) as {ok?:boolean};if(attempt===generation&&result.ok!==true)throw Error('ACCESS_UNAVAILABLE')},()=>attempt===generation?unavailable():'')
 }
 usePrivateSessionLifecycle(expiresAt,busy,{clear:clearHistory,expire,refresh})
 useFreshPageOnRestore()
 usePageExitCleanup(()=>{write?.abort();clearSession();command.error.value=null;error.value=''})
 onMounted(()=>{void refresh()})
 useHead({htmlAttrs:{lang:locale,dir:ar?'rtl':'ltr'},title:(ar?'مواعيدي | ':'My appointments | ')+brand.value.publicName,link:[{rel:'canonical',href:websitePortalUrl(brand.value.canonicalSlug,locale),key:'canonical'}],meta:[{name:'robots',content:'noindex, nofollow'},{name:'description',content:ar?'تحقق لعرض مواعيدك لدى هذا المتجر.':'Verify access to view your appointments with this shop.'}]})
 const view=computed<BsCustomerPortalView>(()=>{
  const labels:Record<PortalStatus,string>=ar?{booked:'محجوز',arrived:'وصل',waiting:'منتظر',in_service:'قيد الخدمة',completed:'مكتمل',cancelled:'ملغي',no_show:'لم يحضر'}:{booked:'Booked',arrived:'Arrived',waiting:'Waiting',in_service:'In service',completed:'Completed',cancelled:'Cancelled',no_show:'No show'}
  const copy=ar?{title:'مواعيدي',home:'العودة إلى المتجر',language:'اللغة',help:'أدخل رمز الوصول الذي أعطاك إياه المتجر والهاتف المحفوظ مع الموعد.',code:'رمز الوصول',phone:'الهاتف المحفوظ للموعد',verify:'عرض مواعيدي',upcoming:'القادمة',past:'السجل',emptyUpcoming:'لا توجد مواعيد قادمة.',emptyPast:'لا توجد مواعيد في السجل.',locationUnavailable:'تواصل مع المتجر لمعرفة المكان.',staff:'الموظف',logout:'إنهاء الوصول',refresh:'تحديث',loading:'جارٍ التحقق من الوصول…',previous:'السابق',next:'التالي',retry:'حاول مرة أخرى'}:{title:'My appointments',home:'Back to shop',language:'Language',help:'Enter the access code provided by the shop and the phone saved with your appointment.',code:'Access code',phone:'Phone saved with the appointment',verify:'View my appointments',upcoming:'Upcoming',past:'History',emptyUpcoming:'No upcoming appointments.',emptyPast:'No appointment history yet.',locationUnavailable:'Contact the shop for the location.',staff:'Staff member',logout:'End access',refresh:'Refresh',loading:'Checking access…',previous:'Previous',next:'Next',retry:'Try again'}
  return{shopName:brand.value.publicName,logo:brand.value.logoDataUrl,homeHref:websitePageUrl(brand.value.canonicalSlug,locale),locale,languages:[{label:'العربية',locale:'ar',href:websitePortalUrl(brand.value.canonicalSlug,'ar')},{label:'English',locale:'en',href:websitePortalUrl(brand.value.canonicalSlug,'en')}],mode:loading.value?'loading':history.value?'history':'verify',pending:busy.value,error:error.value||command.error.value||'',scopeLabel:history.value?.scope==='appointment'?(ar?'الوصول لهذا الموعد فقط.':'Access covers this appointment only.'):(ar?'مواعيدك وسجل خدماتك لدى هذا المتجر.':'Your appointments and service history with this shop.'),expiresLabel:expiresAt.value?(ar?'ينتهي الوصول في ':'Access ends at ')+new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{hour:'numeric',minute:'2-digit'}).format(new Date(expiresAt.value)):'',bucket:bucket.value,page:page.value,total:history.value?.total??0,
   rows:(history.value?.items??[]).map((item,index)=>({key:`${bucket.value}:${page.value}:${index}`,date:new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{dateStyle:'full',timeZone:item.timeZone}).format(new Date(item.startsAt)),time:new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{hour:'numeric',minute:'2-digit',hourCycle:'h23',timeZone:item.timeZone}).format(new Date(item.startsAt))+'–'+new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{hour:'numeric',minute:'2-digit',hourCycle:'h23',timeZone:item.timeZone}).format(new Date(item.endsAt)),timeZone:new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{timeZone:item.timeZone,timeZoneName:'short'}).formatToParts(new Date(item.startsAt)).find(part=>part.type==='timeZoneName')?.value??item.timeZone,service:item.service,staff:item.staff||copy.staff,status:item.status,statusLabel:labels[item.status],tone:item.status==='completed'?'success':item.status==='cancelled'||item.status==='no_show'?'danger':item.status==='in_service'?'info':'neutral',location:item.location})),copy}
 })
 return{view,form,verify,logout,refresh,setBucket:async(value:PortalBucket)=>{if(busy.value)return;bucket.value=value;page.value=1;await refresh()},setPage:async(value:number)=>{if(busy.value)return;page.value=value;await refresh()},initializeLocale:()=>setLocale(locale)}
}
