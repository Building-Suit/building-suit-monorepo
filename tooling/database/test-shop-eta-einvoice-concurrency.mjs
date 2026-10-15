import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { setTimeout as delay } from 'node:timers/promises'
const connection={host:'127.0.0.1',port:61322,user:'postgres',password:'postgres',database:'postgres'}
const admin=new pg.Client(connection)
await admin.connect()
try {
 await admin.query('BEGIN')
 for(const name of ['shop_eta_submission.sql','shop_eta_einvoice.sql']) await admin.query(await readFile(new URL('../../apps/shop-suit/supabase/tests/'+name,import.meta.url),'utf8'))
 const info=(await admin.query("select current_setting('eta_test.shop') shop,current_setting('eta_test.location') location,(select owner::text from eta_fixture) owner")).rows[0]
 await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[info.owner])
 await admin.query("select set_config('shop.location_id',$1,true)",[info.location])
 await admin.query('SET LOCAL ROLE authenticated')
 const config=(await admin.query('select public.eta_settings($1) settings',[info.shop])).rows[0].settings.configuration
 config.branches[0].deviceSerialNumber=''
 await admin.query('select public.save_eta_configuration($1,$2,$3,$4)',[randomUUID(),info.shop,config,'Synthetic concurrency'])
 const product=config.items[0].sourceId
 const customer=(await admin.query('select id from public.clients where shop_id=$1 limit 1',[info.shop])).rows[0].id
 const sales=[]
 for(let index=0;index<2;index++) {
  const sale=(await admin.query('select public.save_sale_draft($1,$2,null,$3,null,$4) id',[randomUUID(),info.shop,customer,JSON.stringify([{item_type:'product',source_id:product,quantity:1}])])).rows[0].id
  await admin.query('select public.issue_sale($1,$2,$3)',[randomUUID(),info.shop,sale]);sales.push(sale)
 }
 await admin.query('COMMIT')
 const receiver={type:'B',id:'987654321',name:'Concurrent business',address:{country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Test',buildingNumber:'1'}}
 const request=randomUUID(),gate=randomInt(100000,100000000)
 await admin.query('select pg_advisory_lock($1::bigint)',[gate])
 async function worker(fn) {
  const client=new pg.Client(connection);await client.connect()
  try {return await fn(client)}finally{await client.end()}
 }
 async function queue(client) {
  await client.query('BEGIN')
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[info.owner]);await client.query('SET LOCAL ROLE authenticated')
  await client.query('select pg_advisory_xact_lock_shared($1::bigint)',[gate])
  const result=await client.query("select public.queue_eta_invoice($1,$2,$3,$4,'Concurrent invoice buyer') id",[request,info.shop,sales[0],JSON.stringify(receiver)])
  await client.query('COMMIT');return result.rows[0].id
 }
 const competing=[worker(queue),worker(queue)]
 try {
  const deadline=Date.now()+10000
  while ((await admin.query("select count(*)::int n from pg_locks where locktype='advisory' and objid=$1::oid and mode='ShareLock' and not granted",[gate])).rows[0].n!==2) {
   assert.ok(Date.now()<deadline,'Both queue sessions must reach the race barrier');await delay(10)
  }
 } finally {await admin.query('select pg_advisory_unlock($1::bigint)',[gate])}
 const ids=await Promise.all(competing)
 assert.equal(ids[0],ids[1])
 await admin.query('BEGIN');await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[info.owner]);await admin.query('SET LOCAL ROLE authenticated')
 await admin.query("select public.queue_eta_invoice($1,$2,$3,$4,'Concurrent invoice buyer')",[randomUUID(),info.shop,sales[1],JSON.stringify(receiver)]);await admin.query('COMMIT')
 const claims=await Promise.all([worker(async client=>(await client.query('select public.shop_eta_invoice_claim() job')).rows[0].job),worker(async client=>(await client.query('select public.shop_eta_invoice_claim() job')).rows[0].job)])
 assert.equal(claims.filter(Boolean).length,2,'Different invoices can be claimed without receipt POS chaining')
 assert.equal(new Set(claims.map(job=>job.id)).size,2)
 assert.ok(claims.every(job=>job.channel==='einvoice' && job.device_serial===null))
 assert.equal((await admin.query('select count(*)::int n from public.eta_outbox where invoice_id=$1',[sales[0]])).rows[0].n,1)
 console.log('Two PostgreSQL sessions: same-invoice concurrent replay returns one job; independent invoices claim separately without POS chaining or duplicate claims. Synthetic disposable fixtures retained.')
} finally {await admin.end()}
