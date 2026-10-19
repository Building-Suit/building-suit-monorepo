import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorPageMetadata,doctorMissingPage } from '../../app/utils/previewMetadata.ts'
import { doctorPublicPreview } from '../../app/utils/publicPreview.ts'
import { doctorLandingContent } from '../../app/utils/landingPresentation.ts'
const workflow = { title: 'Synthetic scope',description: 'Synthetic administrative workflow preview.' }
for(const ar of [false,true])test(`C01 public preview metadata follows approved copy and locale ${ar ? 'AR' : 'EN'}`,() => {
  const copy = doctorLandingContent(ar);const result = doctorPageMetadata('/',ar,workflow)
  assert.equal(result.publicPage,true);assert.equal(result.title,`Doctor Suit · ${copy.heroTitle}`);assert.equal(result.description,copy.heroBody);assert.equal(result.locale,ar ? 'ar_EG' : 'en_US');assert.equal(result.robots,'noindex, nofollow');assert.equal('canonical'in result,false);assert.equal('url'in result,false)
  assert.equal(doctorPageMetadata('/preview',ar,workflow).description,workflow.description)
})
test('C02 private and auth metadata cannot retain public sharing content or caller material',() => {
  const copy = { title: 'PRIVATE_WORKFLOW_SENTINEL',description: 'PRIVATE_DESCRIPTION_SENTINEL' }
  for(const path of ['/account','/account-activity','/workspace','/patients/d1900000-0000-0000-0000-000000000001','/appointments','/audit','/sign-in','/sign-up','/verify','/recover','/unknown?code=PRIVATE_CODE_SENTINEL']) {
    const result = doctorPageMetadata(path,false,copy);assert.equal(result.publicPage,false);assert.equal(result.description,undefined);assert.match(result.robots,/noindex/);assert.match(result.robots,/nosnippet/);assert.equal(JSON.stringify(result).includes('SENTINEL'),false);assert.equal(result.title.includes(path),false)
  }
})
test('C03 preview navigation has only real relative destinations, with no invented support/store/domain links',() => {
  const links = []
  const walk = value => { if(Array.isArray(value))value.forEach(walk);else if(value && typeof value==='object')for(const [key,item]of Object.entries(value)) { if(['href','to'].includes(key) && typeof item==='string')links.push(item);else walk(item) } }
  walk(doctorPublicPreview(false));assert.ok(links.length>0);assert.equal(links.some(link => !link.startsWith('/') && !link.startsWith('#')),false);assert.equal(links.some(link => /mailto:|tel:|apps\.apple|play\.google|https?:/.test(link)),false)
})
test('C03/C04 missing-route copy is neutral, locale-specific and cannot reflect a requested identifier',() => {
  for(const ar of [false,true]) { const result = doctorMissingPage(ar);assert.deepEqual(result.links.map(link => link.to),['/','/preview']);assert.ok(result.title && result.description);assert.equal(result.description.includes('SENTINEL'),false);result.links[0].to='/changed';assert.equal(doctorMissingPage(ar).links[0].to,'/') }
})

test('C02 a foreground authority request cannot settle with an earlier in-flight context snapshot',async () => {
  const { createDoctorContextController,doctorContextState } = await import('../../app/utils/contextController.ts')
  const actor = { userId: 'd1900000-0000-4000-8000-000000000001',sessionId: 'd1900000-0000-4000-8000-000000000002',practiceId: null }
  const row = { practice_id: 'd1900000-0000-4000-8000-000000000003',practice_name: 'Synthetic practice',doctor_name: 'Synthetic doctor',location_id: 'd1900000-0000-4000-8000-000000000004',location_name: 'Synthetic clinic',timezone: 'Etc/UTC',portal: 'secretary',grants_version: 1,location_version: 1,capabilities: ['audit.read'] }
  let resolve;let calls = 0;let held = false;const state = doctorContextState()
  const controller = createDoctorContextController({ load: async () => { calls++;if(held && calls===2)return new Promise(done => { resolve = done });return held ? [] : [row] },resolve: async () => row },state,() => actor,'local',{ read: () => null,write: () => {} })
  await controller.refresh();const old = controller.capture('audit');held = true
  const earlier = controller.refresh();await new Promise(done => setImmediate(done));const foreground = controller.refresh();resolve([row])
  await Promise.all([earlier,foreground]);assert.equal(calls,3);assert.equal(state.current,null);assert.equal(old.accepts(),false);assert.equal(state.phase,'choosing')
})


test('C02 repeated authority refreshes after revocation cannot silently choose the remaining doctor',async () => {
  const { createDoctorContextController,doctorContextState } = await import('../../app/utils/contextController.ts')
  const actor = { userId: 'd1900000-0000-4000-8000-000000000001',sessionId: 'd1900000-0000-4000-8000-000000000002',practiceId: null }
  const row = n => ({ practice_id: `d1900000-0000-4000-8000-00000000000${n}`,practice_name: 'Synthetic practice',doctor_name: 'Synthetic doctor',location_id: `d1900000-0000-4000-8000-00000000001${n}`,location_name: 'Synthetic clinic',timezone: 'Etc/UTC',portal: 'secretary',grants_version: 1,location_version: 1,capabilities: ['audit.read'] })
  let options = [row(3),row(4)];const state = doctorContextState();const controller = createDoctorContextController({ load: async () => options,resolve: async practice => options.find(item => item.practice_id===practice) },state,() => actor,'local',{ read: () => null,write: () => {} })
  await controller.refresh();await controller.choose(`${row(3).practice_id}:${row(3).location_id}`);const old = controller.capture('audit');options = [row(4)]
  for(let n=0;n<3;n++) { assert.equal(await controller.refresh(),false);assert.equal(state.current,null);assert.equal(state.phase,'choosing');assert.equal(old.accepts(),false) }
  assert.equal(await controller.choose(`${row(4).practice_id}:${row(4).location_id}`),true);assert.equal(state.current.practiceId,row(4).practice_id)
})
