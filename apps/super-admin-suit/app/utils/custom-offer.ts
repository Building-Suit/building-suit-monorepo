/** Shop commercial protocol fields; values come exclusively from stored offers. */
export const resourceKeys = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers'] as const
export interface OfferDraft {
  definitionId: string
  expectedVersion: number
  recipientUserId: string
  companyId: string
  basePlanId: string
  templateReference: string
  displayName: string
  priceAmount: string
  currency: string
  billingInterval: string
  resourceLimits: string
  entitlements: string
  expiresAt: string
}
export interface OfferVersion {
  id: string; definitionId: string; version: number; bindingId: string; suitId: string
  recipientUserId: string; companyId: string; basePlanId: string; templateReference: string | null
  displayName: string; priceAmount: string; currency: string; billingInterval: string
  resourceLimits: Record<string, number | null>; entitlements: Record<string, unknown>
  targetBindingId: string; targetEnvironmentId: string; expiresAt: string
  customerLink?: string | null; creatorUserId: string; reason: string; state: 'saved' | 'issued' | 'revoked' | 'expired'
}
export function emptyOffer(): OfferDraft {
  return { definitionId: '', expectedVersion: 0, recipientUserId: '', companyId: '', basePlanId: '', templateReference: '', displayName: '', priceAmount: '', currency: '', billingInterval: '', resourceLimits: '', entitlements: '', expiresAt: '' }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function offerCommand(bindingId: string, draft: OfferDraft, reason: string, id: () => string) {
  const resources = JSON.parse(draft.resourceLimits)
  const entitlements = JSON.parse(draft.entitlements)
  const object = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
  if (![bindingId, draft.definitionId, draft.recipientUserId, draft.companyId, draft.basePlanId].every(v => uuid.test(v))
    || !Number.isSafeInteger(draft.expectedVersion) || draft.expectedVersion < 0
    || !/^[0-9]{1,10}(\.[0-9]{1,2})?$/.test(draft.priceAmount) || Number(draft.priceAmount) <= 0 || Number(draft.priceAmount) > 9999999999.99
    || !/^[A-Z]{3}$/.test(draft.currency) || !['monthly', 'annual'].includes(draft.billingInterval)
    || draft.displayName.trim().length < 1 || draft.displayName.trim().length > 80 || draft.templateReference.length > 500
    || !Number.isFinite(Date.parse(draft.expiresAt)) || Date.parse(draft.expiresAt) <= Date.now()
    || reason.trim().length < 8 || reason.length > 1000 || !object(resources) || !object(entitlements)
    || Object.keys(resources).sort().join() !== [...resourceKeys].sort().join()
    || Object.values(resources).some(v => v !== null && (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 2147483647))) throw new Error('invalid_request')
  return { action: 'save', bindingId, requestId: id(), correlationId: id(), reason: reason.trim(), payload: {
    ...draft, displayName: draft.displayName.trim(), templateReference: draft.templateReference || null,
    expiresAt: new Date(draft.expiresAt).toISOString(), resourceLimits: resources, entitlements,
  } }
}
export function amendOffer(o: OfferVersion): OfferDraft {
  return { definitionId: o.definitionId, expectedVersion: o.version, recipientUserId: o.recipientUserId, companyId: o.companyId,
    basePlanId: o.basePlanId, templateReference: o.templateReference || '', displayName: o.displayName, priceAmount: o.priceAmount,
    currency: o.currency, billingInterval: o.billingInterval, resourceLimits: JSON.stringify(o.resourceLimits), entitlements: JSON.stringify(o.entitlements), expiresAt: o.expiresAt }
}
/** Mapping for the existing registration protocol. Delivery remains gated on secure target redemption. */
export function shopOfferPayload(o: OfferVersion, suit: string) {
  return { offerId: o.id, offerVersion: o.version, shopId: o.companyId, recipientUserId: o.recipientUserId,
    targetBindingId: o.targetBindingId, targetEnvironmentId: o.targetEnvironmentId, suit, expiresAt: o.expiresAt,
    planId: o.basePlanId, displayName: o.displayName, billingInterval: o.billingInterval, currency: o.currency,
    priceAmount: Number(o.priceAmount), resourceLimits: structuredClone(o.resourceLimits), entitlements: structuredClone(o.entitlements) }
}
