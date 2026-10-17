import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorPageMetadata,doctorMissingPage } from '../../app/utils/previewMetadata.ts'
import { doctorPublicPreview } from '../../app/utils/publicPreview.ts'
const workflow = { title: 'Synthetic scope',description: 'Synthetic administrative workflow preview.' }
for(const ar of [false,true])test(`C01 public preview metadata follows approved copy and locale ${ar ? 'AR' : 'EN'}`,() => {
  const copy = doctorPublicPreview(ar);const result = doctorPageMetadata('/',ar,workflow)
  assert.equal(result.publicPage,true);assert.equal(result.title,`${copy.productName} · ${copy.eyebrow}`);assert.equal(result.description,copy.description);assert.equal(result.locale,ar ? 'ar_EG' : 'en_US');assert.equal(result.robots,'noindex, nofollow');assert.equal('canonical'in result,false);assert.equal('url'in result,false)
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
