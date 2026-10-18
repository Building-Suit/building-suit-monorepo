// https://docs.xpay.app/en/integrate/checkout-session/line-items-and-pricing
// Processing totals are EGP; customer presentment is a separate amount track.
const positiveMinor = value => Number.isSafeInteger(value) && value > 0
export function xpayMoneyTracks(session) {
  if (session?.currency !== 'EGP' || !positiveMinor(session.amountTotal)) throw new Error('xpay_money_invalid')
  const processing = { currency: 'EGP', amountMinor: session.amountTotal }
  const mirror = session.presentmentDetails
  if (mirror == null) return { processing, presentment: { ...processing }, exchangeRate: null }
  if (!['EGP', 'USD'].includes(mirror.currency) || !positiveMinor(mirror.amountTotal)) throw new Error('xpay_money_invalid')
  if (mirror.currency === 'EGP') {
    if (mirror.amountTotal !== processing.amountMinor) throw new Error('xpay_money_invalid')
    return { processing, presentment: { ...processing }, exchangeRate: null }
  }
  if (typeof mirror.exchangeRate !== 'number' || !Number.isFinite(mirror.exchangeRate) || mirror.exchangeRate <= 0
    || typeof mirror.exchangeRateId !== 'string' || !mirror.exchangeRateId || mirror.exchangeRateId.length > 255) throw new Error('xpay_money_invalid')
  // Provider supplies both tracks and the locked rate. Do not recompute one
  // using the other or infer a currency from the buyer's location.
  return { processing, presentment: { currency: mirror.currency, amountMinor: mirror.amountTotal },
    exchangeRate: { id: mirror.exchangeRateId, rate: mirror.exchangeRate } }
}
