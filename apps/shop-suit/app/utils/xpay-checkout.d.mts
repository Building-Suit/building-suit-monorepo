export type XPayOrderState = 'creating' | 'open' | 'pending' | 'expired' | 'failed' | 'paid' | 'requires_review'
export type XPayOrder = { orderId: string; quoteId?: string; state: XPayOrderState; amountMinor: number; currency: 'EGP'; planName: string; sessionId: string | null; url: string | null; expiresAt: string | null; createdAt: string }
export function isXPayOrderId(value: unknown): value is string
export function xpayHostedUrl(value: unknown, sessionId: unknown): string
export function parseXPayOrder(value: unknown): XPayOrder
export function parseXPayDatabaseOrders(value: unknown): XPayOrder[]
export function checkoutAttemptKey(userId: string, shopId: string): string
export function checkoutAttempt(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, selection: string, createId: () => string): string

export function checkoutFailureCode(data: unknown, error: unknown): Promise<'checkout_change_at_period_end' | 'checkout_active_period_exists' | 'checkout_historical_review_pending' | 'checkout_quote_stale' | 'checkout_quote_open' | 'checkout_credit_confirmation_required' | 'checkout_payment_unresolved' | 'checkout_proration_unavailable' | 'checkout_currency_unsupported' | 'checkout_offer_expiring' | 'checkout_plan_change_blocked' | 'checkout_quote_required' | 'checkout_payment_method_unsupported' | 'checkout_period_unsupported' | null>
