import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
const database = process.env.SHOP_MATERIAL_TEST_DATABASE ?? 'postgres'
if (database !== 'postgres' && !database.startsWith('shop_material_test_')) throw new Error('Disposable local database required')
const connection = {host: '127.0.0.1', port: 61322, user: 'postgres', password: 'postgres', database}
const admin = new pg.Client(connection)
await admin.connect()
try {
 await admin.query('BEGIN')
 await admin.query(await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_service_materials.sql', import.meta.url), 'utf8'))
 const info = (await admin.query("select current_setting('materials_test.shop') shop,current_setting('materials_test.location') location,current_setting('materials_test.owner') owner")).rows[0]
 const service = (await admin.query('select id from public.services where shop_id=$1 limit 1',[info.shop])).rows[0].id
 const customer = (await admin.query('select id from public.clients where shop_id=$1 limit 1',[info.shop])).rows[0].id
 await admin.query('SET LOCAL ROLE authenticated')
 const product = (await admin.query("select public.save_product($1,null,'Concurrent cream',null,null,1) id",[info.shop])).rows[0].id
 await admin.query("select public.define_service_material_unit($1,$2,'mL')",[info.shop,product])
 await admin.query("select public.adjust_stock($1,$2,$3,40,1,'Concurrent opening')",[randomUUID(),info.shop,product])
 await admin.query("select public.save_service_recipe($1,$2,$3,null,$4,'Concurrent thirty mL')",[randomUUID(),info.shop,service,JSON.stringify([{productId:product,unit:'mL',quantity:30}])])
 const lines=[]
 for(let i=0;i<2;i++) {
  const sale=(await admin.query('select public.save_sale_draft($1,$2,null,$3,null,$4) id',[randomUUID(),info.shop,customer,JSON.stringify([{item_type:'service',source_id:service,quantity:1}])])).rows[0].id
  await admin.query('select public.issue_sale($1,$2,$3)',[randomUUID(),info.shop,sale])
  lines.push((await admin.query('select id from public.invoice_items where invoice_id=$1',[sale])).rows[0].id)
 }
 await admin.query('COMMIT')
 const gate=randomInt(100000,100000000)
 await admin.query('select pg_advisory_lock($1::bigint)',[gate])
 const requests=[randomUUID(),randomUUID()]
 async function worker(index) {
  const client=new pg.Client(connection);await client.connect()
  try {
   await client.query('BEGIN')
   await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[info.owner])
   await client.query('SET LOCAL ROLE authenticated')
   await client.query('select pg_advisory_xact_lock_shared($1::bigint)',[gate])
   const result=await client.query('select public.complete_service($1,$2,$3,$4,1) id',[requests[index],info.shop,info.location,lines[index]])
   await client.query('COMMIT');return result.rows[0].id
  } catch(error) {await client.query('ROLLBACK');throw error} finally {await client.end()}
 }
 const work=[worker(0),worker(1)].map(p=>p.then(value=>({value}),error=>({error})))
 try {
  const deadline=Date.now()+10000
  for(;;) {
   const count=(await admin.query("select count(*)::int n from pg_locks where locktype='advisory' and objid=$1::oid and mode='ShareLock' and not granted",[gate])).rows[0].n
   if(count===2)break
   assert.ok(Date.now()<deadline,'Both sessions must reach barrier');await delay(10)
  }
 } finally {await admin.query('select pg_advisory_unlock($1::bigint)',[gate])}
 const results=await Promise.all(work)
 assert.equal(results.filter(r=>r.value).length,1)
 assert.equal(results.filter(r=>r.error?.message==='INSUFFICIENT_SERVICE_MATERIAL_STOCK').length,1)
 assert.equal((await admin.query('select sum(remaining_quantity)::text qty from public.inventory_batches where product_id=$1',[product])).rows[0].qty,'10.00')
 assert.equal((await admin.query('select count(*)::int n from public.service_fulfillments where request_id=any($1::uuid[])',[requests])).rows[0].n,1)
 const winner=results.findIndex(r=>r.value)
 await admin.query('BEGIN');await admin.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[info.owner]);await admin.query('SET LOCAL ROLE authenticated')
 const replay=await admin.query('select public.complete_service($1,$2,$3,$4,1) id',[requests[winner],info.shop,info.location,lines[winner]])
 assert.equal(replay.rows[0].id,results[winner].value)
 await admin.query('ROLLBACK')
 console.log('Two PostgreSQL sessions: concurrent 2 × 30 against 40 yields one success, one atomic shortage, 10 remaining, and idempotent replay. Synthetic fixtures retained.')
} finally {await admin.end()}
