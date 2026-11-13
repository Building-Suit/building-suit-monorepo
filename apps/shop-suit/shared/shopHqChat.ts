export interface ShopHqChatAccess {
  enabled: boolean
  agentName: string
  queueAvailable: boolean
}

export type ShopHqChatClarification =
  | { kind: 'customer_missing' | 'customer_ambiguous' | 'service_missing' | 'service_ambiguous'; query: string }
  | { kind: 'cash_shift_required' | 'sale_unavailable' | 'sale_details_required' }
  | { kind: 'payment_missing'; total?: number; currency?: string }
  | { kind: 'amount_mismatch'; total: number; currency: string }

interface ChatEntry {
  sequence: number
  jobId: string
  createdAt: string
}

export const shopHqActionDestinations = ['sales', 'reports', 'products', 'inventory', 'expenses', 'appointments', 'customers', 'business-mode'] as const
export type ShopHqActionDestination = typeof shopHqActionDestinations[number]
export interface ShopHqProductLink {
  destination: 'product'
  productId: string
  name: string
  pricePending: boolean
}

export type ShopHqChatMessage = ChatEntry & (
  | { kind: 'message'; role: 'user' | 'assistant'; text: string }
  | { kind: 'receipt'; role: 'assistant'; link: { destination: 'receipt'; saleId: string } }
  | { kind: 'product'; role: 'assistant'; link: ShopHqProductLink }
  | { kind: 'action'; role: 'assistant'; link: { destination: ShopHqActionDestination } }
  | { kind: 'clarification'; role: 'assistant'; outcome: ShopHqChatClarification }
  | { kind: 'status'; role: 'assistant'; status: 'failed' | 'expired' | 'revoked' }
)

export interface ShopHqChatJob {
  jobId: string
  state: 'queued' | 'working' | 'completed'
  reviewPending: boolean
}

export interface ShopHqChatHistory {
  messages: ShopHqChatMessage[]
  hasMore: boolean
  activeJobs: ShopHqChatJob[]
}
