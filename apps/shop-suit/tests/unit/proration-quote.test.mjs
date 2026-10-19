import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProrationQuote, prorationStorageKey } from '../../app/utils/proration-quote.mjs'
const expiresAt='2026-10-14T12:15:00Z'
const fixture={quoteId:'11111111-1111-4111-8111-111111111111',shopId:'shop-1',catalogTermsId:'terms-1',privateOfferId:null,planName:'Team',state:'quoted',createdAt:'2026-10-14T12:00:00Z',expiresAt,xpayOrderId:null,
 calculation:{version:1,currency:'EGP',mode:'remaining_period',amountDueMinor:23333,creditBeforeMinor:0,creditAfterMinor:0,newTermMinor:69900,unusedPrepaidMinor:'23266.6666666666666667',serviceValueMinor:'46600',newBillingInterval:'monthly',periodStart:'2026-10-14T12:00:00Z',periodEnd:'2026-11-03T12:00:00Z',periodMonths:1,periodStartPolicy:'frozen_quote',transition:'verified_xpay_payment',quotedAt:'2026-10-14T12:00:00Z',expiresAt}}
test('frozen server amounts and unrounded strings survive without client recalculation or private fields',()=>{
 const quote=parseProrationQuote({...fixture,secret:'must-not-retain',parameters:{redemptionToken:'private'}})
 assert.equal(quote.calculation.amountDueMinor,23333)
 assert.equal(quote.calculation.unusedPrepaidMinor,fixture.calculation.unusedPrepaidMinor)
 assert.equal('secret'in quote,false);assert.equal('parameters'in quote,false)
 assert.notEqual(prorationStorageKey('owner-a','shop-a'),prorationStorageKey('owner-b','shop-a'))
 assert.notEqual(prorationStorageKey('owner-a','shop-a'),prorationStorageKey('owner-a','shop-b'))
})
test('zero credit changes require the explicit transition; malformed amounts, currency and expiry fail closed',()=>{
 const zero={...fixture,calculation:{...fixture.calculation,amountDueMinor:0,creditAfterMinor:23333,transition:'explicit_credit_transition'}}
 assert.equal(parseProrationQuote(zero).calculation.amountDueMinor,0)
 for(const patch of [{amountDueMinor:-1},{amountDueMinor:1.5},{amountDueMinor:NaN},{currency:'EUR'},{unusedPrepaidMinor:'Infinity'},{periodMonths:12},{expiresAt:'2026-10-15T12:15:00Z'},{mode:'activated'},{transition:'paid'}]) assert.throws(()=>parseProrationQuote({...fixture,calculation:{...fixture.calculation,...patch}}))
 assert.throws(()=>parseProrationQuote({...zero,calculation:{...zero.calculation,transition:'verified_xpay_payment'}}))
})

test('commercial projection retains frozen caps and known enabled flags, excluding private bindings',()=>{
 const details={planVariant:'multi_3',billingInterval:'monthly',listPriceAmount:699,effectivePriceAmount:599,priceSource:'override',
 resourceLimits:{active_locations:3,active_members:5,active_products:null,active_services:50,active_customers:500,active_suppliers:50},
 entitlements:{appointments:true,reports:false,unknownFeature:true,redemptionToken:'secret'},offerBinding:{redemptionToken:'secret'}}
 const q=parseProrationQuote({...fixture,details})
 assert.equal(q.details.resourceLimits.active_products,null)
 assert.deepEqual(q.details.entitlements,{appointments:true})
 assert.equal('offerBinding'in q.details,false)
 assert.throws(()=>parseProrationQuote({...fixture,details:{...details,billingInterval:'annual'}}))
 assert.throws(()=>parseProrationQuote({...fixture,details:{...details,resourceLimits:{...details.resourceLimits,active_members:-1}}}))
})
