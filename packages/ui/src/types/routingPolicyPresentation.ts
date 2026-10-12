export interface BsRoutingPolicyView {
  id: string
  name: string
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
  attempts: { id: string; label: string; profile: string }[]
}
export interface BsRoutingPolicyForm {
  id: string
  name: string
  maximumAttempts: number
  profiles: string
  active: boolean
}
export interface BsRoutingPolicyCopy {
  eyebrow: string
  title: string
  description: string
  create: string
  edit: string
  createTitle: string
  editTitle: string
  submit: string
  id: string
  name: string
  maximumAttempts: string
  profiles: string
  active: string
  writeStatus: string
}
