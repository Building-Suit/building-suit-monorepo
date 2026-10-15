import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReceipt, buildEinvoice, serializeEta, receiptUuid, validateProfile, validateBranch, validateItem } from '../../supabase/functions/_shared/eta-adapter.mjs'
import { createEtaDispatcher, createEtaReconciler, createEtaClient, retryDelay } from '../../supabase/functions/_shared/eta-worker.mjs'
const reference='a'.repeat(64)
function source() {return {channel:'ereceipt',kind:'sale',currency:'EGP',issuedAt:'2026-10-15T00:00:00Z',receiptNumber:'S-001',
 profile:{legalName:'Test legal name',rin:'123456789',activityCode:'1234'},branch:{branchCode:'0',deviceSerialNumber:'POS-1',address:{country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Test',buildingNumber:'1'}},
 buyer:{type:'P'},paymentMethod:'C',items:[{sourceId:'product-1',sourceType:'product',itemType:'EGS',itemCode:'EG-123456789-TEST',unitType:'EA'}],names:{'line-1':'Test item'},
 tax:{version:1,componentDecimals:5,calculationEnabled:true,net5:100,tax5:14,total5:114,total:114,lines:[{id:'line-1',sourceId:'product-1',itemType:'product',originalQuantity:1,originalUnitPrice:114,net5:100,tax5:14,total5:114,discountNet5:0,rule:{treatment:'vat',priceMode:'inclusive',rate:14,subtype:'V009'}}]}}}
const config={shopId:'shop-1',deviceSerialNumber:'POS-1',rin:'123456789',environment:'preproduction',clientId:'synthetic-id',clientSecret:'synthetic-secret',presharedKey:'synthetic-key',osVersion:'test',modelFramework:'1',credentialVersion:'v1',receiptSignatureMode:'eta-current-unsigned'}
test('deterministic exact inclusive VAT receipt, no reserved rounding patches',async()=>{
 const input=source(),before=structuredClone(input)
 const a=await buildReceipt(input),b=await buildReceipt(input)
 assert.deepEqual(a,b);assert.deepEqual(input,before)
 assert.equal(a.receipt.itemData[0].unitPrice,100);assert.equal(a.receipt.totalAmount,114)
 assert.equal(a.receipt.feesAmount,0);assert.equal(a.receipt.adjustment,0)
 assert.equal(a.uuid,await receiptUuid(a.receipt));assert.match(a.uuid,/^[a-f0-9]{64}$/)
 assert.notEqual((await buildReceipt(input,reference)).uuid,a.uuid)
})
test('ETA serialization uses uppercase names, quotes, insertion order and repeated array names',()=>{
 assert.equal(serializeEta({name:'A "quote"',items:[{amount:1},{amount:2}]}),'"NAME""A \\"quote\\"""ITEMS""ITEMS""AMOUNT""1""ITEMS""AMOUNT""2"')
})
test('merchant and item format validation exposes missing fields without claiming official approval',()=>{
 assert.deepEqual(validateProfile({}),['legalName','rin','activityCode']);assert.ok(validateBranch({}).includes('address.country'))
 assert.equal(validateItem(source().items[0],'123456789'),true)
 assert.equal(validateItem({...source().items[0],itemCode:'EG-999999999-X'},'123456789'),false)
})
for (const [name,mutate,error] of [
 ['non EGP',s=>s.currency='USD','EGP_ONLY'],['legacy',s=>s.tax=null,'LEGACY'],['disabled',s=>s.tax.calculationEnabled=false,'LEGACY'],
 ['compound',s=>s.tax.lines[0].rule.taxType='T2','TREATMENT'],['hidden withholding',s=>s.tax.lines[0].rule.withholding=5,'TREATMENT'],['invalid subtype',s=>s.tax.lines[0].rule.subtype='W001','TREATMENT'],['unknown classification',s=>s.tax.lines[0].rule.treatment='constructor','TREATMENT'],
 ['three decimal rate',s=>s.tax.lines[0].rule.rate=14.001,'RATE'],['missing code',s=>s.items=[],'CODES'],
 ['money rounding',s=>s.tax.total=114.01,'ROUNDING'],['B2B',s=>s.buyer={type:'B',id:'987654321'},'B2B'],
 ['eInvoice',s=>s.channel='einvoice','EINVOICE'],['high amount buyer',s=>s.tax.total5=150000,'BUYER'],
 ['invalid precision',s=>s.tax.lines[0].net5=100.000001,'PRECISION'],['tax mismatch',s=>s.tax.lines[0].tax5=15,'EQUATION'],
]) test(`fails clearly: ${name}`,async()=>{const s=source();mutate(s);await assert.rejects(buildReceipt(s),new RegExp(error))})
test('returns retain immutable original reference; invalid correction is a distinct contract',async()=>{
 const s=source();s.kind='return';await assert.rejects(buildReceipt(s),/ORIGINAL_REFERENCE/)
 s.original={uuid:reference,snapshotId:'snapshot-1',issuedAt:s.issuedAt}
 const returned=await buildReceipt(s);assert.equal(returned.receipt.header.referenceUUID,reference);assert.equal(returned.receipt.documentType.receiptType,'r')
 s.kind='correction';s.invalidOriginal={uuid:reference,status:'valid',previousUUID:''};await assert.rejects(buildReceipt(s),/INVALID_ORIGINAL/)
 s.invalidOriginal.status='invalid';const fixed=await buildReceipt(s)
 assert.equal(fixed.receipt.header.referenceOldUUID,reference);assert.equal(fixed.receipt.header.referenceUUID,undefined);assert.equal(fixed.receipt.documentType.receiptType,'s')
})
async function fixture({state='queued',submitStatus=202,network=false,pollState='Valid',configured=true,mismatch=false}={}) {
 const prepared=await buildReceipt(source()),calls=[]
 const job={id:'job-1',lease_id:'lease-1',shop_id:'shop-1',device_serial:'POS-1',source:source(),state,previous_uuid:'',attempts:0,payload:state==='queued'?null:prepared.body,document_uuid:state==='queued'?null:prepared.uuid,submission_uuid:state==='submitted'?'submission-1':null}
 const rpc=async(name,args)=>{calls.push({name,args});return name==='shop_eta_claim'?job:null}
 const client={token:async()=>{},submit:async()=>{calls.push({name:'POST'});if(network)throw new Error('synthetic network failure');return new Response(JSON.stringify({submissionUUID:'submission-1',acceptedDocuments:[{uuid:prepared.uuid}]}),{status:submitStatus})},poll:async()=>{calls.push({name:'GET'});return new Response(JSON.stringify({submissionuuid:'submission-1',sellerId:'123456789',receipts:[{uuid:mismatch?reference:prepared.uuid,status:pollState,sellerId:'123456789',deviceSerialNumber:'POS-1'}]}))}}
 const dispatch=createEtaDispatcher({rpc,configuration:()=>configured?config:null,client})
 return {dispatch,calls,job}
}
test('202 persists submitted state, never valid; prepare and begin precede POST',async()=>{
 const f=await fixture();assert.deepEqual(await f.dispatch(),{state:'submitted'})
 assert.deepEqual(f.calls.map(c=>c.name),['shop_eta_claim','shop_eta_prepare','shop_eta_transition','POST','shop_eta_transition'])
 assert.equal(f.calls[2].args.p_state,'submitting');assert.equal(f.calls.at(-1).args.p_state,'submitted')
})
test('submitted batches only poll and require individual tenant/POS-matched status evidence',async()=>{
 for (const mismatch of [false,true]) {
  const f=await fixture({state:'submitted',mismatch});assert.equal((await f.dispatch()).state,mismatch?'submitted':'valid')
  assert.equal(f.calls.some(c=>c.name==='POST'),false)
 }
})
test('network ambiguity and duplicate responses never auto-retry POST',async()=>{
 for (const options of [{network:true},{submitStatus:422},{submitStatus:500}]) {
  const f=await fixture(options);assert.equal((await f.dispatch()).state,'uncertain');assert.equal(f.calls.at(-1).args.p_state,'uncertain')
 }
})
test('rate limiting backs off; missing setup never sends',async()=>{
 const f=await fixture({submitStatus:429});assert.equal((await f.dispatch()).state,'retry')
 assert.equal(retryDelay(3,1000),1000);assert.equal(retryDelay(30,999999),86400)
 const missing=await fixture({configured:false});assert.equal((await missing.dispatch()).state,'setup_required');assert.equal(missing.calls.some(c=>c.name==='POST'),false)
})
test('POS tokens reused with single flight and tenant/POS/credential-version isolation',async()=>{
 let calls=0
 const client=createEtaClient({fetcher:async()=>{calls++;return new Response(JSON.stringify({access_token:'synthetic-token',expires_in:3600}))},now:()=>1000})
 await Promise.all([client.token(config),client.token(config)]);await client.token(config);assert.equal(calls,1)
 await client.token({...config,shopId:'shop-2'});await client.token({...config,deviceSerialNumber:'POS-2'});await client.token({...config,credentialVersion:'v2'});assert.equal(calls,4)
 await client.token({...config,deviceSerialNumber:'POS:A',credentialVersion:'B'});await client.token({...config,deviceSerialNumber:'POS',credentialVersion:'A:B'});assert.equal(calls,6)
})

test('B2B eInvoice uses separate envelope and explicit CAdES-BES signing provider',async()=>{
 const s=source();s.channel='einvoice';s.receiver={type:'B',id:'987654321',name:'Test business',address:{...s.branch.address}}
 await assert.rejects(buildEinvoice(s),/CADES_BES_PROVIDER_REQUIRED/)
 const built=await buildEinvoice(s,async(document,contract)=>{assert.equal(contract.signature,'CAdES-BES');assert.equal(document.documentType,'i');return 'dGVzdA=='})
 const wire=JSON.parse(built.body);assert.equal(wire.receipts,undefined);assert.equal(wire.documents[0].receiver.type,'B');assert.equal(wire.documents[0].signatures[0].signatureType,'I')
})

test('ambiguous POST recovery requires provider document, taxpayer and POS evidence',async()=>{
 const prepared=await buildReceipt(source());const calls=[]
 const job={id:'11111111-1111-4111-8111-111111111111',shop_id:'shop-1',device_serial:'POS-1',document_uuid:prepared.uuid,source:source()}
 let matched=false
 const recover=createEtaReconciler({configuration:()=>config,rpc:async(name,args)=>{calls.push({name,args});return job},client:{poll:async()=>new Response(JSON.stringify({submissionuuid:'recovered-1',sellerId:'123456789',receipts:matched?[{uuid:prepared.uuid,sellerId:'123456789',deviceSerialNumber:'POS-1'}]:[]}))}})
 await assert.rejects(recover(job.id,'recovered-1'),/EVIDENCE_REQUIRED/);assert.equal(calls.some(call=>call.name==='shop_eta_link_recovery'),false)
 matched=true;assert.deepEqual(await recover(job.id,'recovered-1'),{state:'submitted'});assert.equal(calls.at(-1).name,'shop_eta_link_recovery')
})

test('Edge dispatcher rejects browser/anonymous callers and stays disabled until server setup',async()=>{
 const original=globalThis.Deno
 let handler
 const values={SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-only'}
 globalThis.Deno={env:{get:key=>values[key]},serve:fn=>{handler=fn}}
 try {
  await import('../../supabase/functions/shop-eta-dispatch/index.ts')
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST'}))).status,403)
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer synthetic-browser-key'}}))).status,403)
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer synthetic-server-only'}}))
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{state:'disabled'})
 } finally {globalThis.Deno=original}
})

test('versioned adapter emits the same wire format despite source property order',async()=>{
 const a=source(),b=source();a.buyer={type:'P',id:'12345678901234',name:'Test'};b.buyer={name:'Test',id:'12345678901234',type:'P'}
 b.branch.address=Object.fromEntries(Object.entries(b.branch.address).reverse())
 assert.deepEqual(await buildReceipt(a),await buildReceipt(b))
})
