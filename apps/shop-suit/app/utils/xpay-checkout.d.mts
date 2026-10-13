export type XPayOrderState = 'creating' | 'open' | 'pending' | 'expired' | 'failed' | 'paid' | 'requires_review'
export type XPayOrder = { orderId: string; state: XPayOrderState; amountMinor: number; currency: 'EGP'; planName: string; sessionId: string | null; url: string | null; expiresAt: string | null; createdAt: string }
export function isXPayOrderId(value: unknown): value is string
export function xpayHostedUrl(value: unknown, sessionId: unknown): string
export function parseXPayOrder(value: unknown): XPayOrder
export function parseXPayDatabaseOrders(value: unknown): XPayOrder[]
export function checkoutAttemptKey(userId: string, shopId: string): string
export function checkoutAttempt(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, selection: string, createId: () => string): string
