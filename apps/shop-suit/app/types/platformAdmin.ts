export type PlatformAdminSession = {
  userId: string
  role: 'observer' | 'operator'
  canMutate: boolean
  displayName: string | null
}

export type PlatformAdminEvent = {
  id: string
  shopId: string
  shopName: string
  actorUserId: string
  actorRole: string
  action: string
  reason: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown>
  occurredAt: string
}

export type PlatformDashboard = {
  shops: number
  activeShops: number
  suspendedShops: number
  locations: number
  members: number
  activeTrials: number
  trialsExpiringSoon: number
  activeSubscriptions: number
  readOnlySubscriptions: number
  pendingBillingSubmissions: number
  recentEvents: PlatformAdminEvent[]
}

export type PlatformShopRow = {
  id: string
  name: string
  status: string
  businessMode: string
  createdAt: string
  ownerName: string | null
  ownerEmail: string | null
  locationCount: number
  memberCount: number
  subscriptionStatus: string | null
  planSlug: string | null
  accessState: string
}

export type PlatformPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type PlatformShopDetail = {
  shop: { id: string; name: string; status: string; businessMode: string; createdAt: string }
  owner: { profileId: string; name: string | null; email: string | null; membershipStatus: string } | null
  subscription: {
    id: string
    status: string
    planId: string
    planSlug: string
    planName: string
    trialStartAt: string | null
    trialEndAt: string | null
    periodStart: string | null
    periodEnd: string | null
    lockedAt: string | null
    billingMetadata: Record<string, unknown>
  } | null
  locations: Array<{ id: string; name: string; code: string | null; status: string; isDefault: boolean }>
  members: Array<{ id: string; role: string; status: string; name: string | null; email: string | null; createdAt: string }>
  usage: { members: number; locations: number; products: number; services: number; limits: Record<string, unknown> | null }
  billingHistory: Array<{ id: string; kind: string; status: string; amount: number | null; currency: string; reference: string | null; submittedAt: string }>
  sensitiveEvents: Array<{ id: string; type: string; action: string; reason: string | null; actorId: string; occurredAt: string; details: Record<string, unknown> }>
  supportNotes: Array<{ id: string; note: string; reason: string; actorUserId: string; createdAt: string }>
}
