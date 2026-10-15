// Optional reference signing bridge. Deploy separately with a managed registered
// eSeal/certificate and HTTPS reverse proxy. Never started/configured by the app.
import { createServer } from 'node:http'
import { createHash, timingSafeEqual, X509Certificate } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { serializeEta } from '../supabase/functions/_shared/eta-adapter.mjs'
import { verifyInvoiceCades } from '../supabase/functions/_shared/eta-cades.mjs'
const execute=promisify(execFile),limit=1500000
const digest=value=>createHash('sha256').update(value).digest()
async function limitedBody(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('body_required')
 const chunks=[];let length=0
 for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new Error('body_limit')}chunks.push(value)}
 return Buffer.concat(chunks).toString('utf8')
}
export function createSigningProvider(config){
 if(config.environment!=='preproduction' || !/^\d{9}$/.test(config.rin??'') || !config.token || !/^[a-f0-9]{64}$/.test(config.certificateFingerprint??''))throw new Error('ETA_SIGNER_SETUP_REQUIRED')
 const certificate=new X509Certificate(readFileSync(config.certificatePath))
 if(digest(certificate.raw).toString('hex')!==config.certificateFingerprint || Date.parse(certificate.validFrom)>Date.now() || Date.parse(certificate.validTo)<=Date.now())throw new Error('ETA_SIGNER_CERTIFICATE_INVALID')
 if(typeof config.keyReference!=='string' || !config.keyReference || config.keyReference.includes('pin-value='))throw new Error('ETA_SIGNER_KEY_SETUP_REQUIRED')
 if(!config.keyReference.startsWith('pkcs11:') && (statSync(config.keyReference).mode&0o077)!==0)throw new Error('ETA_SIGNER_KEY_PERMISSIONS_INVALID')
 if(config.opensslProvider && !/^[A-Za-z0-9_-]{1,40}$/.test(config.opensslProvider))throw new Error('ETA_SIGNER_PROVIDER_INVALID')
 let busy=false
 return async request=>{
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest(`Bearer ${config.token}`)))return new Response(null,{status:403})
  if(request.method!=='POST' || new URL(request.url).pathname!=='/sign')return new Response(null,{status:405})
  if(busy)return Response.json({error:'ETA_SIGNER_BUSY'},{status:429,headers:{'retry-after':'30'}})
  busy=true;let folder
  try {
   const input=JSON.parse(await limitedBody(request)),document=input.document
   if(input.protocol!=='shop-eta-cades-bes-v1' || document?.issuer?.id!==config.rin || document.signatures || document.documentType!=='i' || document.documentTypeVersion!=='1.0' || input.certificateFingerprint!==config.certificateFingerprint)throw new Error('binding')
   const canonical=serializeEta(document),documentHash=digest(canonical).toString('hex')
   if(input.canonical!==canonical || input.documentHash!==documentHash)throw new Error('digest')
   folder=await mkdtemp(join(tmpdir(),'shop-eta-sign-'))
   const content=join(folder,'canonical'),output=join(folder,'signature.der')
   await writeFile(content,canonical,{mode:0o600})
   const provider=config.opensslProvider?['-provider',config.opensslProvider,'-provider','default']:[]
   await execute('openssl',['cms','-sign','-binary','-cades','-md','sha256','-econtent_type','1.2.840.113549.1.7.5',...provider,'-in',content,'-signer',config.certificatePath,'-inkey',config.keyReference,'-outform','DER','-out',output],{timeout:20000,maxBuffer:100000})
   const signature=(await readFile(output)).toString('base64')
   if(!await verifyInvoiceCades(signature,canonical,config.certificateFingerprint))throw new Error('verification')
   return Response.json({algorithm:'CAdES-BES',signature,documentHash,certificateFingerprint:config.certificateFingerprint})
  }catch{return Response.json({error:'ETA_SIGNER_FAILED'},{status:503})}
  finally{if(folder)await rm(folder,{recursive:true,force:true});busy=false}
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const handle=createSigningProvider({environment:process.env.SHOP_ETA_SIGNER_ENVIRONMENT,rin:process.env.SHOP_ETA_SIGNER_RIN,token:process.env.SHOP_ETA_SIGNER_TOKEN,certificatePath:process.env.SHOP_ETA_SIGNER_CERTIFICATE_PATH,keyReference:process.env.SHOP_ETA_SIGNER_KEY_REFERENCE,certificateFingerprint:process.env.SHOP_ETA_SIGNER_CERTIFICATE_FINGERPRINT,opensslProvider:process.env.SHOP_ETA_SIGNER_OPENSSL_PROVIDER})
 const port=Number(process.env.SHOP_ETA_SIGNER_PORT??8321)
 if(!Number.isInteger(port) || port<1024 || port>65535)throw new Error('ETA_SIGNER_PORT_INVALID')
 createServer(async(incoming,outgoing)=>{
  let length=0;const chunks=[]
  try {
   for await(const chunk of incoming){length+=chunk.length;if(length>limit){outgoing.writeHead(413);outgoing.end();return}chunks.push(chunk)}
   const response=await handle(new Request(new URL(incoming.url??'/','http://127.0.0.1'),{method:incoming.method,headers:incoming.headers,body:['GET','HEAD'].includes(incoming.method??'GET')?undefined:Buffer.concat(chunks)}))
   outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()))
  }catch{outgoing.writeHead(503);outgoing.end()}
 }).listen(port,'127.0.0.1',()=>process.stdout.write('Shop ETA preproduction signing bridge listening on loopback.\n'))
}
