import { canIndex, publicSitemap } from '#shared/publicSeo'
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  const config = useRuntimeConfig(event)
  return publicSitemap(canIndex(config.public.appEnvironment, getRequestURL(event).origin), config.public.changelogAvailable)
})
