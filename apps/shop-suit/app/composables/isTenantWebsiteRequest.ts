import {classifyWebsiteHost} from '#shared/websiteHost'
export function isTenantWebsiteRequest() {
 const config=useRuntimeConfig()
 const host=import.meta.server?useRequestEvent()?.node.req.headers.host:window.location.host
 return classifyWebsiteHost(host,config.public.appUrl||'',config.public.appEnvironment,config.public.websiteHostnameSuffix).kind==='website'
}
