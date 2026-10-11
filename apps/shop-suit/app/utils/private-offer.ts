export type PrivateOfferEntry = { offerId: string; offerVersion: number; targetBindingId: string; targetEnvironmentId: string; redemptionToken: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
/** Tokens live in URL fragments, never query strings or persistent browser storage. */
export function parsePrivateOfferLink(value: string, origin: string): PrivateOfferEntry {
  const url = new URL(value, origin)
  if (url.origin !== new URL(origin).origin || url.pathname !== '/billing' || url.search || url.username || url.password) throw new Error('invalid_offer_link')
  const p = new URLSearchParams(url.hash.slice(1))
  const keys = ['offer', 'version', 'binding', 'environment', 'token']
  if ([...p.keys()].length !== keys.length || keys.some(k => p.getAll(k).length !== 1) || [...p.keys()].some(k => !keys.includes(k))) throw new Error('invalid_offer_link')
  if (![p.get('offer'), p.get('binding'), p.get('environment')].every(v => uuid.test(v ?? '')) || !/^[1-9][0-9]{0,8}$/.test(p.get('version') ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(p.get('token') ?? '')) throw new Error('invalid_offer_link')
  return { offerId: p.get('offer')!, offerVersion: Number(p.get('version')), targetBindingId: p.get('binding')!, targetEnvironmentId: p.get('environment')!, redemptionToken: p.get('token')! }
}
