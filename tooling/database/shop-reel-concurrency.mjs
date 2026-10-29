import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

// Callers must own a disposable backend; fixtures create real business history.
export async function verifyPhysicalReelRace(sql, parallelSql) {
  const schema = `reel_race_${randomUUID().replaceAll('-','')}`
  sql(`create schema ${schema};`)
  sql(readFileSync(new URL('../../apps/shop-suit/supabase/tests/fixtures/reel_concurrency_setup.sql', import.meta.url), 'utf8').replaceAll('measurement_test',schema))
  const reels = JSON.parse(sql(`select row_to_json(f) from ${schema}.reel_race f;`))
  const reelActor = body => `set request.jwt.claim.sub='${reels.owner_id}';set request.jwt.claim.role='authenticated';set role authenticated;${body}`
  const firstCut = parallelSql(`begin;set application_name='physical-reel-race';${reelActor(`select public.issue_location_sale(gen_random_uuid(),'${reels.shop_id}','${reels.location_id}','${reels.invoice_a}');`)}select pg_sleep(1.5);commit;`)
  let cutLock = false
  for (let attempt = 0; attempt < 40; attempt++) {
    if (sql("select count(*) from pg_stat_activity where application_name='physical-reel-race' and wait_event='PgSleep';") === '1') { cutLock = true; break }
    await delay(25)
  }
  assert.ok(cutLock, 'Physical cut did not reach its held-lock barrier')
  const secondCut = parallelSql(reelActor(`select public.issue_location_sale(gen_random_uuid(),'${reels.shop_id}','${reels.location_id}','${reels.invoice_b}');`))
  const [wonCut,lostCut] = await Promise.all([firstCut,secondCut])
  assert.equal(wonCut.code,0,wonCut.stderr)
  assert.notEqual(lostCut.code,0,'Two cashiers oversold one physical reel')
  assert.ok(/INSUFFICIENT_STOCK|CONTINUOUS_LENGTH_UNAVAILABLE/.test(lostCut.stderr),lostCut.stderr)
  assert.equal(sql(`select remaining_length=5 from public.inventory_reels where product_id='${reels.product_id}';`),'t')
  assert.equal(sql(`select remaining_quantity=5 from public.inventory_batches where product_id='${reels.product_id}';`),'t')
  assert.equal(sql(`select count(*) from public.inventory_reel_cuts where reel_id in(select id from public.inventory_reels where product_id='${reels.product_id}');`),'1')
  console.log('Physical reel cashier race: PASS; one10m cut committed from15m, waiting cashier rolled back; exactly5m and one cut remain')
}
