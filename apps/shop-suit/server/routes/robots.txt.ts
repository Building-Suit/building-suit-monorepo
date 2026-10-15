import { canIndex, productionOrigin } from '#shared/publicSeo'
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  // Crawlable even on staging: crawlers must see noindex on previously indexed URLs.
  return 'User-agent: *\nAllow: /\n' + (canIndex(useRuntimeConfig(event).public.appEnvironment, getRequestURL(event).origin)
    ? `Sitemap: ${productionOrigin}/sitemap.xml\n` : '')
})
