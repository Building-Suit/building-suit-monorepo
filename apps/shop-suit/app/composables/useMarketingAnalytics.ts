import type { MarketingEvent } from '#shared/marketingAnalytics'
export function useMarketingAnalytics() {
  const nuxt = useNuxtApp()
  return { track: async (event: MarketingEvent) => {
    // Optional measurement must never turn a successful business operation into an error.
    if (import.meta.client) {
      try { await nuxt.$marketingAnalytics?.track(event) } catch { /* blockers/CSP may prevent optional analytics */ }
    }
  } }
}
