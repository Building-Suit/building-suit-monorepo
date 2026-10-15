/** CATALOG must replace the server boundary, never a browser-supplied count. */
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
