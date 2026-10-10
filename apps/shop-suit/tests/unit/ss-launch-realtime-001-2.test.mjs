import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createScopedRealtime } from '../../../../packages/data-access/src/realtime.ts'
import { createShopRefreshGate,shopRealtimeFilters,shopRealtimeTables } from '../../app/utils/shopRealtime.ts'
const root=new URL('../../../../',import.meta.url)
test('Exact approved Foundation source is preserved including reconciled contract',()=>{
 for(const [p,object] of Object.entries({'pnpm-lock.yaml':'5f0c8b59705707f0f72f086d679e85a1e3b4ba7f','packages/contracts/src/index.ts':'291f86a5c0667e603f049b0a8e15bab255b31f45','packages/data-access/src/index.ts':'0a768c25d63217619bbcc684b216a8fb0a45e427','packages/data-access/src/realtime.ts':'a4cfc2b2769c6b17fcaa8324c8e7152b501846de'})){
  const b=readFileSync(new URL(p,root));assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),object,p)
 }
})
test('Every launch feature is scoped to exact tenant and location; injection rejected',()=>{
 for(const f of Object.keys(shopRealtimeTables)){
  const filters=shopRealtimeFilters(f,'shop-a','location-a');assert.equal(filters.length,4)
  assert.ok(filters.every(x=>x.table==='shop_realtime_versions'&&x.filter.includes(`shop-a:`)&&x.filter.endsWith(`:${f}`)))
  assert.ok(filters.every(x=>!x.filter.includes('location-b')))
 }
 assert.throws(()=>shopRealtimeFilters('customers','x,or(shop_id.eq.y)',null))
})
test('Dirty editors keep values; coalesced pending update flushes after completion; failure can retry',async()=>{
 let dirty=true,refreshes=0,fail=false
 const gate=createShopRefreshGate(()=>dirty,async()=>{if(fail)throw Error('network');refreshes++})
 await gate.invalidate();await gate.invalidate();assert.equal(refreshes,0);assert.equal(gate.stale,true)
 dirty=false;await gate.flush();assert.equal(refreshes,1);assert.equal(gate.stale,false)
 fail=true;await assert.rejects(gate.invalidate());assert.equal(gate.stale,true)
 fail=false;await gate.flush();assert.equal(refreshes,2);gate.dispose();await gate.invalidate();assert.equal(refreshes,2)
})
test('Shared engine reconnect, throttle, obsolete-context rejection and teardown',async()=>{
 const channels=[];let removes=0,refreshes=0
 const client={channel(){const c={callbacks:[],on(_type,filter,cb){this.callbacks.push(cb);return this},subscribe(cb){this.status=cb;return this}};channels.push(c);return c},async removeChannel(){removes++;return 'ok'}}
 const rt=createScopedRealtime(client,{refreshIntervalMs:5})
 const binding=tenant=>({scope:{environment:'local',portal:'shop-crm',userId:'user-a',tenantId:tenant,locationId:'location-a',sessionId:'session-a',contextKey:'customers'},filters:shopRealtimeFilters('customers',tenant,'location-a'),dataKeys:['customers'],refresh:async r=>{assert.ok(r.isCurrent());refreshes++}})
 await rt.update(binding('shop-a'));await rt.update(binding('shop-a'));assert.equal(channels.length,1)
 channels[0].status('SUBSCRIBED');channels[0].callbacks.forEach(cb=>cb());await new Promise(r=>setTimeout(r,25));assert.equal(refreshes,1)
 channels[0].status('CHANNEL_ERROR');assert.equal(rt.connected,false)
 channels[0].status('SUBSCRIBED');await new Promise(r=>setTimeout(r,25));assert.equal(refreshes,2)
 await rt.update(binding('shop-b'));channels[0].callbacks.forEach(cb=>cb());await new Promise(r=>setTimeout(r,25));assert.equal(refreshes,2);assert.equal(removes,1)
 await rt.dispose();assert.equal(removes,2);channels[1].callbacks.forEach(cb=>cb());await new Promise(r=>setTimeout(r,25));assert.equal(refreshes,2)
})
