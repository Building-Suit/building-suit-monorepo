export type BsBusinessSettingsSection = 'shop-profile' | 'business-mode' | 'locations' | 'receipt-settings' | 'cash-policy' | 'public-booking-settings' | 'website-inquiries' | 'website-catalog' | 'website-profile' | 'website-address' | 'currency-settings'

export interface BsBusinessProfileForm { displayName: string }
export interface BsBusinessLocationForm { name: string; code: string; address: string; phone: string }
export interface BsBusinessReceiptForm { displayName: string; address: string; phone: string; footer: string; paperSize: string; documentLabel?: string; referenceLabel?: string; documentLanguage?: string; documentDirection?: string; showDescriptions?: boolean; notes?: string; logoDataUrl?: string }
export interface BsBusinessLocationRow { id: string; name: string; summary: string; badge: 'default' | 'archived' | null; canArchive: boolean; canRestore: boolean }
export interface BsBusinessSettingsEditor { pending: boolean; error: string; success: string; dirty: boolean; submitDisabled: boolean }
export interface BsBusinessLocationsView { rows: BsBusinessLocationRow[]; pending: boolean; error: string; dirty: boolean; editing: boolean; usageLabel: string; canCreate: boolean; capacityNotice: boolean; restoreDisabled: boolean }
export interface BsBusinessCashPolicyView { loading: boolean; loadError: boolean; pending: boolean; error: string; success: string; disabled: boolean; submitDisabled: boolean }
export interface BsBusinessReceiptSummary { displayName: string; address: string; phone: string; footer: string; paperLabel: string }
export interface BsBusinessSettingsCopy {
  editProfile?: string
  editMode?: string
  editReceipt?: string
  title: string
  subtitle: string
  loading: string
  failed: string
  retry: string
  empty: string
  cashTitle: string
  cashHelp: string
  cashRequired: string
  ownerOnly: string
  cashSave: string
  profileTitle: string
  profileHelp: string
  profileOwnerOnly: string
  saveProfile: string
  cancelEdit: string
  shopDisplayName: string
  profileLocationHelp: string
  manageLocations: string
  modeTitle: string
  modeHelp: string
  preserve: string
  save: string
  locationsTitle: string
  locationsHelp: string
  locationLimit: string
  upgradePlan: string
  addLocation: string
  editLocation: string
  archiveLocation: string
  locationName: string
  locationCode: string
  defaultLocation: string
  archivedLocation: string
  restoreLocation: string
  saveLocation: string
  locationAddress: string
  locationPhone: string
  receiptTitle: string
  receiptHelp: string
  receiptFailed: string
  receiptOwnerOnly: string
  receiptDisplayName: string
  receiptAddress: string
  receiptPhone: string
  receiptFooter: string
  documentLabel?: string
  referenceLabel?: string
  documentLanguage?: string
  documentDirection?: string
  showDescriptions?: string
  documentNotes?: string
  documentLogo?: string
  logoHelp?: string
  removeLogo?: string
  autoDirection?: string
  receiptPaper: string
  saveReceipt: string
  thermal80: string
  a4: string
}

export interface BsBusinessCurrencyView {
  code: string; locked: boolean; loading: boolean; loadError: boolean; pending: boolean; error: string; success: string
  title: string; help: string; lockedHelp: string; failed: string; retry: string; save: string
  options: { value: string; label: string }[]
}
