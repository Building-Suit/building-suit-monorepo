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
async function fixture(page:Parameters<typeof pilotFixture>[0],handler:(args:Record<string,unknown>)=>unknown){return pilotFixture(page,'en','owner',(name,args)=>{
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
 await dialog.getByRole('button',{name:'Discard unstarted quote and review again',exact:true}).click()
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
 await expect(dialog.getByTestId('checkout-state')).toContainText('Payment is pending')
 await expect(dialog.locator('button[type="submit"]')).toBeDisabled()
 await expect(dialog.getByRole('button',{name:'Discard unstarted quote and review again',exact:true})).toBeDisabled()
 expect(f.calls.some(call=>call.name==='shop-xpay-checkout'&&['quote','pay_quote','apply_credit'].includes(String(call.args.action)))).toBe(false)
 await expect(page).not.toHaveURL(/xpayOrder=/)
})
