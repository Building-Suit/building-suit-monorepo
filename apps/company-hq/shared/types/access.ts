/** Display-only response from HQ's server-owned Supabase/founder authorization. */
export interface HqFounderAccessResponse {
  status: 'anonymous' | 'founder' | 'denied' | 'unavailable'
  user?: {
    displayName: string
    detailLabel?: string
    avatarUrl?: string
  }
  reason?: 'setup-required' | 'invalid-credentials' | 'not-founder' | 'cloud-unavailable' | 'confirmation-required'
}
