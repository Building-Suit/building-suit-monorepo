export interface CatalogOfferLine { measurement?: import('../app/types/measurement').PosMeasurement | null; kind: 'product' | 'service'; sourceId: string; quantity: number; name: string; available: boolean; stock?: number | null; unitPrice: number; discount: number }
export interface CatalogOffer { id: string; name: string; description: string; price: number; oldPrice: number | null; priority: number; active: boolean; website_visible: boolean; starts_at: string | null; ends_at: string | null; revision: number; lines: CatalogOfferLine[] }
export interface OfferMatch { id: string; name: string; revision: number; quantity: number; price: number; oldPrice: number; saving: number }
export interface OfferSource { id: string; key: string; kind: 'product' | 'service'; name: string; price: number; discount: number }
/** Offline estimate only. The replay command recalculates and rejects changed totals. */
export function estimateOfferDiscount(offers: CatalogOffer[], lines: { itemType: string; sourceId: string; quantity: number }[], at = Date.now()): { discount: number; offers: OfferMatch[] } {
 const remaining = new Map<string, number>()
 for (const line of lines) { const key = `${line.itemType}:${line.sourceId}`; remaining.set(key, (remaining.get(key) ?? 0) + Math.round(line.quantity * 100000)) }
 const matched: OfferMatch[] = []
 let discount = 0
 for (const offer of offers) {
  if (!offer.active || !offer.lines.length || offer.lines.some(l => !l.available) || offer.starts_at && Date.parse(offer.starts_at) > at || offer.ends_at && Date.parse(offer.ends_at) <= at) continue
  let sets = 1000000, oldCents = 0
  for (const line of offer.lines) {
   const needed = Math.round(line.quantity * 100000)
   if (needed <= 0) { sets = 0; break }
   sets = Math.min(sets, Math.floor((remaining.get(`${line.kind}:${line.sourceId}`) ?? 0) / needed))
   oldCents += Math.round((line.unitPrice - line.discount) * line.quantity * 100 + 1e-7)
  }
  const saving = oldCents - Math.round(offer.price * 100)
  if (!sets || saving <= 0) continue
  for (const line of offer.lines) { const key = `${line.kind}:${line.sourceId}`; remaining.set(key, remaining.get(key)! - Math.round(line.quantity * 100000) * sets) }
  discount += saving * sets
  matched.push({ id: offer.id, name: offer.name, revision: offer.revision, quantity: sets, price: offer.price, oldPrice: oldCents / 100, saving: saving * sets / 100 })
 }
 return { discount: discount / 100, offers: matched }
}
