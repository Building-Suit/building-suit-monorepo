import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'
const owner='00000000-0000-4000-8000-000000000001'
const quoteId='11111111-1111-4111-8111-111111111111', replacement='33333333-3333-4333-8333-333333333333'
const orderId='22222222-2222-4222-8222-222222222222'
const limits={active_locations:1,active_members:5,active_products:250,active_services:50,active_customers:500,active_suppliers:50}
function quote(id=quoteId,expired=false,state='quoted',bound=false) {
 const at=new Date().toISOString(),expiresAt=new Date(Date.now()+(expired?-1000:900000)).toISOString()
 return {quoteId:id,shopId:'shop-1',catalogTermsId:'terms-1',privateOfferId:null,planName:'Approved Team',state,createdAt:at,expiresAt,xpayOrderId:bound?orderId:null,
 details:{planVariant:'standard',billingInterval:'monthly',listPriceAmount:699,effectivePriceAmount:699,priceSource:'catalog',resourceLimits:limits,entitlements:{}},
 calculation:{version:1,currency:'EGP',mode:'remaining_period',amountDueMinor:23333,creditBeforeMinor:0,creditAfterMinor:0,newTermMinor:69900,unusedPrepaidMinor:'23266.666666666667',serviceValueMinor:'46600',newBillingInterval:'monthly',periodStart:at,periodEnd:new Date(Date.now()+20*86400000).toISOString(),periodMonths:1,periodStartPolicy:'frozen_quote',transition:'verified_xpay_payment',quotedAt:at,expiresAt}}
}
function billing(){return{subscription:{planName:'Existing paid plan',planSlug:'solo',planVariant:'standard',billingInterval:'monthly',accessState:'active',status:'active',currency:'EGP'},availablePlans:[{planId:'public-1',planSlug:'team',planName:'Team',catalogTermsId:'terms-1',planVariant:'standard',variantName:'Standard',billingInterval:'monthly',currency:'EGP',listPriceAmount:699,effectivePriceAmount:699,priceSource:'catalog',resourceLimits:limits,blockers:[]}],usage:{resources:[],limits},submissions:[]}}
async function fixture(page:Parameters<typeof pilotFixture>[0],handler:(args:Record<string,unknown>)=>unknown,extra?:(name:string,args:Record<string,unknown>)=>unknown){return pilotFixture(page,'en','owner',(name,args)=>{
 const supplied=extra?.(name,args);if(supplied!==undefined)return supplied
 if(name==='shop_public_plan_catalog')return[{id:'public-1',name:'Team',slug:'team',catalog_terms_id:'terms-1',plan_variant:'standard',variant_name:'Standard',price_amount:699,currency:'EGP',billing_interval:'monthly',trial_days:7,features:{},resource_limits:limits,is_purchasable:true,is_coming_soon:false}]
 if(name==='shop_billing_read')return billing()
 if(name==='shop-xpay-checkout')return handler(args)
 return undefined
})}

test('expired saved quote restores without a new charge; explicit restart replaces its request identity',async({page})=>{
 let restarted=false
 const f=await fixture(page,args=>{
  if(args.action==='status')return{ready:true,mode:'test',prorationEnabled:true,orders:[]}
  if(args.action==='read_quote')return quote(quoteId,true)
  if(args.action==='abandon_quote'){restarted=true;return quote(quoteId,true,'abandoned')}
  if(args.action==='quote')return quote(replacement)
  return undefined
 })
 await page.addInitScript(({owner,id})=>sessionStorage.setItem(`shop-proration-quote:${owner}:shop-1`,id),{owner,id:quoteId})
 await fixtureGoto(page,'/billing')
 await page.locator('[data-plan="team"]').getByRole('button').click()
 const dialog=page.getByRole('dialog').first()
 await expect(dialog.locator('button[type="submit"]')).toBeDisabled()
 expect(f.calls.filter(call=>call.name==='shop-xpay-checkout'&&call.args.action==='quote')).toHaveLength(0)
 await dialog.getByRole('button',{name:'Review a new price',exact:true}).click()
 await expect(dialog.locator('button[type="submit"]')).toBeEnabled()
 expect(restarted).toBe(true)
 const calls=f.calls.filter(call=>call.name==='shop-xpay-checkout')
 expect(calls.filter(call=>call.args.action==='abandon_quote')).toHaveLength(1)
 expect(calls.filter(call=>call.args.action==='quote')).toHaveLength(1)
 expect(calls.filter(call=>call.args.action==='pay_quote'||call.args.action==='apply_credit')).toHaveLength(0)
 expect(await page.evaluate(owner=>sessionStorage.getItem(`shop-proration-quote:${owner}:shop-1`),owner)).toBe(replacement)
})

test('unresolved bound payment restores status and blocks another quote or cash attempt',async({page})=>{
 const order={orderId,quoteId,state:'pending',currency:'EGP',amountMinor:23333,planName:'Approved Team',createdAt:new Date().toISOString(),sessionId:'cs_test_Bound',url:null}
 const f=await fixture(page,args=>{
  if(args.action==='status')return{ready:true,mode:'test',prorationEnabled:true,orders:[order]}
  if(args.action==='read_quote')return quote(quoteId,false,'checkout',true)
  if(args.orderId===orderId)return order
  return undefined
 })
 await fixtureGoto(page,`/billing?xpayOrder=${orderId}`)
 const dialog=page.getByRole('dialog').first()
 await expect(dialog).toBeVisible()
 await expect(dialog.getByTestId('checkout-state')).toContainText('Confirming your payment')
 await expect(dialog.locator('button[type="submit"]')).toHaveCount(0)
 await expect(dialog.getByRole('button',{name:'Review a new price',exact:true})).toBeDisabled()
 expect(f.calls.some(call=>call.name==='shop-xpay-checkout'&&['quote','pay_quote','apply_credit'].includes(String(call.args.action)))).toBe(false)
 await expect(page).not.toHaveURL(/xpayOrder=/)
})

for(const denied of [false,true])test(`private offer ${denied?'near expiry is actionable without a payment':'review keeps the token out of page and storage'}`,async({page})=>{
 const token='T'.repeat(43),link=`http://127.0.0.1:4326/billing#offer=${quoteId}&version=1&binding=${quoteId}&environment=${quoteId}&token=${token}`
 const base=quote()
 const privateQuote={...base,planName:'Private agreement',catalogTermsId:'private-terms',privateOfferId:quoteId,
 details:{planVariant:'private_offer',billingInterval:'monthly',listPriceAmount:123.45,effectivePriceAmount:123.45,priceSource:'private_offer',resourceLimits:limits,entitlements:{appointments:true,reports:false}},
 calculation:{...base.calculation,mode:'full_term',amountDueMinor:12345,newTermMinor:12345,unusedPrepaidMinor:'0',serviceValueMinor:'12345',periodStart:null,periodEnd:null,periodStartPolicy:'verified_settlement'}}
 const f=await fixture(page,args=>{
  if(args.action==='status')return{ready:true,mode:'test',prorationEnabled:true,orders:[]}
  if(args.action==='quote')return denied?{error:'checkout_offer_expiring',retrySafe:false}:privateQuote
  return undefined
 },(name,args)=>name==='shop_private_offer_read'?{offerId:quoteId,offerVersion:1,shopId:args.p_shop_id,targetBindingId:quoteId,targetEnvironmentId:quoteId,displayName:'Private agreement',priceAmount:123.45,currency:'EGP',billingInterval:'monthly',expiresAt:'2099-01-01T00:00:00Z',resourceLimits:limits,entitlements:{appointments:true,reports:false},submissionId:null,blockers:[]}:undefined)
 await fixtureGoto(page,link)
 await expect(page).not.toHaveURL(/token=|#offer=/)
 await page.locator('#payment').getByRole('button').first().click()
 const dialog=page.getByRole('dialog').first()
 await dialog.locator('button[type="submit"]').click()
 if(denied)await expect(dialog).toContainText('expires too soon')
 else{await expect(dialog.getByTestId('proration-breakdown')).toContainText('Appointments');await expect(dialog.getByTestId('proration-breakdown')).toContainText('123.45');await expect(dialog.getByTestId('proration-breakdown')).not.toContainText('Private agreement · Private agreement')}
 const requested=f.calls.find(call=>call.name==='shop-xpay-checkout'&&call.args.action==='quote')
 expect(requested?.args.privateOffer).toMatchObject({offerId:quoteId,offerVersion:1,redemptionToken:token})
 expect(requested?.args).not.toHaveProperty('amount')
 expect(f.calls.some(call=>call.name==='shop-xpay-checkout'&&['pay_quote','apply_credit'].includes(String(call.args.action)))).toBe(false)
 expect(await page.locator('body').textContent()).not.toContain(token)
 expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).not.toContain(token)
})
