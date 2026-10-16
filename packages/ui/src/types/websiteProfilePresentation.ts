export type BsWebsiteProfileForm = {
  publicName: string; description: string; phone: string; whatsapp: string; email: string
  openingHours: string; seoTitle: string; seoDescription: string
  locations: Array<{ id: string; visible: boolean; publicName: string; address: string }>
}
export type BsWebsiteProfileView = {
  title: string; help: string; state: string; url: string; logo: string; missing: string[]
  loading: boolean; failed: boolean; denied: boolean; pending: boolean; dirty: boolean; error: string; success: string
  canEdit: boolean; canConsent: boolean; canPublish: boolean; canUnpublish: boolean; locationOptions: Array<{ id: string; label: string; canShow: boolean }>
  copy: Record<'loading' | 'failed' | 'denied' | 'retry' | 'edit' | 'save' | 'cancel' | 'publish' | 'unpublish' | 'optIn' | 'logo' | 'logoHelp' | 'removeLogo' | 'publicName' | 'description' | 'phone' | 'whatsapp' | 'email' | 'openingHours' | 'seoTitle' | 'seoDescription' | 'locations' | 'visible' | 'address' | 'readiness' | 'catalogPending', string>
}
