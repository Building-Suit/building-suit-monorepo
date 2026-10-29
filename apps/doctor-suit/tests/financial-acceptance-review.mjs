// Independent test-side reconciliation of actual scoped RPC projections; no provider, DB or browser startup.
const metrics=['charges','collections','refunds','outstanding','credit','reserved_collections','reserved_refunds','unknown','discrepancies']
function invalid(){throw Error('DOCTOR_FINANCIAL_RECONCILIATION_FAILED')}
function minor(v){if(typeof v!=='string'||! /^(0|[1-9][0-9]{0,39})$/.test(v))invalid();return BigInt(v)}
export function reconcileSyntheticPracticeFinancials(groups,charges,expected){
 if(!Array.isArray(groups)||!Array.isArray(charges)||!expected?.userId||!expected?.practiceId)invalid()
 const computed=new Map(),chargeKeys=new Set(),intentIds=new Set(),entryIds=new Set(),entries=new Map(),refunds=new Map(),refundReservations=new Map(),pendingRefunds=[];let unknownCount=0
 for(const {scope,model:m}of charges){
  if(!scope||!m||scope.userId!==expected.userId||scope.practiceId!==expected.practiceId||!scope.locationId||!scope.chargeId||!scope.patientId||chargeKeys.has(scope.chargeId)||!Array.isArray(m.items)||m.items.length!==m.total)invalid();chargeKeys.add(scope.chargeId)
  if(!/^[A-Z]{3}$/.test(m.currency)||!Number.isInteger(m.exponent)||m.exponent<0||m.exponent>4)invalid()
  const key=m.currency+':'+m.exponent,g=computed.get(key)??Object.fromEntries(metrics.map(k=>[k,0n]));computed.set(key,g)
  const gross={collection:0n,refund:0n},reserved={collection:0n,refund:0n}
  for(const i of m.items){
   if(intentIds.has(i.id)||!['collection','refund'].includes(i.kind)||i.currency!==m.currency||i.exponent!==m.exponent)invalid();intentIds.add(i.id);const amount=minor(i.amountMinor);if(amount===0n||amount>9007199254740991n)invalid()
   if(i.state==='posted'){
    const e=i.entry;if(!e||entryIds.has(e.id)||e.intentId!==i.id||e.kind!==i.kind||e.amountMinor!==i.amountMinor||e.currency!==m.currency||e.exponent!==m.exponent||e.originalEntryId!==i.originalEntryId)invalid();entryIds.add(e.id);entries.set(e.id,{...e,chargeId:scope.chargeId,locationId:scope.locationId});gross[i.kind]+=amount
    if(i.kind==='refund'){if(!i.originalEntryId)invalid();refunds.set(i.originalEntryId,(refunds.get(i.originalEntryId)??0n)+amount)}else if(i.originalEntryId!==null)invalid()
   }else if(['pending','unknown'].includes(i.state)){if(i.entry!==null)invalid();reserved[i.kind]+=amount;if(i.kind==='refund'){if(!i.originalEntryId)invalid();refundReservations.set(i.originalEntryId,(refundReservations.get(i.originalEntryId)??0n)+amount);pendingRefunds.push({original:i.originalEntryId,chargeId:scope.chargeId,locationId:scope.locationId,currency:m.currency,exponent:m.exponent})}else if(i.originalEntryId!==null)invalid();if(i.state==='unknown'){g.unknown++;unknownCount++}}else if(i.state!=='failed'||i.entry!==null)invalid()
  }
  if(gross.collection<gross.refund||minor(m.balance.collectedMinor)!==gross.collection||minor(m.balance.refundedMinor)!==gross.refund||minor(m.balance.netMinor)!==gross.collection-gross.refund||minor(m.balance.reservedCollectionMinor)!==reserved.collection||minor(m.balance.reservedRefundMinor)!==reserved.refund)invalid()
  const amount=minor(m.chargeMinor),net=gross.collection-gross.refund;g.charges+=amount;g.collections+=gross.collection;g.refunds+=gross.refund;g.outstanding+=amount>net?amount-net:0n;g.credit+=net>amount?net-amount:0n;g.reserved_collections+=reserved.collection;g.reserved_refunds+=reserved.refund
 }
 for(const p of pendingRefunds){const e=entries.get(p.original);if(!e||e.kind!=='collection'||e.chargeId!==p.chargeId||e.locationId!==p.locationId||e.currency!==p.currency||e.exponent!==p.exponent||((refunds.get(p.original)??0n)+(refundReservations.get(p.original)??0n))>minor(e.amountMinor))invalid()}
 for(const [original,total]of refunds){const e=entries.get(original);if(!e||e.kind!=='collection'||total>minor(e.amountMinor))invalid()}
 for(const e of entries.values())if(e.kind==='refund'){const original=entries.get(e.originalEntryId);if(!original||original.chargeId!==e.chargeId||original.locationId!==e.locationId||original.currency!==e.currency||original.exponent!==e.exponent)invalid()}
 if(groups.length!==computed.size)invalid();const seen=new Set()
 for(const g of groups){const key=g.currency+':'+g.exponent,expectedGroup=computed.get(key);if(!expectedGroup||seen.has(key))invalid();seen.add(key);for(const metric of metrics)if(minor(g.values[metric])!==expectedGroup[metric])invalid()}
 return{charge_count:chargeKeys.size,request_count:intentIds.size,entry_count:entryIds.size,currency_groups:computed.size,unknown_count:unknownCount,synthetic_only:true,external_transport:false,commercial_approval:false,tax_approval:false}
}
/** Candidate evidence qualification never turns an unverified review or historical run into current acceptance. */
export function financialAcceptanceDisposition(packet,candidate){
 if(!packet||!candidate||! /^[a-f0-9]{40}$/.test(candidate.head)||! /^[a-f0-9]{40}$/.test(candidate.base)||packet.task_id!=='DOS-M6-010'||packet.parent_head!==candidate.base||packet.candidate_binding!=='evaluated-committed-head')invalid()
 if(packet.commercial_launch_approved!==false||packet.live_money_used!==false||packet.production_billing_exercised!==false||packet.external_provider_enabled!==false||packet.tax_adapter_enabled!==false||packet.full_task_acceptance!==false)invalid()
 const receipts=packet.current_candidate_receipts;if(!Array.isArray(receipts))invalid()
 const required=['subscription_quote_confirmation_renewal','practice_charge_collection_refund_report','financial_concurrency_and_recovery','affected_shared_consumers']
 const current=required.map(caseId=>({id:caseId,status:receipts.some(r=>r.case_id===caseId&&r.source_head===candidate.head&&r.status==='passed'&&r.synthetic_only===true&&r.actual_service===true&&typeof r.immutable_url==='string'&&/^https:\/\/github\.com\/Building-Suit\/building-suit-monorepo\/actions\/runs\/\d+(?:\/job\/\d+)?$/.test(r.immutable_url))?'receipt-present-needs-independent-validation':'unavailable'}))
 return{candidate: candidate.head,base:candidate.base,engineering_cases:current,accountable_financial_review:packet.accountable_financial_review===null?'unavailable':'requires-qualified-validation',commercial_launch:'unapproved',tax_profile:'unapproved',full_task_acceptance:false,authority_granted:false}
}
