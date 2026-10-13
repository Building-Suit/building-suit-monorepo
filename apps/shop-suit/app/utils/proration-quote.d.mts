export type ProrationQuote = {
  quoteId: string; shopId: string; catalogTermsId: string; privateOfferId: string | null; planName: string
  state: 'quoted' | 'checkout' | 'settled' | 'requires_review' | 'abandoned'; createdAt: string; expiresAt: string; xpayOrderId: string | null
  calculation: { currency: 'EGP'; mode: 'remaining_period' | 'new_interval' | 'trial_conversion' | 'full_term' | 'no_change'; amountDueMinor: number
    creditBeforeMinor: number; creditAfterMinor: number; newTermMinor: number; unusedPrepaidMinor: string; serviceValueMinor: string
    newBillingInterval: 'monthly' | 'annual'; periodStart: string | null; periodEnd: string | null; periodMonths: number
    periodStartPolicy: 'verified_settlement' | 'frozen_quote'; transition: 'verified_xpay_payment' | 'explicit_credit_transition' | 'no_change'; quotedAt: string }
}
export function parseProrationQuote(value: unknown): ProrationQuote
export function prorationStorageKey(userId: string, shopId: string): string
