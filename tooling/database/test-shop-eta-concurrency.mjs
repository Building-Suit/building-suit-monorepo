import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
const connection={host:'127.0.0.1',port:61322,user:'postgres',password:'postgres',database:'postgres'}
const admin=new pg.Client(connection)
await admin.connect()
try {
 await admin.query('BEGIN')
 await admin.query(await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_eta_submission.sql',import.meta.url),'utf8'))
 const info=(await admin.query("select current_setting('eta_test.shop') shop,current_setting('eta_test.location') location,(select owner::text from eta_fixture) owner")).rows[0]
 await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[info.owner])
 await admin.query('SET LOCAL ROLE authenticated')
 const config=(await admin.query('select public.eta_settings($1) settings',[info.shop])).rows[0].settings.configuration
 config.branches[0].deviceSerialNumber='POS-CONCURRENT'
 await admin.query('select public.save_eta_configuration($1,$2,$3,$4)',[randomUUID(),info.shop,config,'Synthetic concurrency'])
 const product=config.items[0].sourceId
 const sales=[]
 for(let index=0;index<2;index++) {
  const sale=(await admin.query('select public.save_sale_draft($1,$2,null,null,null,$3) id',[randomUUID(),info.shop,JSON.stringify([{item_type:'product',source_id:product,quantity:1}])])).rows[0].id
  await admin.query('select public.issue_sale($1,$2,$3)',[randomUUID(),info.shop,sale]);sales.push(sale)
 }
 await admin.query('COMMIT')
 const request=randomUUID()
 async function worker(fn) {
  const client=new pg.Client(connection);await client.connect()
  try {return await fn(client)}finally{await client.end()}
 }
 async function queue(client) {
  await client.query('BEGIN')
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[info.owner]);await client.query('SET LOCAL ROLE authenticated')
  const result=await client.query("select public.queue_eta_receipt($1,$2,$3,'{\"type\":\"P\"}','C') id",[request,info.shop,sales[0]])
  await client.query('COMMIT');return result.rows[0].id
 }
 const ids=await Promise.all([worker(queue),worker(queue)])
 assert.equal(ids[0],ids[1])
 await admin.query('BEGIN');await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[info.owner]);await admin.query('SET LOCAL ROLE authenticated')
 await admin.query("select public.queue_eta_receipt($1,$2,$3,'{\"type\":\"P\"}','C')",[randomUUID(),info.shop,sales[1]]);await admin.query('COMMIT')
 const claims=await Promise.all([worker(async client=>(await client.query('select public.shop_eta_claim() job')).rows[0].job),worker(async client=>(await client.query('select public.shop_eta_claim() job')).rows[0].job)])
 assert.equal(claims.filter(Boolean).length,1,'Same POS must have only one active claim')
 assert.equal((await admin.query('select count(*)::int n from public.eta_outbox where invoice_id=$1',[sales[0]])).rows[0].n,1)
 console.log('Two PostgreSQL sessions: same-sale concurrent replay returns one document; concurrent workers claim only one job per POS. Synthetic disposable fixtures retained.')
} finally {await admin.end()}
