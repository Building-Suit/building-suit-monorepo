import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { netCandidate } from './candidate.mjs'
const inventory=JSON.parse(readFileSync(new URL('../../release-changes/items.json',import.meta.url)))
const item=inventory.find(row=>row.id==='ls-browser-001-mobile-focus')
const sourcePath='packages/ux/src/composables/useSideNavigation.ts'
const source=readFileSync(new URL('../../'+sourcePath,import.meta.url),'utf8')
const suits=['automation-suit','inventory-suit','ledger-suit','shop-suit','super-admin-suit']
const graph=[{name:'ux',dir:'packages/ux',dependencies:[]},...suits.map(suit=>({name:suit,dir:'apps/'+suit,suit,dependencies:['ux']}))]
const internal={id:'private-coverage',task:'BS-COVERAGE-001',suits,classification:'internal',disposition:'internal',paths:['packages/ux'],reason:'Private coverage never supplies public semantic contribution.'}
function candidate(row,text=source){return netCandidate({main:'before',staging:'after',items:[internal,row],graph,diff:()=>[sourcePath],read:ref=>ref==='before'?'':text})}
test('obsolete visibility probes fail to contribute despite preserved internal path coverage',()=>{
  const previous={...item,evidence:[{path:sourcePath,contains:"getComputedStyle(target).visibility !== 'visible'"},{path:sourcePath,contains:'if (cancelled || !open()) return'}]}
  assert.equal(candidate(previous).filter(row=>row.disposition==='public').length,0)
})
test('reviewed combined settlement/cancellation evidence matches the actual implemented controller',()=>{
  assert.deepEqual(item.suits,suits,'Existing consumers are preserved; no new product is declared')
  assert.equal(item.evidence.length,1)
  assert.ok(item.evidence[0].contains.includes('await Promise.allSettled'))
  assert.ok(item.evidence[0].contains.includes('if (!cancelled && open())'))
  assert.ok(source.includes(item.evidence[0].contains))
  assert.deepEqual(candidate(item).filter(row=>row.disposition==='public').map(row=>row.id),[item.id])
})
test('removing the combined behavior cannot borrow internal coverage to announce it',()=>{
  assert.equal(candidate(item,source.replace(item.evidence[0].contains,'')).filter(row=>row.disposition==='public').length,0)
  assert.throws(()=>candidate({...item,suits:[...suits,'unknown-suit']}),/Invalid release fragment/)
})
