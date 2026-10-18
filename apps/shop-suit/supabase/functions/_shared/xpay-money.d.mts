export type SubscriptionCurrency = 'EGP' | 'USD'
export type SubscriptionMoney<C extends SubscriptionCurrency = SubscriptionCurrency> = { currency: C; amountMinor: number }
export type XPayMoneyTracks = {
  processing: SubscriptionMoney<'EGP'>
  presentment: SubscriptionMoney
  exchangeRate: { id: string; rate: number } | null
}
export function xpayMoneyTracks(session: unknown): XPayMoneyTracks
