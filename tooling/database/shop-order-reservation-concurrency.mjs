import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

// Both adapters must target the caller-owned disposable backend only.
export async function verifyOrderReservationRaces(sql, parallelSql) {
 const schema = `order_race_${randomUUID().replaceAll('-','')}`
 sql(`create schema ${schema};`)
 sql(readFileSync(new URL('../../apps/shop-suit/supabase/tests/fixtures/order_reservation_concurrency_setup.sql', import.meta.url),'utf8').replaceAll('measurement_test',schema))
 const f = JSON.parse(sql(`select row_to_json(f) from ${schema}.order_race f;`))
 const actor = body => `set request.jwt.claim.sub='${f.owner_id}';set request.jwt.claim.role='authenticated';set role authenticated;${body}`
 const reserve = (order,line,revision) => `select public.reserve_trade_order(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${order}',${revision},'reserve','[{"lineId":"${line}","quantity":"80"}]',clock_timestamp()+interval '1 day','Reserve competing contractor collection');`
 const race = async (revision, contender, expectedFailure) => {
  const name = `order-reservation-${randomUUID()}`
  const first = parallelSql(`begin;set application_name='${name}';${actor(reserve(f.order_a,f.line_a,revision))}select pg_sleep(1.5);commit;`)
  let held = false
  for (let attempt=0;attempt<60;attempt++) {
   if (sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`)==='1') { held=true;break }
   await delay(25)
  }
  assert.ok(held,'Reservation did not reach its held-lock barrier')
  const second = parallelSql(actor(contender))
  const [won,lost] = await Promise.all([first,second])
  assert.equal(won.code,0,won.stderr)
  assert.notEqual(lost.code,0,'Competing request consumed reserved capacity')
  assert.match(lost.stderr,expectedFailure)
  assert.equal(sql(`select sum(remaining_quantity)=100 from public.inventory_batches where product_id='${f.product_id}';`),'t')
  assert.equal(sql(`select sum(remaining_quantity)=80 and count(*)=1 from public.trade_order_reservations where product_id='${f.product_id}' and status='active';`),'t')
 }
 await race(1,reserve(f.order_b,f.line_b,1),/INSUFFICIENT_AVAILABLE_STOCK/)
 assert.equal(sql(`select revision=1 from public.trade_orders where id='${f.order_b}';`),'t')
 sql(actor(`select public.reserve_trade_order(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${f.order_a}',2,'release','[]',null,'Release between independent race scenarios');`))
 await race(3,`select public.issue_location_sale(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${f.invoice_id}');`,/INSUFFICIENT_STOCK/)
 assert.equal(sql(`select status='draft' from public.invoices where id='${f.invoice_id}';`),'t')
 assert.equal(sql(`select count(*)=0 from public.inventory_movements where reference_id='${f.invoice_id}';`),'t')
 console.log('Order reservation races: PASS; competing80m holds and30m cashier issue serialize against100m; only80m reserved, no stock consumed')
}
