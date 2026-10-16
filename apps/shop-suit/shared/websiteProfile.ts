import { validWebsiteSlug } from './websiteAddress.ts'

/** Server-owned published-item readiness, never a browser-supplied count. */
export type PublishedItemReadiness = { integration: 'pending' | 'ready'; publishedItemCount: number }
export type WebsiteProfileDraft = {
  publicName: string; description: string; phone: string; whatsapp: string; email: string
  openingHours: string; seoTitle: string; seoDescription: string
  locations: Array<{ id: string; visible: boolean; publicName: string; address: string }>
}
export type WebsiteProfileSettings = {
  draft: Partial<WebsiteProfileDraft>; state: 'draft' | 'published' | 'suspended'; slug: string | null
  logoDataUrl: string | null; catalog: PublishedItemReadiness; missing: string[]; ownerOptedIn: boolean
}
export const emptyWebsiteProfile = (): WebsiteProfileDraft => ({ publicName: '', description: '', phone: '', whatsapp: '', email: '', openingHours: '', seoTitle: '', seoDescription: '', locations: [] })

/** A failed/old/malformed RPC response must not break unrelated settings panels. */
export function parseWebsiteProfileSettings(value: unknown): WebsiteProfileSettings {
  const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
  if (!object(value) || !object(value.draft) || !object(value.catalog)
    || typeof value.state !== 'string' || !['draft','published','suspended'].includes(value.state)
    || !(value.slug === null || (typeof value.slug === 'string' && validWebsiteSlug(value.slug)))
    || !(value.logoDataUrl === null || (typeof value.logoDataUrl === 'string' && value.logoDataUrl.length <= 175000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logoDataUrl)))
    || typeof value.catalog.integration !== 'string' || !['pending','ready'].includes(value.catalog.integration)
    || !Number.isSafeInteger(value.catalog.publishedItemCount) || Number(value.catalog.publishedItemCount) < 0
    || !Array.isArray(value.missing) || value.missing.some(v => typeof v !== 'string')
    || typeof value.ownerOptedIn !== 'boolean') throw new Error('INVALID_WEBSITE_PROFILE_RESPONSE')
  const draft = value.draft
  const fields = ['publicName','description','phone','whatsapp','email','openingHours','seoTitle','seoDescription']
  if (fields.some(key => key in draft && typeof draft[key] !== 'string')
    || ('locations' in draft && (!Array.isArray(draft.locations) || draft.locations.some(v => !object(v) || typeof v.id !== 'string' || typeof v.visible !== 'boolean' || typeof v.publicName !== 'string' || typeof v.address !== 'string')))) throw new Error('INVALID_WEBSITE_PROFILE_RESPONSE')
  return value as WebsiteProfileSettings
}
