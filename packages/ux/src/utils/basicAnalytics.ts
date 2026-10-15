/** Basic consent mode. This transport must only be created after explicit consent.
 * A same-origin isolated document keeps the provider away from application DOM,
 * sensitive document URLs, forms and SPA history. Only allowlisted values cross in.
 */
export function createBasicAnalytics(measurementId: string, origin: string, doc: Document = document) {
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || !/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw new Error('Invalid analytics configuration')
  const frame = doc.createElement('iframe')
  frame.hidden = true
  frame.title = 'Optional analytics'
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  frame.referrerPolicy = 'no-referrer'
  const settings = JSON.stringify({
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    allow_enhanced_conversions: false, cookie_expires: 15552000, cookie_update: false,
    cookie_domain: 'none', page_location: origin + '/', page_referrer: '', page_title: 'Shop Suit',
  })
  // No parent document or route reads. No postMessage listener: the parent calls
  // this document's narrow dispatch function with already validated envelopes.
  frame.srcdoc = `<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body><script>
    window.dataLayer=[];function gtag(){dataLayer.push(arguments)}
    gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('js',new Date());gtag('config','${measurementId}',${settings});
    window.dispatchAnalytics=function(name,params){gtag('event',name,params)};
    </script><script referrerpolicy="no-referrer" src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script></body></html>`
  let active = true
  const pending: Array<{ name: string; params: Record<string, unknown> }> = []
  type AnalyticsWindow = Window & { dispatchAnalytics?: (name: string, params: Record<string, unknown>) => void }
  function dispatch(name: string, params: Record<string, unknown>) {
    if (!active) return
    const target = frame.contentWindow as AnalyticsWindow | null
    if (target?.dispatchAnalytics) target.dispatchAnalytics(name, params)
    else pending.push({ name, params })
  }
  frame.addEventListener('load', () => {
    if (!active) return
    const target = frame.contentWindow as AnalyticsWindow | null
    for (const event of pending.splice(0)) target?.dispatchAnalytics?.(event.name, event.params)
  })
  doc.body.append(frame)
  return {
    send(name: string, params: Record<string, unknown>, wait = false): Promise<void> {
      if (!wait) { dispatch(name, params); return Promise.resolve() }
      return new Promise(resolve => {
        const timeout = window.setTimeout(resolve, 1500)
        dispatch(name, { ...params, event_timeout: 1200, event_callback: () => { window.clearTimeout(timeout); resolve() } })
      })
    },
    stop() { active = false; pending.length = 0; frame.remove() },
  }
}
