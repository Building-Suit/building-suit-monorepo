// Doctor-owned implementation of docs/architecture/super-admin-trust-adapter-contract.md.
// No Shop imports, target bindings, keys, policy values or live approvals are supplied.
export const doctorAdministrationPath='/functions/v1/doctor-super-admin-bridge/v1/invoke'
const version='1.0',requestAlgorithm='BS-S2S-HMAC-SHA256',responseAlgorithm='BS-S2S-RESPONSE-HMAC-SHA256'
const operations=['adapter.capabilities.read','doctor.account.query','doctor.plan.query']
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|')
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\r\n\0]/.test(value)
const positive=value=>Number.isSafeInteger(value)&&value>0
export class DoctorAdministrationError extends Error{constructor(code,status=403){super(code);this.code=code;this.status=status}}
function deny(code='DOCTOR_ADMIN_UNAVAILABLE',status=503){throw new DoctorAdministrationError(code,status)}
export async function doctorAdministrationDigest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('')}
function signing(fields,response=false){return(response?
 [responseAlgorithm,version,fields.keyId,fields.requestId,fields.correlationId,fields.sourceBindingId,fields.targetBindingId,fields.targetEnvironmentId,fields.audience,String(fields.status),fields.requestDigest,fields.responseDigest]:
 [requestAlgorithm,version,fields.keyId,String(fields.timestamp),fields.nonce,fields.requestId,fields.correlationId,fields.sourceBindingId,fields.targetBindingId,fields.targetEnvironmentId,fields.audience,'POST',doctorAdministrationPath,fields.bodyDigest]).join('\n')}
export function doctorAdministrationSigningInput(fields){return signing(fields)}
function encode(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function decode(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))deny('DOCTOR_ADMIN_SIGNATURE_INVALID',401);try{return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='),char=>char.charCodeAt(0))}catch{deny('DOCTOR_ADMIN_SIGNATURE_INVALID',401)}}
async function key(bytes){if(!(bytes instanceof Uint8Array)||bytes.length<32)deny();return crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
/** This signs protocol bytes in isolated tests/server adapters only; never expose a signing oracle. */
export async function doctorAdministrationSignature(bytes,input){return encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(bytes),new TextEncoder().encode(input))))}
function configuration(binding,now){
 if(!record(binding)||binding.suit!=='doctor-suit'||binding.mode!=='synthetic_candidate'||binding.protocolVersion!==version||binding.enabled!==true
  ||!['sourceBindingId','authorityBindingId','targetBindingId','sourceEnvironmentId','targetEnvironmentId'].every(field=>uuid(binding[field]))
  ||binding.sourceEnvironmentId===binding.targetEnvironmentId||!text(binding.audience,200)||!text(binding.keyId,160)
  ||!text(binding.signingReference,200)||!text(binding.livePolicyEvidence,200)||!text(binding.operatorApprovalEvidence,200)
  ||!Number.isFinite(Date.parse(binding.keyValidFrom))||!Number.isFinite(Date.parse(binding.keyValidUntil))||Date.parse(binding.keyValidFrom)>now||Date.parse(binding.keyValidUntil)<=now
  ||!positive(binding.clockSkewSeconds)||!positive(binding.nonceRetentionSeconds)||binding.nonceRetentionSeconds<binding.clockSkewSeconds*2
  ||!positive(binding.maximumBodyBytes)||!record(binding.manifest)||binding.manifest.verified!==true
  ||!positive(binding.manifest.revision)||!/^[0-9a-f]{64}$/.test(binding.manifest.digest)||!Number.isFinite(Date.parse(binding.manifest.expiresAt))||Date.parse(binding.manifest.expiresAt)<=now
  ||!Array.isArray(binding.capabilities)||!binding.capabilities.length||binding.capabilities.some(value=>!operations.includes(value))
  ||new Set(binding.capabilities).size!==binding.capabilities.length||!Array.isArray(binding.operators)
  ||!Array.isArray(binding.manifest.capabilities)||binding.capabilities.some(value=>!binding.manifest.capabilities.includes(value)))deny()
 // This contract deliberately supports only synthetic reads. A live mode or
 // command requires a separately reviewed implementation and target policy.
 return binding
}
function headers(pairs){
 if(!Array.isArray(pairs))deny('DOCTOR_ADMIN_HEADERS_INVALID',400)
 const result=new Map()
 for(const pair of pairs){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||typeof pair[1]!=='string')deny('DOCTOR_ADMIN_HEADERS_INVALID',400)
  const name=pair[0].toLowerCase();if(result.has(name))deny('DOCTOR_ADMIN_HEADERS_INVALID',400);result.set(name,pair[1])}
 const names={algorithm:'x-bs-algorithm',protocolVersion:'x-bs-protocol-version',keyId:'x-bs-key-id',timestamp:'x-bs-timestamp',nonce:'x-bs-nonce',requestId:'x-bs-request-id',correlationId:'x-bs-correlation-id',sourceBindingId:'x-bs-source-binding-id',targetBindingId:'x-bs-target-binding-id',targetEnvironmentId:'x-bs-target-environment-id',audience:'x-bs-audience',bodyDigest:'x-bs-body-sha256',signature:'x-bs-signature'}
 const values=Object.fromEntries(Object.entries(names).map(([field,name])=>[field,result.get(name)]))
 if(result.get('content-type')!=='application/json'||values.algorithm!==requestAlgorithm||values.protocolVersion!==version
  ||!['nonce','requestId','correlationId','sourceBindingId','targetBindingId','targetEnvironmentId'].every(field=>uuid(values[field]))
  ||!text(values.keyId,160)||!text(values.audience,200)||!/^\d{1,12}$/.test(values.timestamp)||!/^[0-9a-f]{64}$/.test(values.bodyDigest))deny('DOCTOR_ADMIN_HEADERS_INVALID',400)
 return{...values,timestamp:Number(values.timestamp)}
}
function envelopeIdentity(bytes,wire){
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{deny('DOCTOR_ADMIN_BODY_INVALID',400)}
 // Before consuming a nonce, bind the parsed request and external actor IDs to
 // the authenticated wire identity. Closed schemas/capabilities are checked later.
 if(!record(body)||!record(body.actor)||!['requestId','correlationId','sourceBindingId','targetBindingId','targetEnvironmentId'].every(field=>body[field]===wire[field])
  ||!uuid(body.actor.authorityBindingId)||!uuid(body.actor.subjectId))deny('DOCTOR_ADMIN_BODY_INVALID',400)
 return body
}
function operationEnvelope(body){
 if(!exact(body,['protocolVersion','operation','operationVersion','requestId','correlationId','sourceBindingId','targetBindingId','targetEnvironmentId','actor','reason','payload'])
  ||!exact(body.actor,['authorityBindingId','subjectId','roleSnapshot','sessionId'])||body.protocolVersion!==version||body.operationVersion!==version
  ||!text(body.actor.roleSnapshot,160)||(body.actor.sessionId!==null&&!uuid(body.actor.sessionId))||body.reason!==null||!record(body.payload))deny('DOCTOR_ADMIN_BODY_INVALID',400)
 if(!operations.includes(body.operation))deny('DOCTOR_ADMIN_CAPABILITY_UNAVAILABLE',403)
 if(body.operation==='adapter.capabilities.read'?!exact(body.payload,[]):!exact(body.payload,['subscriberUserId'])||!uuid(body.payload.subscriberUserId))deny('DOCTOR_ADMIN_BODY_INVALID',400)
}
function auditOperation(value){return typeof value==='string'&&value.length<=160&&/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(value)?value:'invalid_operation'}
function subjectProjection(value,subscriber,operation){
 if(!exact(value,['subscriberUserId','practiceId','authVerified','storedOwner','state','subscriptionRevision'])
  ||value.subscriberUserId!==subscriber||!uuid(value.practiceId)||value.authVerified!==true||value.storedOwner!==true
  ||!['unconfigured','trial','scheduled','expired','suspended'].includes(value.state)||!Number.isSafeInteger(value.subscriptionRevision)||value.subscriptionRevision<0)deny('DOCTOR_ADMIN_TARGET_DENIED',403)
 return{...value,operation,paymentConfirmed:false,operatorGrantAvailable:false,liveActivation:false}
}
/** Load binding/key/nonce/read/audit adapters exclusively from target server configuration.
 * Missing adapters return unavailable; no browser values can provide them. */
async function dispatchDoctorAdministration(request,dependencies){
 const now=dependencies.now?.()??Date.now()
 if(!Number.isFinite(now)||typeof dependencies.loadBinding!=='function')deny()
 const binding=configuration(await dependencies.loadBinding(),now),bindingSnapshot=JSON.stringify(binding)
 if(request.method!=='POST'||request.path!==doctorAdministrationPath||!(request.bytes instanceof Uint8Array)||request.bytes.byteLength>binding.maximumBodyBytes)deny('DOCTOR_ADMIN_REQUEST_INVALID',400)
 for(const name of['readVerificationKey','consumeNonce','readTargetSubject','appendAudit'])if(typeof dependencies[name]!=='function')deny()
 const wire=headers(request.headers)
 if(wire.keyId!==binding.keyId||wire.sourceBindingId!==binding.sourceBindingId||wire.targetBindingId!==binding.targetBindingId
  ||wire.targetEnvironmentId!==binding.targetEnvironmentId||wire.audience!==binding.audience||Math.abs(now/1000-wire.timestamp)>binding.clockSkewSeconds
  ||wire.timestamp*1000<Date.parse(binding.keyValidFrom)||wire.timestamp*1000>=Date.parse(binding.keyValidUntil))deny('DOCTOR_ADMIN_BINDING_DENIED',403)
 if(await doctorAdministrationDigest(request.bytes)!==wire.bodyDigest)deny('DOCTOR_ADMIN_DIGEST_INVALID',401)
 const verificationKey=await dependencies.readVerificationKey(binding.signingReference)
 if(!await crypto.subtle.verify('HMAC',await key(verificationKey),decode(wire.signature),new TextEncoder().encode(signing(wire))))deny('DOCTOR_ADMIN_SIGNATURE_INVALID',401)
 const body=envelopeIdentity(request.bytes,wire)
 const auditContext={sourceBindingId:binding.sourceBindingId,targetBindingId:binding.targetBindingId,targetEnvironmentId:binding.targetEnvironmentId,authorityBindingId:body.actor.authorityBindingId,subjectId:body.actor.subjectId,roleSnapshot:text(body.actor.roleSnapshot,160)?body.actor.roleSnapshot:'invalid_role_snapshot',keyId:binding.keyId,nonce:wire.nonce,requestId:wire.requestId,correlationId:wire.correlationId,operation:auditOperation(body.operation),requestDigest:wire.bodyDigest,manifestDigest:binding.manifest.digest}
 const complete=async(data,error,outcome,status=error?403:200)=>{
  const response={protocolVersion:version,requestId:wire.requestId,correlationId:wire.correlationId,targetBindingId:binding.targetBindingId,operation:auditOperation(body.operation),operationVersion:version,requestDigest:wire.bodyDigest,...(error?{error:{code:error}}:{data})}
  const bytes=new TextEncoder().encode(JSON.stringify(response)),responseDigest=await doctorAdministrationDigest(bytes)
  if(outcome){const audit=await dependencies.appendAudit({...auditContext,responseDigest,outcome});if(!uuid(audit))deny()}
  const signature=await doctorAdministrationSignature(verificationKey,signing({...wire,status,requestDigest:wire.bodyDigest,responseDigest},true))
  return{status,bytes,headers:{'content-type':'application/json','x-bs-algorithm':responseAlgorithm,'x-bs-protocol-version':version,'x-bs-key-id':binding.keyId,'x-bs-body-sha256':responseDigest,'x-bs-signature':signature}}
 }
 // This callback MUST commit a unique source/key/nonce receipt independently
 // before returning true. Failed domain reads do not roll it back.
 const consumed=await dependencies.consumeNonce({sourceBindingId:binding.sourceBindingId,keyId:binding.keyId,nonce:wire.nonce,requestId:wire.requestId,expiresAt:new Date(now+binding.nonceRetentionSeconds*1000).toISOString()})
 if(typeof consumed!=='boolean')deny()
 try{const freshNow=dependencies.now?.()??Date.now(),fresh=configuration(await dependencies.loadBinding(),freshNow)
  if(!Number.isFinite(freshNow)||JSON.stringify(fresh)!==bindingSnapshot||Math.abs(freshNow/1000-wire.timestamp)>fresh.clockSkewSeconds)deny()
 }catch{if(consumed)await dependencies.appendAudit({...auditContext,responseDigest:null,outcome:'operator_denied'});deny()}
 if(!consumed)return complete(null,'DOCTOR_ADMIN_REPLAY_DENIED',null,409)

 try{operationEnvelope(body)}catch(error){return complete(null,error instanceof DoctorAdministrationError?error.code:'DOCTOR_ADMIN_BODY_INVALID','schema_denied')}
 const operator=binding.operators.find(value=>record(value)&&value.authorityBindingId===body.actor.authorityBindingId&&value.subjectId===body.actor.subjectId)
 if(body.actor.authorityBindingId!==binding.authorityBindingId||!binding.capabilities.includes(body.operation)
  ||!operator||!Array.isArray(operator.capabilities)||!operator.capabilities.includes(body.operation))return complete(null,'DOCTOR_ADMIN_OPERATOR_DENIED','operator_denied')
 let data
 try{data=body.operation==='adapter.capabilities.read'?{suit:'doctor-suit',protocolVersion:version,manifestRevision:binding.manifest.revision,manifestDigest:binding.manifest.digest,operations:binding.capabilities,mode:'synthetic_candidate',operatorGrantAvailable:false,paymentConfirmed:false,liveActivation:false}:
 subjectProjection(await dependencies.readTargetSubject(body.payload.subscriberUserId,body.operation),body.payload.subscriberUserId,body.operation)
 }catch{return complete(null,'DOCTOR_ADMIN_TARGET_DENIED','target_denied')}
 return complete(data,null,'synthetic_read')
}

export async function handleDoctorAdministration(request,dependencies={}){
 try{return await dispatchDoctorAdministration(request,dependencies)}catch(error){if(error instanceof DoctorAdministrationError)throw error;deny()}
}
