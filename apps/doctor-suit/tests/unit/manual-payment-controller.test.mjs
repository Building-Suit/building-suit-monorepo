import{manualPaymentView}from'../../app/utils/manualPaymentPresentation.ts'
import test from'node:test'
import assert from'node:assert/strict'
import{createManualPaymentController,manualPaymentState}from'../../app/utils/manualPaymentController.ts'
import{manualMinor}from'../../app/utils/manualPayments.ts'
const actor={userId:'10000000-0000-0000-0000-000000000001',sessionId:'10000000-0000-0000-0000-000000000002',practiceId:null}
function fixture(overrides={}){
 let identity=actor,sequence=0
 const state=manualPaymentState(),terms={id:'terms',termsDocumentRef:'terms/v1'},plan={key:'starter',terms}
 const repo={capability:async()=>true,queue:async()=>({items:[],total:0,page:1,activationConfigured:true}),catalog:async()=>({revision:7,plans:[plan]}),configuration:async()=>({revision:8,configured:true}),status:async()=>({revision:0}),document:async()=>({termsId:'terms',english:'A synthetic version document',arabic:'وثيقة اصطناعية'}),quote:async()=>({id:'quote'}),intent:async()=>({id:'intent'}),instructions:async()=>({intentId:'intent',quoteId:'quote'}),submit:async()=>({id:'notice',intentId:'intent',evidence:[]}),...overrides}
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
 const f=fixture({submit:async()=>{notices++;return{id:'notice',evidence:[]}},upload:async(_id,_file,key)=>{uploadKeys.push(key);if(!uploads++)throw Error('uncertain');return{id:'evidence'}}})
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
