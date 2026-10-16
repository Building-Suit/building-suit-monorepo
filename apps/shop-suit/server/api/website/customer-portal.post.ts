import {parseCustomerPortal} from '../../../shared/customerPortal'
import {websiteUrl,validWebsiteSlug} from '../../../shared/websiteAddress'
import {readBoundedInquiryBody} from '../../utils/readBoundedInquiryBody'
import {publicWebsiteRpc} from '../../utils/publicWebsiteRpc'
export default defineEventHandler(async event=>{
 const host=event.context.websiteHost,config=useRuntimeConfig(event)
 setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
 if(host?.kind!=='website'||!validWebsiteSlug(event.context.websiteCanonicalSlug))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug))throw createError({statusCode:403,statusMessage:'Access unavailable'})
 const token=event.context.appointmentAccessToken as string|undefined
 const denied=()=>{const name=`bs-shop-${config.public.appEnvironment}-appointment-access`;event.context.appointmentAccessCookieName=name;deleteCookie(event,name,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict'});return{authenticated:false}}
 try{
  if(!token||!getHeader(event,'content-type')?.startsWith('application/json'))return denied()
  const value=await readBoundedInquiryBody(event,512)
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['bucket','page'].includes(k)))return denied()
  const args=value as {bucket?:unknown;page?:unknown}
  if(typeof args.bucket!=='string'||!['upcoming','past'].includes(args.bucket)||!Number.isSafeInteger(args.page)||Number(args.page)<1||Number(args.page)>100000)return denied()
  const raw=await publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},'appointment_customer_portal',{p_slug:host.slug,p_token:token,p_bucket:args.bucket,p_page:args.page})
  const result=parseCustomerPortal(raw)
  if(!result||result.bucket!==args.bucket||result.page!==args.page)return denied()
  return result
 }catch{return denied()}
})
