import {useFreshPageOnRestore} from '@building-suit/ux'
import type {BsShopWebsiteView} from '@building-suit/ui/types/shopWebsitePresentation'
import {emptyWebsiteInquiry,publicWebsiteQuery,websitePageUrl,type PublicWebsitePayload} from '#shared/publicWebsite'
export function usePublicWebsite() {
 const route=useRoute(),config=useRuntimeConfig(),event=useRequestEvent()
 const query=publicWebsiteQuery(new URLSearchParams(route.fullPath.split('?')[1]??''))
 const authority=import.meta.server?event?.node.req.headers.host:window.location.host
 const slug=String(authority).split('.')[0]!.toLowerCase()
 const page=useState<{payload:PublicWebsitePayload;locale:'ar'|'en';page:number;index:boolean}>(`website:${config.public.appEnvironment}:${slug}:${query.locale}:${query.page}`,()=>event?.context.websitePage)
 if(!page.value)throw createError({statusCode:404,statusMessage:'Not Found'})
 const {setLocale}=useI18n()
 const form=ref(emptyWebsiteInquiry()),success=ref('')
 const action=useRecordAction(()=>form.value)
 useFreshPageOnRestore()
 const canonical=websitePageUrl(page.value.payload.profile.canonicalSlug,page.value.locale,page.value.page)
 const p=page.value.payload.profile
 const title=p.seoTitle||p.publicName,description=p.seoDescription||p.description
 useHead({htmlAttrs:{lang:page.value.locale,dir:page.value.locale==='ar'?'rtl':'ltr'},title,
  link:[{rel:'canonical',href:canonical,key:'canonical'},...(['ar','en'] as const).map(locale=>({rel:'alternate' as const,type:'text/html',hreflang:locale,href:websitePageUrl(p.canonicalSlug,locale,page.value.page)})),{rel:'alternate' as const,type:'text/html',hreflang:'x-default',href:websitePageUrl(p.canonicalSlug,'ar',page.value.page)}],
  meta:[{name:'description',content:description},{name:'robots',content:page.value.index?'index, follow':'noindex, nofollow'},{property:'og:type',content:'website'},{property:'og:site_name',content:p.publicName},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:url',content:canonical},{property:'og:locale',content:page.value.locale==='ar'?'ar_EG':'en_US'}],
  script:[{key:'tenant-business',type:'application/ld+json',innerHTML:JSON.stringify({'@context':'https://schema.org','@type':'LocalBusiness',name:p.publicName,description,url:canonical}).replaceAll('<','\\u003c')}],
 })
 async function submit() {
  success.value=''
  const saved=await action.run(async()=>{await $fetch('/api/website/inquiries',{method:'POST',body:{...form.value,locale:page.value.locale}})},cause=>{
   const status=(cause as {statusCode?:number}).statusCode,ar=page.value.locale==='ar'
   return status===429?(ar?'تم إرسال طلبات كثيرة. حاول لاحقاً.':'Too many inquiries. Please try later.'):(ar?'تعذر إرسال الاستفسار. راجع البيانات وحاول مرة أخرى.':'Could not send your inquiry. Check your details and retry.')
  })
  if(saved){form.value=emptyWebsiteInquiry();success.value=page.value.locale==='ar'?'تم إرسال استفسارك إلى المتجر.':'Your inquiry has been sent to the shop.'}
 }
 const view=computed<BsShopWebsiteView>(()=>{
  const {profile,catalog}=page.value.payload,locale=page.value.locale,ar=locale==='ar'
  return{name:profile.publicName,description:profile.description,logo:profile.logoDataUrl,locale,
   languageLinks:[{locale:'ar',label:'العربية',href:websitePageUrl(profile.canonicalSlug,'ar',catalog.page)},{locale:'en',label:'English',href:websitePageUrl(profile.canonicalSlug,'en',catalog.page)}],
   contacts:[...(profile.phone?[{kind:'phone',label:profile.phone,href:`tel:${profile.phone.replace(/[^+0-9]/g,'')}`}]:[]),...(profile.whatsapp?[{kind:'whatsapp',label:ar?'واتساب':'WhatsApp',href:`https://wa.me/${profile.whatsapp.replace(/\D/g,'')}`}]:[]),...(profile.email?[{kind:'email',label:profile.email,href:`mailto:${profile.email.split('@').map(encodeURIComponent).join('@')}`}]:[])],
   openingHours:profile.openingHours,locations:profile.locations.map(l=>({name:l.publicName,address:l.address})),
   items:catalog.items.map(item=>({id:item.publicId,kind:item.kind==='product'?(ar?'منتج':'Product'):(ar?'خدمة':'Service'),name:item.name,description:item.description,image:item.image,price:item.priceMode==='contact'?(ar?'تواصل لمعرفة السعر':'Contact for price'):new Intl.NumberFormat(ar?'ar-EG':'en-US',{style:'currency',currency:item.currency}).format(item.price)})),
   page:catalog.page,total:catalog.total,previous:catalog.page>1?websitePageUrl(profile.canonicalSlug,locale,catalog.page-1):null,next:catalog.page*20<catalog.total?websitePageUrl(profile.canonicalSlug,locale,catalog.page+1):null,
   pending:action.pending.value,error:action.error.value??'',success:success.value,
   copy:ar?{catalog:'المنتجات والخدمات',locations:'مواقعنا',hours:'مواعيد العمل',contact:'تواصل معنا',inquiry:'أرسل استفساراً',inquiryHelp:'تُرسل بياناتك إلى هذا المتجر حتى يتمكن من الرد عليك.',name:'الاسم',replyContact:'البريد الإلكتروني أو رقم الهاتف',message:'رسالتك',send:'إرسال الاستفسار',company:'الموقع الإلكتروني للشركة',previous:'السابق',next:'التالي',language:'اللغة',empty:'لا توجد عناصر في هذه الصفحة.'}:{catalog:'Products and services',locations:'Our locations',hours:'Opening hours',contact:'Contact us',inquiry:'Send an inquiry',inquiryHelp:'Your details are shared with this shop so they can respond.',name:'Name',replyContact:'Email or phone',message:'Your message',send:'Send inquiry',company:'Company website',previous:'Previous',next:'Next',language:'Language',empty:'There are no items on this page.'},
  }
 })
 return{view,form,submit,initializeLocale:()=>setLocale(page.value.locale)}
}
