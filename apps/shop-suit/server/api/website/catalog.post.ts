import { configuredWebsiteDomain, websiteUrl, validWebsiteSlug } from '../../../shared/websiteAddress'
import { parseStorefrontQuery } from '../../../shared/storefront'
import { parsePublicWebsiteCatalog } from '../../../shared/publicWebsite'
import { readBoundedInquiryBody } from '../../utils/readBoundedInquiryBody'
import { publicWebsiteRpc } from '../../utils/publicWebsiteRpc'
import { createInquiryRateLimit } from '../../utils/inquiryRateLimit'
const allowed=createInquiryRateLimit(120)
export default defineEventHandler(async event=>{
 const config=useRuntimeConfig(event),domain=configuredWebsiteDomain(config.public),host=event.context.websiteHost,canonical=event.context.websiteCanonicalSlug
 setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
 if(!domain||host?.kind!=='website'||!validWebsiteSlug(canonical))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug,domain))throw createError({statusCode:403,statusMessage:'Origin rejected'})
 if(!getHeader(event,'content-type')?.startsWith('application/json'))throw createError({statusCode:415,statusMessage:'JSON required'})
 if(!allowed(`${canonical}:${event.node.req.socket?.remoteAddress??'unknown'}`))throw createError({statusCode:429,statusMessage:'Please try later'})
 let query
 try{query=parseStorefrontQuery(await readBoundedInquiryBody(event,2048))}catch{throw createError({statusCode:400,statusMessage:'Check catalog filters'})}
 try{
  const raw=await publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},'shop_website_storefront_catalog',{p_slug:host.slug,p_page:query.page,p_search:query.search,p_kind:query.kind,p_sort:query.sort})
  if(!raw)throw createError({statusCode:404,statusMessage:'Not Found'})
  return parsePublicWebsiteCatalog(raw,canonical)
 }catch(error){if((error as {statusCode?:number}).statusCode===404)throw createError({statusCode:404,statusMessage:'Not Found'});throw createError({statusCode:503,statusMessage:'Catalog unavailable'})}
})
