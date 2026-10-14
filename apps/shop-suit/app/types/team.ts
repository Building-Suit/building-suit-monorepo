export type TeamMemberState = 'active' | 'invited' | 'suspended' | 'removed'

export interface TeamMember {
  id: string
  name: string | null
  email: string | null
  jobTitle: string | null
  roleKey: string
  status: TeamMemberState
  locationIds: string[]
  createdAt: string
}

export interface TeamRole {
  key: string
  name: string
  nameAr: string | null
  isSystem: boolean
  permissionKeys: string[]
}

export interface TeamLocation {
  id: string
  name: string
  status: 'active' | 'archived'
}

export interface TeamInvitation {
  id: string
  email: string
  name: string | null
  jobTitle: string | null
  roleKey: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
}

export interface TeamEvent {
  id: string
  action: string
  actorEmail: string | null
  targetMembershipId: string | null
  reason: string | null
  occurredAt: string
}

export interface TeamSnapshot {
  permissionKeys: string[]
  grantablePermissionKeys: string[]
  canManage: boolean
  canManagePermissions: boolean
  canViewAudit: boolean
  members: TeamMember[]
  roles: TeamRole[]
  locations: TeamLocation[]
  invitations: TeamInvitation[]
  events: TeamEvent[]
}
