export type SubscriptionCurrency = 'EGP' | 'USD'
export function subscriptionCurrencyChoice(input?: {
  selectedCurrency?: SubscriptionCurrency | null
  countryHint?: string | null
  committedCurrency?: SubscriptionCurrency | null
}): {
  currency: SubscriptionCurrency
  requestedCurrency: SubscriptionCurrency
  suggestedCurrency: SubscriptionCurrency
  source: 'explicit' | 'subscription' | 'suggestion'
  requiresCurrencyChange: boolean
}
