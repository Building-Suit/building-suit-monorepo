import {readBoundedInquiryBody} from '../../utils/readBoundedInquiryBody'
import {validateWebsiteInquiry} from '../../../shared/publicWebsite'
import {publicWebsiteRpc} from '../../utils/publicWebsiteRpc'
import {createInquiryRateLimit} from '../../utils/inquiryRateLimit'
import {websiteUrl,validWebsiteSlug,configuredWebsiteDomain} from '../../../shared/websiteAddress'
const allowed=createInquiryRateLimit()
export default defineEventHandler(async event=>{
 const config=useRuntimeConfig(event),domain=configuredWebsiteDomain(config.public)
 const host=event.context.websiteHost,canonical=event.context.websiteCanonicalSlug
 setResponseHeader(event,'Cache-Control','private, no-store')
 if(!domain||host?.kind!=='website'||typeof canonical!=='string'||!validWebsiteSlug(canonical))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug,domain))throw createError({statusCode:403,statusMessage:'Inquiry origin rejected'})
 if(!getHeader(event,'content-type')?.startsWith('application/json'))throw createError({statusCode:415,statusMessage:'JSON required'})
 const socket=event.node.req.socket?.remoteAddress??'unknown'
 if(!allowed(`${canonical}:${socket}`)){setResponseHeader(event,'Retry-After',600);throw createError({statusCode:429,statusMessage:'Please try later'})}
 let form
 try{form=validateWebsiteInquiry(await readBoundedInquiryBody(event))}catch(error){if((error as {statusCode?:number}).statusCode===413)throw error;throw createError({statusCode:400,statusMessage:'Check inquiry details'})}
 try{
  await publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},'shop_website_inquiry_submit',{p_slug:host.slug,p_name:form.name,p_contact:form.contact,p_message:form.message,p_locale:form.locale,p_honeypot:form.company})
  setResponseStatus(event,202);return{ok:true}
 }catch(error){const code=(error as {code?:string}).code
  throw createError({statusCode:code==='P0001'?429:code==='22023'?400:code==='P0002'?404:503,statusMessage:code==='P0001'?'Please try later':code==='P0002'?'Not Found':'Could not send inquiry'})}
})
