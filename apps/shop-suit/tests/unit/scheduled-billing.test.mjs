import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { shallowRef, ref } from 'vue'
import { parseChangePreview, parseScheduledChange } from '../../app/utils/scheduled-billing.mjs'
const source=stripTypeScriptTypes(await readFile(new URL('../../app/composables/useShopScheduledBilling.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export function','function')
const make=new Function('shallowRef','ref','parseChangePreview','parseScheduledChange',`${source};return useShopScheduledBilling`)(shallowRef,ref,parseChangePreview,parseScheduledChange)
const record=(state='scheduled')=>({id:'change-1',state,catalogTermsId:'terms-1',privateOfferId:null,planName:'Solo',billingInterval:'monthly',currency:'EGP',indicativePriceAmount:349,effectiveAt:'2028-10-13T20:06:28Z',createdAt:'2026-10-14T00:00:00Z',available:true,canPayNow:false,canCancel:state==='scheduled',blockers:[]})
function setup(invoke){let context={generation:0,shop:'shop-a',user:'owner-a'},selection='terms:terms-1';const map=new Map();globalThis.sessionStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}
 const flow=make({context:()=>({...context}),sameContext:c=>c.generation===context.generation,target:()=>({selection,catalogTermsId:'terms-1',privateOffer:null}),invoke})
 return{flow,map,switch(){context={generation:1,shop:'shop-b',user:'owner-b'};flow.reset()},select(){selection='terms:terms-2'}}}
test('malformed and ambiguous targets rejected; private bearer fields discarded',()=>{assert.throws(()=>parseScheduledChange({...record(),privateOfferId:'offer-1'}));assert.throws(()=>parseChangePreview({timing:'term_end',effectiveAt:'bad'}));assert.equal('redemptionToken' in parseScheduledChange({...record(),redemptionToken:'synthetic-secret'}),false)})
test('delayed read cannot enter switched owner/shop context',async()=>{let done;const f=setup(()=>new Promise(r=>done=r)),pending=f.flow.read();f.switch();done({data:record(),error:null});await pending;assert.equal(f.flow.current.value,null)})
test('late read cannot restore cancelled schedule',async()=>{let finish;const f=setup(async name=>name==='read'?await new Promise(r=>finish=r):name==='cancel'?{data:record('cancelled'),error:null}:{data:{timing:'now'},error:null});f.flow.current.value=record();const read=f.flow.read();await f.flow.cancel();finish({data:record(),error:null});await read;assert.equal(f.flow.current.value.state,'cancelled')})
test('schedule response persists while a different selection stays open',async()=>{let finish;const f=setup(()=>new Promise(r=>finish=r));f.flow.preview.value={timing:'term_end'};const pending=f.flow.schedule();f.select();finish({data:record(),error:null});assert.equal(await pending,undefined);assert.equal(f.flow.current.value.id,'change-1');assert.equal(f.map.size,0)})
test('malformed read fails closed without uncaught rejection',async()=>{const f=setup(async()=>({data:{id:'wrong'},error:null}));await f.flow.read();assert.equal(f.flow.error.value,'unavailable');assert.equal(f.flow.current.value,null)})
