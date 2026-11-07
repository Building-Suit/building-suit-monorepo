import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
// Callers own and destroy the entire disposable backend; no hosted override.
export async function verifyCommodityPricingRaces(sql,parallelSql){
 const schema=`commodity_pricing_race_${randomUUID().replaceAll('-','')}`;sql(`create schema ${schema};`)
 sql(readFileSync(new URL('../../apps/shop-suit/supabase/tests/fixtures/commodity_pricing_concurrency_setup.sql',import.meta.url),'utf8').replaceAll('commodity_pricing_test',schema))
 const row=JSON.parse(sql(`select row_to_json(r) from ${schema}.race r;`)),actor=body=>`set request.jwt.claim.sub='${row.owner_id}';set request.jwt.claim.role='authenticated';set role authenticated;${body}`
 const json=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
 async function barrier(name){for(let n=0;n<60;n++){if(sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`)==='1')return;await delay(25)}assert.fail('Commodity command did not reach its held-commit barrier')}
 const command=(request,kind,id,revision,values,reason)=>`select public.commodity_pricing_command('${request}','${row.shop_id}','${kind}',${id?`'${id}'`:'null'},${revision},${json(values)},'${reason}');`
 const request=randomUUID(),quoteCommand=command(request,'quote',null,0,{...row.quote_values,evidenceReference:'Synthetic duplicate source request'},'Approve duplicate synthetic source')
 const first=parallelSql(`begin;set application_name='commodity-quote-first';${actor(quoteCommand)}select pg_sleep(1.5);commit;`);await barrier('commodity-quote-first')
 const second=parallelSql(actor(quoteCommand)),[one,two]=await Promise.all([first,second]);assert.equal(one.code,0,one.stderr);assert.equal(two.code,0,two.stderr)
 const duplicate=JSON.parse(two.stdout.trim());assert.equal(sql(`select count(*) from public.commodity_pricing_events where record_id='${duplicate.id}';`),'1')
 const update=command(randomUUID(),'rule',row.rule_id,1,{...row.rule_values,premiumPerBaseUnit:'6'},'Revise synthetic rule premium')
 const updating=parallelSql(`begin;set application_name='commodity-rule-first';${actor(update)}select pg_sleep(1.5);commit;`);await barrier('commodity-rule-first')
 const waiting=parallelSql(actor(command(randomUUID(),'rule',row.rule_id,1,{...row.rule_values,premiumPerBaseUnit:'7'},'Competing synthetic rule revision'))),[changed,stale]=await Promise.all([updating,waiting]);assert.equal(changed.code,0,changed.stderr);assert.notEqual(stale.code,0);assert.match(stale.stderr,/COMMODITY_CONTEXT_CHANGED/)
 assert.equal(sql(`select revision=2 and premium_per_base_unit=6 from public.product_commodity_rules where id='${row.rule_id}';`),'t')
 const retire=revision=>command(randomUUID(),'quote',row.quote_id,revision,{active:false,confirmed:false},'Retire synthetic source quote')
 const retiring=parallelSql(`begin;set application_name='commodity-retire-first';${actor(retire(1))}select pg_sleep(1.5);commit;`);await barrier('commodity-retire-first')
 const issue=()=>`select public.issue_location_sale(gen_random_uuid(),'${row.shop_id}','${row.location_id}','${row.invoice_id}');`
 const issuing=parallelSql(actor(issue())),[retired,denied]=await Promise.all([retiring,issuing]);assert.equal(retired.code,0,retired.stderr);assert.notEqual(denied.code,0);assert.match(denied.stderr,/COMMODITY_QUOTE_UNAVAILABLE/)
 assert.equal(sql(`select status='draft' and total_amount=25 from public.invoices where id='${row.invoice_id}';`),'t');assert.equal(sql(`select quantity_on_hand=10 from public.product_stock where product_id='${row.product_id}';`),'t')
 sql(actor(command(randomUUID(),'quote',row.quote_id,2,{active:true,confirmed:true},'Reapprove original synthetic source')))
 const selling=parallelSql(`begin;set application_name='commodity-sale-first';${actor(issue())}select pg_sleep(1.5);commit;`);await barrier('commodity-sale-first')
 const laterRetirement=parallelSql(actor(retire(3))),[sold,archived]=await Promise.all([selling,laterRetirement]);assert.equal(sold.code,0,sold.stderr);assert.equal(archived.code,0,archived.stderr)
 assert.equal(sql(`select status='issued' and total_amount=26 from public.invoices where id='${row.invoice_id}';`),'t');assert.equal(sql(`select quantity_on_hand=9 from public.product_stock where product_id='${row.product_id}';`),'t')
 assert.equal(sql(`select trade_pricing_snapshot#>>'{quote,price_per_kg}'='100' and trade_pricing_snapshot->>'premiumPerBaseUnit'='6' from public.invoice_items where invoice_id='${row.invoice_id}';`),'t')
 console.log('Commodity price races: PASS; identical approvals share one event, stale rule edits reject, retirement-first issuance rolls back, and sale-first issuance retains the exact original source and revised premium')
}
