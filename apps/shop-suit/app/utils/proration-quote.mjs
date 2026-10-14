import { isXPayOrderId } from './xpay-checkout.mjs'
const states = new Set(['quoted', 'checkout', 'settled', 'requires_review', 'abandoned'])
const modes = new Set(['remaining_period', 'new_interval', 'trial_conversion', 'full_term', 'no_change'])
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 255
const minor = value => Number.isSafeInteger(value) && value >= 0 && value <= 2000000000000
const decimal = value => typeof value === 'string' && value.length <= 128 && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
const resourceKeys = ['active_locations','active_members','active_products','active_services','active_customers','active_suppliers']
function parseDetails(d, interval) {
  if (d == null) return null // Compatible with saved quotes from the previous projection.
  if (!id(d.planVariant) || d.billingInterval !== interval || !['catalog','override','private_offer'].includes(d.priceSource)
    || !Number.isFinite(d.listPriceAmount) || d.listPriceAmount <= 0 || !Number.isFinite(d.effectivePriceAmount) || d.effectivePriceAmount <= 0
    || !d.resourceLimits || resourceKeys.some(key => !Object.hasOwn(d.resourceLimits,key) || (d.resourceLimits[key] !== null && (!Number.isSafeInteger(d.resourceLimits[key]) || d.resourceLimits[key] < 0)))) throw new Error('invalid_proration_quote')
  return {planVariant:d.planVariant,billingInterval:d.billingInterval,listPriceAmount:d.listPriceAmount,effectivePriceAmount:d.effectivePriceAmount,priceSource:d.priceSource,
    resourceLimits:Object.fromEntries(resourceKeys.map(key=>[key,d.resourceLimits[key]])),
    entitlements:Object.fromEntries(['appointments','reports'].filter(key=>d.entitlements?.[key]===true).map(key=>[key,true]))}
}
export function parseProrationQuote(value) {
  const c = value?.calculation
  if (!value || !isXPayOrderId(value.quoteId) || !id(value.shopId) || !id(value.catalogTermsId) || !id(value.planName)
    || (value.privateOfferId != null && !id(value.privateOfferId)) || !states.has(value.state) || !timestamp(value.createdAt) || !timestamp(value.expiresAt)
    || !c || c.version !== 1 || c.currency !== 'EGP' || !modes.has(c.mode) || !['monthly', 'annual'].includes(c.newBillingInterval)
    || !minor(c.amountDueMinor) || !minor(c.creditBeforeMinor) || !minor(c.creditAfterMinor) || !minor(c.newTermMinor) || c.newTermMinor === 0
    || ![1,12].includes(c.periodMonths) || c.periodMonths !== (c.newBillingInterval === 'monthly' ? 1 : 12)
    || !['verified_settlement','frozen_quote'].includes(c.periodStartPolicy)
    || !decimal(c.unusedPrepaidMinor) || !decimal(c.serviceValueMinor) || !timestamp(c.quotedAt) || !timestamp(c.expiresAt)
    || Date.parse(c.expiresAt) !== Date.parse(value.expiresAt)
    || (c.amountDueMinor > 0 ? c.transition !== 'verified_xpay_payment' : c.mode === 'no_change' ? c.transition !== 'no_change' : c.transition !== 'explicit_credit_transition')
    || (c.mode === 'no_change' && c.creditAfterMinor !== c.creditBeforeMinor)
    || (c.mode === 'remaining_period' && (!timestamp(c.periodStart) || !timestamp(c.periodEnd)))
    || (value.xpayOrderId != null && !isXPayOrderId(value.xpayOrderId))) throw new Error('invalid_proration_quote')
  return { quoteId: value.quoteId, shopId: value.shopId, catalogTermsId: value.catalogTermsId, privateOfferId: value.privateOfferId ?? null,
    planName: value.planName, details: parseDetails(value.details,c.newBillingInterval), state: value.state, createdAt: value.createdAt, expiresAt: value.expiresAt, xpayOrderId: value.xpayOrderId ?? null,
    calculation: { currency: 'EGP', mode: c.mode, amountDueMinor: c.amountDueMinor, creditBeforeMinor: c.creditBeforeMinor, creditAfterMinor: c.creditAfterMinor,
      newTermMinor: c.newTermMinor, unusedPrepaidMinor: c.unusedPrepaidMinor, serviceValueMinor: c.serviceValueMinor,
      newBillingInterval: c.newBillingInterval, periodStart: c.periodStart ?? null, periodEnd: c.periodEnd ?? null, periodMonths: c.periodMonths,
      periodStartPolicy: c.periodStartPolicy, transition: c.transition, quotedAt: c.quotedAt } }
}
export function prorationStorageKey(userId, shopId) { return `shop-proration-quote:${userId}:${shopId}` }
