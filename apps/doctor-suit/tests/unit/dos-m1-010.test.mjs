import test from 'node:test'
import assert from 'node:assert/strict'
import { validDoctorDelegationGrants, validDoctorInvitation } from '../../app/utils/delegation.ts'
import { doctorAdministrativeCapabilities } from '../../app/utils/locationContext.ts'
import { doctorDelegationRepository } from '../../app/utils/delegationRepository.ts'
import { createDoctorTeamController, doctorTeamState } from '../../app/utils/teamController.ts'
const practice = '63000000-0000-0000-0000-000000000001'; const first = '64000000-0000-0000-0000-000000000001'; const second = '64000000-0000-0000-0000-000000000002'
const locations = [{ id: first,name: 'Synthetic first',timezone: 'Africa/Cairo',archived: false },{ id: second,name: 'Synthetic archived',timezone: 'Europe/London',archived: true }]
const grants = [{ locationId: first,capabilities: ['patients.read'] }]
const member = { id: '65000000-0000-0000-0000-000000000001',email: 'synthetic-staff@example.test',status: 'active',version: 7,createdAt: '2026-10-16T00:00:00Z',grants: [] }
const directory = { practiceId: practice,practiceName: 'Synthetic',edition: 'synthetic_preview',editionRevision: 1,availableCapabilities: [...doctorAdministrativeCapabilities],locations,members: [member],invitations: [],memberTotal: 1,invitationTotal: 0,locationTotal: 2 }
const scope = { environment: 'local',portal: 'doctor',userId: '61000000-0000-0000-0000-000000000001',sessionId: '62000000-0000-0000-0000-000000000001',practiceId: practice,locationId: first,grantsVersion: 1 }
test('DOS-M1-010: exact per-location selections, empty removal and clinical/foreign/archived safeguards', () => {
  assert.equal(validDoctorDelegationGrants(grants,locations,true),true)
  assert.equal(validDoctorDelegationGrants([],locations),true)
  assert.equal(validDoctorDelegationGrants([],locations,true),false)
  assert.equal(validDoctorDelegationGrants([{ locationId: first,capabilities: [...doctorAdministrativeCapabilities] }],locations,true),true)
  assert.equal(validDoctorDelegationGrants([{ locationId: second,capabilities: ['patients.read'] }],locations,true),false)
  assert.equal(validDoctorDelegationGrants([{ locationId: second,capabilities: ['patients.read'] }],locations),true)
  for (const invalid of [[{ locationId: practice,capabilities: ['patients.read'] }],[{ locationId: first,capabilities: ['clinical.sign'] }],[...grants,...grants],[{ locationId: first,capabilities: ['members.manage'] }]]) assert.equal(validDoctorDelegationGrants(invalid,locations),false)
  assert.equal(doctorAdministrativeCapabilities.some(value => /clinical|prescri|sign|owner|members/.test(value)),false)
  assert.equal(validDoctorInvitation({ email: 'synthetic-staff@example.test',grants },locations),true)
})
test('DOS-M1-010: adapters send only declared scope/version/capability fields and no frontend role authority', async () => {
  const requests = []
  const repository = doctorDelegationRepository({ rpc(name,args) { requests.push({ name,args }); return { abortSignal: async () => ({ data: { invitation_id: member.id },error: null }) } } })
  const signal = new AbortController().signal
  await repository.grants(practice,member.id,member.version,[{ ...grants[0],role: 'owner',clinicalSigner: true }],'synthetic-key',signal)
  assert.deepEqual(requests[0],{ name: 'doctor_set_membership_grants',args: { p_practice: practice,p_membership: member.id,p_version: 7,p_grants: [{ location_id: first,capabilities: ['patients.read'] }],p_key: 'synthetic-key' } })
  await repository.invite(practice,' Synthetic-Staff@Example.test ',grants,'synthetic-hash','synthetic-key',signal)
  assert.equal(requests[1].args.p_email,'synthetic-staff@example.test')
  assert.equal(requests[1].args.p_token_hash,'synthetic-hash')
  assert.equal('p_token' in requests[1].args,false)
})
test('DOS-M1-010: grant retries preserve the member version and command identity without optimistic escalation', async () => {
  let failed = true; const calls = []
  const state = doctorTeamState()
  const repository = { load: async () => directory,grants: async (...args) => { calls.push(args.slice(0,5)); if (failed) throw { code: '40001',message: 'Private backend detail' } } }
  const controller = createDoctorTeamController(repository,state,() => scope,() => 'synthetic-command-key')
  await controller.load({ page: 0,size: 20,search: '' })
  assert.equal(await controller.grants(member,grants),false)
  assert.equal(state.error,'conflict'); assert.deepEqual(state.directory.members[0].grants,[])
  failed = false
  assert.equal(await controller.grants(member,grants),true)
  assert.deepEqual(calls[0],calls[1]); assert.equal(calls[0][2],7)
})
test('DOS-M1-010: a stale status completion cannot unlock or complete a newer scoped command', async () => {
  let finishOld; let finishNew; let next = 0
  const state = doctorTeamState()
  const repository = { load: async () => directory,status: () => new Promise(resolve => { if (++next===1) finishOld = resolve; else finishNew = resolve }) }
  const controller = createDoctorTeamController(repository,state,() => scope,() => `synthetic-${next}`)
  await controller.load({ page: 0,size: 20,search: '' })
  const old = controller.status(member,'revoked')
  controller.clear(); await controller.load({ page: 0,size: 20,search: '' })
  const current = controller.status(member,'suspended')
  finishOld(); assert.equal(await old,false); assert.equal(state.pending,true)
  finishNew(); assert.equal(await current,true); assert.equal(state.pending,false)
})

test('DOS-M1-010: preset projection copies only explicit selected locations and never silently filters an unknown authority', async () => {
  const { doctorDelegationPreset,doctorFormGrants } = await import('../../app/utils/delegationForms.ts')
  assert.deepEqual(doctorDelegationPreset('all'),[...doctorAdministrativeCapabilities])
  assert.deepEqual(doctorDelegationPreset('owner'),[])
  const form = { name: '',jobTitle: '',email: 'synthetic@example.test',role: 'all',locationIds: [first],grants: [...grants,{ locationId: second,capabilities: ['locations.manage'] }] }
  assert.deepEqual(doctorFormGrants(form),grants)
  assert.equal(doctorFormGrants({ ...form,grants: [{ locationId: first,capabilities: ['clinical.sign'] }] }),null)
})
test('DOS-M1-009/010: authenticated return paths strip invitation material and never accept an external destination', async () => {
  const { doctorReturnPath } = await import('../../app/utils/authConfiguration.ts')
  assert.equal(doctorReturnPath('/invitations/accept?code=synthetic#credential'),'/invitations/accept')
  assert.equal(doctorReturnPath('/team?role=owner'),'/team')
  assert.equal(doctorReturnPath('https://attacker.example/invitations/accept'),'/workspace')
})
