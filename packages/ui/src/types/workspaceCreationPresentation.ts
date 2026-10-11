import type { ScopeOption } from '@building-suit/contracts'
export interface BsWorkspaceCreationForm { name: string; legalName: string; currency: string }
export interface BsWorkspaceCreationView {
  visible: boolean; pending: boolean; dirty: boolean; error: string; currencies: string[]
  copy: { title: string; eyebrow: string; hint: string; name: string; legalName: string; currency: string; separateTitle: string; separateBody: string; cancel: string; create: string }
}
export interface BsCheckoutWorkspace {
  productName: string; email: string | undefined; accountLabel: string; signOut: string; assetPrefix: string
  labels: { close: string; open: string; navigation: string; dashboard: string }
  selector: { value: string | null; label: string; placeholder: string; options: ScopeOption[]; createLabel?: string } | undefined
}
