import {classifyWebsiteHost,websiteAliasRedirect} from '../utils/websiteHost'
import {publicWebsiteRpc} from '../utils/publicWebsiteRpc'
import {parsePublicWebsite,publicWebsiteQuery,websitePageUrl} from '../../shared/publicWebsite'

export default defineNitroPlugin(nitroApp=>{
 nitroApp.hooks.hook('beforeResponse',event=>{
  if(event.context.websiteHost){
   const name=event.context.appointmentAccessCookieName as string|undefined
   const cookies=event.node.res.getHeader('set-cookie')
   const allowed=name?(Array.isArray(cookies)?cookies:typeof cookies==='string'?[cookies]:[]).filter(cookie=>cookie.startsWith(name+'=')):[]
   event.node.res.removeHeader('set-cookie');if(allowed.length)event.node.res.setHeader('set-cookie',allowed)
  }
 })
 nitroApp.hooks.hook('request',async event=>{
  const config=useRuntimeConfig(event)
  const host=classifyWebsiteHost(getHeader(event,'host'),config.public.appUrl||'',config.public.appEnvironment)
  if(host.kind==='private')return
  event.context.websiteHost=host
  if(host.kind==='website'&&event.method==='POST'&&/^\/api\/website\/appointment-access\/(verify|validate|rotate|logout)(\?|$)/.test(event.node.req.url??'')){
   const token=getCookie(event,`bs-shop-${config.public.appEnvironment}-appointment-access`)
   if(token&&/^[A-Za-z0-9_-]{43}$/.test(token))event.context.appointmentAccessToken=token
  }
  delete event.node.req.headers.cookie;delete event.node.req.headers.authorization
  setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'Vary','Host, Accept-Language');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
  const unavailable=async()=>{setResponseStatus(event,404);await send(event,'Not Found','text/plain; charset=utf-8')}
  if(host.kind!=='website')return unavailable()
  const url=new URL(event.node.req.url??'/','https://'+host.slug+'.shops.building-suit.com')
  const asset=/^\/_nuxt\/[A-Za-z0-9_.-]{8,}\.(js|css|woff|woff2)$/.test(url.pathname)||/^\/_i18n\/[a-f0-9]{8}\/(ar|en)\/messages\.json$/.test(url.pathname)||/^\/_nuxt\/builds\/(latest\.json|meta\/[a-f0-9-]{36}\.json)$/.test(url.pathname)
  const inquiry=(url.pathname==='/api/website/inquiries'||/^\/api\/website\/appointment-access\/(verify|validate|rotate|logout)$/.test(url.pathname))&&event.method==='POST'
  if(!inquiry&&!['GET','HEAD'].includes(event.method))return unavailable()
  try{
   const rpc={url:config.public.supabase.url,key:config.public.supabase.key}
   const resolved=await publicWebsiteRpc(rpc,'shop_website_host_resolve',{p_slug:host.slug})
   if(!resolved||typeof resolved!=='object'||!('canonicalSlug'in resolved)||typeof resolved.canonicalSlug!=='string')return unavailable()
   const redirect=websiteAliasRedirect(host.slug,resolved)
   if(inquiry){event.context.websiteCanonicalSlug=resolved.canonicalSlug;return}
   // Preserve the established alias contract: private paths collapse to the canonical root.
   if(redirect&&!['/','/robots.txt','/sitemap.xml'].includes(url.pathname)&&!asset){await sendRedirect(event,redirect,308);return}
   if(!['/','/robots.txt','/sitemap.xml'].includes(url.pathname)&&!asset)return unavailable()
   if(asset)return
   const query=publicWebsiteQuery(url.searchParams)
   if(redirect&&url.pathname==='/'){await sendRedirect(event,query.locale==='ar'&&query.page===1?redirect:websitePageUrl(resolved.canonicalSlug,query.locale,query.page),308);return}
   const index=config.public.appEnvironment==='production'
   const canonical=websitePageUrl(resolved.canonicalSlug,query.locale,query.page)
   if(url.pathname==='/robots.txt'){await send(event,`User-agent: *\n${index?'Allow: /':'Disallow: /'}\nSitemap: ${new URL('/sitemap.xml',canonical).href}\n`,'text/plain; charset=utf-8');return}
   if(url.pathname==='/sitemap.xml'){const root=websitePageUrl(resolved.canonicalSlug,'ar');await send(event,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${index?`<url><loc>${root}</loc></url><url><loc>${websitePageUrl(resolved.canonicalSlug,'en').replaceAll('&','&amp;')}</loc></url>`:''}</urlset>`,'application/xml; charset=utf-8');return}
   const raw=await publicWebsiteRpc(rpc,'shop_website_showcase',{p_slug:host.slug,p_page:query.page})
   const payload=parsePublicWebsite(raw,resolved.canonicalSlug)
   if(query.page>1&&!payload.catalog.items.length)return unavailable()
   event.context.websitePage={payload,...query,index}
   if(index)setResponseHeader(event,'X-Robots-Tag','index, follow')
  }catch{return unavailable()}
 })
})
