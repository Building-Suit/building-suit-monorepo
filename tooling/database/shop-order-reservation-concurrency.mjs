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
 // Pause the real cashier after its product lock and before its historical
 // currency-trigger Shop lock. The early common write boundary prevents the
 // inverse reservation/cashier lock cycle, rather than merely retrying deadlocks.
 sql(actor(`select public.reserve_trade_order(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${f.order_a}',4,'release','[]',null,'Release before cashier-first race');`))
 const marker = `cashier-first-${randomUUID()}`, trigger = `order_barrier_${schema}`
 sql(`create function ${schema}.cashier_barrier() returns trigger language plpgsql as $$begin
 if current_setting('application_name')='${marker}' and old.status='draft' and new.status='draft' then perform pg_sleep(1.5);end if;return new;end;$$;
 create trigger ${trigger} before update on public.invoices for each row execute function ${schema}.cashier_barrier();`)
 try {
  const first = parallelSql(`begin;set local statement_timeout='15s';set application_name='${marker}';${actor(`select public.issue_location_sale(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${f.invoice_id}');`)}commit;`)
  let held=false
  for(let attempt=0;attempt<60;attempt++) {
   if(sql(`select count(*) from pg_stat_activity where application_name='${marker}' and wait_event='PgSleep';`)==='1'){held=true;break}
   await delay(25)
  }
  assert.ok(held,'Cashier did not reach the product-before-currency barrier')
  const second = parallelSql(`set statement_timeout='15s';${actor(reserve(f.order_b,f.line_b,1))}`)
  const [cashier,reservation] = await Promise.all([first,second])
  assert.equal(cashier.code,0,cashier.stderr)
  assert.notEqual(reservation.code,0,'An80m promise consumed the cashier’s remaining70m')
  assert.match(reservation.stderr,/INSUFFICIENT_AVAILABLE_STOCK/)
  assert.equal(sql(`select sum(remaining_quantity)=70 from public.inventory_batches where product_id='${f.product_id}';`),'t')
  assert.equal(sql(`select status='issued' from public.invoices where id='${f.invoice_id}';`),'t')
  assert.equal(sql(`select count(*)=0 from public.trade_order_reservations where product_id='${f.product_id}' and status='active';`),'t')
 } finally { sql(`drop trigger ${trigger} on public.invoices;`) }
 // Two distinct collection requests against one revision must issue once.
 sql(actor(`select public.reserve_trade_order(gen_random_uuid(),'${f.shop_id}','${f.location_id}','${f.order_a}',5,'reserve','[{"lineId":"${f.line_a}","quantity":"50"}]',clock_timestamp()+interval '1 day','Reserve partial collection race material');`))
 const collectRequest=randomUUID(),collectionMarker=`collection-first-${randomUUID()}`
 const collect=`select public.fulfill_trade_order('${collectRequest}','${f.shop_id}','${f.location_id}','${f.order_a}',6,'[{"lineId":"${f.line_a}","quantity":"40"}]',false,'Concurrent contractor collection');`
 const firstCollection=parallelSql(`begin;set local statement_timeout='15s';set application_name='${collectionMarker}';${actor(collect)}select pg_sleep(1.5);commit;`)
 let collectionHeld=false
 for(let attempt=0;attempt<60;attempt++) {
  if(sql(`select count(*) from pg_stat_activity where application_name='${collectionMarker}' and wait_event='PgSleep';`)==='1'){collectionHeld=true;break}
  await delay(25)
 }
 assert.ok(collectionHeld,'Collection did not reach its held-commit barrier')
 const secondCollection=parallelSql(`set statement_timeout='15s';${actor(collect.replace(collectRequest,randomUUID()))}`)
 const [collected,conflicted]=await Promise.all([firstCollection,secondCollection])
 assert.equal(collected.code,0,collected.stderr)
 assert.notEqual(conflicted.code,0,'Concurrent collection issued the same visit twice')
 assert.match(conflicted.stderr,/ORDER_CONTEXT_CHANGED/)
 const retried=JSON.parse(sql(actor(collect)))
 assert.equal(retried.revision,7)
 assert.equal(sql(`select count(*)=1 from public.trade_order_deliveries where order_id='${f.order_a}';`),'t')
 assert.equal(sql(`select sum(remaining_quantity)=30 from public.inventory_batches where product_id='${f.product_id}';`),'t')
 assert.equal(sql(`select sum(remaining_quantity)=10 from public.trade_order_reservations where order_id='${f.order_a}' and status='active';`),'t')
 console.log('Order reservation races: PASS; competing holds, reservation-first sale and cashier-first product/currency barrier and distinct collection requests serialize without over-allocation, duplicate issuance or deadlock')
}
