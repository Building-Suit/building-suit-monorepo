export interface BsWebsiteAddressView {
  title: string; help: string; label: string; currentUrl: string; aliases: string[]
  loading: boolean; failed: boolean; denied: boolean; pending: boolean; dirty: boolean; error: string; success: string; submitDisabled: boolean
  loadingLabel: string; failedLabel: string; deniedLabel: string; retry: string; edit: string; save: string; cancel: string; rules: string
}
