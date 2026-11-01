import{manualPaymentView}from'../../app/utils/manualPaymentPresentation.ts'
import test from'node:test'
import assert from'node:assert/strict'
import{createManualPaymentController,manualPaymentState}from'../../app/utils/manualPaymentController.ts'
import{manualMinor}from'../../app/utils/manualPayments.ts'
const actor={userId:'10000000-0000-0000-0000-000000000001',sessionId:'10000000-0000-0000-0000-000000000002',practiceId:null}
function fixture(overrides={}){
 let identity=actor,sequence=0
 const state=manualPaymentState(),terms={id:'terms',termsDocumentRef:'terms/v1'},plan={key:'starter',terms}
 const repo={capability:async()=>true,queue:async()=>({items:[],total:0,page:1,activationConfigured:true}),catalog:async()=>({revision:7,plans:[plan]}),configuration:async()=>({revision:8,configured:true}),status:async()=>({revision:0}),document:async()=>({termsId:'terms',english:'A synthetic version document',arabic:'وثيقة اصطناعية'}),quote:async()=>({id:'quote'}),intent:async()=>({id:'intent'}),instructions:async()=>({intentId:'intent',quoteId:'quote'}),submit:async()=>({id:'notice',intentId:'intent',status:'submitted',revision:0,evidence:[]}),...overrides}
 const controller=createManualPaymentController(repo,state,()=>identity,'local',()=>{},()=>`key-${++sequence}`)
 return{repo,state,controller,setIdentity:a=>{identity=a}}
}
test('quote preparation retries the same immutable request keys after uncertain intermediate commit',async()=>{
 const keys=[];let count=0
 const f=fixture({quote:async(_a,input,key)=>{keys.push(['quote',key,input]);return{id:'quote'}},intent:async(_a,_q,key)=>{keys.push(['intent',key]);if(!count++)throw Error('network');return{id:'intent'}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true
 assert.equal(await f.controller.prepare(),false);assert.equal(f.state.uncertain,true)
 f.state.plan='different';f.state.interval='yearly'
 assert.equal(await f.controller.prepare(),true);assert.equal(f.state.instructions.intentId,'intent')
 assert.deepEqual(keys[0],keys[2]);assert.deepEqual(keys[1],keys[3]);assert.equal(keys[2][2].interval,'monthly')
})
test('scope loss after quote blocks every later stage and clears retained command/evidence state',async()=>{
 let continueQuote,prepared=0
 const f=fixture({quote:async()=>new Promise(r=>{continueQuote=r}),intent:async()=>{prepared++;return{id:'intent'}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true
 const pending=f.controller.prepare();f.setIdentity({...actor,sessionId:'other'});f.controller.clear();continueQuote({id:'quote'})
 assert.equal(await pending,false);assert.equal(prepared,0);assert.equal(f.state.instructions,null);assert.equal(f.state.file,null);assert.equal(f.state.ready,false)
})
test('notice confirmation survives an upload failure without creating a new claim or period',async()=>{
 let notices=0,uploads=0;const uploadKeys=[]
 const f=fixture({submit:async()=>{notices++;return{id:'notice',status:'submitted',revision:0,evidence:[]}},upload:async(_id,_file,key)=>{uploadKeys.push(key);if(!uploads++)throw Error('uncertain');return{id:'evidence'}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;await f.controller.prepare();f.state.reference='synthetic';f.state.at='2026-10-18T09:00:00Z'
 assert.equal(await f.controller.submit(),true);assert.equal(f.state.uploadNotice,'notice');f.state.file=new File(['%PDF-synthetic'],'synthetic.pdf',{type:'application/pdf'})
 assert.equal(await f.controller.upload(),false);assert.equal(f.state.items[0].id,'notice');assert.equal(await f.controller.submit(),false)
 assert.equal(await f.controller.retry(),true);assert.equal(notices,1);assert.equal(uploads,2);assert.equal(uploadKeys[0],uploadKeys[1]);assert.equal(f.state.items[0].evidence[0].id,'evidence')
})
test('amount parsing uses exact decimal minor units and rejects fractional precision or exponent notation',()=>{
 assert.equal(manualMinor('299.00',2),'29900');assert.equal(manualMinor('2990',2),'299000');for(const value of['1e3','299.001','-1','0','NaN',' 299'])assert.throws(()=>manualMinor(value,2))
})

test('review projection requires entered bank material and funds confirmation never triggers activation',async()=>{
 const n={id:'notice',subscriberId:'foreign-subscriber',intentId:'intent',quoteId:'quote',termsId:'terms',interval:'yearly',amountMinor:'299000',currency:'EGP',exponent:2,beneficiary:'Synthetic recipient',recipientAddress:'synthetic@instapay',recipientKind:'ipa',reference:'synthetic-claim',transferredAt:'2026-10-18T08:00:00Z',createdAt:'2026-10-18T08:00:01Z',status:'submitted',revision:0,reason:null,periodId:null,requiresAttention:false,evidence:[],history:[]}
 let activations=0,bank
 const f=fixture({queue:async()=>({items:[n],total:1,page:1,activationConfigured:true}),review:async(_a,original,input)=>{bank=input;return{...original,status:'funds_verified',revision:1,history:[{revision:1,action:'funds_verified',actor:actor.userId,reason:input.reason,at:'2026-10-18T08:00:02Z'}]}},activate:async(_a,original)=>{activations++;return{...original,status:'activated',revision:2,periodId:'period'}}})
 await f.controller.load(true);f.controller.select('notice');assert.equal(f.state.receivedAmount,'');assert.equal(f.state.independent,false);assert.equal(manualPaymentView(f.controller,false).selected.canActivate,false)
 Object.assign(f.state,{reason:'Independent bank check',receivedReference:'SYNTHETIC-BANK',receivedAmount:'2990.00',receivedCurrency:'EGP',receivedAt:'2026-10-18T08:00',verification:'synthetic bank record'})
 assert.equal(manualPaymentView(f.controller,false).selected.canVerify,false);f.state.independent=true;assert.equal(manualPaymentView(f.controller,false).selected.canVerify,true)
 assert.equal(await f.controller.review('funds_verified'),true);assert.equal(bank.amount,'299000');assert.equal(bank.independent,true);assert.equal(activations,0);assert.equal(manualPaymentView(f.controller,false).selected.canActivate,true)
 assert.equal(await f.controller.activate(),true);assert.equal(activations,1);assert.equal(f.state.items[0].status,'activated')
})
test('source notice outside current page is independently authorized and does not change page totals',async()=>{
 const source={id:'ae340000-0000-0000-0000-000000000010',evidence:[],status:'submitted'},listed={id:'listed',evidence:[]}
 const f=fixture({queue:async()=>({items:[listed],total:26,page:1,activationConfigured:true}),read:async(_actor,review,id)=>{assert.equal(review,false);assert.equal(id,source.id);return source}})
 await f.controller.load();assert.equal(await f.controller.open(source.id),true);assert.equal(f.controller.selected().id,source.id);assert.equal(f.state.total,26);assert.deepEqual(f.state.items,[listed])
})
test('source notice reads are discarded after session change and foreign denial clears details',async()=>{
 const id='ae340000-0000-0000-0000-000000000010';let resolve,signal
 const f=fixture({read:async(_a,_r,_id,s)=>{signal=s;return new Promise(r=>{resolve=r})}});await f.controller.load();const pending=f.controller.open(id);f.setIdentity({...actor,sessionId:'new'});f.controller.clear();resolve({id,evidence:[]});assert.equal(await pending,false);assert.equal(signal.aborted,true);assert.equal(f.controller.selected(),null)
 const denied=fixture({read:async()=>{throw{code:'42501'}}});await denied.controller.load();assert.equal(await denied.controller.open(id),false);assert.equal(denied.state.error,'denied');assert.equal(denied.controller.selected(),null)
})
test('receipt upload through an off-page source updates details without inserting it into the queue page',async()=>{
 const source={id:'ae340000-0000-0000-0000-000000000011',evidence:[],status:'submitted'},listed={id:'listed',evidence:[]},evidence={id:'receipt',filename:'synthetic-source.pdf'}
 const f=fixture({queue:async()=>({items:[listed],total:26,page:1,activationConfigured:true}),read:async()=>source,upload:async()=>evidence})
 await f.controller.load();await f.controller.open(source.id);f.state.file=new File(['%PDF-synthetic'],'synthetic-source.pdf',{type:'application/pdf'})
 assert.equal(await f.controller.upload(),true);assert.deepEqual(f.controller.selected().evidence,[evidence]);assert.deepEqual(f.state.items,[listed]);assert.equal(f.state.total,26);assert.equal(f.state.uploadNotice,null)
})
test('refresh after uncertain preparation preserves original keys and restores transfer instructions',async()=>{
 const calls=[];let attempts=0
 const f=fixture({quote:async(_a,input,key)=>{calls.push(['quote',key,input]);return{id:'quote'}},intent:async(_a,id,key)=>{calls.push(['intent',key,id]);if(!attempts++)throw Error('Synthetic lost acknowledgement');return{id:'intent'}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true
 assert.equal(await f.controller.prepare(),false);assert.equal(f.state.uncertain,true)
 assert.equal(await f.controller.load(),true);assert.equal(f.state.uncertain,true);assert.equal(calls.length,2)
 assert.equal(await f.controller.retry(),true);assert.equal(f.state.instructions.intentId,'intent');assert.equal(f.state.uncertain,false)
 assert.deepEqual(calls[0],calls[2]);assert.deepEqual(calls[1],calls[3])
})
test('refresh after uncertain notice submission restores the confirmed notice without another intent',async()=>{
 const calls=[];let attempts=0
 const f=fixture({submit:async(_a,instructions,reference,at,key)=>{calls.push({instructions,reference,at,key});if(!attempts++)throw Error('Synthetic lost acknowledgement');return{id:'notice',status:'submitted',revision:0,evidence:[]}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;await f.controller.prepare();f.state.reference='synthetic original';f.state.at='2026-10-18T09:00:00Z'
 assert.equal(await f.controller.submit(),false);assert.equal(await f.controller.load(),true)
 f.state.reference='must not replace original';assert.equal(await f.controller.retry(),true)
 assert.equal(f.state.uploadNotice,'notice');assert.equal(f.state.instructions,null);assert.equal(f.controller.selected().id,'notice');assert.equal(f.state.uncertain,false);assert.deepEqual(calls[0],calls[1])
})
test('failed refresh blocks retained retries until a current read succeeds without changing the original keys',async()=>{
 let writes=0,readFails=false;const keys=[]
 const f=fixture({queue:async()=>{if(readFails)throw Error('Synthetic unavailable read');return{items:[],total:0,page:1,activationConfigured:true}},intent:async(_a,_id,key)=>{keys.push(key);if(!writes++)throw Error('Synthetic lost acknowledgement');return{id:'intent'}}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;assert.equal(await f.controller.prepare(),false)
 readFails=true;assert.equal(await f.controller.load(),false);assert.equal(await f.controller.retry(),false);assert.equal(writes,1);assert.equal(f.state.uncertain,true)
 readFails=false;assert.equal(await f.controller.load(),true);assert.equal(await f.controller.retry(),true);assert.deepEqual(keys,['key-2','key-2']);assert.equal(f.state.instructions.intentId,'intent')
})
test('session replacement discards the retained operation rather than replaying it after refresh',async()=>{
 let writes=0
 const f=fixture({intent:async()=>{writes++;throw Error('Synthetic unknown')}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;assert.equal(await f.controller.prepare(),false)
 f.setIdentity({...actor,sessionId:'replacement'});assert.equal(await f.controller.load(),true)
 assert.equal(await f.controller.retry(),false);assert.equal(writes,1);assert.equal(f.state.instructions,null);assert.equal(f.state.uncertain,false)
})
test('newer refresh wins over a late queue read without overwriting current state',async()=>{
 let finish,queues=0
 const f=fixture({queue:async()=>{if(++queues===2)return new Promise(resolve=>{finish=resolve});return{items:[],total:queues,page:1,activationConfigured:true}}})
 await f.controller.load();const stale=f.controller.load();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(await f.controller.load(),true);assert.equal(f.state.total,3)
 finish({items:[],total:99,page:1,activationConfigured:true});assert.equal(await stale,false);assert.equal(f.state.total,3);assert.equal(f.state.loading,false)
})
test('refresh invalidates older notice and terms reads even when actor generation is unchanged',async()=>{
 for(const kind of ['notice','terms']){
  let finish
  const f=fixture({read:async()=>new Promise(resolve=>{finish=resolve}),document:async()=>new Promise(resolve=>{finish=resolve})})
  await f.controller.load();const old=kind==='notice'?f.controller.open('ae340000-0000-0000-0000-000000000012'):f.controller.choose()
  assert.equal(await f.controller.load(),true)
  finish(kind==='notice'?{id:'ae340000-0000-0000-0000-000000000012',evidence:[]}:{termsId:'old',english:'obsolete',arabic:'قديم'})
  assert.equal(await old,false);assert.equal(f.state.detail,null);assert.equal(f.state.document,null);assert.equal(f.state.loading,false)
 }
})
test('recovered submission preserves a newer terminal notice and does not reopen receipt upload',async()=>{
 const original={id:'notice',status:'submitted',revision:0,evidence:[],history:[]},current={...original,status:'activated',revision:2,periodId:'period',history:[{revision:1},{revision:2}]}
 let attempts=0,refreshed=false;const keys=[]
 const f=fixture({queue:async()=>({items:refreshed?[current]:[],total:refreshed?1:0,page:1,activationConfigured:true}),submit:async(_a,_i,_r,_t,key)=>{keys.push(key);if(!attempts++)throw Error('Synthetic lost acknowledgement');return original}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;await f.controller.prepare();f.state.reference='synthetic';f.state.at='2026-10-18T09:00:00Z'
 assert.equal(await f.controller.submit(),false);refreshed=true;assert.equal(await f.controller.load(),true);assert.equal(await f.controller.retry(),true)
 assert.deepEqual(f.controller.selected(),current);assert.equal(f.state.uploadNotice,null);assert.equal(f.state.instructions,null);assert.equal(f.state.uncertain,false);assert.equal(keys[0],keys[1])
})
test('same-revision submission acknowledgement retains receipt discovered by refresh',async()=>{
 const original={id:'notice',status:'submitted',revision:0,evidence:[],history:[]},current={...original,evidence:[{id:'persisted-receipt'}]}
 let attempts=0,refreshed=false
 const f=fixture({queue:async()=>({items:refreshed?[current]:[],total:refreshed?1:0,page:1,activationConfigured:true}),submit:async()=>{if(!attempts++)throw Error('Synthetic lost acknowledgement');return original}})
 await f.controller.load();await f.controller.choose();f.state.accepted=true;await f.controller.prepare();f.state.reference='synthetic';f.state.at='2026-10-18T09:00:00Z'
 assert.equal(await f.controller.submit(),false);refreshed=true;await f.controller.load();assert.equal(await f.controller.retry(),true)
 assert.deepEqual(f.controller.selected(),current);assert.equal(f.state.uploadNotice,null)
})
