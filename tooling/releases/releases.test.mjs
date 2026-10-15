import test from 'node:test'
import assert from 'node:assert/strict'
import { affectedSuits, validateCoverage, validateFragment, plainText } from './fragments.mjs'
import { assertReady, assertBinding, requiredContexts, selectPromotion } from './publisher.mjs'
const registry = ['shop-suit','ledger-suit']
const copy = { en: 'A simpler workflow', ar: 'مسار عمل أبسط' }
const fragment = { id: 'sample-task-release', task: 'BS-SAMPLE-001', suits: ['shop-suit'], classification: 'minor', disposition: 'public', paths: ['apps/shop-suit'], reason: 'Adds a capability', notes: { title: copy, summary: copy, details: copy } }
const graph = [
  { name: 'contracts', dir: 'packages/contracts', dependencies: [] },
  { name: 'shared-ui', dir: 'packages/ui', dependencies: ['contracts'] },
  { name: 'shop', dir: 'apps/shop-suit', suit: 'shop-suit', dependencies: ['shared-ui'] },
  { name: 'ledger', dir: 'apps/ledger-suit', suit: 'ledger-suit', dependencies: [] },
]
test('curated fragments require registered consumers, complete translations and explicit classification', () => {
  assert.equal(validateFragment(fragment,registry),fragment)
  for (const patch of [{ suits: ['other-suit'] }, { classification: 'feature' }, { disposition: 'internal' }, { paths: ['../secrets'] }, { notes: { ...fragment.notes, title: {en:'English only'} } }, { notes: {...fragment.notes, title: {en:'<b>text</b>',ar:'نص'}} }, { notes: {...fragment.notes, title: {en:fragment.task,ar:'نص'}} }, { unknown:'secret' }]) assert.throws(()=>validateFragment({...fragment,...patch},registry))
  assert.throws(()=>validateFragment({...fragment,notes:{...fragment.notes,title:{en:'same',ar:'same'}}},registry))
  assert.ok(validateFragment({...fragment,classification:'internal',disposition:'internal',notes:undefined},registry))
  for (const value of ['service_role credential','github_pat_abc','-----BEGIN PRIVATE KEY-----','secret_key value']) assert.equal(plainText(value),false)
})
test('shared fanout follows transitive dependencies and changed path coverage is mandatory', () => {
  assert.deepEqual(affectedSuits(['packages/contracts/src/change.ts'],graph),['shop-suit'])
  assert.deepEqual(affectedSuits(['tooling/release.mjs'],graph),registry.slice().sort())
  validateCoverage([fragment],['apps/shop-suit/app/page.ts'],graph)
  assert.throws(()=>validateCoverage([fragment],['apps/ledger-suit/app/page.ts'],graph))
  assert.throws(()=>validateCoverage([fragment,fragment],['apps/shop-suit/app/page.ts'],graph))
  assert.throws(()=>validateCoverage([{...fragment,suits:registry}],['apps/shop-suit/app/page.ts'],graph))
})
test('publication fails closed on missing, pending or failed deployment gates', () => {
  const state = { contexts: [{context:'Vercel staging',state:'success'}], checks: [{name:'verify',status:'completed',conclusion:'success'}], required: ['verify','Vercel staging'] }
  assertReady(state)
  for (const patch of [{required:[]},{contexts:[]},{checks:[]},{contexts:[{context:'Vercel staging',state:'failure'}]}]) assert.throws(()=>assertReady({...state,...patch}))
})
test('production imports multiple exact staging releases and rejects missing, changed, unshipped or out-of-order provenance', () => {
  const second = {...fragment,id:'second-release'}
  const rows=[{manifest:{sourceSha:'one',fragments:[fragment]},digest:'same',publishedAt:'now'}, {manifest:{sourceSha:'two',fragments:[second]},digest:'same2',publishedAt:'later'}]
  assert.deepEqual(selectPromotion(rows,[fragment,second],()=>true),rows)
  assert.throws(()=>selectPromotion(rows,[fragment,second],sha=>sha==='one'))
  assert.throws(()=>selectPromotion(rows,[{...fragment,classification:'patch'}],()=>true))
  assert.throws(()=>selectPromotion([{...rows[0],publishedAt:null}],[fragment],()=>true))
  assert.deepEqual(selectPromotion(rows,[],()=>false),[])
})
test('catalog clients require exact verified project bindings', () => {
  assertBinding('https://abcdefghijklmnopqrst.supabase.co','abcdefghijklmnopqrst')
  for (const [url,ref] of [['https://wrong.supabase.co','abcdefghijklmnopqrst'],['http://abcdefghijklmnopqrst.supabase.co','abcdefghijklmnopqrst'],['https://abcdefghijklmnopqrst.supabase.co','']]) assert.throws(()=>assertBinding(url,ref))
})

test('every releasing Suit requires its own configured deployment gates', () => {
  const releases=[{manifest:{versions:{'shop-suit':'1.2.0','ledger-suit':'3.1.0'}}}]
  const config={common:['verify'],suits:{'shop-suit':['shop deployment'],'ledger-suit':['ledger deployment']}}
  assert.deepEqual(requiredContexts(config,releases),['verify','shop deployment','ledger deployment'])
  assert.throws(()=>requiredContexts({common:['verify'],suits:{'shop-suit':['shop']}},releases))
  assert.throws(()=>requiredContexts({common:['verify'],suits:{'shop-suit':['verify'],'ledger-suit':['ledger']}},releases))
})
