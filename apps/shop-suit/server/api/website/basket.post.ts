import { configuredWebsiteDomain, websiteUrl, validWebsiteSlug } from '../../../shared/websiteAddress'
import { parseBasketRequest } from '../../../shared/storefront'
import { readBoundedInquiryBody } from '../../utils/readBoundedInquiryBody'
import { publicWebsiteRpc } from '../../utils/publicWebsiteRpc'
import { createInquiryRateLimit } from '../../utils/inquiryRateLimit'
const allowed=createInquiryRateLimit()
export default defineEventHandler(async event=>{
 const config=useRuntimeConfig(event),domain=configuredWebsiteDomain(config.public),host=event.context.websiteHost,canonical=event.context.websiteCanonicalSlug
 setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
 if(!domain||host?.kind!=='website'||!validWebsiteSlug(canonical))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug,domain))throw createError({statusCode:403,statusMessage:'Origin rejected'})
 if(!getHeader(event,'content-type')?.startsWith('application/json'))throw createError({statusCode:415,statusMessage:'JSON required'})
 if(!allowed(`${canonical}:${event.node.req.socket?.remoteAddress??'unknown'}`)){setResponseHeader(event,'Retry-After',600);throw createError({statusCode:429,statusMessage:'Please try later'})}
 let form
 try{form=parseBasketRequest(await readBoundedInquiryBody(event))}catch{throw createError({statusCode:400,statusMessage:'Check request details'})}
 try{
  await publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},'shop_website_basket_request',{p_slug:host.slug,p_name:form.name,p_contact:form.contact,p_lines:form.lines,p_message:form.message,p_locale:form.locale,p_honeypot:form.company})
  setResponseStatus(event,202);return{ok:true}
 }catch(error){const code=(error as {code?:string}).code;throw createError({statusCode:code==='P0001'?429:code==='22023'?400:503,statusMessage:code==='P0001'?'Please try later':code==='22023'?'Review your basket; an item may no longer be available':'Could not send request'})}
})
