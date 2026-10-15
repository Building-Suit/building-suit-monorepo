import { canIndex, publicSitemap } from '#shared/publicSeo'
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return publicSitemap(canIndex(useRuntimeConfig(event).public.appEnvironment, getRequestURL(event).origin))
})
