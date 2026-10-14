const states = new Set(['scheduled', 'cancelled', 'completed'])
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 255
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const resources = new Set(['active_locations','active_members','active_products','active_services','active_customers','active_suppliers'])
export function parseScheduledChange(value) {
  if (value == null) return null
  if (!value || typeof value !== 'object' || !id(value.id) || !states.has(value.state) || !id(value.planName) || (id(value.catalogTermsId) === id(value.privateOfferId))
    || !['monthly','annual'].includes(value.billingInterval) || value.currency !== 'EGP' || !Number.isFinite(Number(value.indicativePriceAmount)) || Number(value.indicativePriceAmount) <= 0
    || !time(value.effectiveAt) || !time(value.createdAt) || !['available','canPayNow','canCancel'].every(key => typeof value[key] === 'boolean')
    || !Array.isArray(value.blockers) || value.blockers.length > 6 || value.blockers.some(row => !resources.has(row.resource) || !['used','limit','excess'].every(key => Number.isSafeInteger(row[key]) && row[key] >= 0))) throw new Error('invalid_scheduled_change')
  return {id:value.id,state:value.state,catalogTermsId:value.catalogTermsId??null,privateOfferId:value.privateOfferId??null,needsOfferLink:value.needsOfferLink===true,
    planName:value.planName,billingInterval:value.billingInterval,currency:'EGP',indicativePriceAmount:Number(value.indicativePriceAmount),effectiveAt:value.effectiveAt,createdAt:value.createdAt,
    available:value.available,canPayNow:value.canPayNow,canCancel:value.canCancel,blockers:value.blockers.map(row=>({resource:row.resource,used:row.used,limit:row.limit,excess:row.excess}))}
}
export function parseChangePreview(value) {
  if (!value || !['now','term_end'].includes(value.timing) || (value.timing === 'term_end' && !time(value.effectiveAt))) throw new Error('invalid_change_preview')
  return {timing:value.timing,effectiveAt:value.effectiveAt??null,scheduled:parseScheduledChange(value.scheduled)}
}
