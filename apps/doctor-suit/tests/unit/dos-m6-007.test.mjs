import test from 'node:test'
import assert from 'node:assert/strict'
import { practiceMoneyMinor, practicePaymentIntent, practiceMoneyState } from '../../app/utils/practiceMoney.ts'
import { practiceMoneyRepository } from '../../app/utils/practiceMoneyRepository.ts'
import { createPracticeMoneyController, practiceMoneyControllerState } from '../../app/utils/practiceMoneyController.ts'
const id = n => `d2070007-0000-4000-8000-${String(n).padStart(12,'0')}`
const scope = { userId: id(1), practiceId: id(21), locationId: id(31), chargeId: id(60), patientId: id(42) }
const flags = { data_mode:'synthetic',external_transport_enabled:false,live_collection:false,tax_invoice_available:false,tax_applicability:'unreviewed' }
const intent = (kind='collection') => ({...flags,id:id(70),practice_id:scope.practiceId,location_id:scope.locationId,doctor_user_id:scope.userId,patient_id:scope.patientId,charge_id:scope.chargeId,charge_version_id:id(61),kind,original_entry_id:kind==='refund'?id(80):null,original_receipt_label:kind==='refund'?'SYN-00000001':null,amount_minor:'20000',currency:'EGP',currency_exponent:2,reason:'Synthetic explicit financial record',actor_user_id:scope.userId,created_at:'2026-10-26T12:00:00Z',revision:1,state:'pending',reason_code:'prepared',state_at:'2026-10-26T12:00:00Z',entry:null})
function posted(kind='collection',receipt='1') {const i=intent(kind);return {...i,revision:3,state:'posted',reason_code:'synthetic_accepted',entry:{id:id(81),intent_id:i.id,practice_id:i.practice_id,location_id:i.location_id,patient_id:i.patient_id,kind,original_entry_id:i.original_entry_id,receipt_number:receipt,receipt_label:'SYN-'+receipt.padStart(8,'0'),amount_minor:i.amount_minor,currency:i.currency,currency_exponent:i.currency_exponent,actor_user_id:i.actor_user_id,created_at:i.created_at,refundable_minor:kind==='collection'?'15000':null}}}
const board = () => ({...flags,actor_user_id:scope.userId,practice_id:scope.practiceId,location_id:scope.locationId,charge_id:scope.chargeId,charge_version_id:id(61),patient_id:scope.patientId,currency:'EGP',currency_exponent:2,charge_minor:'59800',charge_label:'Synthetic entered service',patient_name:'Synthetic financial patient',charge_recorded_at:'2026-10-26T12:00:00Z',clinic_name:'Synthetic clinic',timezone:'Etc/UTC',balance:{collected_minor:'20000',refunded_minor:'5000',net_minor:'15000',reserved_collection_minor:'10000',reserved_refund_minor:'2000'},page:1,total:1,items:[posted()],edition:'synthetic_preview',location_archived:false,can_write:true,entitlement:{state:'preview',revision:0,writes_allowed:true,can_add_staff:true,can_add_clinic:true,over_limit:false,valid_until:null,observed_at:'2026-10-26T12:00:00Z'}})
test('exact financial boundaries reject fractional/negative/unsafe movement but preserve full-population aggregate precision',()=>{
 assert.equal(practiceMoneyMinor('9007199254740991'),'9007199254740991');assert.equal(practiceMoneyMinor('18014398509481982',false),'18014398509481982')
 for(const v of [1,'1.2','-1','01','1e3',' 1','9007199254740992'])assert.throws(()=>practiceMoneyMinor(v),/MONEY_INVALID/)
 assert.throws(()=>practiceMoneyMinor('1'.repeat(41),false),/MONEY_INVALID/)
})
test('pending and unknown intent never imply a ledger receipt or confirmed collection',()=>{
 for(const raw of[intent(),{...intent(),revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'}]){const i=practicePaymentIntent(raw,scope);assert.equal(i.entry,null);assert.equal('providerAcceptance'in i,false);assert.equal('paid'in i,false)}
 assert.throws(()=>practicePaymentIntent({...intent(),entry:posted().entry},scope),/MONEY_INVALID/)
 assert.throws(()=>practicePaymentIntent({...intent(),revision:2,state:'unknown',reason_code:'synthetic_accepted'},scope),/MONEY_INVALID/)
})
test('posted synthetic receipts preserve source, exact money and original-linked refunds without private transport evidence',()=>{
 for(const kind of['collection','refund']){const raw=posted(kind),i=practicePaymentIntent({...raw,private_acceptance:'never-project-this',provider_secret:'never-project-this'},scope);assert.equal(i.entry.amountMinor,'20000');assert.equal(i.entry.receiptLabel,'SYN-00000001');assert.equal(i.originalEntryId,kind==='refund'?id(80):null);assert.equal(JSON.stringify(i).includes('never-project-this'),false)}
 for(const patch of[{original_entry_id:id(99)},{amount_minor:'1'},{currency:'USD'},{intent_id:id(99)},{patient_id:id(99)},{actor_user_id:id(99)}])assert.throws(()=>practicePaymentIntent({...posted('refund'),entry:{...posted('refund').entry,...patch}},scope),/MONEY_INVALID/)
})
test('receipt labels never truncate or collide after the eight-digit display minimum',()=>{
 assert.equal(practicePaymentIntent(posted('collection','100000000'),scope).entry.receiptLabel,'SYN-100000000')
 assert.throws(()=>practicePaymentIntent({...posted('collection','100000000'),entry:{...posted('collection','100000000').entry,receipt_label:'SYN-10000000'}},scope),/MONEY_INVALID/)
})
test('private scope replacement, live/tax/provider claims and invented outcome states fail closed',()=>{
 for(const patch of[{practice_id:id(99)},{location_id:id(99)},{patient_id:id(99)},{doctor_user_id:id(99)},{charge_id:id(99)},{external_transport_enabled:true},{live_collection:true},{tax_invoice_available:true},{tax_applicability:'exempt'},{state:'paid'},{state:'posted',revision:3,reason_code:'synthetic_accepted'},{amount_minor:'0'},{kind:'refund',original_entry_id:null}])assert.throws(()=>practicePaymentIntent({...intent(),...patch},scope),/MONEY_INVALID/)
})
test('partial payment/refund balance keeps pending and unknown reservations out of available collections',()=>{
 const v=practiceMoneyState(board(),scope,1);assert.equal(v.availableMinor,'34800');assert.equal(v.balance.netMinor,'15000');assert.equal(v.balance.reservedRefundMinor,'2000')
 for(const patch of[{net_minor:'14999'},{refunded_minor:'20001'},{reserved_collection_minor:'44801'},{reserved_refund_minor:'15001'}])assert.throws(()=>practiceMoneyState({...board(),balance:{...board().balance,...patch}},scope,1),/MONEY_INVALID/)
})
test('paged current status cannot silently drop financial rows or mix currencies or patients',()=>{
 for(const patch of[{items:[]},{total:2},{page:2},{items:[{...posted(),currency:'USD',entry:{...posted().entry,currency:'USD'}}]},{patient_id:id(99)},{can_write:false},{location_archived:true}])assert.throws(()=>practiceMoneyState({...board(),...patch},scope,1),/MONEY_INVALID/)
 const empty=practiceMoneyState({...board(),page:2,total:1,items:[]},scope,2);assert.equal(empty.balance.collectedMinor,'20000');assert.equal(empty.items.length,0)
})
test('inactive subscription still projects original receipts/history without granting a new money command',()=>{
 const raw=board();raw.edition='administrative_candidate';raw.can_write=false;raw.entitlement={...raw.entitlement,state:'expired',revision:1,writes_allowed:false,can_add_staff:false,can_add_clinic:false,valid_until:'2026-10-26T11:00:00Z'}
 const result=practiceMoneyState(raw,scope,1);assert.equal(result.canWrite,false);assert.equal(result.items[0].entry.receiptLabel,'SYN-00000001');assert.equal(result.availableMinor,'34800')
})
const query=()=>({userId:scope.userId,practiceId:scope.practiceId,locationId:scope.locationId,chargeId:scope.chargeId})
const identity=()=>({userId:scope.userId,sessionId:id(11),practiceId:scope.practiceId})
function harness(overrides={},timers){let actor=identity(),raw=board(),sequence=900;const state=practiceMoneyControllerState(),calls=[]
 const repo={read:async()=>({scope:{...scope},model:practiceMoneyState(raw,scope,1)}),prepare:async(s,input,key)=>{calls.push({s:structuredClone(s),input:structuredClone(input),key});return practicePaymentIntent({...intent(),amount_minor:input.amountMinor,reason:input.reason},s)},advance:async(s,input,action,outcome,key)=>{calls.push({s:structuredClone(s),input:structuredClone(input),action,outcome,key});return practicePaymentIntent({...intent(),id:input.id,amount_minor:input.amountMinor,reason:input.reason,revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'},s)},...overrides}
 const controller=createPracticeMoneyController(repo,state,()=>actor,'local',timers,()=>id(sequence++))
 return{controller,state,calls,repo,setActor:value=>{actor=value},setRaw:value=>{raw=value}}
}
test('unknown prepare retains its exact key/source/input and blocks a second movement or scope switch',async()=>{
 const h=harness();await h.controller.select(query());h.controller.open();h.state.form={amount:'100.00',reason:'Synthetic original intent'};let attempt=0,original
 h.repo.prepare=async(s,input,key)=>{h.calls.push({input:structuredClone(input),key});if(attempt++===0){original=structuredClone(input);throw Error('Lost accepted prepare acknowledgement')}return practicePaymentIntent({...intent(),amount_minor:original.amountMinor,reason:original.reason},s)}
 assert.equal(await h.controller.save(),false);assert.equal(h.state.uncertain,true);assert.equal(h.controller.open(),false);assert.equal(await h.controller.select({...query(),chargeId:id(99)}),false)
 h.state.form={amount:'1.00',reason:'Changed input must not resend'};assert.equal(await h.controller.retry(),true);assert.deepEqual(h.calls[0],h.calls[1]);assert.equal(h.calls[1].input.amountMinor,'10000');assert.equal(h.state.uncertain,false);assert.equal(h.calls.length,2)
})
test('unknown dispatch retries only its original command and never automatically reconciles or sends a second movement',async()=>{
 const raw=board();raw.items=[intent()];const h=harness();h.setRaw(raw);await h.controller.select(query());let attempt=0
 h.repo.advance=async(s,input,action,outcome,key)=>{h.calls.push({id:input.id,revision:input.revision,action,outcome,key});if(attempt++===0)throw Error('Lost synthetic acceptance reply');return practicePaymentIntent({...intent(),revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'},s)}
 assert.equal(await h.controller.advance(id(70),1,'dispatch','accepted'),false);assert.equal(h.state.uncertain,true)
 const newer={...raw,items:[{...intent(),revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'}]};h.setRaw(newer);await h.controller.refresh()
 assert.equal(await h.controller.advance(id(70),2,'reconcile',null),false);assert.equal(await h.controller.retry(),true);assert.deepEqual(h.calls[0],h.calls[1]);assert.equal(h.state.data.items[0].state,'unknown');assert.equal(h.calls.length,2)
})
test('known acknowledgement followed by failed read cannot be replayed as another command',async()=>{
 const h=harness();await h.controller.select(query());h.controller.open();h.state.form={amount:'100.00',reason:'Synthetic known request'};h.repo.read=async()=>{throw Error('Read unavailable')}
 assert.equal(await h.controller.save(),true);assert.equal(h.state.error,'network');assert.equal(h.state.uncertain,false);assert.equal(await h.controller.retry(),false);assert.equal(h.calls.length,1)
})
test('a newer charge version requires explicit form review before using another financial source',async()=>{
 const h=harness();await h.controller.select(query());h.controller.open();h.state.form={amount:'100.00',reason:'Synthetic selected original source'}
 h.setRaw({...board(),charge_version_id:id(62)});await h.controller.refresh();assert.equal(h.controller.valid(),false);assert.equal(await h.controller.save(),false);assert.equal(h.calls.length,0);assert.equal(h.state.error,'invalid')
})
test('account/SID replacement clears private pending state and suppresses an old accepted response',async()=>{
 let resolve;const h=harness({prepare:()=>new Promise(r=>{resolve=r})});await h.controller.select(query());h.controller.open();h.state.form={amount:'100.00',reason:'Synthetic old owner'}
 const running=h.controller.save();h.setActor({...identity(),userId:id(2),sessionId:id(12),practiceId:id(22)});h.controller.clear();resolve(practicePaymentIntent({...intent(),amount_minor:'10000',reason:'Synthetic old owner'},scope));assert.equal(await running,false);assert.equal(h.state.data,null);assert.equal(h.state.scope,null);assert.equal(h.state.uncertain,false);assert.equal(await h.controller.retry(),false)
})
test('a current-session financial denial clears private history and retained unknown command',async()=>{
 const h=harness({prepare:async()=>{throw{code:'42501'}}});await h.controller.select(query());h.controller.open();h.state.form={amount:'100.00',reason:'Synthetic denial'};assert.equal(await h.controller.save(),false);assert.equal(h.state.error,'denied');assert.equal(h.state.data,null);assert.equal(h.state.scope,null);assert.equal(await h.controller.retry(),false)
})
test('adapter freezes expected scope, amount/currency and source before waiting for the RPC acknowledgement',async()=>{
 let resolve;const calls=[],client={rpc:(name,args)=>{calls.push({name,args:structuredClone(args)});return{abortSignal:()=>new Promise(r=>{resolve=r})}}},repo=practiceMoneyRepository(client),owner={...scope},input={kind:'collection',chargeVersionId:id(61),originalEntryId:null,amountMinor:'20000',reason:'Synthetic explicit financial record',currency:'EGP',exponent:2}
 const running=repo.prepare(owner,input,id(901),new AbortController().signal);owner.practiceId=id(99);input.amountMinor='1';input.currency='USD';resolve({data:intent(),error:null});const result=await running;assert.equal(result.amountMinor,'20000');assert.equal(calls[0].args.p_practice,scope.practiceId);assert.equal(calls[0].args.p_minor,'20000')
 const wrongRepo=practiceMoneyRepository({rpc:()=>({abortSignal:async()=>({data:{...intent(),currency:'USD'},error:null})})});await assert.rejects(()=>wrongRepo.prepare(scope,{...input,amountMinor:'20000',currency:'EGP'},id(902),new AbortController().signal),/MONEY_INVALID/)
})
test('repeated refund/recollection gross totals display exactly even beyond the individual movement bound',async()=>{
 const {formatPracticeMoneyMinor}=await import('../../app/utils/practiceMoney.ts'),{practiceMoneyView}=await import('../../app/utils/practiceMoneyPresentation.ts')
 assert.equal(formatPracticeMoneyMinor('18014398509481982',2),'180143985094819.82')
 const raw=board();raw.balance.collected_minor='18014398509481982';raw.balance.refunded_minor='18014398509466982';const h=harness();h.setRaw(raw);await h.controller.select(query());const view=practiceMoneyView(h.controller,false,true)
 assert.equal(view.collected,'180143985094819.82 EGP');assert.equal(view.refunded,'180143985094669.82 EGP');assert.equal(view.net,'150.00 EGP');assert.equal(view.available,'348.00 EGP')
})
test('English/Arabic presentation preserves original receipt links and keeps unknown reconciliation separate from dispatch',async()=>{
 const {practiceMoneyView,practiceMoneyCopy}=await import('../../app/utils/practiceMoneyPresentation.ts'),h=harness(),raw=board();raw.items=[{...intent(),revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'}];h.setRaw(raw);await h.controller.select(query())
 for(const ar of[false,true]){const view=practiceMoneyView(h.controller,ar,true);assert.equal(view.rows[0].id,id(70));assert.equal(view.rows[0].dispatch,false);assert.equal(view.rows[0].reconcile,true);assert.equal(view.rows[0].refundable,false);assert.equal(view.rows[0].receipt,'—');assert.notEqual(practiceMoneyCopy(ar).accept,practiceMoneyCopy(ar).reconcile)}
})
test('monotonic expiry removes new dispatch and refund affordances while retaining historical reconciliation',async()=>{
 const {practiceMoneyView}=await import('../../app/utils/practiceMoneyPresentation.ts');let now=0,callback
 const timers={now:()=>now,set:fn=>{callback=fn;return 1},clear:()=>{}},h=harness({},timers),raw=board();raw.edition='administrative_candidate';raw.entitlement={...raw.entitlement,state:'paid',revision:1,valid_until:'2026-10-26T12:00:01Z'};raw.items=[{...intent(),revision:2,state:'unknown',reason_code:'attempt_reconciliation_required'}];h.setRaw(raw);await h.controller.select(query());now=1001;callback()
 assert.equal(h.state.data.canWrite,false);assert.equal(h.controller.open(),false);const view=practiceMoneyView(h.controller,false,true);assert.equal(view.readonly,true);assert.equal(view.rows[0].reconcile,true);assert.equal(view.rows[0].dispatch,false);assert.equal(view.rows[0].refundable,false);assert.equal(h.calls.length,0)
})
