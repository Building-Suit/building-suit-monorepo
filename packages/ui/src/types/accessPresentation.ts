import type { BsInvitationAction } from '@building-suit/ux'

export interface BsAccessMemberAction {
  key: 'edit' | 'suspend' | 'reactivate' | 'remove' | 'transfer'
  label: string
  tone?: 'default' | 'secondary' | 'danger'
  disabled?: boolean
}
export interface BsAccessMemberView {
  id: string
  name: string
  email: string
  jobTitle?: string
  role: string
  roleNote?: string
  status: string
  statusLabel?: string
  joined?: string
  locations?: string
  actions: BsAccessMemberAction[]
}

export interface BsAccessInvitationView {
  id: string
  email: string
  role: string
  status: string
  statusLabel?: string
  sender?: string
  senderDetail?: string
  sent: string
  expires?: string
  actions: BsInvitationAction[]
}

export interface BsAccessRoleView {
  id: string
  label: string
  description?: string
  permissions: string
  actions: { key: 'edit' | 'remove'; label: string; disabled?: boolean }[]
}
export interface BsAccessAuditView {
  id: string
  action: string
  actor: string
  reason: string
  date: string
}
export interface BsAccessPageCopy {
  title: string
  subtitle: string
  eyebrow?: string
  members: string
  roles: string
  invitations: string
  noMembers: string
  noInvitations: string
  search?: string
  memberCount?: string
  invitationCount?: string
  roleSummary?: string
  roleSummaryHint?: string
  invite?: string
  newRole?: string
  matrix?: string
  retry: string
  noTeam: string
  memberColumns: { name: string; role: string; status: string; actions: string; joined?: string; locations?: string }
  invitationColumns: { email: string; role: string; status: string; sent: string; actions: string; sender?: string; expires?: string }
  audit?: { title: string; empty: string; action: string; actor: string; reason: string; date: string }
}

export interface BsAccessEditorState {
  visible: boolean
  title: string
  dirty: boolean
  pending: boolean
  error?: string | null
  submitLabel: string
  cancelLabel: string
}
export interface BsAccessIdentityForm {
  name: string
  jobTitle: string
  email: string
  role: string
  locationIds: string[]
}
export interface BsAccessIdentityCopy {
  name?: string
  jobTitle?: string
  email: string
  emailMaxLength?: number
  role: string
  locations?: string
  help?: string
  deliveryTitle?: string
  deliveryHint?: string
  ready?: string
}
export interface BsAccessRoleForm {
  name: string
  nameAr: string
  permissions: string[]
}
