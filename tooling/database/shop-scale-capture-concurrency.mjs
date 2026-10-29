import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
// Callers own and destroy the whole disposable backend. No hosted override.
export async function verifyScaleCaptureRaces(sql,parallelSql){
 const schema=`scale_capture_race_${randomUUID().replaceAll('-','')}`;sql(`create schema ${schema};`)
 sql(readFileSync(new URL('../../apps/shop-suit/supabase/tests/fixtures/scale_capture_concurrency_setup.sql',import.meta.url),'utf8').replaceAll('scale_capture_test',schema))
 const row=JSON.parse(sql(`select row_to_json(r) from ${schema}.race r;`)),actor=body=>`set request.jwt.claim.sub='${row.owner_id}';set request.jwt.claim.role='authenticated';set role authenticated;${body}`
 async function barrier(name){for(let n=0;n<60;n++){if(sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`)==='1')return;await delay(25)}assert.fail('Scale command did not reach its held-commit barrier')}
 const request=randomUUID(),reading={...row.reading,readAt:new Date().toISOString()},readSql=`'${JSON.stringify(reading).replaceAll("'","''")}'::jsonb`
 const record=id=>`select public.record_scale_capture('${id}','${row.shop_id}','${row.location_id}','${row.product_id}','${row.device_id}',1,${readSql});`
 const first=parallelSql(`begin;set application_name='scale-record-first';${actor(record(request))}select pg_sleep(1.5);commit;`);await barrier('scale-record-first')
 const duplicate=parallelSql(actor(record(request))),[one,two]=await Promise.all([first,duplicate]);assert.equal(one.code,0,one.stderr);assert.equal(two.code,0,two.stderr)
 const capture=JSON.parse(two.stdout.trim()).id
 assert.equal(sql(`select count(*)=1 from public.scale_captures where shop_id='${row.shop_id}';`),'t');assert.equal(sql(`select count(*) from public.invoices where shop_id='${row.shop_id}';`),'0')
 const line=JSON.stringify([{item_type:'product',source_id:row.product_id,quantity:'0.25',unit_code:'kg',measurement_revision:1,measurement_capture:{kind:'scale',id:capture}}])
 const draft=id=>`select public.save_pos_sale_draft('${id}','${row.shop_id}','${row.location_id}',null,'${row.staff_id}',null,'${row.customer_id}',null,'${line}'::jsonb);`
 const winningRequest=randomUUID(),winning=parallelSql(`begin;set application_name='scale-draft-first';${actor(draft(winningRequest))}select pg_sleep(1.5);commit;`);await barrier('scale-draft-first')
 const losing=parallelSql(actor(draft(randomUUID()))),[won,lost]=await Promise.all([winning,losing]);assert.equal(won.code,0,won.stderr);assert.notEqual(lost.code,0);assert.match(lost.stderr,/SCALE_CAPTURE_ALREADY_ASSIGNED/)
 const invoice=sql(`select id from public.invoices where shop_id='${row.shop_id}';`);assert.equal(sql(`select count(*) from public.invoices where shop_id='${row.shop_id}';`),'1')
 sql(actor(`select public.issue_location_sale(gen_random_uuid(),'${row.shop_id}','${row.location_id}','${invoice}');`))
 assert.equal(sql(`select quantity_on_hand=4.75 from public.product_stock where product_id='${row.product_id}';`),'t')
 const values=JSON.stringify({label:'Synthetic race scale',model:'Protocol fixture, not hardware',serialNumber:'TEST-RACE-SCALE',serialOptions:{baudRate:9600,dataBits:8,stopBits:1,parity:'none',flowControl:'none'},evidenceReference:'Synthetic retired profile fixture',active:false,confirmed:false})
 const changing=parallelSql(`begin;set application_name='scale-profile-first';${actor(`select public.weighing_setup_command(gen_random_uuid(),'${row.shop_id}','${row.location_id}','device','${row.device_id}',1,'${values}'::jsonb,'Retire synthetic scale before capture');`)}select pg_sleep(1.5);commit;`);await barrier('scale-profile-first')
 const waiting=parallelSql(actor(record(randomUUID()))),[changed,denied]=await Promise.all([changing,waiting]);assert.equal(changed.code,0,changed.stderr);assert.notEqual(denied.code,0);assert.match(denied.stderr,/SCALE_DEVICE_CONTEXT_CHANGED/)
 assert.equal(sql(`select count(*)=1 from public.scale_captures where shop_id='${row.shop_id}';`),'t')
 console.log('Scale capture races: PASS; duplicate requests share one capture, competing drafts bind it once, and a waiting capture rechecks retired device approval without stock or partial sale changes')
}
