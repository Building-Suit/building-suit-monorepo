import test from 'node:test'
import assert from 'node:assert/strict'
import {scrollRegionKey} from '../src/scrollRegion.ts'
function fixture(key, overrides={}) {
 const calls=[],region={clientWidth:300,scrollWidth:900,scrollBy:value=>calls.push(value)}
 const event={key,target:region,currentTarget:region,preventDefault(){this.defaultPrevented=true},...overrides}
 return {calls,event,region}
}
test('physical horizontal arrows move the focused overflow region without smooth animation',()=>{
 for(const [key,left]of[['ArrowLeft',-150],['ArrowRight',150]]){
  const f=fixture(key);scrollRegionKey(f.event);assert.deepEqual(f.calls,[{left,behavior:'instant'}]);assert.equal(f.event.defaultPrevented,true)
 }
})
test('RTL and LTR use physical deltas; the browser clamps at the corresponding edge',()=>{
 for(const direction of ['rtl','ltr']){
  let position=0;const f=fixture(direction==='rtl'?'ArrowLeft':'ArrowRight')
  f.region.scrollBy=({left})=>{position=Math.max(direction==='rtl'?-600:0,Math.min(direction==='rtl'?0:600,position+left))}
  for(let step=0;step<8;step++)scrollRegionKey({...f.event,defaultPrevented:false})
  assert.equal(position,direction==='rtl'?-600:600)
 }
})
test('descendant editors, shortcuts, prior handlers and vertical keys remain untouched',()=>{
 for(const extra of [{target:{}},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{defaultPrevented:true},{key:'ArrowDown'},{key:'Tab'},{currentTarget:null}]){
  const f=fixture('ArrowRight',extra);scrollRegionKey(f.event);assert.deepEqual(f.calls,[])
 }
 const f=fixture('ArrowRight');f.region.scrollWidth=300;scrollRegionKey(f.event);assert.deepEqual(f.calls,[]);assert.equal(f.event.defaultPrevented,undefined)
})
