import assert from 'node:assert/strict'
import { parseProrationQuote } from '../../apps/shop-suit/app/utils/proration-quote.mjs'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Requires GitHub Actions')
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'No self-hosted or customer environment')
assert.equal(process.env.SHOP_XPAY_DISPOSABLE, '1', 'Explicit disposable payment job required')
const sql = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_xpay_payments.sql', import.meta.url), 'utf8')
const proration = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_quotes.sql', import.meta.url), 'utf8')
const settlement = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_settlement.sql', import.meta.url), 'utf8')
const checkoutDetails = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_checkout_details.sql', import.meta.url), 'utf8')
const journeys = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_journeys.sql', import.meta.url), 'utf8')
const windows = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_checkout_windows.sql', import.meta.url), 'utf8')
const activationMigration = await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261014063640_staging_proration_activation.sql', import.meta.url), 'utf8')
const activationFixture = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_staging_activation.sql', import.meta.url), 'utf8')
const activation = activationFixture.replaceAll('-- APPLY_REVIEWED_ACTIVATION_MIGRATION', activationMigration)
// Test-only admission under the former policy constructs already-legitimate
// historical receipts. The deployed public constructor remains guarded.
const historicalOrder = (await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261014051811_checkout_recovery_proration_integration.sql', import.meta.url), 'utf8'))
  .replace('create or replace function public.shop_xpay_order_create(', 'create function pg_temp.historical_order_create(')
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], {
  input: `BEGIN;\n${activation}\nROLLBACK;\nBEGIN;\n${historicalOrder}\n${proration}\n${sql}\nROLLBACK;\nBEGIN;\n${settlement}\n${checkoutDetails}\nROLLBACK;\nBEGIN;\n${historicalOrder}\n${journeys}\n${windows}\nROLLBACK;`, encoding: 'utf8', timeout: 120000,
})
if (result.status !== 0) {
  // This job has only synthetic records, but never print CLI status or credentials.
  console.error(result.stderr.slice(-6000))
  process.exitCode = 1
} else {
  const rows = result.stdout.split('\n').filter(line => line.trim().startsWith('{"prorationContract":')).map(line => JSON.parse(line).prorationContract)
  assert.ok(rows.length >= 10, 'Expected real disposable quote projections across financial states')
  for (const row of rows) {
    const parsed = parseProrationQuote(row)
    assert.equal(parsed.quoteId, row.quoteId)
    assert.equal(parsed.calculation.amountDueMinor, row.calculation.amountDueMinor)
    assert.equal(parsed.calculation.unusedPrepaidMinor, row.calculation.unusedPrepaidMinor)
    assert.equal(parsed.calculation.serviceValueMinor, row.calculation.serviceValueMinor)
    assert.equal('offerBinding' in parsed, false)
  }
  console.log(`Disposable staging activation boundaries, SQL authority, settlement and ${rows.length} real SQL/client quote projections passed and rolled back`)
}

// Race two independent PostgreSQL connections at first fulfillment. All writes
// remain in this throwaway runner; no hosted credentials or provider requests.
if (result.status === 0) {
  const { randomUUID } = await import('node:crypto')
  const { spawn } = await import('node:child_process')
  const ownerId = randomUUID(), requestId = randomUUID()
  const catalog = sql.slice(sql.indexOf('insert into public.plans'), sql.indexOf('create temporary table'))
  function execute(input) {
    const output = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-Atq', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', timeout: 120000 })
    assert.equal(output.status, 0, output.stderr.slice(-3000))
    return JSON.parse(output.stdout.trim().split('\n').filter(line => line.startsWith('{')).at(-1))
  }
  const order = execute(`
${catalog}
insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode) values(true,true,'merchant-race-fixture','test');
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('${ownerId}','${ownerId}@xpay-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','${ownerId}',false),set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
select public.create_owner_shop('Concurrent XPay fixture','mixed'::public.business_mode,'Main',null,null,null) as shop_id \\gset
select catalog_terms_id as terms_id from public.shop_public_plan_catalog() where slug='solo' and billing_interval='monthly' order by price_amount limit 1 \\gset
select (public.shop_xpay_order_create('${requestId}',:'shop_id'::uuid,:'terms_id'::uuid)->>'id') as order_id \\gset
reset role;
select set_config('request.jwt.claim.role','service_role',false);
set role service_role;
select public.shop_xpay_server_order(:'order_id'::uuid);
`)
  const paid = JSON.stringify({ id: 'cs_test_Racefixture', object: 'checkout.session', merchantId: order.merchantId, livemode: false, metadata: { orderId: order.id }, currency: 'EGP', amountTotal: order.amountMinor, status: 'complete', paymentStatus: 'paid', paymentIntentId: 'pi_test_Racefixture' })
  async function race(event) {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-Atq', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
      let errors = '', output = ''
      child.stderr.on('data', chunk => { errors += chunk })
      child.stdout.on('data', chunk => { output += chunk })
      child.on('error', reject)
      child.on('close', code => {
        if (code !== 0) reject(new Error(errors.slice(-3000)))
        else resolve(output)
      })
      child.stdin.end(`begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
select public.shop_xpay_inbox_receive('${event}','checkout.session.completed','cs_test_Racefixture','merchant-race-fixture','test',repeat('a',64));
select public.shop_xpay_apply_session('${paid}'::jsonb,'${event}');commit;`)
    })
  }
  await Promise.all([race('evt_ci_race1'), race('evt_ci_race2')])
  const counts = execute(`select jsonb_build_object(
'payments',(select count(*) from public.shop_xpay_payments where order_id='${order.id}'),
'observations',(select count(*) from public.shop_xpay_paid_observations where order_id='${order.id}'),
'periods',(select count(*) from public.subscription_commercial_periods where xpay_order_id='${order.id}'));`)
  assert.deepEqual(counts, { payments: 1, observations: 1, periods: 1 })
  console.log('Two concurrent PostgreSQL workers produced one payment, one observation and one commercial period')
  const guardedEnd = execute(`select jsonb_build_object('end',current_period_end) from public.subscriptions where id=(select subscription_id from public.shop_xpay_orders where id='${order.id}');`)
  async function deniedRepurchase(intent) {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-Atq', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
      let errors = ''
      child.stderr.on('data', chunk => { errors += chunk })
      child.on('error', reject)
      child.on('close', code => { if (code) reject(new Error(errors.slice(-3000))); else resolve() })
      child.stdin.end(`begin;select set_config('request.jwt.claim.sub','${ownerId}',true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.headers','${JSON.stringify({ 'x-shop-payment-intent': intent, 'x-shop-prior-paid-order': order.id })}',true);set local role authenticated;
do $$begin perform public.shop_xpay_order_create('${randomUUID()}','${order.shopId}', '${order.quote.catalogTermsId}');raise exception 'Concurrent prepaid repurchase accepted';exception when sqlstate '55000' then if sqlerrm<>'XPAY_ACTIVE_PERIOD_EXISTS' then raise;end if;end $$;rollback;`)
    })
  }
  await Promise.all([deniedRepurchase('renew'), deniedRepurchase('change')])
  const guardedAfter = execute(`select jsonb_build_object('end',current_period_end) from public.subscriptions where id=(select subscription_id from public.shop_xpay_orders where id='${order.id}');`)
  assert.deepEqual(guardedAfter, guardedEnd)
  assert.equal(execute(`select jsonb_build_object('count',count(*)) from public.shop_xpay_orders where shop_id='${order.shopId}';`).count, 1)
  console.log('Two independent concurrent active repurchases denied; existing paid end/order count unchanged')
}
