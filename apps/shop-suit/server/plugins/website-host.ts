import { serverSupabaseClient } from '#supabase/server'
import type { ShopRpcDatabase } from '../../app/types/shopCrmRpc'
import { websiteAliasRedirect, classifyWebsiteHost } from '../utils/websiteHost'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const config = useRuntimeConfig(event)
    const host = classifyWebsiteHost(getHeader(event, 'host'), config.public.appUrl || '', config.public.appEnvironment)
    if (host.kind === 'private') return
    // Foundation only: no tenant rendering, login, API, assets or customer publication
    // on wildcard hosts. Do not let SSR/private routes handle these requests.
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    if (host.kind === 'website' && (event.method === 'GET' || event.method === 'HEAD')) {
      try {
        const client = await serverSupabaseClient<ShopRpcDatabase>(event)
        const { data, error } = await client.rpc('shop_website_host_resolve', { p_slug: host.slug })
        const target = !error && websiteAliasRedirect(host.slug, data)
        if (target) { await sendRedirect(event, target, 308); return }
      } catch { /* An unavailable backend is indistinguishable from an unknown host. */ }
    }
    setResponseStatus(event, 404)
    await send(event, 'Not Found', 'text/plain; charset=utf-8')
  })
})
