import { isPublicPath, productionOrigin } from './publicSeo'
export type MarketingEvent = 'page_view' | 'pricing_cta' | 'signup_complete'
export function analyticsEnvelope(event: MarketingEvent, path: string, changelogAvailable = false) {
  if (event === 'signup_complete' && path === '/auth/signup') return { name: 'sign_up', params: { method: 'email', page_location: productionOrigin + '/', page_title: 'Shop Suit', page_referrer: '' } }
  if (!isPublicPath(path, changelogAvailable)) return null
  const common = { page_location: productionOrigin + path, page_title: 'Shop Suit', page_referrer: '' }
  if (event === 'page_view') return { name: 'page_view', params: common }
  if (event === 'pricing_cta' && path === '/') return { name: 'select_content', params: { ...common, content_type: 'pricing', item_id: 'signup' } }
  return null
}
