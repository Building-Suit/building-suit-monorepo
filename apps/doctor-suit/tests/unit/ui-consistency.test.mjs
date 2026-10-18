import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorLandingContent,doctorMarketingCopy } from '../../app/utils/landingPresentation.ts'
import { doctorWorkspaceNavigation } from '../../app/utils/workspaceNavigation.ts'
import { doctorHomePath,doctorReturnPath } from '../../app/utils/authConfiguration.ts'
const copy={workspace:'Workspace',patients:'Patients',appointments:'Appointments',availability:'Availability',audit:'Audit',locations:'Locations',practice:'Practice settings',team:'Team',account:'Account'}
const access={capabilities:[],ownsPractice:false,hasCurrent:true,hasOptions:true,choosing:false,portal:'secretary'}
const paths=value=>value.groups.flatMap(group=>group.links.map(link=>link.to))
test('bilingual canonical landing describes implemented administration with approved pricing headings and without inventing clinical availability',()=>{
  for(const ar of[false,true]){
    const content=doctorLandingContent(ar);assert.equal(content.features.length,4);assert.equal(content.workflow.length,3)
    assert.match(content.trialNote,ar?/تجريبية/:/synthetic data/);assert.match(content.trialNote,ar?/غير متاحتين/:/unavailable/)
    assert.ok(content.pricingTitle.trim());assert.ok(content.pricingBody.trim())
    assert.doesNotMatch(JSON.stringify(content),/\$\d|USD|EGP|free trial|تجربة مجانية|https?:|mailto:|tel:/i)
    const marketing=doctorMarketingCopy(ar);assert.deepEqual(marketing.navigation.map(link=>link.to),['/#features','/#workflow','/#pricing'])
    assert.deepEqual(marketing.legalLinks.map(link=>link.to),['/preview'])
    assert.doesNotMatch(marketing.labels.startTrial,/free|trial|مجانية|تجربة/i)
  }
})
test('Doctor post-auth home is the practice workspace while authorized deep links and redirect safety remain explicit',()=>{
  assert.equal(doctorHomePath,'/workspace');assert.equal(doctorReturnPath(undefined),doctorHomePath)
  for(const path of['/account','/team','/appointments','/patients','/workspace','/payment-notices','/payment-review'])assert.equal(doctorReturnPath(path),path)
  for(const path of['//external.test','https://external.test','%2f%2fexternal.test','/sign-in','/workspace\n'])assert.equal(doctorReturnPath(path),doctorHomePath)
})
test('mobile and desktop secretary navigation reflect only the selected practice grants',()=>{
  const view=doctorWorkspaceNavigation({...access,capabilities:['patients.read']},copy)
  assert.deepEqual(paths(view),['/workspace','/patients','/account'])
  assert.deepEqual(view.mobileLinks.map(link=>link.to),['/workspace','/patients','/account'])
  assert.equal(paths(view).some(path=>['/team','/onboarding','/audit','/appointments'].includes(path)),false)
})
test('appointments and availability appear together only with their existing role grants',()=>{
  const view=doctorWorkspaceNavigation({...access,capabilities:['appointments.read']},copy)
  assert.deepEqual(paths(view),['/workspace','/appointments','/availability','/account'])
  assert.deepEqual(view.mobileLinks.map(link=>link.to),['/workspace','/appointments','/account'])
})
test('owner settings remain available with no active clinic and do not leak into another selected practice',()=>{
  const owner=doctorWorkspaceNavigation({...access,ownsPractice:true,hasCurrent:false,hasOptions:false,choosing:true,portal:undefined},copy)
  for(const route of['/locations','/onboarding','/team','/audit'])assert.ok(paths(owner).includes(route))
  const delegated=doctorWorkspaceNavigation({...access,ownsPractice:true,capabilities:['patients.read']},copy)
  assert.deepEqual(paths(delegated),['/workspace','/patients','/account'])
})
