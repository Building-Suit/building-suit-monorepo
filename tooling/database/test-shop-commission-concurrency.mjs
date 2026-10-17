import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
const database = process.env.SHOP_COMMISSION_TEST_DATABASE ?? 'postgres'
if (database !== 'postgres' && !database.startsWith('shop_commission_test_')) throw new Error('Disposable fixture database required')
const connection = { host: '127.0.0.1', port: process.env.SHOP_COMMISSION_TEST_CONTAINER === 'shop_commission_disposable' ? 64329 : 61322, database, user: 'postgres', password: 'postgres' }
const admin = new pg.Client(connection)
await admin.connect()
try {
 // Entire SQL fixture setup is synthetic and created only in the known local
 // disposable container. Keep its append-only rows for inspection after races.
 const fixture = (await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_commissions.sql', import.meta.url), 'utf8')).replace(/^\\echo.*$/gm, '')
 await admin.query('BEGIN')
 await admin.query(fixture)
 const info = (await admin.query("select current_setting('commission_test.shop') shop,current_setting('commission_test.member') member,owner from commission_fixture")).rows[0]
 await admin.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [info.owner])
 const product = (await admin.query('select id from public.products where shop_id=$1', [info.shop])).rows[0].id
 const customer = (await admin.query('select id from public.clients where shop_id=$1', [info.shop])).rows[0].id
 await admin.query('SET LOCAL ROLE authenticated')
 await admin.query('select public.save_commission_policy($1,$2,$3,$4)', [randomUUID(), info.shop, { enabled: true, currency: 'EGP', product: { type: 'percentage', rate: 10 }, employees: [{ membershipId: info.member, enabled: true }] }, 'Concurrent fixture policy'])
 const sale = (await admin.query('select public.save_sale_draft($1,$2,null,$3,null,$4) id', [randomUUID(), info.shop, customer, JSON.stringify([{ item_type: 'product', source_id: product, quantity: 1 }])])).rows[0].id
 const line = (await admin.query('select id from public.invoice_items where invoice_id=$1', [sale])).rows[0].id
 await admin.query('select public.assign_sale_commission($1,$2,$3,null)', [info.shop, line, info.member])
 await admin.query('select public.issue_sale($1,$2,$3)', [randomUUID(), info.shop, sale])
 await admin.query('COMMIT')
 const gate = randomInt(100000, 100000000), request = randomUUID(), paidAt = new Date().toISOString()
 await admin.query('select pg_advisory_lock($1::bigint)', [gate])
 async function worker() {
  const client = new pg.Client(connection)
  await client.connect()
  try {
   await client.query('BEGIN')
   await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [info.owner])
   await client.query('SET LOCAL ROLE authenticated')
   await client.query('select pg_advisory_xact_lock_shared($1::bigint)', [gate])
   const result = await client.query('select public.record_customer_receipt($1,$2,$3,10,$4,\'cash\',null,null,$5) id', [request, info.shop, customer, paidAt, JSON.stringify([{ invoice_id: sale, amount: 10 }])])
   await client.query('COMMIT')
   return result.rows[0].id
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { await client.end() }
 }
 const work = [worker(), worker()]
 try {
  const deadline = Date.now() + 10000
  for (;;) {
   const result = await admin.query("select count(*)::int count from pg_locks where locktype='advisory' and objid=$1::oid and mode='ShareLock' and not granted", [gate])
   if (result.rows[0].count === 2) break
   assert.ok(Date.now() < deadline, 'Both workers must reach the barrier')
   await delay(10)
  }
 } finally { await admin.query('select pg_advisory_unlock($1::bigint)', [gate]) }
 const receipts = await Promise.all(work)
 assert.equal(receipts[0], receipts[1], 'Concurrent duplicate receipt must be idempotent')
 const earning = (await admin.query("select count(*)::int count,sum(e.amount)::text amount from public.commission_events e join public.commission_snapshots s on s.id=e.snapshot_id where s.invoice_id=$1 and e.kind='earned'", [sale])).rows[0]
 assert.equal(earning.count, 1)
 assert.equal(earning.amount, '1.00')
 console.log('Two PostgreSQL sessions passed concurrent duplicate payment and exactly-once commission recognition; synthetic append-only fixtures retained locally')
} finally { await admin.end() }
