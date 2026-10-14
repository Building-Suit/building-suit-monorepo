import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { processAccountProvisioning, accountAuthAdmin } from '../../supabase/functions/_shared/account-provisioning.mjs'
import { claimProvisionedOwner } from '../../app/utils/owner-invitation.ts'

function fixture(options={}) {
  const row={done:false,commandId:randomUUID(),leaseToken:randomUUID(),jobId:randomUUID(),userId:randomUUID(),email:'new@example.invalid',displayName:'New owner',phase:'reserved',invitationState:'pending',inviteRedirectUrl:'https://shop.example/auth/owner-invitation',authTimeoutMs:1000}
  let user=options.user??null, invitation='pending'
  const calls=[]
  const result=()=>({data:{phase:'active',invitationState:invitation},targetAuditId:randomUUID(),targetResultVersion:1})
  const rpc=async(name,args)=>{
    calls.push({name,args})
    if(name==='shop_super_admin_account_begin')return {...row,invitationState:invitation}
    if(args.p_step==='auth_conflict')return {result:{data:{phase:'conflict',invitationState:'pending'}}}
    if(args.p_step==='domain')return {result:options.domainResult??result()}
    if(args.p_step==='invite_start'){
      if(user?.email_confirmed_at){invitation='claimed';return {sendAllowed:false,result:result()}}
      if(invitation==='pending'){invitation='sending';return {sendAllowed:true,result:result()}}
      return {sendAllowed:false,result:result()}
    }
    if(args.p_step==='invite_finish'){invitation=options.unknownInvite?'unknown':'sent';return {result:result()}}
    return {result:result()}
  }
  const auth={
    getUserById:async(id)=>{calls.push({name:'get',id});return user},
    createUser:async(attrs)=>{
      calls.push({name:'create',attrs})
      if(options.existingEmail)throw Object.assign(new Error('private provider response'),{code:'email_exists'})
      user={id:attrs.id,email:attrs.email,app_metadata:attrs.app_metadata}
      if(options.lostCreate)throw new Error('lost create response')
      return user
    },
    inviteUserByEmail:async(email,redirect)=>{
      calls.push({name:'invite',email,redirect})
      if(options.unknownInvite)throw new Error('SMTP outcome unknown')
      return user
    },
  }
  const run=()=>processAccountProvisioning({rpc,auth,principalId:randomUUID(),nonce:randomUUID(),bodyDigest:'a'.repeat(64),envelope:{}})
  return {row,calls,run,setUser:input=>{user=input}}
}

test('reserved ID creates an unconfirmed passwordless identity before domain and invitation',async()=>{
  const f=fixture();const result=await f.run()
  const attrs=f.calls.find(call=>call.name==='create').attrs
  assert.equal(attrs.id,f.row.userId);assert.equal(attrs.email_confirm,false)
  assert.equal(attrs.app_metadata.bs_admin_provisioning_id,f.row.jobId)
  assert.equal('password' in attrs,false);assert.equal('role' in attrs,false)
  assert.equal(result.data.invitationState,'sent')
  assert.ok(f.calls.findIndex(call=>call.args?.p_step==='domain')<f.calls.findIndex(call=>call.name==='invite'))
})
test('lost Auth create reply reconciles its reserved ID rather than creating or linking another user',async()=>{
  const f=fixture({lostCreate:true});await f.run()
  assert.equal(f.calls.filter(call=>call.name==='create').length,1)
  assert.equal(f.calls.filter(call=>call.name==='invite').length,1)
  assert.ok(f.calls.filter(call=>call.name==='get').every(call=>call.id===f.row.userId))
})
test('pre-existing email is a conflict with zero domain mutation/invitation/account linking',async()=>{
  const f=fixture({existingEmail:true});assert.equal((await f.run()).data.phase,'conflict')
  assert.equal(f.calls.some(call=>call.args?.p_step==='domain'),false)
  assert.equal(f.calls.some(call=>call.name==='invite'),false)
})
test('client-editable metadata cannot prove ownership of a reserved identity',async()=>{
  const f=fixture();f.setUser({id:f.row.userId,email:f.row.email,user_metadata:{bs_admin_provisioning_id:f.row.jobId},app_metadata:{}})
  await f.run()
  assert.equal(f.calls.some(call=>call.args?.p_step==='domain'),false)
  assert.equal(f.calls.some(call=>call.name==='invite'),false)
  assert.equal(f.calls.at(-1).args.p_details.code,'auth_ownership_mismatch')
})
test('domain review failure retains the Auth identity and sends no premature invite',async()=>{
  const f=fixture({domainResult:{data:{phase:'review_required'}}});await f.run();await f.run()
  assert.equal(f.calls.filter(call=>call.name==='create').length,1)
  assert.equal(f.calls.some(call=>call.name==='invite'),false)
})
test('uncertain invitation never gets automatically sent twice on exact request replay',async()=>{
  const f=fixture({unknownInvite:true});assert.equal((await f.run()).data.invitationState,'unknown')
  await f.run()
  assert.equal(f.calls.filter(call=>call.name==='create').length,1)
  assert.equal(f.calls.filter(call=>call.name==='invite').length,1)
})
test('verified reserved owner needs no further invitation',async()=>{
  const f=fixture();f.setUser({id:f.row.userId,email:f.row.email,app_metadata:{bs_admin_provisioning_id:f.row.jobId},email_confirmed_at:'2026-10-13T08:00:00Z'})
  assert.equal((await f.run()).data.invitationState,'claimed')
  assert.equal(f.calls.some(call=>call.name==='invite'),false)
})
test('frozen completed request never invokes Auth or domain steps again',async()=>{
  let calls=0
  const expected={data:{phase:'active',invitationState:'sent'},replayed:true}
  assert.deepEqual(await processAccountProvisioning({rpc:async()=>({done:true,result:expected}),auth:{getUserById:()=>{calls++}},envelope:{}}),expected)
  assert.equal(calls,0)
})
test('target Auth wrapper pins the configured provider and never follows redirects or accepts a client password',async()=>{
  const calls=[]
  const auth=accountAuthAdmin({supabaseUrl:'https://project.example',serviceRoleKey:'synthetic-only',fetchImpl:async(url,options)=>{
    calls.push({url:String(url),options});return new Response(JSON.stringify({id:'fixture'}),{status:200})
  }})
  await auth.createUser({id:'reserved',email:'new@example.invalid',email_confirm:false},1000)
  await auth.inviteUserByEmail('new@example.invalid','https://shop.example/auth/owner-invitation',1000)
  assert.ok(calls.every(call=>call.url.startsWith('https://project.example/auth/v1/')))
  assert.ok(calls.every(call=>call.options.redirect==='error'))
  assert.equal(calls[0].options.headers.authorization,'Bearer synthetic-only')
  assert.throws(()=>auth.inviteUserByEmail('new@example.invalid','http://attacker.example/auth/owner-invitation',1000))
  assert.equal(calls.length,2)
  assert.throws(()=>accountAuthAdmin({supabaseUrl:'https://person:password@project.example',serviceRoleKey:'synthetic-only'}))
})
test('REST email_exists errors become safe conflicts without exposing provider messages',async()=>{
  const auth=accountAuthAdmin({supabaseUrl:'https://project.example',serviceRoleKey:'synthetic-only',fetchImpl:async()=>new Response(JSON.stringify({error_code:'email_exists',msg:'private detail'}),{status:422})})
  await assert.rejects(auth.createUser({},1000),error=>error.code==='email_exists'&&error.message==='auth_request_failed')
})
test('owner claim consumes only invite OTP, validates live identity and delegates membership authorization to SQL',async()=>{
  const calls=[]
  const client={auth:{verifyOtp:async input=>{calls.push(input);return {data:{user:{id:'owner'}},error:null}},getUser:async()=>({data:{user:{id:'owner'}},error:null})},rpc:async name=>{calls.push(name);return {data:{shopId:'owned-shop'},error:null}}}
  assert.equal((await claimProvisionedOwner(client,'a'.repeat(56))).shopId,'owned-shop')
  assert.deepEqual(calls,[{token_hash:'a'.repeat(56),type:'invite'},'shop_admin_provisioned_owner_claim'])
})
test('invalid, cross-user and metadata-only owner claims cannot reach authorized ownership',async()=>{
  let queries=0
  const client={auth:{verifyOtp:async()=>({data:{user:{id:'invited'}},error:null}),getUser:async()=>({data:{user:{id:'other'}},error:null})},rpc:async()=>{queries++;return {data:null,error:{code:'42501'}}}}
  await assert.rejects(claimProvisionedOwner(client,'invalid'))
  await assert.rejects(claimProvisionedOwner(client,'a'.repeat(56)))
  assert.equal(queries,0)
  await assert.rejects(claimProvisionedOwner(client))
  assert.equal(queries,1)
})
