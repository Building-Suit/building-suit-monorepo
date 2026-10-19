import test from 'node:test'
import assert from 'node:assert/strict'
import {doctorSaasQuote,doctorSaasQuoteRepository}from'../../app/utils/saasQuoteRepository.ts'
const id=n=>`ae240000-0000-0000-0000-${String(n).padStart(12,'0')}`
const identity={userId:id(1),practiceId:id(2)}
const route={state:'unconfigured',merchant_eligibility:'pending',route_approval:'pending',credentials_custody:'pending',tax_document_applicability:'pending',provider_acceptance:'unrun',checkout_url:null,purchase_available:false,paid_activation_available:false,live_activation:false}
const raw={quote_id:id(3),subscriber_user_id:id(1),practice_id:id(2),terms_id:id(4),configuration_revision:2,account_revision:0,account_state:'unconfigured',current_period_id:null,billing_interval:'monthly',currency:'USD',currency_exponent:2,amount_minor:'9007199254740991',document_ref:'synthetic-quote/v1',created_at:'2026-10-18T00:00:00Z',kind:'configured_saas_offer',data_mode:'synthetic',payment_route:route}
const input={termsId:id(4),configurationRevision:2,accountRevision:0,interval:'monthly',documentRef:'synthetic-quote/v1'}
test('exact minor-unit strings and closed route survive decoding, zero is explicit',()=>{
 assert.equal(doctorSaasQuote(raw,identity).amountMinor,'9007199254740991')
 assert.equal(doctorSaasQuote({...raw,amount_minor:'0',currency_exponent:0},identity).amountMinor,'0')
 for(const change of[{subscriber_user_id:id(9)},{practice_id:id(9)},{amount_minor:123},{amount_minor:'1.2'},{amount_minor:'1e3'},{amount_minor:'9007199254740992'},{amount_minor:'-1'},{amount_minor:'01'},{currency_exponent:null},{account_revision:1},{billing_interval:'weekly'},{data_mode:'live'}])assert.throws(()=>doctorSaasQuote({...raw,...change},identity))
 for(const change of[{state:'approved'},{checkout_url:'https://untrusted.example'},{purchase_available:true},{paid_activation_available:true},{live_activation:true},{provider_acceptance:'passed'},{tax_document_applicability:'exempt'}])assert.throws(()=>doctorSaasQuote({...raw,payment_route:{...route,...change}},identity))
})
test('RPC adapter rejects browser totals, currencies, identity and URL overrides before transport',async()=>{
 let calls=0
 const repo=doctorSaasQuoteRepository({rpc(){calls++;throw Error('unexpected transport')}})
 for(const extra of[{amountMinor:'1'},{currency:'GBP'},{returnUrl:'https://untrusted.example'},{subscriberUserId:id(9)},{practiceId:id(9)}])await assert.rejects(repo.create(identity,{...input,...extra},id(5),new AbortController().signal),/CONTRACT_INVALID/)
 assert.equal(calls,0)
})
test('adapter passes only exact server selections and AbortSignal, fences response scope and terms',async()=>{
 const signal=new AbortController().signal;let seen
 function client(data){return{rpc(name,args){seen={name,args};return{abortSignal(s){assert.equal(s,signal);return Promise.resolve({data,error:null})}}}}}
 const result=await doctorSaasQuoteRepository(client(raw)).create(identity,input,id(5),signal)
 assert.equal(result.id,id(3));assert.deepEqual(seen,{name:'doctor_create_saas_quote',args:{p_terms:id(4),p_configuration_revision:2,p_account_revision:0,p_interval:'monthly',p_document_ref:'synthetic-quote/v1',p_key:id(5)}})
 for(const change of[{terms_id:id(9)},{configuration_revision:3},{billing_interval:'yearly'},{document_ref:'synthetic-quote/v2'}])await assert.rejects(doctorSaasQuoteRepository(client({...raw,...change})).create(identity,input,id(5),signal),/CONTRACT_INVALID/)
 await assert.rejects(doctorSaasQuoteRepository(client({...raw,quote_id:id(8)})).read(identity,id(3),signal),/CONTRACT_INVALID/)
 const intent={intent_id:id(6),quote:raw,state:'awaiting_route_approval',created_at:raw.created_at,payment_route:route}
 assert.equal((await doctorSaasQuoteRepository(client(intent)).prepare(identity,id(3),id(7),signal)).purchaseAvailable,false)
 for(const change of[{state:'paid'},{payment_route:{...route,checkout_url:'https://untrusted.example'}},{quote:{...raw,subscriber_user_id:id(9)}}])await assert.rejects(doctorSaasQuoteRepository(client({...intent,...change})).prepare(identity,id(3),id(7),signal),/CONTRACT_INVALID/)
})
