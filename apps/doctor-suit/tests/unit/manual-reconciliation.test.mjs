import test from'node:test'
import assert from'node:assert/strict'
import{decodeManualReport,manualReportAmount,manualReportWindow}from'../../app/utils/manualReconciliation.ts'
import{createManualReportController,manualReportState}from'../../app/utils/manualReconciliationController.ts'
import{manualReportView}from'../../app/utils/manualReconciliationPresentation.ts'
const id=n=>`ae340000-0000-0000-0000-${String(n).padStart(12,'0')}`,actor={userId:id(1),sessionId:id(2),practiceId:null},query={review:false,from:null,until:null,status:'all',page:1}
function payload(){const value={actor_user_id:actor.userId,review_queue:false,scope:'saas_manual_only',data_mode:'synthetic',totals_scope:'filtered_full_population',date_basis:'notice_created_at',observed_at:'2026-10-18T10:00:00Z',from:null,until:null,status:'all',page:1,page_size:25,total:2,live_activation:false,patient_revenue_included:false,invoices_available:false,settlement_available:false,independent_financial_review:'pending',currencies:[{currency:'EGP',currency_exponent:2,notices:2,claimed_minor:'18000000000000000',pending_count:2,pending_minor:'18000000000000000',rejected_count:0,rejected_minor:'0',verified_count:0,verified_minor:'0',activated_count:0,activated_minor:'0',awaiting_activation_count:0,awaiting_activation_minor:'0',attention_count:0,discrepancy_count:0}],items:[{id:id(3),subscriber_user_id:actor.userId,intent_id:id(4),quote_id:id(5),terms_id:id(6),created_at:'2026-10-18T09:00:00Z',status:'submitted',revision:0,amount_minor:'9000000000000000',currency:'EGP',currency_exponent:2,requires_attention:false,discrepancy:false,funds_id:null,received_minor:null,received_currency:null,received_at:null,verified_at:null,funds_bound:false,period_id:null,period_started_at:null,period_ends_at:null,period_bound:false}]};value.items.push({...value.items[0],id:id(10)});return value}
test('exact aggregate decoder and presentation preserve large minor-unit strings',()=>{
 const report=decodeManualReport(payload(),actor,query);assert.equal(report.currencies[0].claimed,'18000000000000000');assert.equal(manualReportAmount(report.currencies[0].claimed,2,'EGP'),'180000000000000.00 EGP')
 const view=manualReportView({loading:false,error:null,result:report},false,false);assert.equal(view.rows[0].to,`/payment-notices?notice=${id(3)}`);assert.match(view.totals[0].cells.notices,/180000000000000.00 EGP/);assert.match(manualReportView({loading:false,error:null,result:report},true,true).rows[0].to,/payment-review\?notice=/)
})
test('decoder rejects foreign scope, false live authority, wrong filters, malformed money and inconsistent counts',()=>{
 for(const change of[v=>{v.actor_user_id=id(7)},v=>{v.live_activation=true},v=>{v.items[0].subscriber_user_id=id(8)},v=>{v.currencies[0].claimed_minor='9e17'},v=>{v.currencies.push({...v.currencies[0]})},v=>{v.currencies[0].verified_minor='1'},v=>{v.page=2},v=>{v.from='2026-01-01Z'},v=>{v.total=3},v=>{v.items[0].period_bound=true}]){const value=payload();change(value);assert.throws(()=>decodeManualReport(value,actor,query))}
})
test('UTC day filters are inclusive in the form and half open on the server',()=>{
 assert.deepEqual(manualReportWindow('2026-02-28','2026-02-28'),{from:'2026-02-28T00:00:00.000Z',until:'2026-03-01T00:00:00.000Z'})
 assert.deepEqual(manualReportWindow('',''),{from:null,until:null});for(const dates of[['2026-02-30',''],['','9999-12-31'],['2026-03-02','2026-03-01'],['2026-1-01','']])assert.throws(()=>manualReportWindow(...dates))
})
test('out-of-order reads and identity changes cannot publish stale financial state',async()=>{
 let identity=actor,firstResolve,secondResolve;const signals=[],repo={read:async(_a,_q,signal)=>{signals.push(signal);return new Promise(r=>{if(!firstResolve)firstResolve=r;else secondResolve=r})}},state=manualReportState(),c=createManualReportController(repo,state,()=>identity,'stg')
 const first=c.load(query),second=c.load({...query,page:2});assert.equal(signals[0].aborted,true)
 secondResolve({total:26,query:{...query,page:2}});assert.equal(await second,true);firstResolve({total:1,query});assert.equal(await first,false);assert.equal(state.result.total,26)
 const third=c.load(query);identity={...actor,sessionId:id(9)};c.clear();secondResolve({total:99,query});assert.equal(await third,false);assert.equal(state.result,null);assert.equal(state.loading,false)
})
test('permission failures clear prior results and receive explicit denied presentation',async()=>{
 const state=manualReportState();state.result={total:99};const c=createManualReportController({read:async()=>{throw{code:'42501'}}},state,()=>actor,'stg');assert.equal(await c.load(query),false);assert.equal(state.result,null);assert.equal(state.error,'denied');assert.equal(manualReportView(state,true,false).denied,true)
})
