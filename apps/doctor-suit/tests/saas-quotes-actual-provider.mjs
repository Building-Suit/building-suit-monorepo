// Real local GoTrue/PostgREST transport; synthetic terms and unconfigured route.
import assert from 'node:assert/strict'
import {randomUUID}from'node:crypto'
import {doctorSaasQuoteRepository}from'../app/utils/saasQuoteRepository.ts'
export async function verifyDoctorSaasQuoteProvider({a,b,staff,rpc}){
 const identity=actor=>({userId:actor.user.id,practiceId:actor.scope.practiceId})
 const signal=new AbortController().signal,repository=doctorSaasQuoteRepository(a.client)
 const offer=await rpc(a.client,'doctor_saas_terms'),status=await rpc(a.client,'doctor_saas_status')
 const input={termsId:offer.terms.terms_id,configurationRevision:offer.configuration_revision,accountRevision:status.revision,interval:'monthly',documentRef:offer.terms.terms_document_ref}
 const key=randomUUID(),quote=await repository.create(identity(a),input,key,signal)
 assert.equal(quote.amountMinor,String(offer.terms.monthly_minor));assert.equal(quote.currency,offer.terms.currency)
 assert.equal((await repository.create(identity(a),input,key,signal)).id,quote.id)
 assert.equal((await repository.read(identity(a),quote.id,signal)).id,quote.id)
 const intent=await repository.prepare(identity(a),quote.id,randomUUID(),signal)
 assert.equal(intent.state,'awaiting_route_approval');assert.equal(intent.purchaseAvailable,false)
 assert.equal((await repository.prepare(identity(a),quote.id,randomUUID(),signal)).id,intent.id)
 for(const actor of[b,staff]){
  assert.equal((await actor.client.rpc('doctor_saas_quote',{p_quote:quote.id})).error?.code,'42501')
  assert.equal((await actor.client.rpc('doctor_prepare_saas_payment',{p_quote:quote.id,p_key:randomUUID()})).error?.code,'42501')
 }
 const args={p_terms:input.termsId,p_configuration_revision:input.configurationRevision,p_account_revision:input.accountRevision,p_interval:input.interval,p_document_ref:input.documentRef,p_key:randomUUID()}
 assert.equal((await staff.client.rpc('doctor_create_saas_quote',args)).error?.code,'42501')
 for(const extra of[{p_amount_minor:1},{p_currency:'GBP'},{p_subscriber:a.user.id},{p_return_url:'https://untrusted.example'}]){
  assert.equal((await a.client.rpc('doctor_create_saas_quote',{...args,...extra})).error?.code,'PGRST202')
 }
 for(const table of['doctor_saas_quotes','doctor_saas_payment_intents'])assert.equal((await a.client.from(table).select('*')).error?.code,'42501')
 console.log('Actual local SaaS quote transport passed: exact app adapter, replay, one held intent, foreign/delegated denial, raw-table denial and PostgREST browser-total/currency/identity/URL rejection; merchant/provider payment acceptance remains UNRUN')
 return quote.id
}
