import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildEinvoice, serializeEta } from '../../supabase/functions/_shared/eta-adapter.mjs'
import { createSigningProvider } from '../../signing-provider/server.mjs'
import { createInvoiceSigner, createInvoiceClient, createInvoiceDispatcher, createInvoiceReconciler } from '../../supabase/functions/_shared/eta-einvoice-worker.mjs'
let fingerprint='a'.repeat(64)
const config={shopId:'shop-1',rin:'123456789',environment:'preproduction',clientId:'synthetic-erp',clientSecret:'synthetic-secret',credentialVersion:'v1',signerUrl:'https://synthetic-signer.invalid/sign',signerToken:'synthetic-token',certificateFingerprint:fingerprint}
function source() {return {channel:'einvoice',kind:'sale',currency:'EGP',issuedAt:'2026-10-15T00:00:00Z',receiptNumber:'INV-001',profile:{legalName:'Synthetic issuer',rin:'123456789',activityCode:'1234'},branch:{branchCode:'0',address:{country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Test',buildingNumber:'1'}},receiver:{type:'B',id:'987654321',name:'Synthetic receiver',address:{country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Test',buildingNumber:'2'}},items:[{sourceId:'product-1',sourceType:'product',itemType:'EGS',itemCode:'EG-123456789-TEST',unitType:'EA'}],names:{'line-1':'Test'},tax:{version:1,componentDecimals:5,calculationEnabled:true,net5:100,tax5:14,total5:114,total:114,lines:[{id:'line-1',sourceId:'product-1',itemType:'product',originalQuantity:1,originalUnitPrice:100,net5:100,tax5:14,total5:114,discountNet5:0,rule:{treatment:'vat',rate:14,priceMode:'exclusive',subtype:'V009'}}]}}}
let unsigned
await assert.rejects(buildEinvoice(source(),async document=>{unsigned=document;throw new Error('capture_only')}),/capture_only/)
const work=mkdtempSync(join(tmpdir(),'eta-synthetic-cades-'))
function openssl(args,success=true){const result=spawnSync('openssl',args,{encoding:'utf8'});if(success)assert.equal(result.status,0,result.stderr);return result}
let signature
try {
 openssl(['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=Shop synthetic test only','-keyout',join(work,'key.pem'),'-out',join(work,'cert.pem'),'-days','1'])
 writeFileSync(join(work,'canonical'),serializeEta(unsigned),{mode:0o600})
 openssl(['cms','-sign','-binary','-cades','-md','sha256','-econtent_type','1.2.840.113549.1.7.5','-in',join(work,'canonical'),'-signer',join(work,'cert.pem'),'-inkey',join(work,'key.pem'),'-outform','DER','-out',join(work,'signed.der')])
 signature=readFileSync(join(work,'signed.der')).toString('base64')
 const cert=spawnSync('openssl',['x509','-in',join(work,'cert.pem'),'-outform','DER']);assert.equal(cert.status,0);fingerprint=createHash('sha256').update(cert.stdout).digest('hex');config.certificateFingerprint=fingerprint
 test('mock signing provider returns a real synthetic CAdES signature, not a fabricated successful signature',()=>{
  // Test trust is self-signed only. This proves cryptographic integrity, not ETA registration.
  openssl(['cms','-verify','-binary','-inform','DER','-in',join(work,'signed.der'),'-content',join(work,'canonical'),'-noverify','-out',join(work,'verified')])
  writeFileSync(join(work,'changed'),'changed',{mode:0o600})
  assert.notEqual(openssl(['cms','-verify','-binary','-inform','DER','-in',join(work,'signed.der'),'-content',join(work,'changed'),'-noverify','-out',join(work,'bad')],false).status,0)
 })
 process.once('exit',()=>rmSync(work,{recursive:true,force:true}))
}catch(error){rmSync(work,{recursive:true,force:true});throw error}
function providerResponse(body,patch={}){return {algorithm:'CAdES-BES',signature,documentHash:body.documentHash,certificateFingerprint:fingerprint,...patch}}
test('invoice signer binds canonical bytes, digest and certificate and never mutates the document',async()=>{
 const calls=[],document=structuredClone(unsigned)
 const sign=createInvoiceSigner({fetcher:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,options,body});return Response.json(providerResponse(body))}})
 assert.equal(await sign(config,document),signature);assert.deepEqual(document,unsigned)
 assert.equal(calls[0].body.canonical,serializeEta(document));assert.equal(calls[0].body.documentHash,createHash('sha256').update(serializeEta(document)).digest('hex'))
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.authorization,'Bearer synthetic-token')
})
test('missing signer, HTTP errors, wrong hash/certificate and fake base64 fail closed',async()=>{
 for(const patch of [{documentHash:'b'.repeat(64)},{certificateFingerprint:'b'.repeat(64)},{signature:'dGVzdA=='},{algorithm:'raw-rsa'}]){
  const sign=createInvoiceSigner({fetcher:async(_url,options)=>Response.json(providerResponse(JSON.parse(options.body),patch))})
  await assert.rejects(sign(config,unsigned),/SIGNER_EVIDENCE_INVALID/)
 }
 await assert.rejects(createInvoiceSigner({fetcher:async()=>{throw new Error('synthetic failure')}})(config,unsigned),/SIGNER_UNAVAILABLE/)
 await assert.rejects(createInvoiceSigner({})({...config,signerUrl:'http://synthetic.invalid'},unsigned),/SIGNER_SETUP_REQUIRED/)
})
test('B2B builder has no POS requirement or receipt identifiers and freezes real signed envelope',async()=>{
 const result=await buildEinvoice(source(),async()=>signature),wire=JSON.parse(result.body)
 assert.equal(wire.receipts,undefined);assert.equal(wire.documents[0].issuer.address.branchId,'0');assert.equal(wire.documents[0].issuer.deviceSerialNumber,undefined)
 assert.equal(wire.documents[0].signatures[0].value,signature);assert.equal(wire.documents[0].receiver.id,'987654321')
})
test('ERP authentication uses Basic client credentials, never POS headers, and reuses isolated tokens',async()=>{
 const calls=[]
 const client=createInvoiceClient({fetcher:async(url,options)=>{calls.push({url,options});return Response.json({access_token:'synthetic-token',expires_in:3600})},now:()=>1000})
 await Promise.all([client.token(config),client.token(config)]);await client.token(config);assert.equal(calls.length,1)
 assert.equal(calls[0].options.headers.authorization,`Basic ${btoa('synthetic-erp:synthetic-secret')}`);assert.equal(calls[0].options.headers.posserial,undefined)
 await client.token({...config,shopId:'shop-2'});await client.token({...config,credentialVersion:'v2'});assert.equal(calls.length,3)
})
async function fixture({state='queued',status=202,network=false,mismatch=false,configured=true}={}){
 const calls=[],built=await buildEinvoice(source(),async()=>signature)
 const job={id:'11111111-1111-4111-8111-111111111111',shop_id:'shop-1',source:source(),state,lease_id:'lease-1',attempts:1,document_uuid:state==='submitted'?'PROVIDER-DOC-1':null,submission_uuid:state==='submitted'?'SUBMISSION-1':null,payload:state==='queued'?null:built.body}
 const rpc=async(name,args)=>{calls.push({name,args});return ['shop_eta_invoice_claim','shop_eta_invoice_recovery_context'].includes(name)?job:null}
 const client={token:async()=>{},submit:async()=>{calls.push({name:'POST'});if(network)throw new Error('synthetic timeout');return Response.json({submissionId:'SUBMISSION-1',acceptedDocuments:[{uuid:'PROVIDER-DOC-1',internalId:'INV-001'}]},{status})},poll:async()=>{calls.push({name:'GET'});return Response.json({uuid:'SUBMISSION-1',overallStatus:'valid',documentSummary:[{uuid:'PROVIDER-DOC-1',internalId:'INV-001',issuerId:mismatch?'000000000':'123456789',receiverId:'987654321',typeName:'i',typeVersionName:'1.0',total:114,status:'valid'}]})}}
 const deps={rpc,configuration:()=>configured?config:null,client,sign:async()=>signature}
 return {job,calls,dispatch:createInvoiceDispatcher(deps),recover:createInvoiceReconciler(deps)}
}
test('invoice 202 records provider assigned ID, after durable prepare and begin; never validated success',async()=>{
 const f=await fixture();assert.deepEqual(await f.dispatch(),{state:'submitted'})
 assert.deepEqual(f.calls.map(call=>call.name),['shop_eta_invoice_claim','shop_eta_invoice_prepare','shop_eta_transition','POST','shop_eta_invoice_acknowledge'])
 assert.equal(f.calls[2].args.p_state,'submitting');assert.equal(f.calls.at(-1).args.p_document_uuid,'PROVIDER-DOC-1')
})
test('successful invoice batches only poll matching individual evidence and never POST again',async()=>{
 for(const mismatch of [false,true]){const f=await fixture({state:'submitted',mismatch});assert.equal((await f.dispatch()).state,mismatch?'submitted':'valid');assert.equal(f.calls.some(call=>call.name==='POST'),false)}
})
test('ambiguous invoice POST and duplicate response require evidence, explicit throttling backs off',async()=>{
 for(const options of [{network:true},{status:500},{status:422}]){const f=await fixture(options);assert.equal((await f.dispatch()).state,'uncertain')}
 const limited=await fixture({status:429});assert.equal((await limited.dispatch()).state,'retry')
 const missing=await fixture({configured:false});assert.equal((await missing.dispatch()).state,'setup_required');assert.equal(missing.calls.some(call=>call.name==='POST'),false)
})
test('invoice uncertain recovery requires submission, internal ID, issuer, receiver and amount evidence',async()=>{
 const f=await fixture({state:'uncertain'});assert.deepEqual(await f.recover(f.job.id,'SUBMISSION-1'),{state:'submitted'});assert.equal(f.calls.at(-1).args.p_document_uuid,'PROVIDER-DOC-1')
 const bad=await fixture({state:'uncertain',mismatch:true});await assert.rejects(bad.recover(bad.job.id,'SUBMISSION-1'),/RECOVERY_EVIDENCE_REQUIRED/)
})

test('reference provider and HTTPS adapter exercise actual CAdES signing and reject unauthenticated or mutated inputs',async()=>{
 const handle=createSigningProvider({environment:'preproduction',rin:config.rin,token:config.signerToken,certificatePath:join(work,'cert.pem'),keyReference:join(work,'key.pem'),certificateFingerprint:fingerprint})
 assert.equal((await handle(new Request(config.signerUrl,{method:'POST',body:'{}'}))).status,403)
 const sign=createInvoiceSigner({fetcher:async(url,options)=>handle(new Request(url,options))})
 const actual=await sign(config,unsigned);assert.ok(actual.length>1000)
 const bad={protocol:'shop-eta-cades-bes-v1',document:unsigned,canonical:'mutated',documentHash:'a'.repeat(64),certificateFingerprint:fingerprint}
 const rejected=await handle(new Request(config.signerUrl,{method:'POST',headers:{authorization:`Bearer ${config.signerToken}`},body:JSON.stringify(bad)}))
 assert.equal(rejected.status,503);assert.deepEqual(await rejected.json(),{error:'ETA_SIGNER_FAILED'})
})
