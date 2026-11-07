import { emptyStorefrontLayout } from '#shared/storefrontBuilder'
import { configuredWebsiteDomain } from '#shared/websiteAddress'
import { websiteBookingUrl } from '#shared/appointmentBooking'
import { websitePortalUrl } from '#shared/customerPortal'
import { useFreshPageOnRestore, usePageExitCleanup } from '@building-suit/ux'
import type { BsShopWebsiteView, BsWebsiteStoreItem } from '@building-suit/ui/types/shopWebsitePresentation'
import { emptyWebsiteInquiry, parsePublicWebsiteCatalog, publicWebsiteQuery, websitePageUrl, type PublicWebsitePayload } from '#shared/publicWebsite'
import type { PublicWebsiteCatalogItem } from '#shared/websiteCatalog'
import { useStorefrontBasketStore } from '~/stores/storefrontBasket'
export function usePublicWebsite() {
 const shopRequest=useShopRequest(),route=useRoute(),config=useRuntimeConfig(),event=useRequestEvent()
 const domain=configuredWebsiteDomain(config.public)
 if(!domain)throw createError({statusCode:404,statusMessage:'Not Found'})
 const query=publicWebsiteQuery(new URL(route.fullPath,'https://website.invalid').searchParams)
 const authority=import.meta.server?event?.node.req.headers.host:window.location.host
 const slug=String(authority).split('.')[0]!.toLowerCase()
 const page=useShopState<{payload:PublicWebsitePayload;locale:'ar'|'en';page:number;index:boolean}>(`website:${config.public.appEnvironment}:${domain}:${slug}:${query.locale}:${query.page}`,()=>event?.context.websitePage)
 if(!page.value)throw createError({statusCode:404,statusMessage:'Not Found'})
 const {setLocale}=useI18n(),locale=page.value.locale,ar=locale==='ar'
 const profile=page.value.payload.profile
 const basket=useStorefrontBasketStore()
 basket.selectScope(`${config.public.supabase.url}:${domain}:${profile.canonicalSlug}`,profile.canonicalSlug)
 onMounted(()=>basket.restore())
 const form=ref(emptyWebsiteInquiry()),basketForm=ref(emptyWebsiteInquiry()),success=ref(''),basketSuccess=ref(''),feedback=ref('')
 const action=useRecordAction(()=>form.value),basketAction=useRecordAction(()=>basketForm.value)
 const search=ref(''),term=ref(''),kind=ref('all'),sort=ref('featured'),catalogPage=ref(query.page),queryEnabled=ref(false)
 useDebouncedChange(search,value=>{term.value=value.trim().slice(0,120);catalogPage.value=1;queryEnabled.value=true},300)
 const catalogQuery=useShopQuery(
  ()=>`shop-public:storefront:${domain}:${profile.canonicalSlug}:${locale}:${kind.value}:${term.value}:${sort.value}:${catalogPage.value}`,
  async()=>{
   try{return parsePublicWebsiteCatalog(await shopRequest('/api/website/catalog',{method:'POST',body:{page:catalogPage.value,search:term.value,kind:kind.value,sort:sort.value},cache:'no-store'}),profile.canonicalSlug)}
   catch(cause){if(import.meta.client&&(cause as {statusCode?:number}).statusCode===404)window.location.reload();throw cause}
  },
  {server:false,enabled:queryEnabled,staleTime:0,watch:[term,kind,sort,catalogPage],default:()=>page.value.payload.catalog},
 )
 const catalog=computed(()=>queryEnabled.value?catalogQuery.data.value:page.value.payload.catalog)
 useFreshPageOnRestore()
 let write:AbortController|undefined,basketWrite:AbortController|undefined
 usePageExitCleanup(()=>{write?.abort();basketWrite?.abort();form.value=emptyWebsiteInquiry();basketForm.value=emptyWebsiteInquiry()})
 const canonical=websitePageUrl(profile.canonicalSlug,locale,page.value.page,domain)
 const title=profile.seoTitle||profile.publicName,description=profile.seoDescription||profile.description
 useHead({htmlAttrs:{lang:locale,dir:ar?'rtl':'ltr'},title,
  link:[{rel:'canonical',href:canonical,key:'canonical'},...(['ar','en'] as const).map(language=>({rel:'alternate' as const,type:'text/html',hreflang:language,href:websitePageUrl(profile.canonicalSlug,language,page.value.page,domain)})),{rel:'alternate' as const,type:'text/html',hreflang:'x-default',href:websitePageUrl(profile.canonicalSlug,'ar',page.value.page,domain)}],
  meta:[{name:'description',content:description},{name:'robots',content:page.value.index?'index, follow':'noindex, nofollow'},{property:'og:type',content:'website'},{property:'og:site_name',content:profile.publicName},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:url',content:canonical},{property:'og:locale',content:ar?'ar_EG':'en_US'}],
  script:[{key:'tenant-business',type:'application/ld+json',innerHTML:JSON.stringify({'@context':'https://schema.org','@type':'LocalBusiness',name:profile.publicName,description,url:canonical,...(profile.phone?{telephone:profile.phone}:{}),...(profile.email?{email:profile.email}:{})}).replaceAll('<','\\u003c')}],
 })
 const safeError=(cause:unknown)=>{
  const status=(cause as {statusCode?:number}).statusCode
  if(import.meta.client&&status===404)window.location.reload()
  return status===429?(ar?'تم إرسال طلبات كثيرة. حاول لاحقاً.':'Too many requests. Please try later.'):status===400?(ar?'راجع بياناتك والسلة. قد يكون أحد الأصناف غير متاح الآن.':'Review your details and basket. An item may no longer be available.'):(ar?'تعذر إرسال الطلب. احتفظ ببياناتك وحاول مرة أخرى.':'Could not send the request. Your details are retained; please retry.')
 }
 async function submit() {
  success.value='';write=new AbortController()
  const saved=await action.run(async()=>{await shopRequest('/api/website/inquiries',{method:'POST',body:{...form.value,locale},signal:write!.signal})},safeError)
  if(saved){form.value=emptyWebsiteInquiry();success.value=ar?'تم إرسال استفسارك إلى المتجر.':'Your inquiry has been sent to the shop.'}
 }
 async function submitBasket(){
  if(!basket.lines.length||basketAction.pending.value)return
  const scope=basket.scope;basketSuccess.value='';basketWrite=new AbortController()
  const body={...basketForm.value,locale,lines:basket.lines.map(line=>({id:line.item.publicId,quantity:line.quantity}))}
  const saved=await basketAction.run(async()=>{await shopRequest('/api/website/basket',{method:'POST',body,signal:basketWrite!.signal})},safeError)
  if(saved&&basket.scope===scope){basket.clear();basketForm.value=emptyWebsiteInquiry();basketSuccess.value=ar?'وصل طلبك إلى المتجر. سيؤكد التوفر والسعر معك عبر بيانات الاتصال التي أدخلتها.':'Your request has reached the shop. They will confirm availability and pricing using your contact details.'}
 }
 function selectKind(value:string){if(!['all','product','service'].includes(value))return;kind.value=value;catalogPage.value=1;queryEnabled.value=true}
 function selectSort(value:string){if(!['featured','name','price_asc','price_desc'].includes(value))return;sort.value=value;catalogPage.value=1;queryEnabled.value=true}
 function selectPage(value:number){
  if(!Number.isSafeInteger(value)||value<1||value>99999)return
  // Unfiltered page links are public permalinks with server-owned canonical and
  // locale state. Keep reload/bookmark behavior; discovery filters stay local.
  if(!term.value&&kind.value==='all'&&sort.value==='featured'){
   void navigateTo(websitePageUrl(profile.canonicalSlug,locale,value,domain!),{external:true});return
  }
  catalogPage.value=value;queryEnabled.value=true
 }
 function clearFilters(){search.value='';term.value='';kind.value='all';sort.value='featured';catalogPage.value=1;queryEnabled.value=true}
 function add(id:string){
  if(basketAction.pending.value)return
  const item=[...catalog.value.items,...page.value.payload.catalog.items].find(item=>item.publicId===id)
  if(!item)return
  feedback.value=basket.add(item)?(ar?`تمت إضافة ${item.name} إلى السلة.`:`${item.name} added to your basket.`):(ar?'يمكن إضافة 10 أصناف مختلفة لكل طلب.':'You can request up to 10 different items at once.')
  basketSuccess.value=''
 }
 function addOffer(id:string){
  if(basketAction.pending.value)return
  const offer=page.value.payload.storefront?.offers.find(offer=>offer.id===id)
  if(!offer)return
  const added=basket.addBundle(offer.lines.map(line=>({quantity:line.quantity,item:{publicId:line.id,kind:line.kind,name:line.name,description:'',image:line.image,displayOrder:0,priceMode:'shown' as const,price:line.price,currency:offer.currency}})))
  feedback.value=added?(ar?`تمت إضافة ${offer.name}.`:`${offer.name} added.`):(ar?'لا يمكن إضافة الباقة: حد الطلب 10 أصناف و999 لكل صنف.':'Cannot add bundle: requests support 10 items and up to 999 of each.')
  basketSuccess.value=''
 }
 function quantity(id:string,value:number){if(!basketAction.pending.value)basket.quantity(id,value)}
 const money=(amount:number,currency:string)=>new Intl.NumberFormat(ar?'ar-EG':'en-US',{style:'currency',currency}).format(amount)
 function itemView(item:PublicWebsiteCatalogItem):BsWebsiteStoreItem {
  return{id:item.publicId,kind:item.kind,kindLabel:item.kind==='product'?(ar?'منتج':'Product'):(ar?'خدمة':'Service'),name:item.name,description:item.description,image:item.image,
   price:item.priceMode==='shown'?money(item.price,item.currency):(ar?'السعر عند التواصل':'Price on request'),
   bookingLabel:ar?'احجز الخدمة':'Book service',bookingHref:item.kind==='service'&&item.bookable!==false&&catalog.value.bookingEnabled!==false?websiteBookingUrl(profile.canonicalSlug,locale,domain!,item.publicId):undefined,
   quantity:basket.lines.find(line=>line.item.publicId===item.publicId)?.quantity??0}
 }
 const view=computed<BsShopWebsiteView>(()=>{
  const data=catalog.value,counts=data.counts
  const totals=new Map<string,number>()
  for(const line of basket.lines)if(line.item.priceMode==='shown')totals.set(line.item.currency,(totals.get(line.item.currency)??0)+line.item.price*line.quantity)
  const remaining=new Map(basket.lines.map(l=>[l.item.publicId,Math.round(l.quantity*1000)])),matched:string[]=[]
  for(const offer of page.value.payload.storefront?.offers??[]){
   let sets=1000000
   for(const line of offer.lines)sets=Math.min(sets,Math.floor((remaining.get(line.id)??0)/Math.round(line.quantity*1000)))
   if(sets<1)continue
   for(const line of offer.lines)remaining.set(line.id,remaining.get(line.id)!-Math.round(line.quantity*1000)*sets)
   const regular=offer.lines.reduce((sum,line)=>{const item=basket.lines.find(v=>v.item.publicId===line.id)?.item;return sum+(item?.priceMode==='shown'?item.price:line.price)*line.quantity},0)
   totals.set(offer.currency,Math.max(0,(totals.get(offer.currency)??0)-(regular-offer.price)*sets))
   matched.push(`${offer.name} × ${sets}`)
  }
  return{
   design:page.value.payload.storefront??emptyStorefrontLayout(),offerSummary:matched.join(' · '),
   offers:(page.value.payload.storefront?.offers??[]).map(offer=>({id:offer.id,name:offer.name,description:offer.description,price:money(offer.price,offer.currency),oldPrice:money(offer.oldPrice,offer.currency),saving:`${ar?'وفّر':'Save'} ${money(offer.oldPrice-offer.price,offer.currency)}`,items:offer.lines.map(line=>`${line.quantity} × ${line.name}`).join(' · '),images:offer.lines.flatMap(line=>line.image?[line.image]:[])})),
   bookingLink:data.bookingEnabled!==false?{href:websiteBookingUrl(profile.canonicalSlug,locale,domain),label:ar?'احجز موعدك':'Book an appointment'}:undefined,
   portalLink:{href:websitePortalUrl(profile.canonicalSlug,locale,domain),label:ar?'مواعيدي':'My appointments'},
   name:profile.publicName,description:profile.description,logo:profile.logoDataUrl,locale,
   languageLinks:[{locale:'ar',label:'العربية',href:websitePageUrl(profile.canonicalSlug,'ar',data.page,domain)},{locale:'en',label:'English',href:websitePageUrl(profile.canonicalSlug,'en',data.page,domain)}],
   contacts:[...(profile.phone?[{kind:'phone',label:profile.phone,href:`tel:${profile.phone.replace(/[^+0-9]/g,'')}`}]:[]),...(profile.whatsapp?[{kind:'whatsapp',label:ar?'تواصل عبر واتساب':'Chat on WhatsApp',href:`https://wa.me/${profile.whatsapp.replace(/\D/g,'')}`}]:[]),...(profile.email?[{kind:'email',label:profile.email,href:`mailto:${profile.email.split('@').map(encodeURIComponent).join('@')}`}]:[])],
   openingHours:profile.openingHours,locations:profile.locations.map(location=>({name:location.publicName,address:location.address,mapHref:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`})),
   items:data.items.map(itemView),featured:page.value.payload.catalog.items.slice(0,3).map(itemView),page:data.page,total:data.total,
   previous:data.page>1?websitePageUrl(profile.canonicalSlug,locale,data.page-1,domain):null,next:data.page*20<data.total?websitePageUrl(profile.canonicalSlug,locale,data.page+1,domain):null,
   discovery:{search:search.value,kind:kind.value,sort:sort.value,filters:[{value:'all',label:ar?'الكل':'All',count:counts?.all},{value:'product',label:ar?'المنتجات':'Products',count:counts?.product},{value:'service',label:ar?'الخدمات':'Services',count:counts?.service}],
    sorts:[{value:'featured',label:ar?'اختيارات المتجر':'Shop selection'},{value:'name',label:ar?'الاسم':'Name'},{value:'price_asc',label:ar?'السعر: من الأقل للأعلى':'Price: low to high'},{value:'price_desc',label:ar?'السعر: من الأعلى للأقل':'Price: high to low'}],
    loading:queryEnabled.value&&catalogQuery.isLoading.value,refreshing:queryEnabled.value&&catalogQuery.isLoading.value,failed:queryEnabled.value&&Boolean(catalogQuery.error.value),filtered:!!term.value||kind.value!=='all'||sort.value!=='featured',
    range:ar?`${data.items.length?((data.page-1)*20+1):0}–${data.items.length?Math.min(data.page*20,data.total):0} من ${data.total}`:`${data.items.length?((data.page-1)*20+1):0}–${data.items.length?Math.min(data.page*20,data.total):0} of ${data.total}`},
   basket:{count:basket.lines.length,lines:basket.lines.map(line=>({...itemView(line.item),quantity:line.quantity,lineTotal:line.item.priceMode==='shown'?money(line.quantity*line.item.price,line.item.currency):(ar?'السعر عند التأكيد':'To be confirmed')})),totals:Array.from(totals,([currency,amount])=>({currency,label:money(amount,currency)})),pending:basketAction.pending.value,error:basketAction.error.value??'',success:basketSuccess.value,feedback:feedback.value},
   pending:action.pending.value,error:action.error.value??'',success:success.value,
   copy:ar?{
    promos:'العروض والباقات',addOffer:'أضف الباقة',gallery:'صور من متجرنا',staff:'تعرّف على فريقنا',find:'ابحث الآن',searchType:'نوع الصنف',home:'الرئيسية',catalog:'اكتشف ما يناسبك',locations:'زر أحد فروعنا',hours:'مواعيد العمل',contact:'نتحدث معك',inquiry:'كيف نقدر نساعدك؟',inquiryHelp:'أرسل سؤالك وسيصلك رد المتجر عبر بيانات الاتصال التي تدخلها.',name:'الاسم',replyContact:'البريد الإلكتروني أو رقم الهاتف',message:'رسالتك',send:'إرسال الرسالة',company:'الموقع الإلكتروني للشركة',previous:'السابق',next:'التالي',language:'اللغة',empty:'لم نجد أصنافاً بهذه الاختيارات. جرّب بحثاً مختلفاً أو امسح المرشحات.',
    navigation:'تصفح المتجر',browse:'استكشف المتجر',products:'تسوق المنتجات',services:'اكتشف الخدمات',visit:'الفروع والتواصل',details:'عرض التفاصيل',add:'أضف للسلة',added:'في السلة',basket:'سلتك',basketEmpty:'سلتك جاهزة لاختياراتك.',basketHelp:'أرسل اختياراتك ليؤكد المتجر التوفر والسعر وطريقة الاستلام. هذا طلب تأكيد؛ لا يتم دفع أموال أو حجز مخزون هنا.',basketSend:'إرسال الطلب للمتجر',basketSuccess:'تم إرسال طلبك',basketNotes:'ملاحظات الطلب (اختياري)',quantity:'الكمية',increase:'زيادة الكمية',decrease:'تقليل الكمية',remove:'إزالة',total:'إجمالي الأصناف ذات السعر المعلن',priceHelp:'الأسعار المعروضة استرشادية. يؤكد المتجر الإجمالي النهائي وأي ضرائب أو رسوم والأصناف التي تحتاج عرض سعر.',search:'ابحث عن منتج أو خدمة',sort:'ترتيب العرض',clear:'مسح الاختيارات',retry:'إعادة المحاولة',loading:'جارٍ تحميل الأصناف…',catalogError:'تعذر تحميل الكتالوج. حاول مرة أخرى.',close:'إغلاق',imagePlaceholder:'صورة الصنف غير متاحة',discover:'تفاصيل صغيرة. اختيارات تناسبك.',bookingTitle:'احجز في الوقت المناسب لك',bookingBody:'اختر الخدمة والفرع والموعد المناسب من الأوقات المتاحة للحجز.',portalTitle:'موعدك، تحت عينك',portalBody:'ادخل برمز الوصول الخاص بك لعرض مواعيدك ومتابعتها بأمان.',directions:'الاتجاهات',about:'عن المتجر',requestLimit:'حتى 10 أصناف مختلفة لكل طلب.',poweredBy:'يعمل بواسطة Shop Suit'
   }:{
    promos:'Promos & offers',addOffer:'Add bundle',gallery:'A closer look',staff:'Meet our team',find:'Find items',searchType:'Choose type',home:'Home',catalog:'Browse products and services',locations:'Visit us',hours:'Opening hours',contact:'Let’s talk',inquiry:'How can we help?',inquiryHelp:'Send a question. The shop will reply using the contact details you provide.',name:'Name',replyContact:'Email or phone',message:'Your message',send:'Send message',company:'Company website',previous:'Previous',next:'Next',language:'Language',empty:'No items match these choices. Try another search or clear the filters.',
    navigation:'Shop navigation',browse:'Explore the shop',products:'Shop products',services:'Explore services',visit:'Visit & contact',details:'View details',add:'Add to basket',added:'In your basket',basket:'Your basket',basketEmpty:'Your basket is ready for your favourites.',basketHelp:'Send your selection so the shop can confirm availability, pricing and collection arrangements. This is a request for confirmation; no payment or stock reservation is made here.',basketSend:'Send request to shop',basketSuccess:'Your request is on its way',basketNotes:'Request notes (optional)',quantity:'Quantity',increase:'Increase quantity',decrease:'Decrease quantity',remove:'Remove',total:'Subtotal of priced items',priceHelp:'Published prices are indicative. The shop confirms the final total, any taxes or fees, and items that need a quote.',search:'Search products and services',sort:'Sort by',clear:'Clear choices',retry:'Try again',loading:'Loading items…',catalogError:'Could not load the catalogue. Please try again.',close:'Close',imagePlaceholder:'Item image unavailable',discover:'Good things. Thoughtfully chosen.',bookingTitle:'A time that works for you',bookingBody:'Choose a service, a branch and a time from the appointments available to book.',portalTitle:'Keep your plans close',portalBody:'Use your private access code to view and follow your appointments securely.',directions:'Get directions',about:'About the shop',requestLimit:'Up to 10 different items per request.',poweredBy:'Powered by Shop Suit'
   },
  }
 })
 return{view,form,basketForm,submit,submitBasket,add,addOffer,quantity,selectKind,selectSort,selectPage,clearFilters,setSearch:(value:string)=>{search.value=value.slice(0,120)},retryCatalog:()=>catalogQuery.refresh(),initializeLocale:()=>setLocale(locale)}
}
