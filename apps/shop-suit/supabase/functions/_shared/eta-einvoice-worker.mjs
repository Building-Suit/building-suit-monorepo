import { buildEinvoice, serializeEta, EtaError } from './eta-adapter.mjs'
import { retryDelay } from './eta-worker.mjs'
import { verifyInvoiceCades } from './eta-cades.mjs'
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)
const sha256 = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('')
const configured = (config,job) => config?.environment === 'preproduction' && config.shopId === job.shop_id && config.rin === job.source.profile.rin && ['clientId','clientSecret','credentialVersion'].every(key=>typeof config[key] === 'string' && config[key].length)
// The trusted signing service owns actual eSeal/device material and CAdES creation.
// This adapter binds its response to the exact canonical document and configured
// certificate. It verifies the detached RSA/SHA-256 CMS, digest and signing-certificate binding. ETA registration and certificate-chain policy remain external activation requirements.
export function createInvoiceSigner({fetcher = fetch}) {
 return async (config,document)=>{
  let url
  try {url=new URL(config.signerUrl)} catch {throw new EtaError('ETA_EINVOICE_SIGNER_SETUP_REQUIRED')}
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !config.signerToken || !/^[a-f0-9]{64}$/.test(config.certificateFingerprint??'')) throw new EtaError('ETA_EINVOICE_SIGNER_SETUP_REQUIRED')
  if (document.issuer?.id !== config.rin || document.signatures) throw new EtaError('ETA_EINVOICE_SIGNER_BINDING_INVALID')
  const canonical=serializeEta(document),documentHash=await sha256(canonical)
  let response,result
  try {
   response=await fetcher(url.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${config.signerToken}`,'content-type':'application/json'},body:JSON.stringify({protocol:'shop-eta-cades-bes-v1',document,canonical,documentHash,certificateFingerprint:config.certificateFingerprint})})
   if (!response.ok) throw new Error('provider_failure')
   result=await response.json()
  } catch {throw new EtaError('ETA_EINVOICE_SIGNER_UNAVAILABLE')}
  if (result?.algorithm !== 'CAdES-BES' || result.documentHash !== documentHash || result.certificateFingerprint !== config.certificateFingerprint || typeof result.signature !== 'string' || result.signature.length>100000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.signature)) throw new EtaError('ETA_EINVOICE_SIGNER_EVIDENCE_INVALID')
  if (!await verifyInvoiceCades(result.signature,canonical,config.certificateFingerprint)) throw new EtaError('ETA_EINVOICE_SIGNER_EVIDENCE_INVALID')
  return result.signature
 }
}
export function createInvoiceClient({fetcher = fetch, now = Date.now}) {
 const tokens=new Map(),pending=new Map()
 const key=config=>JSON.stringify([config.shopId,config.rin,config.credentialVersion])
 async function token(config) {
  const id=key(config),cached=tokens.get(id)
  if(cached?.until>now()+60000)return cached.value
  if(pending.has(id))return pending.get(id)
  const work=(async()=>{
   const response=await fetcher('https://id.preprod.eta.gov.eg/connect/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:`Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'InvoicingAPI'})})
   if(!response.ok)throw new EtaError('ETA_EINVOICE_AUTHENTICATION_FAILED')
   const result=await response.json()
   if(typeof result.access_token!=='string' || !Number.isFinite(result.expires_in) || result.expires_in<=60)throw new EtaError('ETA_EINVOICE_AUTHENTICATION_FAILED')
   tokens.set(id,{value:result.access_token,until:now()+result.expires_in*1000});return result.access_token
  })()
  pending.set(id,work);try{return await work}finally{pending.delete(id)}
 }
 async function call(config,path,options={}) {
  const bearer=await token(config)
  const response=await fetcher(`https://api.preprod.invoicing.eta.gov.eg${path}`,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'}})
  if(response.status===401)tokens.delete(key(config))
  return response
 }
 return {token,submit:(config,body)=>call(config,'/api/v1.0/documentsubmissions/',{method:'POST',body}),poll:(config,id)=>call(config,`/api/v1.0/documentsubmissions/${encodeURIComponent(id)}?pageNo=1&pageSize=10`)}
}
function matchedDocument(result,job,submissionId,requireId=true) {
 if(result?.uuid!==submissionId)return null
 return result.documentSummary?.find(item=>validId(item.uuid) && (!requireId || item.uuid===job.document_uuid) && item.internalId===job.source.receiptNumber && item.issuerId===job.source.profile.rin && item.receiverId===job.source.receiver.id && String(item.typeName).toLowerCase()==='i' && String(item.typeVersionName)==='1.0' && Number(item.total)===Number(job.source.tax.total5))??null
}
export function createInvoiceDispatcher({rpc,configuration,client,sign}) {
 return async()=>{
  const job=await rpc('shop_eta_invoice_claim',{})
  if(!job)return {state:'idle'}
  const transition=(state,code=null,submission=null,retry=300)=>rpc('shop_eta_transition',{p_id:job.id,p_lease_id:job.lease_id,p_state:state,p_submission_uuid:submission,p_error_code:code,p_retry_seconds:retry})
  const config=configuration(job.shop_id)
  if(!configured(config,job)){
   await transition(job.state==='submitted'?'submitted':'retry','ETA_EINVOICE_PROVIDER_SETUP_REQUIRED',job.submission_uuid,3600);return {state:'setup_required'}
  }
  if(job.state==='submitted') {
   try {
    const response=await client.poll(config,job.submission_uuid)
    if(!response.ok){await transition('submitted','ETA_STATUS_RETRY',job.submission_uuid,retryDelay(job.attempts,response.headers.get('retry-after')));return {state:'submitted'}}
    const document=matchedDocument(await response.json(),job,job.submission_uuid)
    if(!document){await transition('submitted','ETA_STATUS_EVIDENCE_MISMATCH',job.submission_uuid);return {state:'submitted'}}
    const state={valid:'valid',invalid:'invalid',rejected:'invalid',cancelled:'cancelled'}[document.status]??'submitted'
    await transition(state,state==='invalid'?'ETA_DOCUMENT_INVALID':null,job.submission_uuid);return {state}
   }catch{await transition('submitted','ETA_STATUS_RETRY',job.submission_uuid);return {state:'submitted'}}
  }
  let body=job.payload
  if(job.state==='queued') {
   try {
    const built=await buildEinvoice(job.source,document=>sign(config,document))
    await rpc('shop_eta_invoice_prepare',{p_id:job.id,p_lease_id:job.lease_id,p_payload:built.body,p_certificate_fingerprint:config.certificateFingerprint})
    body=built.body
   }catch(error){
    if(!(error instanceof EtaError))throw error
    const retryable=/SIGNER_SETUP|SIGNER_UNAVAILABLE|PROVIDER_SETUP/.test(error.code)
    await transition(retryable?'retry':'blocked',error.code,null,retryable?3600:300)
    return {state:retryable?'setup_required':'blocked'}
   }
  }
  try{await client.token(config)}catch{await transition('retry','ETA_EINVOICE_AUTHENTICATION_FAILED',null,3600);return {state:'retry'}}
  await transition('submitting')
  try {
   const response=await client.submit(config,body)
   if([401,429].includes(response.status)){await transition('retry',response.status===401?'ETA_EINVOICE_AUTHENTICATION_FAILED':'ETA_RATE_LIMITED',null,retryDelay(job.attempts,response.headers.get('retry-after')));return {state:'retry'}}
   if(response.status>=200 && response.status<300) {
    let result;try{result=await response.json()}catch{/* Ambiguous accepted response must not be retried. */}
    const accepted=result?.acceptedDocuments?.find(document=>document.internalId===job.source.receiptNumber && validId(document.uuid))
    if(validId(result?.submissionId) && accepted) {
     await rpc('shop_eta_invoice_acknowledge',{p_id:job.id,p_lease_id:job.lease_id,p_submission_uuid:result.submissionId,p_document_uuid:accepted.uuid});return {state:'submitted'}
    }
    if(result?.rejectedDocuments?.some(document=>document.internalId===job.source.receiptNumber) && !result.acceptedDocuments?.length){await transition('invalid','ETA_DOCUMENT_REJECTED');return {state:'invalid'}}
   }else if([400,403].includes(response.status)){await transition('invalid','ETA_SUBMISSION_REJECTED');return {state:'invalid'}}
   await transition('uncertain','ETA_SUBMISSION_OUTCOME_UNKNOWN');return {state:'uncertain'}
  }catch{await transition('uncertain','ETA_SUBMISSION_OUTCOME_UNKNOWN');return {state:'uncertain'}}
 }
}
export function createInvoiceReconciler({rpc,configuration,client}) {
 return async(outboxId,submissionId)=>{
  if(!/^[a-f0-9-]{36}$/.test(outboxId) || !validId(submissionId))throw new EtaError('ETA_RECOVERY_REFERENCE_INVALID')
  const job=await rpc('shop_eta_invoice_recovery_context',{p_id:outboxId})
  if(!job)throw new EtaError('ETA_RECOVERY_NOT_REQUIRED')
  const config=configuration(job.shop_id)
  if(!configured(config,job))throw new EtaError('ETA_EINVOICE_PROVIDER_SETUP_REQUIRED')
  const response=await client.poll(config,submissionId)
  if(!response.ok)throw new EtaError('ETA_RECOVERY_EVIDENCE_REQUIRED')
  const document=matchedDocument(await response.json(),job,submissionId,false)
  if(!document)throw new EtaError('ETA_RECOVERY_EVIDENCE_REQUIRED')
  await rpc('shop_eta_invoice_link_recovery',{p_id:outboxId,p_submission_uuid:submissionId,p_document_uuid:document.uuid})
  return {state:'submitted'}
 }
}
