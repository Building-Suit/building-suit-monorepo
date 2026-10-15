import { buildReceipt, EtaError } from './eta-adapter.mjs'
export const retryDelay = (attempt, retryAfter = 0) => Math.min(86400, Math.max(60, Number(retryAfter) || 0, 60 * 2 ** Math.min(attempt, 10)))
// Cache is server-instance scoped and tenant/POS/credential-version isolated.
export function createEtaClient({ fetcher = fetch, now = Date.now }) {
 const tokens = new Map()
 const inflight = new Map()
 async function token(config) {
  const key = `${config.shopId}:${config.deviceSerialNumber}:${config.credentialVersion}`
  const cached = tokens.get(key)
  if (cached && cached.until > now() + 60000) return cached.value
  if (inflight.has(key)) return inflight.get(key)
  const request = (async () => {
   const response = await fetcher('https://id.preprod.eta.gov.eg/connect/token', { method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'content-type':'application/x-www-form-urlencoded',posserial:config.deviceSerialNumber,pososversion:config.osVersion,posmodelframework:config.modelFramework,presharedkey:config.presharedKey},
    body:new URLSearchParams({grant_type:'client_credentials',client_id:config.clientId,client_secret:config.clientSecret}) })
   if (!response.ok) throw new EtaError('ETA_AUTHENTICATION_FAILED')
   const result = await response.json()
   if (typeof result.access_token !== 'string' || !Number.isFinite(result.expires_in) || result.expires_in <= 60) throw new EtaError('ETA_AUTHENTICATION_FAILED')
   tokens.set(key,{value:result.access_token,until:now()+result.expires_in*1000})
   return result.access_token
  })()
  inflight.set(key,request)
  try { return await request } finally { inflight.delete(key) }
 }
 async function call(config, path, options = {}) {
  const bearer = await token(config)
  const response = await fetcher(`https://api.preprod.invoicing.eta.gov.eg${path}`,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'}})
  if (response.status === 401) tokens.delete(`${config.shopId}:${config.deviceSerialNumber}:${config.credentialVersion}`)
  return response
 }
 return {token, submit:(config,body)=>call(config,'/api/v1/receiptsubmissions',{method:'POST',body}),
  poll:(config,id)=>call(config,`/api/v1/receiptsubmissions/${encodeURIComponent(id)}/details?PageNo=1&PageSize=10`) }
}
export function createEtaDispatcher({ rpc, configuration, client }) {
 return async function dispatch() {
  const job = await rpc('shop_eta_claim',{})
  if (!job) return {state:'idle'}
  const change = (state, code = null, submission = null, retry = 60) => rpc('shop_eta_transition',{p_id:job.id,p_lease_id:job.lease_id,p_state:state,p_submission_uuid:submission,p_error_code:code,p_retry_seconds:retry})
  const config = configuration(job.shop_id, job.device_serial)
  // No activation is inferred from saved browser settings. This implementation is
  // deliberately limited to an explicitly configured ETA preproduction provider.
  if (!config || config.environment !== 'preproduction' || config.shopId !== job.shop_id || config.deviceSerialNumber !== job.device_serial || config.rin !== job.source.profile.rin ||
    !['clientId','clientSecret','presharedKey','osVersion','modelFramework','credentialVersion'].every(key=>typeof config[key] === 'string' && config[key].length)) {
   await change(job.state === 'submitted' ? 'submitted' : 'retry','ETA_PROVIDER_SETUP_REQUIRED',job.submission_uuid,3600)
   return {state:'setup_required'}
  }
  if (config.receiptSignatureMode !== 'eta-current-unsigned') {
   await change(job.state === 'submitted' ? 'submitted' : 'retry','ETA_RECEIPT_PROVIDER_CONTRACT_REQUIRED',job.submission_uuid,3600)
   return {state:'setup_required'}
  }
  if (job.state === 'submitted') {
   try {
    const response = await client.poll(config,job.submission_uuid)
    if (!response.ok) { await change('submitted','ETA_STATUS_RETRY',job.submission_uuid,retryDelay(job.attempts,response.headers.get('retry-after'))); return {state:'submitted'} }
    const result = await response.json()
    // One immutable document per batch. Never infer individual validity from an
    // aggregate status, a missing page or a different taxpayer/document.
    const receipt = result.receipts?.find(item=>item.uuid === job.document_uuid)
    if (result.submissionuuid !== job.submission_uuid || result.sellerId !== config.rin || !receipt || receipt.sellerId !== config.rin || receipt.deviceSerialNumber !== job.device_serial) {
     await change('submitted','ETA_STATUS_EVIDENCE_MISMATCH',job.submission_uuid,300); return {state:'submitted'}
    }
    const state = {Valid:'valid',Invalid:'invalid',Cancelled:'cancelled'}[receipt.status] ?? 'submitted'
    await change(state,state === 'invalid' ? 'ETA_DOCUMENT_INVALID' : null,job.submission_uuid,300)
    return {state}
   } catch { await change('submitted','ETA_STATUS_RETRY',job.submission_uuid,300); return {state:'submitted'} }
  }
  let body = job.payload
  if (job.state === 'queued') {
   try {
    const prepared = await buildReceipt(job.source,job.previous_uuid)
    await rpc('shop_eta_prepare',{p_id:job.id,p_lease_id:job.lease_id,p_previous_uuid:job.previous_uuid,p_document_uuid:prepared.uuid,p_payload:prepared.body})
    body = prepared.body
   } catch (error) {
    if (!(error instanceof EtaError)) throw error
    await change('blocked',error.code); return {state:'blocked'}
   }
  }
  // Acquire/reuse token before recording a potentially sent request.
  try { await client.token(config) } catch { await change('retry','ETA_AUTHENTICATION_FAILED',null,3600); return {state:'retry'} }
  await change('submitting')
  // begin transition consumed its lease only for non-POST states.
  try {
   const response = await client.submit(config,body)
   if (response.status === 429 || response.status === 401) {
    await change('retry',response.status === 401 ? 'ETA_AUTHENTICATION_FAILED' : 'ETA_RATE_LIMITED',null,retryDelay(job.attempts,response.headers.get('retry-after')))
    return {state:'retry'}
   }
   if (response.status >= 200 && response.status < 300) {
    let result
    try { result = await response.json() } catch { /* Accepted without durable ID needs operator reconciliation. */ }
    if (result?.submissionUUID && result.acceptedDocuments?.some(item=>item.uuid === job.document_uuid || item.uuid === JSON.parse(body).receipts[0].header.uuid)) {
     await change('submitted',null,result.submissionUUID,300); return {state:'submitted'}
    }
    if (result?.rejectedDocuments?.some(item=>item.uuid === JSON.parse(body).receipts[0].header.uuid) && !result.acceptedDocuments?.length) {
     await change('invalid','ETA_DOCUMENT_REJECTED'); return {state:'invalid'}
    }
   } else if ([400,403].includes(response.status)) {
    await change('invalid','ETA_SUBMISSION_REJECTED'); return {state:'invalid'}
   }
   // 422 duplicate, 5xx or unknown 20x are not permission to send again.
   await change('uncertain','ETA_SUBMISSION_OUTCOME_UNKNOWN'); return {state:'uncertain'}
  } catch { await change('uncertain','ETA_SUBMISSION_OUTCOME_UNKNOWN'); return {state:'uncertain'} }
 }
}

// An operator may supply a submission ID found in ETA after an ambiguous POST.
// The server verifies its document evidence before releasing the blocked POS.
export function createEtaReconciler({rpc,configuration,client}) {
 return async (outboxId,submissionUUID)=>{
  if (!/^[0-9a-f-]{36}$/.test(outboxId) || !/^[A-Za-z0-9_-]{1,100}$/.test(submissionUUID)) throw new EtaError('ETA_RECOVERY_REFERENCE_INVALID')
  const job=await rpc('shop_eta_recovery_context',{p_id:outboxId})
  if (!job) throw new EtaError('ETA_RECOVERY_NOT_REQUIRED')
  const config=configuration(job.shop_id,job.device_serial)
  if (!config || config.environment!=='preproduction' || config.shopId!==job.shop_id || config.deviceSerialNumber!==job.device_serial || config.rin!==job.source.profile.rin) throw new EtaError('ETA_PROVIDER_SETUP_REQUIRED')
  const response=await client.poll(config,submissionUUID)
  if (!response.ok) throw new EtaError('ETA_RECOVERY_EVIDENCE_REQUIRED')
  const result=await response.json()
  const receipt=result.receipts?.find(item=>item.uuid===job.document_uuid)
  if (result.submissionuuid!==submissionUUID || result.sellerId!==config.rin || !receipt || receipt.sellerId!==config.rin || receipt.deviceSerialNumber!==job.device_serial) throw new EtaError('ETA_RECOVERY_EVIDENCE_REQUIRED')
  await rpc('shop_eta_link_recovery',{p_id:outboxId,p_submission_uuid:submissionUUID,p_document_uuid:job.document_uuid})
  return {state:'submitted'}
 }
}
