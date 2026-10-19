import { validWebsiteSlug,websiteUrl,websiteDomain } from './websiteAddress.ts'
import type { PublicWebsiteCatalog,PublicWebsiteCatalogItem } from './websiteCatalog'
export type WebsiteLocale='ar'|'en'
export type PublicWebsiteProfile={canonicalSlug:string;publicName:string;description:string;phone:string;whatsapp:string;email:string;openingHours:string;seoTitle:string;seoDescription:string;logoDataUrl:string;locations:Array<{publicName:string;address:string}>}
export type PublicWebsitePayload={profile:PublicWebsiteProfile;catalog:PublicWebsiteCatalog}
export type WebsiteInquiryForm={name:string;contact:string;message:string;company:string}
export const emptyWebsiteInquiry=():WebsiteInquiryForm=>({name:'',contact:'',message:'',company:''})
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||Array.from(v).length>max)throw Error('INVALID_PUBLIC_WEBSITE');return v}
const image=(v:unknown)=>{if(v===null)return null;const s=text(v,175000);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('INVALID_PUBLIC_WEBSITE');return s}
/** Construct an allowlist again at the HTTP/SSR boundary; never serialize raw RPC data. */
export function parsePublicWebsite(value:unknown,canonicalSlug:string):PublicWebsitePayload {
 if(!object(value)||!object(value.profile)||!object(value.catalog)||!validWebsiteSlug(canonicalSlug))throw Error('INVALID_PUBLIC_WEBSITE')
 const p=value.profile,c=value.catalog
 if(p.canonicalSlug!==canonicalSlug||c.canonicalSlug!==canonicalSlug||!Array.isArray(p.locations)||p.locations.length>50||!Array.isArray(c.items)||c.items.length>20||!Number.isSafeInteger(c.total)||Number(c.total)<1||!Number.isSafeInteger(c.page)||Number(c.page)<1||c.pageSize!==20)throw Error('INVALID_PUBLIC_WEBSITE')
 const profile:PublicWebsiteProfile={canonicalSlug,publicName:text(p.publicName,120),description:text(p.description,320),phone:text(p.phone,30),whatsapp:text(p.whatsapp,16),email:text(p.email,254),openingHours:text(p.openingHours,1000),seoTitle:text(p.seoTitle,70),seoDescription:text(p.seoDescription,170),logoDataUrl:image(p.logoDataUrl)??'',locations:p.locations.map(v=>{if(!object(v))throw Error('INVALID_PUBLIC_WEBSITE');return{publicName:text(v.publicName,120),address:text(v.address,500)}})}
 if(!profile.publicName.trim()||!profile.description.trim()||!profile.logoDataUrl||!profile.locations.length||!(profile.phone||profile.whatsapp||profile.email))throw Error('INVALID_PUBLIC_WEBSITE')
 if(profile.phone&&!/^\+?[0-9][0-9 ()-]{5,29}$/.test(profile.phone)||profile.whatsapp&&!/^\+?[0-9]{7,15}$/.test(profile.whatsapp)||profile.email&&!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(profile.email))throw Error('INVALID_PUBLIC_WEBSITE')
 return{profile,catalog:parsePublicWebsiteCatalog(c,canonicalSlug)}
}
/** Public catalog allowlist also applies to filtered responses and local public baskets. */
export function parsePublicWebsiteCatalog(value:unknown,canonicalSlug:string):PublicWebsiteCatalog {
 if(!object(value)||value.canonicalSlug!==canonicalSlug||!Array.isArray(value.items)||value.items.length>20||!Number.isSafeInteger(value.total)||Number(value.total)<0||!Number.isSafeInteger(value.page)||Number(value.page)<1||value.pageSize!==20)throw Error('INVALID_PUBLIC_WEBSITE')
 const c=value
 const items:PublicWebsiteCatalogItem[]=value.items.map(v=>{
  if(!object(v)||typeof v.kind!=='string'||!['product','service'].includes(v.kind)||!Number.isSafeInteger(v.displayOrder))throw Error('INVALID_PUBLIC_WEBSITE')
  if(v.bookable!==undefined&&typeof v.bookable!=='boolean')throw Error('INVALID_PUBLIC_WEBSITE')
  const base={publicId:text(v.publicId,80),kind:v.kind as 'product'|'service',name:text(v.name,160),description:text(v.description,2000),image:image(v.image),displayOrder:Number(v.displayOrder),...(typeof v.bookable==='boolean'?{bookable:v.bookable}:{})}
  if(v.priceMode==='contact')return{...base,priceMode:'contact' as const}
  if(v.priceMode!=='shown'||typeof v.price!=='number'||!Number.isFinite(v.price)||v.price<0||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))throw Error('INVALID_PUBLIC_WEBSITE')
  return{...base,priceMode:'shown' as const,price:v.price,currency:v.currency}
 })
 const counts=object(c.counts)&&['all','product','service'].every(key=>Number.isSafeInteger((c.counts as Record<string,unknown>)[key])&&Number((c.counts as Record<string,unknown>)[key])>=0)?c.counts as {all:number;product:number;service:number}:undefined
 if(c.counts!==undefined&&!counts||counts&&(counts.all!==counts.product+counts.service||Number(c.total)>counts.all))throw Error('INVALID_PUBLIC_WEBSITE')
 if(c.bookingEnabled!==undefined&&typeof c.bookingEnabled!=='boolean')throw Error('INVALID_PUBLIC_WEBSITE')
 return{canonicalSlug,items,total:Number(c.total),page:Number(c.page),pageSize:20,...(counts?{counts}:{}),...(typeof c.bookingEnabled==='boolean'?{bookingEnabled:c.bookingEnabled}:{})}
}

export function websitePageUrl(slug:string,locale:WebsiteLocale,page=1,domain:string=websiteDomain):string {
 const url=new URL(websiteUrl(slug,domain)+'/');if(locale==='en')url.searchParams.set('lang','en');if(page>1)url.searchParams.set('page',String(page));return url.href
}
export function publicWebsiteQuery(query:URLSearchParams):{locale:WebsiteLocale;page:number} {
 if([...query.keys()].some(k=>!['lang','page'].includes(k))||query.getAll('lang').length>1||query.getAll('page').length>1)throw Error('INVALID_WEBSITE_QUERY')
 const lang=query.get('lang')??'ar',p=query.get('page')??'1'
 if(!['ar','en'].includes(lang)||!/^[1-9][0-9]{0,4}$/.test(p)||Number(p)>99999)throw Error('INVALID_WEBSITE_QUERY')
 return{locale:lang as WebsiteLocale,page:Number(p)}
}
export function validateWebsiteInquiry(value:unknown):WebsiteInquiryForm&{locale:WebsiteLocale} {
 if(!object(value)||Object.keys(value).some(k=>!['name','contact','message','company','locale'].includes(k)))throw Error('INVALID_WEBSITE_INQUIRY')
 const form={name:text(value.name,120).trim(),contact:text(value.contact,254).trim(),message:text(value.message,2000).trim(),company:text(value.company,200),locale:value.locale}
 if(form.locale!=='ar'&&form.locale!=='en')throw Error('INVALID_WEBSITE_INQUIRY')
 if(form.company)return{...form,locale:form.locale}
 const digits=form.contact.replace(/\D/g,'')
 if(!form.name||Array.from(form.name).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)||!form.message||!(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(form.contact)||/^\+?[0-9][0-9 ()-]{5,30}$/.test(form.contact)&&digits.length>=7&&digits.length<=15))throw Error('INVALID_WEBSITE_INQUIRY')
 return{...form,locale:form.locale}
}
