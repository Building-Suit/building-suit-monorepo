import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const catalog=JSON.parse(readFileSync(new URL('../../config/introductory-plans.v2.json',import.meta.url),'utf8'))
const source=readFileSync(new URL('../../app/utils/launchPricing.ts',import.meta.url),'utf8').replace("import catalog from '../../config/introductory-plans.v2.json'",`const catalog=${JSON.stringify(catalog)}`)
const {doctorLaunchPricing}=await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`)
test('both landing locales use the existing Shop card interface and exact approved annual/minor amounts',()=>{
 for(const ar of[false,true]){
  const monthly=doctorLaunchPricing(ar),yearly=doctorLaunchPricing(ar,'yearly'),currency=ar?'ج.م':'EGP'
  assert.equal(yearly.variant,'shop');assert.equal(monthly.variant,'shop')
  assert.deepEqual(monthly.plans.map(p=>p.price),[299,599,999].map(p=>`${p} ${currency}`))
  assert.deepEqual(yearly.plans.map(p=>p.price),['2439.84','4887.84','8151.84'].map(p=>`${p} ${currency}`))
  assert.equal(yearly.annualSaving,ar?'وفّر ٣٢٪ سنوياً':'Save 32% annually')
  assert.ok(yearly.plans.every(p=>p.action.disabled));assert.match(yearly.intro,ar?/٣٢٪/:/32%/)
 }
})
