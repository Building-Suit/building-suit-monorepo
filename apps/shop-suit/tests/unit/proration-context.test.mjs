import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { shallowRef, computed } from 'vue'
import { parseProrationQuote, prorationStorageKey } from '../../app/utils/proration-quote.mjs'
import { checkoutAttempt, checkoutAttemptKey, checkoutFailureCode, isXPayOrderId } from '../../app/utils/xpay-checkout.mjs'
const source=stripTypeScriptTypes(await readFile(new URL('../../app/composables/useShopProrationCheckout.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export function','function').replaceAll('import.meta.client','true')
const make=new Function('shallowRef','computed','useVerificationTimer','parseProrationQuote','prorationStorageKey','checkoutAttempt','checkoutAttemptKey','checkoutFailureCode','isXPayOrderId',`${source};return useShopProrationCheckout`)(shallowRef,computed,()=>({expired:shallowRef(false),reset(){this.expired.value=false},restore(at){this.expired.value=at<=Date.now()}}),parseProrationQuote,prorationStorageKey,checkoutAttempt,checkoutAttemptKey,checkoutFailureCode,isXPayOrderId)
function quote(shopId,id='11111111-1111-4111-8111-111111111111',state='quoted'){
 const at=new Date().toISOString(),expiresAt=new Date(Date.now()+900000).toISOString()
 return{quoteId:id,shopId,catalogTermsId:'terms-1',planName:'Frozen plan',privateOfferId:null,state,createdAt:at,expiresAt,xpayOrderId:null,
 calculation:{version:1,currency:'EGP',mode:'full_term',amountDueMinor:34900,creditBeforeMinor:0,creditAfterMinor:0,newTermMinor:34900,unusedPrepaidMinor:'0',serviceValueMinor:'34900',newBillingInterval:'monthly',periodStart:null,periodEnd:null,periodMonths:1,periodStartPolicy:'verified_settlement',transition:'verified_xpay_payment',quotedAt:at,expiresAt}}
}
function setup(invoke){
 const map=new Map();globalThis.sessionStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}
 let context={generation:0,shop:'shop-a',user:'owner-a'}
 const flow=make({context:()=>({...context}),sameContext:value=>value.generation===context.generation&&value.shop===context.shop&&value.user===context.user,target:()=>({selection:'terms:terms-1',catalogTermsId:'terms-1',privateOffer:null}),locale:()=> 'en',invoke})
 return{flow,map,switchTo(next){context={...next,generation:context.generation+1};flow.reset()}}
}
test('delayed old quote cannot enter another owner/shop context or cache',async()=>{
 let resolve
 const f=setup(()=>new Promise(done=>{resolve=done}))
 const pending=f.flow.prepare()
 f.switchTo({shop:'shop-b',user:'owner-b'})
 resolve({data:quote('shop-a'),error:null})
 assert.equal(await pending,null);assert.equal(f.flow.quote.value,null)
 assert.equal(f.map.has(prorationStorageKey('owner-a','shop-a')),false)
 assert.equal(f.map.has(prorationStorageKey('owner-b','shop-b')),false)
})
test('restoration is scoped to owner/shop and rejects a different tenant response',async()=>{
 const calls=[],f=setup(async body=>{calls.push(body);return{data:quote('shop-a'),error:null}})
 f.map.set(prorationStorageKey('owner-a','shop-a'),'11111111-1111-4111-8111-111111111111')
 f.switchTo({shop:'shop-b',user:'owner-a'})
 assert.equal(await f.flow.restore(),null);assert.equal(calls.length,0)
 f.map.set(prorationStorageKey('owner-a','shop-b'),'22222222-2222-4222-8222-222222222222')
 await assert.rejects(f.flow.restore(),/invalid_quote_context/)
 assert.equal(calls[0].shopId,'shop-b');assert.equal(f.flow.quote.value,null)
})
test('settled quote restoration clears only its owner/shop caches',async()=>{
 const f=setup(async()=>({data:quote('shop-a',undefined,'settled'),error:null}))
 f.map.set(prorationStorageKey('owner-a','shop-a'),'11111111-1111-4111-8111-111111111111')
 f.map.set(checkoutAttemptKey('owner-a','shop-a'),'synthetic-owner-attempt')
 f.map.set(prorationStorageKey('owner-b','shop-b'),'22222222-2222-4222-8222-222222222222')
 assert.equal((await f.flow.restore()).state,'settled')
 assert.equal(f.flow.quote.value,null);assert.equal(f.map.has(prorationStorageKey('owner-a','shop-a')),false)
 assert.equal(f.map.has(checkoutAttemptKey('owner-a','shop-a')),false)
 assert.equal(f.map.has(prorationStorageKey('owner-b','shop-b')),true)
})
