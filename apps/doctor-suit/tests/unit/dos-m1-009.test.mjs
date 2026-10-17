import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createDoctorInvitationSecret, doctorInvitationCredential, doctorInvitationDetails, doctorTeamDirectory } from '../../app/utils/delegation.ts'
import { createDoctorTeamController, doctorTeamState } from '../../app/utils/teamController.ts'
import { createDoctorInvitationController, doctorInvitationState } from '../../app/utils/invitationController.ts'
const actor = { userId: '51000000-0000-0000-0000-000000000003',sessionId: '52000000-0000-0000-0000-000000000003',practiceId: null }
const practice = '53000000-0000-0000-0000-000000000001'; const location = '54000000-0000-0000-0000-000000000001'; const invitation = '55000000-0000-0000-0000-000000000001'
const credential = `${invitation}.${'a'.repeat(64)}`
const details = { id: invitation,practiceId: practice,practiceName: 'Synthetic practice',doctorName: 'Synthetic doctor',expiresAt: '2026-10-18T00:00:00Z',status: 'pending',grants: [{ locationId: location,locationName: 'Synthetic clinic',timezone: 'Africa/Cairo',capabilities: ['patients.read'] }] }
const directory = { practiceId: practice,practiceName: 'Synthetic practice',members: [],invitations: [],locations: [{ id: location,name: 'Synthetic clinic',timezone: 'Africa/Cairo',archived: false }],memberTotal: 0,invitationTotal: 0,locationTotal: 1 }
const scope = { environment: 'local',portal: 'doctor',userId: actor.userId,sessionId: actor.sessionId,practiceId: practice,locationId: location,grantsVersion: 1,locationVersion: 1 }
const form = () => ({ email: 'synthetic-staff@example.test',grants: [{ locationId: location,capabilities: ['patients.read'] }] })
const deferred = () => { let resolve; let reject; const promise = new Promise((done,fail) => { resolve = done; reject = fail }); return { promise,resolve,reject } }
function team(overrides = {},material) {
  let current = scope; let keys = 0
  const state = doctorTeamState()
  const repository = { load: async () => directory,invite: async () => ({ invitation_id: invitation }),grants: async () => {},status: async () => {},cancel: async () => {},...overrides }
  const controller = createDoctorTeamController(repository,state,() => current,() => `synthetic-key-${++keys}`,material)
  return { state,controller,repository,scope: value => { current = value } }
}
function acceptance(overrides = {}) {
  let current = actor; let keys = 0
  const state = doctorInvitationState()
  const repository = { review: async () => details,accept: async () => {},...overrides }
  const controller = createDoctorInvitationController(repository,state,() => current,() => `synthetic-key-${++keys}`)
  return { state,controller,repository,actor: value => { current = value } }
}
test('DOS-M1-009: invitation codes are exact non-URL credentials and contain 32 random bytes', async () => {
  assert.deepEqual(doctorInvitationCredential(`  ${credential.toUpperCase()}  `),{ id: invitation,token: 'a'.repeat(64) })
  for (const value of [`https://doctor.invalid/${credential}`,`${credential}?owner=true`,`${credential}.extra`,invitation,`${invitation}.${'a'.repeat(63)}`]) assert.equal(doctorInvitationCredential(value),null)
  const first = await createDoctorInvitationSecret(); const second = await createDoctorInvitationSecret()
  assert.match(first.token,/^[a-f0-9]{64}$/); assert.notEqual(first.token,second.token)
  assert.equal(first.hash,createHash('sha256').update(Buffer.from(first.token,'hex')).digest('hex'))
  assert.notEqual(first.hash,first.token)
})
test('DOS-M1-009: strict projections reject another practice, clinical grants and mismatched invitation IDs', () => {
  const dto = { practice_id: practice,practice_name: 'Synthetic',members: [],invitations: [],locations: [],member_total: 0,invitation_total: 0,location_total: 0,token_hash: 'must not propagate' }
  assert.equal('token_hash' in doctorTeamDirectory(dto,practice),false)
  assert.throws(() => doctorTeamDirectory({ ...dto,practice_id: invitation },practice),/RESPONSE_INVALID/)
  const preview = { invitation_id: invitation,practice_id: practice,practice_name: 'Synthetic',doctor_name: 'Synthetic owner',expires_at: details.expiresAt,status: 'pending',grants: [{ location_id: location,location_name: 'Synthetic',timezone: 'Africa/Cairo',capabilities: ['clinical.sign'] }] }
  assert.throws(() => doctorInvitationDetails(preview,invitation),/RESPONSE_INVALID/)
  assert.throws(() => doctorInvitationDetails({ ...preview,invitation_id: practice },invitation),/RESPONSE_INVALID/)
})
test('DOS-M1-009: late owner directory reads abort and cannot restore a previous scope', async () => {
  const wait = deferred(); let signal
  const fixture = team({ load: (_practice,_query,value) => { signal = value; return wait.promise } })
  const loading = fixture.controller.load({ page: 0,size: 20,search: '' })
  fixture.controller.clear(); fixture.scope(null)
  assert.equal(signal.aborted,true)
  wait.resolve(directory)
  assert.equal(await loading,false); assert.equal(fixture.state.directory,null)
})
test('DOS-M1-009: secretary scopes cannot use an owner directory or create invitation material', async () => {
  let issued = 0
  const fixture = team({},async () => { issued++; return { token: 'a'.repeat(64),hash: 'b'.repeat(64) } })
  fixture.scope({ ...scope,portal: 'secretary' })
  assert.equal(await fixture.controller.load({ page: 0,size: 20,search: '' }),false)
  assert.equal(await fixture.controller.invite(form()),false)
  assert.equal(issued,0); assert.equal(fixture.state.error,'denied')
})
test('DOS-M1-009: duplicate creation and reads cannot interrupt pending credential generation', async () => {
  const material = deferred(); let calls = 0
  const fixture = team({ invite: async () => { calls++; return { invitation_id: invitation } } },() => material.promise)
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  const pending = fixture.controller.invite(form())
  assert.equal(await fixture.controller.invite(form()),false)
  assert.equal(await fixture.controller.load({ page: 1,size: 20,search: '' }),false)
  material.resolve({ token: 'a'.repeat(64),hash: 'b'.repeat(64) })
  assert.equal(await pending,true); assert.equal(calls,1)
  assert.equal(fixture.state.credential,credential)
})
test('DOS-M1-009: uncertain creation retries preserve credential material and key; a new intent changes both', async () => {
  const calls = []; let uncertain = true; let issued = 0
  const fixture = team({ invite: async (_practice,email,grants,hash,key) => { calls.push({ email,grants,hash,key }); if (uncertain) throw new Error('Synthetic private transport error'); return { invitation_id: invitation } } },async () => ({ token: String(++issued).repeat(64),hash: String(issued+5).repeat(64) }))
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  assert.equal(await fixture.controller.invite(form()),false)
  assert.equal(fixture.state.error,'network'); assert.equal(fixture.state.credential,'')
  uncertain = false
  assert.equal(await fixture.controller.invite(form()),true)
  assert.deepEqual(calls[0],calls[1]); assert.equal(issued,1)
  fixture.controller.forgetCredential(); assert.equal(fixture.state.credential,'')
  assert.equal(await fixture.controller.invite({ ...form(),email: 'synthetic-another@example.test' }),true)
  assert.notEqual(calls[1].key,calls[2].key); assert.notEqual(calls[1].hash,calls[2].hash)
})
test('DOS-M1-009: clearing while material is generated never sends a stale invitation or restores a secret', async () => {
  const material = deferred(); let calls = 0
  const fixture = team({ invite: async () => { calls++; return { invitation_id: invitation } } },() => material.promise)
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  const pending = fixture.controller.invite(form())
  fixture.controller.clear(); fixture.scope(null)
  material.resolve({ token: 'a'.repeat(64),hash: 'b'.repeat(64) })
  assert.equal(await pending,false); assert.equal(calls,0); assert.equal(fixture.state.credential,'')
})
test('DOS-M1-009: late invitation success cannot display its credential after a context change', async () => {
  const response = deferred(); const fixture = team({ invite: () => response.promise },async () => ({ token: 'a'.repeat(64),hash: 'b'.repeat(64) }))
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  const pending = fixture.controller.invite(form())
  await new Promise(resolve => setImmediate(resolve))
  fixture.controller.clear(); fixture.scope({ ...scope,sessionId: 'new-session' })
  response.resolve({ invitation_id: invitation })
  assert.equal(await pending,false); assert.equal(fixture.state.credential,''); assert.equal(fixture.state.pending,false)
})
test('DOS-M1-009: acceptance requires verified identity, valid material and explicit review', async () => {
  const fixture = acceptance()
  assert.equal(await fixture.controller.accept(credential),false)
  assert.equal(await fixture.controller.review('invalid'),false)
  fixture.actor(null)
  assert.equal(await fixture.controller.review(credential),false)
  assert.equal(fixture.state.details,null)
})
test('DOS-M1-009: review material cannot be replaced or restored by a stale response', async () => {
  const response = deferred(); let signal
  const fixture = acceptance({ review: (_id,_token,value) => { signal = value; return response.promise } })
  const pending = fixture.controller.review(credential)
  fixture.controller.changed(`${invitation}.${'b'.repeat(64)}`)
  assert.equal(signal.aborted,true)
  response.resolve(details)
  assert.equal(await pending,false); assert.equal(fixture.state.details,null)
})
test('DOS-M1-009: a preview with a mismatched invitation ID fails closed', async () => {
  const fixture = acceptance({ review: async () => ({ ...details,id: practice }) })
  assert.equal(await fixture.controller.review(credential),false)
  assert.equal(fixture.state.details,null); assert.equal(fixture.state.error,'network')
})
test('DOS-M1-009: double acceptance is excluded and uncertain retries retain their command identity', async () => {
  const response = deferred(); const calls = []
  const fixture = acceptance({ accept: async (_id,_token,key) => { calls.push(key); await response.promise } })
  await fixture.controller.review(credential)
  const pending = fixture.controller.accept(credential)
  assert.equal(await fixture.controller.accept(credential),false)
  response.reject(new Error('Synthetic uncertain provider response'))
  assert.equal(await pending,false); assert.equal(fixture.state.accepted,false)
  fixture.repository.accept = async (_id,_token,key) => { calls.push(key) }
  assert.equal(await fixture.controller.accept(credential),true)
  assert.equal(calls[0],calls[1]); assert.equal(await fixture.controller.accept(credential),false)
})
test('DOS-M1-009: a new login cannot inherit preview or completion from the previous session', async () => {
  const response = deferred(); const fixture = acceptance({ accept: () => response.promise })
  await fixture.controller.review(credential)
  const pending = fixture.controller.accept(credential)
  fixture.controller.clear(); fixture.actor({ ...actor,sessionId: 'new-session' })
  response.resolve()
  assert.equal(await pending,false); assert.equal(fixture.state.accepted,false); assert.equal(fixture.state.details,null)
})

test('DOS-M1-009: closing an uncertain invitation discards its raw material rather than recovering it through a later intent', async () => {
  const calls = []; let issued = 0
  const fixture = team({ invite: async (_practice,_email,_grants,hash,key) => { calls.push({ hash,key }); throw new Error('Synthetic uncertain response') } },async () => ({ token: String(++issued).repeat(64),hash: String(issued+5).repeat(64) }))
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  assert.equal(await fixture.controller.invite(form()),false)
  fixture.controller.forgetCredential()
  assert.equal(await fixture.controller.invite(form()),false)
  assert.equal(issued,2); assert.notDeepEqual(calls[0],calls[1]); assert.equal(fixture.state.credential,'')
})

test('DOS-M1-009: equivalent recipient/capability-set ordering keeps an uncertain invitation identity', async () => {
  const calls = []; let fail = true; let issued = 0
  const fixture = team({ invite: async (_practice,email,grants,hash,key) => { calls.push({ email,grants,hash,key }); if (fail) throw new Error('Synthetic uncertain response'); return { invitation_id: invitation } } },async () => ({ token: String(++issued).repeat(64),hash: String(issued+5).repeat(64) }))
  await fixture.controller.load({ page: 0,size: 20,search: '' })
  assert.equal(await fixture.controller.invite({ email: ' Synthetic-Staff@Example.test ',grants: [{ locationId: location,capabilities: ['patients.read','appointments.read'] }] }),false)
  fail = false
  assert.equal(await fixture.controller.invite({ email: 'synthetic-staff@example.test',grants: [{ locationId: location,capabilities: ['appointments.read','patients.read'] }] }),true)
  assert.deepEqual(calls[0],calls[1]); assert.equal(issued,1)
})

test('DOS-M1-009: SDK sign-out notifications cannot leave the account-switch form stuck checking', async () => {
  const { createDoctorAuthController,doctorAuthState } = await import('../../app/utils/authController.ts')
  let controller; let locked = false; let clears = 0
  const state = { ...doctorAuthState(),phase: 'authenticated',identity: actor,providerReady: true }
  const backend = { marker: async () => true,identity: async () => actor,signIn: async () => {},signOut: async () => { controller.providerChanged(); assert.equal(state.phase,'checking') } }
  controller = createDoctorAuthController(backend,state,{ clear: () => { clears++ },locked: () => locked,lock: () => { locked = true },unlock: () => { locked = false } })
  assert.equal(await controller.signOut(),true)
  assert.equal(state.phase,'signed-out'); assert.equal(state.identity,null); assert.equal(state.pending,false); assert.equal(locked,true)
  assert.equal(await controller.signIn('synthetic-secretary@example.test','synthetic-password-only'),true)
  assert.equal(state.phase,'authenticated'); assert.equal(locked,false); assert.ok(clears>=3)
})

test('DOS-M1-009: editors wait for the selected practice directory, including context replacement', async () => {
  const first = deferred(); const second = deferred(); let loads = 0
  const fixture = team({ load: () => ++loads===1 ? first.promise : second.promise })
  const loading = fixture.controller.load({ page: 0,size: 20,search: '' })
  assert.equal(fixture.controller.available(),false)
  first.resolve(directory); assert.equal(await loading,true)
  assert.equal(fixture.controller.available(),true)
  fixture.scope({ ...scope,practiceId: invitation })
  assert.equal(fixture.controller.available(),false)
  const replacing = fixture.controller.load({ page: 0,size: 20,search: '' })
  assert.equal(fixture.controller.available(),false)
  second.resolve({ ...directory,practiceId: invitation }); assert.equal(await replacing,true)
  assert.equal(fixture.controller.available(),true)
  fixture.controller.clear(); assert.equal(fixture.controller.available(),false)
})

test('DOS-M1-009: protected admission waits for an SDK revision queued as identity verification settles', async () => {
  const { createDoctorAuthController,doctorAuthState } = await import('../../app/utils/authController.ts')
  let controller; let reads = 0
  const state = { ...doctorAuthState(),providerReady: true }
  const backend = { marker: async () => true,identity: async () => {
    if (++reads===1) {
      queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => controller.providerChanged())))
      return null
    }
    return actor
  } }
  controller = createDoctorAuthController(backend,state,{ clear() {},locked: () => false,lock() {},unlock() {} })
  assert.equal(await controller.refresh(),true)
  assert.equal(state.phase,'authenticated'); assert.deepEqual(state.identity,actor); assert.equal(reads,2)
})
