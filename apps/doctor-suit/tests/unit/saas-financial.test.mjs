import test from'node:test'
import assert from'node:assert/strict'
import{doctorSaasFinancialStatus,doctorSaasFinancialRepository}from'../../app/utils/saasFinancialRepository.ts'
const id=n=>`ae260000-0000-0000-0000-${String(n).padStart(12,'0')}`,identity={userId:id(1),practiceId:id(2)}
const raw={subscriber_user_id:id(1),scope:'saas_only',data_mode:'synthetic',payment_route:'unconfigured',invoices_available:false,settlement_available:false,lifecycle_available:false,independent_financial_review:'pending',patient_revenue_included:false,totals_scope:'full_population',paid_activation_available:false,live_activation:false,total:3,currencies:[{currency:'USD',currency_exponent:2,held_intents:2,quoted_minor:'18014398509481982',settled_minor:null},{currency:'JPY',currency_exponent:0,held_intents:1,quoted_minor:'97',settled_minor:null}],items:[{intent_id:id(3),quote_id:id(4),created_at:'2026-10-18T00:00:00Z',state:'awaiting_route_approval',reconciliation:'confirmed_synthetic',synthetic_event_ids:[id(5)]}]}
test('financial decoder preserves full-population exact currencies, synthetic labels and source IDs',()=>{
 const report=doctorSaasFinancialStatus(raw,identity)
 assert.equal(report.total,3);assert.equal(report.items.length,1);assert.equal(report.currencies[0].quotedMinor,'18014398509481982');assert.equal(report.currencies[1].currency,'JPY');assert.equal(report.items[0].syntheticEventIds[0],id(5));assert.equal(report.settlementAvailable,false)
 for(const patch of[{subscriber_user_id:id(9)},{patient_revenue_included:true},{payment_route:'approved'},{paid_activation_available:true},{settlement_available:true},{lifecycle_available:true},{invoices_available:true},{independent_financial_review:'approved'},{total:1},{totals_scope:'page'}])assert.throws(()=>doctorSaasFinancialStatus({...raw,...patch},identity))
 for(const patch of[{quoted_minor:18014398509481982},{quoted_minor:'1.2'},{quoted_minor:'1e5'},{settled_minor:'0'},{currency_exponent:null}])assert.throws(()=>doctorSaasFinancialStatus({...raw,currencies:[{...raw.currencies[0],...patch},raw.currencies[1]]},identity))
 for(const patch of[{reconciliation:'paid'},{state:'settled'},{synthetic_event_ids:['https://untrusted.example']}])assert.throws(()=>doctorSaasFinancialStatus({...raw,items:[{...raw.items[0],...patch}]},identity))
})
test('report adapter validates bounded page and response identity without mixing totals with page rows',async()=>{
 const signal=new AbortController().signal;let calls=0
 const repo=doctorSaasFinancialRepository({rpc(name,args){calls++;assert.equal(name,'doctor_saas_financial_status');assert.deepEqual(args,{p_page:0,p_size:1});return{abortSignal(s){assert.equal(s,signal);return Promise.resolve({data:raw,error:null})}}}})
 for(const [page,size]of[[-1,1],[0,0],[0,101],[1.2,1],[2147483648,1]])await assert.rejects(repo.status(identity,page,size,signal),/CONTRACT_INVALID/)
 assert.equal(calls,0);assert.equal((await repo.status(identity,0,1,signal)).total,3)
})
