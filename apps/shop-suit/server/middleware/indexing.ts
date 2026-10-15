import { canIndex, isPublicPath } from '#shared/publicSeo'
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const config = useRuntimeConfig(event)
  if (!canIndex(config.public.appEnvironment, url.origin) || !isPublicPath(url.pathname)) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
