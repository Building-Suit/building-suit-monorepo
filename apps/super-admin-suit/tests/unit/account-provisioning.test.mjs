import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { provisionCommand,invitationCommand,provisionAccount } from '../../server/utils/account-provisioning.ts'
import { restoreProvision,provisionKey } from '../../app/utils/provision-attempt.ts'

const input=()=>({bindingId:randomUUID(),email:' New@example.invalid ',displayName:'New owner',shopName:'New shop',mainLocationName:'Main branch',businessMode:'product',planId:randomUUID(),catalogTermsId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID(),reason:'Operator approved immediate access'})
test('creation is a closed target-owned contract with no password, owner ID, confirmation or payment injection',()=>{
  const data=input();const command=provisionCommand(data)
  assert.equal(command.operation,'shop.account.command');assert.equal(command.payload.email,'new@example.invalid')
  assert.equal(command.payload.catalogTermsId,data.catalogTermsId)
  assert.deepEqual(provisionCommand(data),command)
  for(const key of ['password','email_confirm','authUserId','ownerId','payment','endpoint','actor'])assert.throws(()=>provisionCommand({...data,[key]:'injected'}))
})
test('a new invitation send requires explicit acknowledgment and its own request identity',()=>{
  const data={bindingId:randomUUID(),provisioningId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID(),reason:'Reviewed uncertain invitation send',acknowledgeUncertainSend:true}
  assert.equal(invitationCommand(data).payload.action,'resend_invitation')
  assert.throws(()=>invitationCommand({...data,acknowledgeUncertainSend:false}))
})
test('pending provisioning commands restore exact IDs only within their owner/environment/binding scope',()=>{
  const data=input();data.email=data.email.trim().toLowerCase()
  const scope={userId:randomUUID(),authorityEnvironmentId:randomUUID(),bindingId:data.bindingId}
  const saved={kind:'create',input:data}
  assert.deepEqual(restoreProvision(JSON.stringify(saved),scope),saved)
  assert.equal(restoreProvision(JSON.stringify(saved),{...scope,bindingId:randomUUID()}),null)
  assert.notEqual(provisionKey(scope),provisionKey({...scope,userId:randomUUID()}))
  assert.equal(restoreProvision(JSON.stringify({...saved,input:{...data,password:'bad'}}),scope),null)
})
test('creation unavailable in registry cannot enqueue, sign or call a target',async()=>{
  let dispatched=0
  const user=randomUUID()
  const actor={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async name=>({data:name==='super_admin_session'?{userId:user,role:'owner',authorityEnvironmentId:randomUUID()}:{suits:[]},error:null})}
  const worker={rpc:async()=>{dispatched++;return {data:null,error:null}}}
  await assert.rejects(provisionAccount(actor,worker,input()))
  assert.equal(dispatched,0)
})
