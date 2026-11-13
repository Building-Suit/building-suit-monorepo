// Invoked only by the existing owned actual-provider lifecycle; synthetic ledger/transport, no real funds.
import { randomUUID } from 'node:crypto'
export async function preparePracticeMoneyReadonly({ b, charge, rpc, expect, setStage }) {
 setStage('actual practice money readonly owner fixture')
 const pending = await rpc(b.client, 'doctor_prepare_practice_payment', { p_practice:b.scope.practiceId,p_location:b.scope.locationId,p_kind:'collection',p_charge_version:charge.id,p_original:null,p_minor:'5000',p_reason:'SYNTHETIC_READONLY_COLLECTION_HISTORY',p_key:randomUUID() })
 const base={p_practice:b.scope.practiceId,p_location:b.scope.locationId,p_intent:pending.id}
 await rpc(b.client,'doctor_advance_practice_payment',{...base,p_revision:1,p_action:'dispatch',p_outcome:'accepted',p_key:randomUUID()})
 const posted=await rpc(b.client,'doctor_advance_practice_payment',{...base,p_revision:2,p_action:'reconcile',p_outcome:null,p_key:randomUUID()})
 expect(posted.state==='posted'&&posted.entry.amount_minor==='5000'&&posted.external_transport_enabled===false&&posted.live_collection===false,'Synthetic readonly receipt fixture differs')
}
export async function verifyPracticeMoneyBrowserRecords({ a, b, rpc, sql, expect, fixture, originalPeriod, setStage }) {
 setStage('actual practice money persisted GUI sources and reservations')
 const board=await rpc(a.client,'doctor_practice_billing_board',{p_practice:a.scope.practiceId,p_location:a.scope.locationId}),receipts=[]
 for(const locale of ['EN','AR']){
  const source=board.charges.find(c=>c.charge.label===fixture.reference+'-'+locale)
  expect(source&&source.charge.patient_id===a.scope.patientId,'GUI financial source charge missing')
  const state=await rpc(a.client,'doctor_practice_money_state',{p_practice:a.scope.practiceId,p_location:a.scope.locationId,p_charge:source.charge.charge_id})
  expect(state.total===3&&state.items.length===3&&state.patient_id===a.scope.patientId&&state.charge_version_id===source.charge.id&&state.charge_minor==='18075'&&state.external_transport_enabled===false&&state.live_collection===false&&state.tax_invoice_available===false,'Actual GUI money source or disabled external boundary differs')
  expect(state.balance.collected_minor==='10000'&&state.balance.refunded_minor==='3000'&&state.balance.net_minor==='7000'&&state.balance.reserved_collection_minor==='0'&&state.balance.reserved_refund_minor==='0','Actual GUI balances lost partial/failed/refunded distinction')
  const collection=state.items.find(i=>i.kind==='collection'),refund=state.items.find(i=>i.kind==='refund'&&i.state==='posted'),failed=state.items.find(i=>i.kind==='refund'&&i.state==='failed')
  expect(collection?.state==='posted'&&collection.entry.amount_minor==='10000'&&refund?.entry.original_entry_id===collection.entry.id&&refund.entry.amount_minor==='3000'&&failed?.amount_minor==='2000'&&failed.entry===null,'Actual immutable receipt/reversal/refund failure differs')
  receipts.push(collection.entry.receipt_number,refund.entry.receipt_number)
 }
 expect(receipts.join(',')==='1,2,3,4','Scoped receipts collided, skipped due to failed attempt or changed original numbering')
 expect(/^[a-f0-9-]{36}$/.test(a.scope.practiceId),'Owned financial SQL fixture scope required')
 expect(sql(`select count(*)from doctor_private.synthetic_practice_payment_acceptances e join public.doctor_practice_payment_intents i on i.id=e.intent_id where i.practice_id='${a.scope.practiceId}';`)==='6','Lost GUI acknowledgement caused duplicate acceptance or missing persisted outcome')
 expect((await b.client.rpc('doctor_practice_money_state',{p_practice:a.scope.practiceId,p_location:a.scope.locationId,p_charge:board.charges.find(c=>c.charge.label===fixture.reference+'-EN').charge.charge_id})).error?.code==='42501','Independent owner read another practice money history')
 const status=await rpc(a.client,'doctor_saas_status');expect(status.state==='paid'&&status.period.id===originalPeriod.id&&status.period.ends_at===originalPeriod.ends_at,'Practice ledger changed SaaS entitlement or settlement')
 console.log('Actual practice money: EN/AR GUI partial collections, persisted lost-ack acceptance and original-key recovery, single original-linked refunds, failed refund without receipt, scoped receipt sequence, independent inactive-owner history, exact reserved/net balances and unchanged SaaS period passed; real funds/provider/tax approval remains unavailable.')
}
