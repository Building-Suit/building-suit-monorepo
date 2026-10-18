// Run-owned SQL fixture plus real local app/PostgREST report boundaries.
import assert from'node:assert/strict'
import{randomUUID}from'node:crypto'
import{doctorSaasFinancialRepository}from'../app/utils/saasFinancialRepository.ts'
export async function verifyDoctorSaasFinancialProvider({a,b,staff,quoteId,sql,rpc}){
 const uuid=value=>{assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return value}
 const identity=actor=>({userId:actor.user.id,practiceId:actor.scope.practiceId}),signal=new AbortController().signal
 const repository=doctorSaasFinancialRepository(a.client),before=await rpc(a.client,'doctor_saas_status')
 const initial=await repository.status(identity(a),0,1,signal);assert.equal(initial.total,1);assert.equal(initial.items[0].quoteId,quoteId)
 const intentId=uuid(initial.items[0].intentId),subscriber=uuid(a.user.id),delivery=uuid(randomUUID()),event=`synthetic-fixture/actual-${uuid(randomUUID())}`
 const evidence=()=>sql(`select doctor_private.record_saas_synthetic_evidence('${intentId}','${event}',1,'confirmed','${subscriber}',1234,'USD','${delivery}')::text;`)
 assert.equal(JSON.parse(evidence()).settled,false);assert.equal(JSON.parse(evidence()).disposition,'recorded')
 const report=await repository.status(identity(a),0,1,signal)
 assert.equal(report.items[0].reconciliation,'confirmed_synthetic');assert.equal(report.items[0].syntheticEventIds.length,1)
 assert.equal(report.settlementAvailable,false);assert.equal(report.invoicesAvailable,false);assert.equal(report.lifecycleAvailable,false)
 const other=await doctorSaasFinancialRepository(b.client).status(identity(b),0,1,signal);assert.equal(other.total,0)
 assert.equal((await staff.client.rpc('doctor_saas_financial_status')).error?.code,'42501')
 for(const table of['doctor_saas_synthetic_events','doctor_saas_synthetic_deliveries'])assert.equal((await a.client.from(table).select('*')).error?.code,'42501')
 assert.equal((await a.client.rpc('record_saas_synthetic_evidence',{})).error?.code,'PGRST202')
 const after=await rpc(a.client,'doctor_saas_status');assert.equal(after.revision,before.revision);assert.equal(after.period.id,before.period.id);assert.equal(after.paid_activation_available,false)
 console.log('Actual local financial report transport passed: synthetic-only fixture replay and source links, owner/delegated/raw-table isolation, unchanged subscription and unavailable settlement/lifecycle/invoice/payment route; actual merchant acceptance UNRUN')
}
