import { canIndex, isPublicPath } from '#shared/publicSeo'
export default defineEventHandler((event) => {
  if (event.context.websiteHost) return
  const url = getRequestURL(event)
  const config = useRuntimeConfig(event)
  if (!canIndex(config.public.appEnvironment, url.origin) || !isPublicPath(url.pathname, config.public.changelogAvailable)) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
