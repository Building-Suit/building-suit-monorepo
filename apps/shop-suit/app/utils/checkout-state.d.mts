import type { XPayOrder } from './xpay-checkout.mjs'
export type CheckoutPhase = 'checking' | 'ready' | 'resume' | 'confirming' | 'confirmed' | 'held' | 'failed'
export function checkoutDialogPhase(input: { paymentPhase: CheckoutPhase; newPlanReview: boolean; quoteState?: string; blocked: boolean; pending: boolean }): CheckoutPhase
export function checkoutSnapshot(input: { orders: XPayOrder[]; current: XPayOrder | null; historyKnown: boolean; accessState: string | undefined; checking: boolean; error: boolean; periodEnd?: string | null; now?: number }): { phase: CheckoutPhase; order: XPayOrder | null; latestPaid: XPayOrder | null; canStart: boolean }
