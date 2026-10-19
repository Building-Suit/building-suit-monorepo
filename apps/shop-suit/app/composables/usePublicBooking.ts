import {configuredWebsiteDomain} from '#shared/websiteAddress'
import {useFreshPageOnRestore,usePageExitCleanup,usePrivateSessionLifecycle,useOverlayState} from '@building-suit/ux'
import type {BsPublicBookingForm,BsPublicBookingView} from '@building-suit/ui/types/appointmentBookingPresentation'
import {bookingPageQuery,parseBookingOptions,parseBookingSlots,parseBookingManagement,bookingExpiry,bookingUuid,websiteBookingUrl,type BookingOptions,type BookingSlot,type BookingManagement} from '#shared/appointmentBooking'
import {websitePortalUrl} from '#shared/customerPortal'
import {websitePageUrl,type PublicWebsiteProfile} from '#shared/publicWebsite'
export function usePublicBooking(){
 const shopRequest=useShopRequest()
 const route=useRoute(),event=useRequestEvent(),config=useRuntimeConfig(),{setLocale}=useI18n()
 const domain=configuredWebsiteDomain(config.public)
 if(!domain)throw createError({statusCode:404,statusMessage:'Not Found'})
 if(!isTenantWebsiteRequest())throw createError({statusCode:404,statusMessage:'Not Found'})
 const query=bookingPageQuery(new URL(route.fullPath,'https://booking.invalid').searchParams)
 if(query.page!==1)throw createError({statusCode:404,statusMessage:'Not Found'})
 const locale=query.locale,ar=locale==='ar',slug=String(import.meta.server?event?.node.req.headers.host:window.location.host).split('.')[0]!.toLowerCase()
 const brand=useShopState<PublicWebsiteProfile>(`booking-brand:${config.public.appEnvironment}:${domain}:${slug}:${locale}`,()=>event?.context.websitePage?.payload.profile)
 if(!brand.value)throw createError({statusCode:404,statusMessage:'Not Found'})
 const tomorrow=()=>new Date(Date.now()+86400000).toISOString().slice(0,10)
 const form=ref<BsPublicBookingForm>({selection:'',date:tomorrow(),startsAt:'',name:'',phone:'',code:'',verifyPhone:''})
 const options=shallowRef<BookingOptions>({enabled:false}),slots=shallowRef<BookingSlot[]>([]),management=shallowRef<BookingManagement|null>(null),expiresAt=ref<string|null>(null),accessCode=ref(''),success=ref(''),error=ref(''),loading=ref(true),mode=ref<'create'|'manage'|'reschedule'>('create'),managePage=ref(1),reference=ref<string|null>(null),cancelReference=ref<string|null>(null)
 const action=useRecordAction(()=>''),busy=computed(()=>action.pending.value||loading.value),verification=useOverlayState(),cancellation=useOverlayState()
 let linkedServiceSelected=false
 let generation=0,read:AbortController|undefined,write:AbortController|undefined,requestMemo:{fingerprint:string;key:string}|undefined
 const failed=()=>ar?'تعذر إتمام الطلب. حدّث الأوقات وراجع شروط الحجز ثم حاول مرة أخرى.':'Could not complete the request. Refresh available times, check booking rules and try again.'
 function clear(){generation++;read?.abort();read=undefined;management.value=null;accessCode.value='';loading.value=false}
 function suspend(){write?.abort();clear();expiresAt.value=null;form.value={...form.value,name:'',phone:'',code:'',verifyPhone:''};verification.close();cancellation.close();requestMemo=undefined;error.value='';action.error.value=null;success.value='';options.value={enabled:false}}
 function expire(){suspend();error.value=ar?'انتهى الوصول. تحقق مرة أخرى لإدارة مواعيدك.':'Access has ended. Verify again to manage your appointments.'}
 async function refresh(){
  clear();if(document.hidden)return;const attempt=generation,controller=new AbortController();read=controller;loading.value=true
  try{
   const data=parseBookingOptions(await shopRequest('/api/website/booking/options',{method:'POST',body:{},cache:'no-store',signal:controller.signal}))
   if(attempt!==generation||document.hidden)return
   options.value=data;expiresAt.value=data.enabled?data.expiresAt:null
   if(data.enabled&&query.service&&!linkedServiceSelected){const choice=data.combinations.find(item=>item.service===query.service);if(choice){form.value={...form.value,selection:selectionKey(choice)};linkedServiceSelected=true}}
   if(data.enabled&&data.authenticated){
    const rows=parseBookingManagement(await shopRequest('/api/website/booking/manage',{method:'POST',body:{page:managePage.value},cache:'no-store',signal:controller.signal}))
    if(attempt!==generation||document.hidden)return
    if(!rows||rows.page!==managePage.value){expire();return}
    management.value=rows;expiresAt.value=rows.expiresAt
    if(data.scope==='appointment')mode.value='manage'
   }else{management.value=null;mode.value='create'}
   if(data.enabled&&!data.combinations.some(c=>selectionKey(c)===form.value.selection)){form.value={...form.value,selection:'',startsAt:''};slots.value=[]}
   error.value=''
  }catch{if(attempt===generation){suspend();error.value=failed()}}
  finally{if(attempt===generation)loading.value=false}
 }
 const selectionKey=(c:{service:string;location:string;staff:string})=>[c.service,c.location,c.staff].join(':')
 const selected=()=>options.value.enabled?options.value.combinations.find(c=>selectionKey(c)===form.value.selection):undefined
 async function loadSlots(){
  if(busy.value||document.hidden)return
  const c=selected();slots.value=[];form.value={...form.value,startsAt:''};if(!c)return
  const attempt=++generation;read?.abort();const controller=new AbortController();read=controller;loading.value=true;error.value=''
  try{const data=parseBookingSlots(await shopRequest('/api/website/booking/slots',{method:'POST',body:{service:c.service,location:c.location,staff:c.staff,date:form.value.date,reference:mode.value==='reschedule'?reference.value:null},cache:'no-store',signal:controller.signal}));if(attempt===generation&&!document.hidden)slots.value=data}
  catch{if(attempt===generation)error.value=failed()}finally{if(attempt===generation)loading.value=false}
 }
 watch([()=>form.value.selection,()=>form.value.date],()=>{slots.value=[];form.value={...form.value,startsAt:''};requestMemo=undefined},{flush:'sync'})
 function requestKey(payload:Record<string,unknown>){const fingerprint=JSON.stringify(payload);if(requestMemo?.fingerprint!==fingerprint){const bytes=crypto.getRandomValues(new Uint8Array(32));requestMemo={fingerprint,key:Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('')}}return requestMemo!.key}
 async function command(operation:'create'|'reschedule'|'cancel'){
  if(busy.value||document.hidden)return
  const c=selected(),scope=options.value.enabled?options.value.scope:'guest'
  if(operation!=='cancel'&&(!c||!slots.value.some(s=>s.startsAt===form.value.startsAt)))return
  const payload:Record<string,unknown>={operation,reference:operation==='cancel'?cancelReference.value:operation==='reschedule'?reference.value:null,...(operation==='cancel'?{}:{service:c!.service,location:c!.location,staff:c!.staff,startsAt:form.value.startsAt}),...(operation==='create'&&scope==='guest'?{name:form.value.name,phone:form.value.phone}:{})}
  const body={...payload,requestKey:requestKey(payload)},attempt=++generation;write=new AbortController();error.value='';success.value='';accessCode.value=''
  await action.run(async()=>{
   const result=await shopRequest('/api/website/booking/command',{method:'POST',body,cache:'no-store',signal:write!.signal}) as {ok?:boolean;accessEnded?:boolean;reference?:unknown;expiresAt?:unknown;code?:unknown}
   if(attempt!==generation||document.hidden)return
   if(result.accessEnded){expire();return}
   if(result.ok!==true||!bookingUuid(result.reference))throw Error('BOOKING_UNAVAILABLE')
   const expiry=bookingExpiry(result.expiresAt),code=typeof result.code==='string'&&/^[0-9A-HJKMNP-TV-Z]{12}$/.test(result.code)?result.code.match(/.{4}/g)!.join('-'):''
   if(result.code!==null&&!code)throw Error('BOOKING_UNAVAILABLE')
   verification.close();cancellation.close();form.value={...form.value,name:'',phone:'',code:'',verifyPhone:'',startsAt:''};requestMemo=undefined;mode.value='manage';managePage.value=1;await refresh()
   if(document.hidden||!management.value)return
   accessCode.value=code;expiresAt.value=expiry;success.value=ar?operation==='cancel'?'تم إلغاء الموعد.':operation==='reschedule'?'تم تعديل الموعد.':'تم تأكيد الحجز.':operation==='cancel'?'Appointment cancelled.':operation==='reschedule'?'Appointment rescheduled.':'Booking confirmed.'
  },()=>attempt===generation?failed():'')
 }
 async function verify(){
  if(busy.value||document.hidden)return;const payload={code:form.value.code,phone:form.value.verifyPhone};clear();write?.abort();expiresAt.value=null;form.value={...form.value,name:'',phone:'',code:'',verifyPhone:''};requestMemo=undefined;error.value='';const attempt=generation;write=new AbortController()
  await action.run(async()=>{const r=await shopRequest('/api/website/appointment-access/verify',{method:'POST',body:payload,cache:'no-store',signal:write!.signal}) as {ok?:boolean;expiresAt?:unknown};if(attempt!==generation||document.hidden)return;if(r.ok!==true)throw Error('ACCESS_UNAVAILABLE');expiresAt.value=bookingExpiry(r.expiresAt);verification.close();mode.value='manage';await refresh()},()=>attempt===generation?failed():'')
 }
 async function logout(){if(busy.value)return;suspend();const attempt=generation;write=new AbortController();await action.run(async()=>{await shopRequest('/api/website/appointment-access/logout',{method:'POST',body:{},cache:'no-store',signal:write!.signal});if(attempt===generation&&!document.hidden)await refresh()},()=>failed())}
 function reschedule(id:string){if(busy.value)return;const row=management.value?.items.find(a=>a.reference===id&&a.canReschedule);if(!row)return;reference.value=id;mode.value='reschedule';form.value={...form.value,selection:[row.serviceRef,row.locationRef,row.staffRef].join(':'),date:tomorrow(),startsAt:''};slots.value=[];success.value='';requestMemo=undefined}
 function requestCancel(id:string){if(busy.value||!management.value?.items.some(a=>a.reference===id&&a.canCancel))return;cancelReference.value=id;cancellation.show();action.error.value=null;error.value=''}
 async function setMode(value:'create'|'manage'){if(busy.value)return;mode.value=value;reference.value=null;success.value='';accessCode.value='';slots.value=[];requestMemo=undefined;if(value==='manage')await refresh()}
 usePrivateSessionLifecycle(expiresAt,busy,{clear,suspend,expire,refresh});useFreshPageOnRestore();usePageExitCleanup(suspend);onMounted(()=>{void refresh()})
 useHead({htmlAttrs:{lang:locale,dir:ar?'rtl':'ltr'},title:(ar?'حجز موعد | ':'Book an appointment | ')+brand.value.publicName,link:[{rel:'canonical',href:websiteBookingUrl(brand.value.canonicalSlug,locale,domain),key:'canonical'}],meta:[{name:'robots',content:'noindex, nofollow'},{name:'description',content:ar?'اختر وقتاً متاحاً للحجز لدى المتجر.':'Choose an available appointment time with this shop.'}]})
 const view=computed<BsPublicBookingView>(()=>{
  const copy=ar?{title:'حجز موعد',loading:'جارٍ التحقق…',unavailable:'الحجز عبر الموقع غير متاح حالياً. تواصل مع المتجر.',retry:'إعادة المحاولة',home:'العودة إلى المتجر',portal:'مواعيدي والسجل',language:'اللغة',newBooking:'حجز جديد',manage:'إدارة مواعيدي',guest:'حجز كزائر: يمنحك الوصول لهذا الموعد فقط، ولا يربطك بعميل آخر.',customer:'تستخدم هوية العميل التي تم التحقق منها لدى هذا المتجر.',appointment:'يقتصر وصولك على الموعد الذي تم التحقق منه. أنهِ الوصول لبدء حجز زائر مستقل.',verify:'لدي رمز وصول',verifyHelp:'أدخل رمز الوصول والهاتف المحفوظ لدى المتجر.',code:'رمز الوصول',phone:'رقم الهاتف',name:'الاسم',selection:'الخدمة والموقع والموظف',date:'التاريخ',slot:'الوقت المتاح',noSlots:'اختر الخدمة والتاريخ ثم اعرض الأوقات المتاحة.',loadSlots:'عرض الأوقات',create:'تأكيد الحجز',reschedule:'تعديل الموعد',cancel:'إلغاء الموعد',confirmCancel:'تأكيد إلغاء الموعد',cancelHelp:'سيصبح الموعد ملغياً فور التأكيد. لن تُفرض أي رسوم.',back:'رجوع',saveCode:'احفظ رمز الوصول',codeHelp:'يظهر هذا الرمز مرة واحدة فقط. استخدمه مع هاتف الحجز للتحقق لاحقاً. لا ترسل هذه الصفحة رسائل.',logout:'إنهاء الوصول',noManage:'لا توجد مواعيد قادمة قابلة للإدارة. راجع مواعيدي والسجل.',previous:'السابق',next:'التالي',remindersDisabled:'التذكير بالبريد اختياري لكل موعد مؤهل، ويظل الإرسال مقيداً بإعداد المشغل.',reminderOn:'أوافق على تذكير بالبريد',reminderOff:'إيقاف تذكير البريد',reminderConsent:'سأستلم تذكيراً واحداً على البريد المحفوظ لدى المتجر. قد تصل رسالة بدأ إرسالها قبل الإلغاء. لا يظهر البريد هنا.'}:{title:'Book an appointment',loading:'Checking availability…',unavailable:'Online booking is currently unavailable. Contact the shop.',retry:'Try again',home:'Back to shop',portal:'My appointments and history',language:'Language',newBooking:'New booking',manage:'Manage my appointments',guest:'Guest booking gives access to this appointment only. It never links you to another customer.',customer:'Booking uses your verified customer identity at this shop.',appointment:'Access covers your verified appointment only. End access to start a separate guest booking.',verify:'I have an access code',verifyHelp:'Enter the access code and phone saved with the shop.',code:'Access code',phone:'Phone number',name:'Name',selection:'Service, location and staff',date:'Date',slot:'Available time',noSlots:'Choose a service and date, then show available times.',loadSlots:'Show times',create:'Confirm booking',reschedule:'Reschedule',cancel:'Cancel appointment',confirmCancel:'Confirm cancellation',cancelHelp:'Confirmation immediately cancels this appointment. No fee is charged.',back:'Back',saveCode:'Save your access code',codeHelp:'This code appears once. Use it with your booking phone to verify later. This page does not send messages.',logout:'End access',noManage:'No upcoming appointments to manage. Check My appointments and history.',previous:'Previous',next:'Next',remindersDisabled:'Email reminders require consent for each eligible appointment and remain subject to operator delivery configuration.',reminderOn:'Request email reminder',reminderOff:'Stop email reminder',reminderConsent:'I agree to one reminder at my email saved with the shop. A message already being sent may arrive after cancellation. My email is not shown here.'}
  const data=options.value.enabled?options.value:null,format=(date:string,timeZone:string)=>new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short',hourCycle:'h23',timeZone}).format(new Date(date))
  return{locale,shopName:brand.value.publicName,logo:brand.value.logoDataUrl,homeHref:websitePageUrl(brand.value.canonicalSlug,locale,1,domain),portalHref:websitePortalUrl(brand.value.canonicalSlug,locale,domain),languages:[{label:'العربية',locale:'ar',href:websiteBookingUrl(brand.value.canonicalSlug,'ar',domain,query.service)},{label:'English',locale:'en',href:websiteBookingUrl(brand.value.canonicalSlug,'en',domain,query.service)}],loading:loading.value,pending:busy.value,enabled:Boolean(data),scope:data?.scope??'guest',authenticated:data?.authenticated??false,canCreate:Boolean(data&&data.scope!=='appointment'),error:error.value||action.error.value||'',success:success.value,accessCode:accessCode.value,mode:mode.value,selectionDetails:selected()?[{term:ar?'الخدمة':'Service',value:selected()!.serviceName},{term:ar?'الموقع':'Location',value:selected()!.locationName+' — '+selected()!.address},{term:ar?'الموظف':'Staff member',value:selected()!.staffName}]:[],selectionOptions:(data?.combinations??[]).map(c=>({value:selectionKey(c),label:`${c.serviceName} — ${c.locationName} — ${c.staffName} (${c.duration} ${ar?'دقيقة':'min'})`})),slotOptions:slots.value.map(s=>({value:s.startsAt,label:format(s.startsAt,s.timeZone)+' '+new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{timeZone:s.timeZone,timeZoneName:'short'}).formatToParts(new Date(s.startsAt)).find(p=>p.type==='timeZoneName')?.value})),dateMin:new Date().toISOString().slice(0,10),dateMax:new Date(Date.now()+(data?.horizonDays??30)*86400000).toISOString().slice(0,10),rules:data?(ar?`الحجز قبل الموعد بـ ${data.leadMinutes} دقيقة على الأقل، خلال ${data.horizonDays} يوماً. التعديل والإلغاء قبل الموعد بـ ${data.changeNoticeMinutes} دقيقة بحسب سياسة المتجر.`:`Book at least ${data.leadMinutes} minutes ahead, within ${data.horizonDays} days. Changes and cancellation require ${data.changeNoticeMinutes} minutes' notice, subject to shop policy.`):'',managePage:managePage.value,manageTotal:management.value?.total??0,rows:(management.value?.items??[]).map(a=>({reference:a.reference,date:format(a.startsAt,a.timeZone),service:a.service,staff:a.staff,location:a.location?`${a.location.name}: ${a.location.address}`:ar?'تواصل مع المتجر لمعرفة المكان.':'Contact the shop for the location.',canCancel:a.canCancel,canReschedule:a.canReschedule,reminderEligible:a.reminderEligible,reminderEnabled:a.reminderEnabled})),cancelSummary:management.value?.items.find(a=>a.reference===cancelReference.value)?.service??'',copy}
 })
 async function reminder(reference:string,enabled:boolean){
  if(busy.value||document.hidden||!management.value?.items.some(item=>item.reference===reference&&(item.reminderEligible||item.reminderEnabled)))return
  const attempt=++generation;write=new AbortController();error.value=''
  await action.run(async()=>{
   const result=await shopRequest('/api/website/booking/reminder',{method:'POST',body:{reference,enabled,locale},cache:'no-store',signal:write!.signal}) as {ok?:boolean}
   if(attempt!==generation||document.hidden)return
   if(!result.ok)throw Error('REMINDER_UNAVAILABLE')
   await refresh()
  },failed)
 }
 return{reminder,form,view,verifyOpen:verification.open,cancelOpen:cancellation.open,verify,logout,refresh,loadSlots,create:()=>command('create'),saveReschedule:()=>command('reschedule'),cancel:()=>command('cancel'),reschedule,requestCancel,setMode,setPage:async(value:number)=>{if(busy.value)return;managePage.value=value;await refresh()},initializeLocale:()=>setLocale(locale)}
}
