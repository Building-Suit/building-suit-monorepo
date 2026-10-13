import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { requestSigningInput, signHmac, sha256Hex } from '../../apps/shop-suit/supabase/functions/_shared/super-admin-bridge.mjs'
import { provisionAccount, provisionQuery, resendAccountInvitation } from '../../apps/super-admin-suit/server/utils/account-provisioning.ts'
import { activateAccount } from '../../apps/super-admin-suit/server/utils/account-workflow.ts'

export function assertDisposable(environment) {
  assert.equal(environment.GITHUB_ACTIONS,'true','Requires GitHub Actions')
  assert.equal(environment.RUNNER_ENVIRONMENT,'github-hosted','Self-hosted runners are forbidden')
  assert.equal(environment.ACCOUNT_PROVISION_DISPOSABLE,'1','Requires explicit disposable validation')
}
export function localOrigin(value, product) {
  const url=new URL(value), expected=product==='shop'?'http://127.0.0.1:61321':'http://127.0.0.1:64321'
  assert.equal(url.origin,expected,'Only the isolated product loopback API is allowed')
  assert.equal(url.username+url.password,'','URL credentials are forbidden')
  return url.origin
}
const quote=value=>`'${String(value).replaceAll("'","''")}'`
const json=value=>`${quote(JSON.stringify(value))}::jsonb`
function command(program,args,input) {
  const result=spawnSync(program,args,{input,encoding:'utf8',timeout:180000})
  if(result.status!==0) {
    const safe=(result.stderr||'').split('\n').filter(line=>line.startsWith('ERROR:')).join(' ').replace(/[A-Za-z0-9_-]{40,}/g,'[redacted]').slice(0,400)
    throw new Error(`${program} failed; exit ${result.status}; ${safe}`)
  }
  return result.stdout
}
function sql(product,statement) {
  const container=product==='shop'?'supabase_db_building-suit-shop':'supabase_db_building-suit-super-admin'
  return command('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],statement).trim()
}
async function run() {
  assertDisposable(process.env)
  const status=product=>JSON.parse(command('pnpm',['exec','supabase','--workdir',`apps/${product==='shop'?'shop-suit':'super-admin-suit'}`,'status','-o','json']))
  const shop=status('shop'), sas=status('sas')
  const shopOrigin=localOrigin(shop.API_URL,'shop'), sasOrigin=localOrigin(sas.API_URL,'sas')
  const call=async(origin,key,token,path,body,method='POST')=>{
    const response=await fetch(origin+path,{method,redirect:'error',headers:{apikey:key,authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
    const value=await response.json()
    if(!response.ok)throw Object.assign(new Error(`Local request rejected: ${path.split('?')[0]} HTTP ${response.status} ${typeof value.message==='string'?value.message.replace(/[A-Za-z0-9_-]{40,}/g,'[redacted]').slice(0,160):''}`),{code:typeof value.code==='string'?value.code:undefined})
    return value
  }
  const admin=async(product,path,body,method)=>{const value=await call(product==='shop'?shopOrigin:sasOrigin,product==='shop'?shop.SERVICE_ROLE_KEY:sas.SERVICE_ROLE_KEY,product==='shop'?shop.SERVICE_ROLE_KEY:sas.SERVICE_ROLE_KEY,path,body,method);return value.user??value}
  const rpc=(origin,key,token)=>({rpc:async(name,args)=>{try{return {data:await call(origin,key,token,`/rest/v1/rpc/${name}`,args),error:null}}catch(error){return {data:null,error}}}})
  const worker=rpc(sasOrigin,sas.SERVICE_ROLE_KEY,sas.SERVICE_ROLE_KEY)
  const sourceEmail=`sas-${randomUUID()}@example.invalid`, sourcePassword=`Fixture-${randomUUID()}!`
  const sourceUser=await admin('sas','/auth/v1/admin/users',{email:sourceEmail,password:sourcePassword,email_confirm:true})
  const sourceSession=await call(sasOrigin,sas.ANON_KEY,sas.ANON_KEY,'/auth/v1/token?grant_type=password',{email:sourceEmail,password:sourcePassword})
  await assert.rejects(call(sasOrigin,sas.ANON_KEY,sas.ANON_KEY,'/auth/v1/signup',{email:`outsider-${randomUUID()}@example.test`,password:`Fixture-${randomUUID()}!`}), 'Public SAS signup must remain closed')
  const actor={...rpc(sasOrigin,sas.ANON_KEY,sourceSession.access_token),auth:{getUser:async()=>{try{return {data:{user:await call(sasOrigin,sas.ANON_KEY,sourceSession.access_token,'/auth/v1/user',undefined,'GET')},error:null}}catch(error){return {data:{user:null},error}}}}}
  // Empty disposable projects need explicit synthetic catalog rows; never manufacture app runtime defaults.
  sql('shop',`insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,is_active,is_public,is_purchasable,is_coming_soon,resource_limits)
    select id,'Team fixture','team',699,'EGP','monthly',7,true,true,true,false,'{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb from public.portals where key='shop-crm' on conflict(portal_id,slug) do nothing;
    insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,is_active,is_public,is_purchasable,is_coming_soon,resource_limits)
    select id,'Internal trial fixture','full-product-trial',0,'EGP','monthly',7,true,false,false,false,'{"active_locations":null,"active_members":null,"active_products":null,"active_services":null,"active_customers":null,"active_suppliers":null}'::jsonb from public.portals where key='shop-crm' on conflict(portal_id,slug) do nothing;
    select shop_private.reconcile_plan_catalog();`)
  const ids={source:randomUUID(),target:randomUUID(),binding:randomUUID(),principal:randomUUID(),targetBinding:randomUUID(),suit:randomUUID(),adapter:randomUUID(),provider:randomUUID()}
  const keyId='disposable-account-v1', key=crypto.getRandomValues(new Uint8Array(32)), encoded=Buffer.from(key).toString('base64url')
  const operations=['adapter.capabilities.read','shop.platform.query','shop.plan.query','shop.plan.command','shop.account.query','shop.account.command']
  sql('shop',`insert into public.shop_super_admin_integrations(id,source_binding_id,target_binding_id,target_environment_id,audience,key_id,allowed_operations,max_clock_skew_seconds,nonce_retention_seconds,valid_from,enabled) values(${quote(ids.principal)},${quote(ids.source)},${quote(ids.targetBinding)},${quote(ids.target)},'disposable:accounts',${quote(keyId)},ARRAY[${operations.map(quote).join(',')}],300,3600,now()-interval '1 minute',true);
    insert into public.shop_account_provisioning_settings(id,enabled,invitation_ready,invite_redirect_url,auth_timeout_ms,lease_seconds) values(true,true,true,'https://shop.example/auth/owner-invitation',10000,90);`)
  let handler
  globalThis.Deno={env:{get:name=>({SUPABASE_URL:shopOrigin,SUPABASE_SERVICE_ROLE_KEY:shop.SERVICE_ROLE_KEY,SHOP_SUPER_ADMIN_BRIDGE_KEYS:JSON.stringify({[keyId]:encoded})})[name]},serve:callback=>{handler=callback}}
  await import('../../apps/shop-suit/supabase/functions/shop-super-admin-bridge/index.ts')
  assert.equal(typeof handler,'function')
  const envelope={protocolVersion:'1.0',operation:'adapter.capabilities.read',operationVersion:'1.0',requestId:randomUUID(),correlationId:randomUUID(),sourceBindingId:ids.source,targetBindingId:ids.targetBinding,targetEnvironmentId:ids.target,actor:{authorityBindingId:ids.source,subjectId:sourceUser.id,roleSnapshot:'owner',sessionId:null},reason:null,payload:{}}
  const body=JSON.stringify(envelope), digest=await sha256Hex(new TextEncoder().encode(body)), nonce=randomUUID(), timestamp=Math.floor(Date.now()/1000)
  const fields={...envelope,keyId,nonce,timestamp,bodyDigest:digest,audience:'disposable:accounts'}
  const signature=await signHmac(key,requestSigningInput(fields))
  const manifestResponse=await handler(new Request('https://shop-target.example/functions/v1/shop-super-admin-bridge/v1/invoke',{method:'POST',body,headers:{'content-type':'application/json','x-bs-algorithm':'BS-S2S-HMAC-SHA256','x-bs-protocol-version':'1.0','x-bs-key-id':keyId,'x-bs-timestamp':String(timestamp),'x-bs-nonce':nonce,'x-bs-request-id':envelope.requestId,'x-bs-correlation-id':envelope.correlationId,'x-bs-source-binding-id':ids.source,'x-bs-target-binding-id':ids.targetBinding,'x-bs-target-environment-id':ids.target,'x-bs-audience':'disposable:accounts','x-bs-body-sha256':digest,'x-bs-signature':signature}}))
  assert.equal(manifestResponse.status,200,'Signed manifest discovery')
  const manifest=(await manifestResponse.json()).data
  assert.ok(manifest.capabilities.some(item=>item.operation==='shop.account.command'))
  const vault=sql('sas',`select vault.create_secret(${quote(encoded)});`).split('\n').at(-1)
  sql('sas',`insert into public.admin_environments(id,stable_key,environment_kind,display_name,status) values(${quote(ids.source)},'disposable-source','local','{"en":"Disposable source"}','active'),(${quote(ids.target)},'disposable-target','local','{"en":"Disposable target"}','active');
    insert into public.platform_admins(user_id,authority_environment_id,provisioned_by) values(${quote(sourceUser.id)},${quote(ids.source)},${quote(sourceUser.id)});
    insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status) values(${quote(ids.suit)},'disposable-shop','{"en":"Disposable Shop"}','fixture','1.0','active');
    insert into public.suit_environment_bindings(id,suit_id,admin_environment_id,target_environment_id,adapter_base_url,audience,target_identity_fingerprint,egress_policy,status) values(${quote(ids.binding)},${quote(ids.suit)},${quote(ids.source)},${quote(ids.target)},'https://shop-target.example','disposable:accounts','disposable-target-fingerprint','{"allowedHosts":["shop-target.example"]}','active');
    insert into public.adapter_registrations(id,binding_id,adapter_key,protocol_min_version,protocol_max_version,manifest_schema_version,manifest_max_age_seconds,status) values(${quote(ids.adapter)},${quote(ids.binding)},'disposable-shop','1.0','1.0','1.0',3600,'active');
    insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version,status) values(${quote(ids.provider)},'disposable-signer','{"en":"Disposable signer"}','adapter-signer','1.0','active');
    insert into public.integration_secret_references(provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from,status) values(${quote(ids.provider)},${quote(ids.binding)},'adapter-signing',${quote(keyId)},1,${quote(vault)},now()-interval '1 minute','active');
    insert into public.integration_settings(provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,status) values(${quote(ids.provider)},${quote(ids.binding)},'adapter-dispatch-policy','object',${json({targetBindingId:ids.targetBinding,timeoutMs:30000,maxResponseBytes:1048576})},'1.0',now()-interval '1 minute','active');
    insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at) values(${quote(ids.binding)},${quote(manifest.manifestRevision)},${quote(manifest.manifestDigest)},ARRAY['1.0'],${json(manifest.capabilities)},'verified',now()+interval '1 hour');
    insert into public.navigation_items(suit_id,stable_key,label,module_kind,route_descriptor,required_capability_key,required_capability_version,visibility_policy,enabled) values(${quote(ids.suit)},'accounts','{"en":"Accounts"}','accounts','{}','shop.plan.command','1.0','{"role":"owner"}',true);`)
  for(const operation of operations)sql('sas',`insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,query_scopes,command_scopes,enabled) values(${quote(ids.adapter)},${quote(operation)},'1.0','1.0',${operation.endsWith('.command')?'ARRAY[]::text[]':`ARRAY[${quote(operation)}]`},${operation.endsWith('.command')?`ARRAY[${quote(operation)}]`:'ARRAY[]::text[]'},true);`)
  const send=async attempt=>{
    assert.equal(new URL(attempt.url).origin,'https://shop-target.example','Fixture transport must use only the configured signed target')
    const response=await handler(new Request(attempt.url,{method:'POST',headers:attempt.headers,body:attempt.body}))
    const responseBody=await response.text()
    if(response.status>=400){
      const code=JSON.parse(responseBody)?.error?.code
      if(typeof code==='string'&&/^[a-z0-9_]+$/.test(code))console.error(`Disposable target rejection: ${code}`)
    }
    return {status:response.status,headers:Object.fromEntries(response.headers),body:responseBody}
  }
  const catalog=await provisionQuery(actor,worker,{bindingId:ids.binding},send)
  assert.equal(catalog.state,'success','Real signed catalog query')
  const selected=catalog.data.plans.find(plan=>plan.name.toLowerCase().includes('team'))??catalog.data.plans[0]
  assert.ok(selected)
  const baseline=sql('shop',`select (select count(*) from public.shop_billing_submissions)||':'||(select count(*) from public.platform_billing_events);`)
  const input={bindingId:ids.binding,email:`owner-${randomUUID()}@example.invalid`,displayName:'Disposable owner',shopName:'Disposable provisioned shop',mainLocationName:'Main fixture',businessMode:catalog.data.businessModes[0],planId:selected.id,catalogTermsId:selected.catalogTermsId,requestId:randomUUID(),correlationId:randomUUID(),reason:'Disposable admin provisioning validation'}
  const created=await provisionAccount(actor,worker,input,send)
  assert.equal(created.state,'success','Real signed account creation')
  assert.equal(created.data.phase,'active','Real domain activation')
  assert.equal(created.data.ownerVerified,false,'Creation must not auto-confirm the owner email')
  assert.equal(created.data.invitationState,'sent','Local Auth invitation accepted')
  const same=await provisionAccount(actor,worker,input,send)
  assert.equal(same.state,'success');assert.equal(same.replayed,true)
  assert.deepEqual(same.data,created.data,'Exact completed replay is frozen')
  const userId=sql('shop',`select auth_user_id from public.shop_account_provisions where id=${quote(created.data.provisioningId)};`)
  const user=await admin('shop',`/auth/v1/admin/users/${userId}`,undefined,'GET')
  assert.equal(Boolean(user.email_confirmed_at),false,'Unclaimed identity remains unconfirmed')
  assert.equal(sql('shop',`select email_confirmed_at is null from auth.users where id=${quote(userId)};`),'t','Provider-owned confirmation state remains null')
  assert.equal(sql('shop',`select count(*) from public.shop_account_provisions where email=${quote(input.email)};`),'1','One reserved identity')
  assert.equal(sql('shop',`select count(*) from public.shop_account_provision_events where action='account_activated' and job_id=${quote(created.data.provisioningId)};`),'1','One activation event')
  assert.equal(sql('shop',`select (select count(*) from public.shop_billing_submissions)||':'||(select count(*) from public.platform_billing_events);`),baseline,'No payment or receipt fabrication')
  await assert.rejects(provisionAccount(actor,worker,{...input,reason:'Different input under the same request id'},send), /Adapter request unavailable/, 'Changed-input replay must be rejected by the source ledger')
  const lostInput={...input,email:`lost-${randomUUID()}@example.invalid`,shopName:'Lost response fixture',requestId:randomUUID(),correlationId:randomUUID()}
  const unknownFirst=await provisionAccount(actor,worker,lostInput,async attempt=>{await send(attempt);throw new Error('Lost reply')})
  assert.equal(unknownFirst.state,'outcome_unknown','A lost response is never reported as success')
  const recovered=await provisionAccount(actor,worker,lostInput,send)
  assert.equal(recovered.state,'success');assert.equal(recovered.replayed,true)
  assert.equal(sql('sas',`select count(*) from public.adapter_dispatches where request_id=${quote(lostInput.requestId)};`),'1','One logical source dispatch after lost-response retry')
  const conflict=await provisionAccount(actor,worker,{...input,requestId:randomUUID(),correlationId:randomUUID()},send)
  assert.notEqual(conflict.state,'success','New request cannot duplicate a reserved email')
  const overwrite=await activateAccount(actor,worker,{bindingId:ids.binding,shopId:created.data.shopId,subscriptionId:created.data.subscriptionId,planId:input.planId,requestId:randomUUID(),correlationId:randomUUID(),reason:'Attempt overwrite active account'},send)
  assert.equal(overwrite.state,'target_rejected','A valid existing active period cannot be overwritten')
  const externalEmail=`existing-${randomUUID()}@example.invalid`
  const external=await admin('shop','/auth/v1/admin/users',{email:externalEmail,password:`Fixture-${randomUUID()}!`,email_confirm:true})
  const prior=await admin('shop',`/auth/v1/admin/users/${external.id}`,undefined,'GET')
  const exists=await provisionAccount(actor,worker,{...input,email:externalEmail,requestId:randomUUID(),correlationId:randomUUID()},send)
  assert.equal(exists.state,'success');assert.equal(exists.data.phase,'conflict','A provider-existing email is not linked to a new tenant')
  const afterExternal=await admin('shop',`/auth/v1/admin/users/${external.id}`,undefined,'GET')
  assert.deepEqual(afterExternal.app_metadata,prior.app_metadata,'Existing account ownership/metadata remains intact')
  await assert.rejects(call(shopOrigin,shop.ANON_KEY,shop.ANON_KEY,'/rest/v1/rpc/shop_super_admin_account_begin',{p_principal_id:ids.principal,p_nonce:randomUUID(),p_body_digest:'a'.repeat(64),p_envelope:envelope}),'Anonymous target entry denied')
  // SQL regression fixtures cover day-1/day-6, tenant mismatch, direct authorization and immutable audit.
  for(const suite of ['shop_trial_admin_activation','shop_super_admin_bridge']){
    const text=await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`,import.meta.url),'utf8')
    sql('shop',`BEGIN;\n${text}\nROLLBACK;`)
  }
  command('pnpm',['exec','supabase','--workdir','apps/super-admin-suit','test','db','--local'])
  const mailbox=new URL(shop.INBUCKET_URL)
  assert.equal(mailbox.origin,'http://127.0.0.1:61324','Only the disposable local mailbox is allowed')
  let tokenHash
  for(let index=0;index<20&&!tokenHash;index++){
    const messages=await (await fetch(mailbox.origin+'/api/v1/messages')).json()
    const message=messages.messages?.find(item=>item.To?.some(to=>to.Address===input.email))
    if(message){const detail=await (await fetch(mailbox.origin+'/api/v1/message/'+message.ID)).json();tokenHash=detail.HTML?.match(/token_hash=([0-9a-f]{64})/i)?.[1]}
    if(!tokenHash)await new Promise(resolve=>setTimeout(resolve,250))
  }
  assert.ok(tokenHash,'Owner invitation must contain a real one-time token hash')
  const ownerSession=await call(shopOrigin,shop.ANON_KEY,shop.ANON_KEY,'/auth/v1/verify',{token_hash:tokenHash,type:'invite'})
  const ownerClaim=await call(shopOrigin,shop.ANON_KEY,ownerSession.access_token,'/rest/v1/rpc/shop_admin_provisioned_owner_claim',{})
  assert.equal(ownerClaim.shopId,created.data.shopId,'Verified owner claims only their provisioned tenant')
  await call(shopOrigin,shop.ANON_KEY,ownerSession.access_token,'/auth/v1/user',{password:`Owner-${randomUUID()}!`},'PUT')
  const verified=await provisionQuery(actor,worker,{bindingId:ids.binding,provisioningId:created.data.provisioningId},send)
  assert.equal(verified.state,'success');assert.equal(verified.data.ownerVerified,true)
  const resend=await resendAccountInvitation(actor,worker,{bindingId:ids.binding,provisioningId:created.data.provisioningId,requestId:randomUUID(),correlationId:randomUUID(),reason:'Review already claimed owner invitation',acknowledgeUncertainSend:true},send)
  assert.equal(resend.state,'success');assert.equal(resend.data.invitationState,'claimed','Verified owners receive no duplicate invitation')
  console.log('Disposable SQL, real SAS signing/verification, target handler/Auth, immediate grant, local invitation and verified owner claim passed.')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv[2]==='--startup-errors') {
    assertDisposable(process.env)
    const content=await readFile(process.argv[3],'utf8')
    const errors=content.split('\n').filter(line=>/ERROR:|failed to|SQLSTATE/i.test(line)).slice(-10)
      .map(line=>line.replace(/[A-Za-z0-9_-]{40,}/g,'[redacted]').slice(0,500))
    console.error(errors.join('\n')||'Disposable backend startup failed; no safe error line available')
  } else run().catch(error=>{console.error(error.message);process.exitCode=1})
}
