export interface StorefrontBanner { image: string; alt: string; title: string; subtitle: string }
export interface StorefrontGalleryImage { image: string; caption: string }
export interface StorefrontStaff { image: string | null; name: string; role: string; bio: string }
export interface StorefrontLayout { banner: StorefrontBanner | null; gallery: StorefrontGalleryImage[]; staff: StorefrontStaff[]; showOffers: boolean; showGallery: boolean; showStaff: boolean }
export interface StorefrontBuilder { eligible: boolean; owner: boolean; revision: number; draft: StorefrontLayout | null; published: StorefrontLayout | null; websitePublished: boolean }
export interface PublicStorefrontOffer { id: string; name: string; description: string; price: number; oldPrice: number; currency: string; lines: { id: string; quantity: number; name: string; kind: 'product' | 'service'; image: string | null; price: number }[] }
export interface PublicStorefront extends StorefrontLayout { offers: PublicStorefrontOffer[] }
export const emptyStorefrontLayout = (): StorefrontLayout => ({ banner: null, gallery: [], staff: [], showOffers: true, showGallery: true, showStaff: true })
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const text = (v: unknown, max: number) => { if (typeof v !== 'string' || Array.from(v).length > max) throw Error('INVALID_STOREFRONT'); return v }
const image = (v: unknown): string => { const s = text(v, 175000); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) throw Error('INVALID_STOREFRONT_IMAGE'); return s }
const uuid = (v: unknown): string => { const s = text(v, 36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw Error('INVALID_STOREFRONT_ID'); return s }
const number = (v: unknown, max = 1e12) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw Error('INVALID_STOREFRONT_NUMBER'); return v }
/** The public response is reconstructed: private builder metadata never reaches SSR. */
export function parseStorefrontLayout(value: unknown): StorefrontLayout {
 if (!object(value) || !Array.isArray(value.gallery) || value.gallery.length > 8 || !Array.isArray(value.staff) || value.staff.length > 20 || ['showOffers','showGallery','showStaff'].some(k => typeof value[k] !== 'boolean')) throw Error('INVALID_STOREFRONT')
 let banner: StorefrontBanner | null = null
 if (value.banner !== null) {
  if (!object(value.banner)) throw Error('INVALID_STOREFRONT')
  banner = { image: image(value.banner.image), alt: text(value.banner.alt,320), title: text(value.banner.title,320), subtitle: text(value.banner.subtitle,320) }
 }
 return { banner, showOffers: value.showOffers as boolean, showGallery: value.showGallery as boolean, showStaff: value.showStaff as boolean,
  gallery: value.gallery.map(v => { if (!object(v)) throw Error('INVALID_STOREFRONT'); return { image: image(v.image), caption: text(v.caption,160) } }),
  staff: value.staff.map(v => { if (!object(v)) throw Error('INVALID_STOREFRONT'); return { image: v.image === null ? null : image(v.image), name: text(v.name,120), role: text(v.role,120), bio: text(v.bio,320) } }),
 }
}
export function parsePublicStorefront(value: unknown): PublicStorefront {
 if (value === undefined) return { ...emptyStorefrontLayout(), offers: [] }
 const layout = parseStorefrontLayout(value)
 if (!object(value) || !Array.isArray(value.offers) || value.offers.length > 20) throw Error('INVALID_STOREFRONT')
 return { ...layout, gallery: layout.showGallery ? layout.gallery : [], staff: layout.showStaff ? layout.staff : [], offers: (layout.showOffers ? value.offers : []).map(v => {
  if (!object(v) || !Array.isArray(v.lines) || v.lines.length < 1 || v.lines.length > 10 || typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)) throw Error('INVALID_STOREFRONT_OFFER')
  const price = number(v.price), oldPrice = number(v.oldPrice)
  if (price <= 0 || price >= oldPrice) throw Error('INVALID_STOREFRONT_OFFER')
  return { id: uuid(v.id), name: text(v.name,120), description: text(v.description,320), price, oldPrice, currency: v.currency, lines: v.lines.map(l => {
   if (!object(l) || !['product','service'].includes(String(l.kind))) throw Error('INVALID_STOREFRONT_OFFER')
   const quantity = number(l.quantity,999)
   if (quantity < 0.001) throw Error('INVALID_STOREFRONT_OFFER')
   return { id: uuid(l.id), quantity, name: text(l.name,160), kind: l.kind as 'product' | 'service', image: l.image === null ? null : image(l.image), price: number(l.price) }
  }) }
 }) }
}
