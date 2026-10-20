import { createBasicAnalytics, readPrivacyPreference } from '@building-suit/ux'
import type { PrivacyPreference } from '@building-suit/ux'
import { canIndex, isPublicPath, productionOrigin } from '#shared/publicSeo'
import { analyticsEnvelope } from '#shared/marketingAnalytics'
import type { MarketingEvent } from '#shared/marketingAnalytics'
export default defineNuxtPlugin(() => {
  if (isTenantWebsiteRequest()) return
  const config = useRuntimeConfig()
  const router = useRouter()
  const user = useSupabaseUser()
  const preference = useShopState<PrivacyPreference | null>('shop-privacy', () => null)
  let transport: ReturnType<typeof createBasicAnalytics> | undefined
  const seen = new Set<string>()
  const configured = canIndex(config.public.appEnvironment, location.origin) && /^G-[A-Z0-9]+$/.test(config.public.gaMeasurementId)
  function consented() { return configured && readPrivacyPreference(JSON.stringify(preference.value))?.analytics === true }
  function stop() { transport?.stop(); transport = undefined }
  async function track(event: MarketingEvent) {
    const path = router.currentRoute.value.path
    if (!consented() || (user.value && event !== 'signup_complete')) return
    const envelope = analyticsEnvelope(event, path, config.public.changelogAvailable)
    if (!envelope) return
    const key = `${event}:${path}`
    if (seen.has(key)) return
    if (event === 'signup_complete') {
      try { if (sessionStorage.getItem('bs-shop.analytics.signup')) return } catch { /* in-memory deduplication remains */ }
    }
    try { transport ??= createBasicAnalytics(config.public.gaMeasurementId, productionOrigin) } catch { return }
    seen.add(key)
    const delivery = transport.send(envelope.name, envelope.params, event === 'signup_complete')
    if (event === 'signup_complete') {
      try { sessionStorage.setItem('bs-shop.analytics.signup', '1') } catch { /* no persistent identifier */ }
    }
    await delivery
  }
  watch([preference, () => router.currentRoute.value.path, user], () => {
    if (!consented() || user.value || !isPublicPath(router.currentRoute.value.path, config.public.changelogAvailable)) stop()
    else void track('page_view')
  }, { immediate: true, flush: 'sync' })
  // Suspend on document exit; consent restoration rechecks expiry on return.
  window.addEventListener('pagehide', stop)
  window.addEventListener('pageshow', () => { if (!user.value && isPublicPath(router.currentRoute.value.path, config.public.changelogAvailable)) void track('page_view') })
  return { provide: { marketingAnalytics: { track } } }
})
