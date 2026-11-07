import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

// Both callers own and destroy their disposable backend. No connection/tenant
// override, hosted URL or credential is accepted by this fixture.
export async function verifySupplierOrderRaces(sql, parallelSql) {
 const schema = `supplier_order_race_${randomUUID().replaceAll('-','')}`
 sql(`create schema ${schema};`)
 sql(readFileSync(new URL('../../apps/shop-suit/supabase/tests/fixtures/supplier_order_concurrency_setup.sql',import.meta.url),'utf8').replaceAll('supplier_order_test',schema))
 const row = JSON.parse(sql(`select row_to_json(r) from ${schema}.race r;`))
 const actor = body => `set request.jwt.claim.sub='${row.owner_id}';set request.jwt.claim.role='authenticated';set role authenticated;${body}`
 const receive = (id,revision,quantity,number) => `select public.receive_supplier_order('${id}','${row.shop_id}','${row.location_id}','${row.order_id}',${revision},current_date,'${number}','[{"lineId":"${row.line_id}","quantity":"${quantity}"}]','Concurrent source receipt');`
 async function barrier(name) {
  for(let attempt=0;attempt<40;attempt++){
   if(sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`)==='1')return
   await delay(25)
  }
  assert.fail('Supplier receipt did not reach its held-commit barrier')
 }
 const firstId=randomUUID(),secondId=randomUUID()
 const first=parallelSql(`begin;set application_name='supplier-first-receipt';${actor(receive(firstId,2,'6','PO-RACE-SIX'))}select pg_sleep(1.5);commit;`)
 await barrier('supplier-first-receipt')
 const second=parallelSql(actor(receive(secondId,2,'6','PO-RACE-EXCESS')))
 const [one,two]=await Promise.all([first,second])
 assert.equal(one.code,0,one.stderr)
 assert.notEqual(two.code,0,'Two staff over-received the same ten-reel promise')
 assert.match(two.stderr,/SUPPLIER_ORDER_CONTEXT_CHANGED/)
 assert.equal(sql(`select count(*)=1 and sum(total_amount)=15000 from public.vendor_invoices where shop_id='${row.shop_id}';`),'t')
 assert.equal(sql(`select sum(remaining_quantity)=600 from public.inventory_batches where product_id='${row.product_id}';`),'t')
 assert.equal(sql(`select count(*)=6 from public.inventory_reels where product_id='${row.product_id}';`),'t')
 const firstInvoice=sql(`select id from public.vendor_invoices where shop_id='${row.shop_id}' and request_id='${firstId}';`)
 assert.equal(JSON.parse(sql(actor(receive(firstId,2,'6','PO-RACE-SIX')))).invoiceId,firstInvoice)
 const lastId=randomUUID(),lastCommand=receive(lastId,3,'4','PO-RACE-FOUR')
 const last=parallelSql(`begin;set application_name='supplier-last-receipt';${actor(lastCommand)}select pg_sleep(1.5);commit;`)
 await barrier('supplier-last-receipt')
 const duplicate=parallelSql(actor(lastCommand))
 const [lastResult,duplicateResult]=await Promise.all([last,duplicate])
 assert.equal(lastResult.code,0,lastResult.stderr);assert.equal(duplicateResult.code,0,duplicateResult.stderr)
 const lastInvoice=sql(`select id from public.vendor_invoices where shop_id='${row.shop_id}' and request_id='${lastId}';`)
 assert.equal(JSON.parse(duplicateResult.stdout.trim()).invoiceId,lastInvoice)
 assert.equal(sql(`select count(*)=2 and sum(total_amount)=25000 from public.vendor_invoices where shop_id='${row.shop_id}';`),'t')
 assert.equal(sql(`select sum(remaining_quantity)=1000 from public.inventory_batches where product_id='${row.product_id}';`),'t')
 assert.equal(sql(`select count(*)=10 from public.inventory_reels where product_id='${row.product_id}';`),'t')
 const context=JSON.parse(sql(actor(`select public.supplier_order_context('${row.shop_id}','${row.location_id}','${row.order_id}');`)))
 assert.equal(context.detail.record.status,'received');assert.equal(context.detail.lines[0].remaining_entered_quantity,'0');assert.equal(context.detail.receiptTotal,2)
 console.log('Supplier order receipt races: PASS; distinct six-of-ten requests issue one receipt, identical final four requests share one receipt; ten reels, two invoices and original cost remain')
}
