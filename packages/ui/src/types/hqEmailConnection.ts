/** Founder-only connection test; never an ordinary email-send permission. */
export interface HqEmailTestSnapshot {
  id: string; agentId: 'AG-EMAIL-002'; managerId: 'AG-EMAIL-001'; sender: string
  recipient: string; subject: string; body: string; digest: string; expiresAt: string
  state: 'prepared' | 'approved' | 'reserved' | 'accepted' | 'rejected' | 'uncertain' | 'revoked'
  providerAccepted: boolean; delivered: false; providerId: string | null
}
export interface HqEmailConnectionReadiness {
  agentId: 'AG-EMAIL-002'; managerId: 'AG-EMAIL-001'; domain: string; sender: string
  configured: boolean; providerTested: boolean; scope: 'founder-test-only'
  /** No general autonomous sending. Each separately approved test runs on the host. */
  automaticSending: false
}
export interface HqEmailConnectionPresentation {
  pending: boolean; readiness: HqEmailConnectionReadiness | null; test: HqEmailTestSnapshot | null
  message: string; approvalAvailable: boolean
}
export type HqEmailConnectionCommand = { action: 'refresh'; id?: string }
  | { action: 'prepare'; recipient: string; subject: string; body: string }
  | { action: 'decide'; id: string; digest: string; approve: boolean }
