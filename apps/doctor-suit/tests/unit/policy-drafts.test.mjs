import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import {doctorPolicyDocument,doctorPolicyKeys,doctorPolicyLinks,doctorPolicyNavigation,doctorPolicyReview}from'../../app/utils/policyPresentation.ts'
import {doctorPageMetadata}from'../../app/utils/previewMetadata.ts'
const content=readFileSync(new URL('../../config/policy-drafts.v1.json',import.meta.url)),bundle=JSON.parse(content),review=JSON.parse(readFileSync(new URL('../../config/policy-review.v1.json',import.meta.url),'utf8'))
const catalog=JSON.parse(readFileSync(new URL('../../config/introductory-plans.v2.json',import.meta.url),'utf8'))
test('all six bilingual policy drafts have one pinned version and a verified content digest without fabricated approvals',()=>{
 assert.equal(createHash('sha256').update(content).digest('hex'),review.sha256)
 assert.equal(bundle.version,review.version);assert.equal(bundle.status,'draft');assert.equal(review.acceptanceMode,'review_only')
 assert.equal(review.qualifiedReview,null);assert.ok(Object.values(review.operator).every(value=>value===null))
 for(const flag of['qualifiedApproval','liveDataAllowed','livePaymentsAllowed'])assert.equal(bundle[flag],false)
 assert.equal(doctorPolicyReview.qualifiedApproval,false);assert.equal(doctorPolicyReview.acceptanceMode,'review_only')
 assert.deepEqual(Object.keys(bundle.documents),[...doctorPolicyKeys]);assert.equal(doctorPolicyKeys.length,6)
 for(const key of doctorPolicyKeys)for(const ar of[false,true]){
  const doc=doctorPolicyDocument(key,ar);assert.ok(doc.title&&doc.intro.includes(bundle.version))
  assert.ok(doc.sections.length>=3);assert.ok(doc.sections.every(s=>s.title&&s.paragraphs.length&&s.paragraphs.every(p=>typeof p==='string'&&p.trim())))
  assert.match(doc.title,ar?/مسودة/:/Draft/)
 }
})
test('policy links are known public destinations; metadata never treats caller material as policy text',()=>{
 for(const ar of[false,true]){
  const navigation=doctorPolicyNavigation(ar);assert.equal(navigation.links.length,6)
  for(const link of doctorPolicyLinks(ar)){
   assert.match(link.to,/^\/policies\/[a-z-]+$/)
   const meta=doctorPageMetadata(link.to,ar,{title:'PRIVATE_SENTINEL',description:'PRIVATE_SENTINEL'})
   assert.equal(meta.publicPage,true);assert.ok(meta.title.endsWith(link.label));assert.match(meta.description,/2026-10-18.1/);assert.equal(meta.robots,'noindex, nofollow');assert.doesNotMatch(JSON.stringify(meta),/PRIVATE_SENTINEL/)
  }
 }
 for(const path of['/policies/unknown','/policies/terms?code=SECRET','/privacy','/subscription'])assert.equal(doctorPageMetadata(path,false,{title:'SECRET',description:'SECRET'}).publicPage,false)
})
test('subscription draft follows canonical exact annual economics, manual renewal and future-feature limits',()=>{
 const text=doctorPolicyDocument('subscription',false).sections.flatMap(s=>s.paragraphs).join('\n')
 for(const plan of catalog.plans){assert.ok(text.includes(String(plan.monthlyMinor/100)));assert.ok(text.includes((plan.yearlyMinor/100).toFixed(2)))}
 assert.match(text,/32%/);assert.match(text,/Renewal.*manual/);assert.match(text,/no automatic debit/);assert.match(text,/as released within plan capacity/);assert.match(text,/no approved universal trial duration/)
 assert.match(text,/original snapshots/)
})
