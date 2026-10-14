import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import { readFile } from 'node:fs/promises'

export async function runProrationConcurrency(connection) {
  assert.ok(connection.host === '127.0.0.1' || connection.host?.startsWith('/tmp/'), 'Local disposable PostgreSQL only')
  assert.ok(connection.database?.startsWith('shop_proration_test_') || (process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted' && connection.database === 'postgres'), 'Verified disposable fixture database required')
  const admin = new pg.Client(connection)
  await admin.connect()
  // Synthetic pre-policy accepted credit quote, never an exposed runtime API.
  const prior = await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261013190345_proration_checkout_windows.sql', import.meta.url), 'utf8')
  await admin.query(prior.slice(prior.indexOf('create or replace function public.shop_xpay_proration_quote('), prior.indexOf('create or replace function public.shop_xpay_proration_order('))
    .replace('create or replace function public.shop_xpay_proration_quote(', 'create function pg_temp.historical_quote_create('))
  const paidOwner = randomUUID(), quoteOwner = randomUUID()
  let clientCount = 0
  async function concurrent(actor, sql, params, key) {
    const c = new pg.Client(connection)
    await c.connect()
    clientCount++
    try {
      await c.query('BEGIN')
      await c.query("select set_config('request.jwt.claim.role',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claims','{}',true)", [actor.role, actor.id || ''])
      await c.query(actor.role === 'service_role' ? 'SET LOCAL ROLE service_role' : 'SET LOCAL ROLE authenticated')
      await c.query('select pg_advisory_xact_lock_shared($1::bigint)', [key])
      const result = await c.query(sql, params)
      await c.query('COMMIT')
      return { ok: true, rows: result.rows }
    } catch (error) {
      await c.query('ROLLBACK')
      return { ok: false, code: error.code, message: error.message }
    } finally { await c.end() }
  }
  async function race(actor, statements) {
    // Both workers must be waiting before an exclusive controller gate opens.
    // Shared worker locks allow simultaneous admission; they do not serialize
    // the mutations being tested or hide missing application locks.
    const key = randomInt(100000000, 1000000000)
    await admin.query('select pg_advisory_lock($1::bigint)', [key])
    const work = statements.map(({ sql, params }) => concurrent(actor, sql, params, key))
    try {
      const deadline = Date.now() + 5000
      for (;;) {
        const { rows } = await admin.query("select count(*)::int count from pg_locks where locktype='advisory' and objid=$1::oid and mode='ShareLock' and not granted and database=(select oid from pg_database where datname=current_database())", [key])
        if (rows[0].count === 2) break
        assert.ok(Date.now() < deadline, 'Both independent PostgreSQL workers must reach the barrier')
        await delay(10)
      }
    } finally { await admin.query('select pg_advisory_unlock($1::bigint)', [key]) }
    return Promise.all(work)
  }
  async function owner(id, sql, params) {
    await admin.query("select set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id])
    await admin.query('SET ROLE authenticated')
    try { return await admin.query(sql, params) } finally { await admin.query('RESET ROLE') }
  }
  try {
    await admin.query(`insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values($1::uuid,$1::text||'@proration-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()),($2::uuid,$2::text||'@proration-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now())`, [paidOwner, quoteOwner])
    await admin.query(`insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
      select id,v.name,v.slug,v.amount,'EGP','monthly',7,'{}','{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}',true,true,true,false
      from public.portals cross join(values('Race low','proration-race-low',349),('Race high','proration-race-high',699))v(name,slug,amount) where key='shop-crm' on conflict(portal_id,slug)do nothing`)
    await admin.query('select shop_private.reconcile_plan_catalog()')
    await admin.query("insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode)values(true,true,'merchant-proration-race','test')on conflict(singleton)do update set merchant_id=excluded.merchant_id,enabled=true,mode='test'")
    await admin.query('update shop_private.proration_configuration set enabled=true where singleton')
    const catalog = await admin.query("select catalog_terms_id,slug from public.shop_public_plan_catalog() where slug in('proration-race-low','proration-race-high') and billing_interval='monthly'")
    const high = catalog.rows.find(row => row.slug === 'proration-race-high')?.catalog_terms_id
    const low = catalog.rows.find(row => row.slug === 'proration-race-low')?.catalog_terms_id
    assert.ok(high && low)
    const shop = (await owner(paidOwner, "select public.create_owner_shop('Proration race paid','mixed'::public.business_mode,'Main',null,null,null) id")).rows[0].id
    const quote = (await owner(paidOwner, 'select public.shop_xpay_proration_quote($1,$2,$3) value', [randomUUID(), shop, high])).rows[0].value
    assert.equal(quote.calculation.mode, 'trial_conversion')
    assert.equal(quote.calculation.amountDueMinor, 69900)
    const order = (await owner(paidOwner, 'select public.shop_xpay_proration_order($1,$2) value', [shop, quote.quoteId])).rows[0].value
    const suffix = randomUUID().replaceAll('-', '')
    const session = { id: `cs_test_Pr${suffix}`, object: 'checkout.session', merchantId: order.merchantId, livemode: false, currency: 'EGP', amountTotal: order.amountMinor, status: 'complete', paymentStatus: 'paid', paymentIntentId: `pi_test_Pr${suffix}`, metadata: { orderId: order.id } }
    const paidRace = await race({ role: 'service_role' }, [1, 2].map(() => ({ sql: 'select public.shop_xpay_apply_session($1::jsonb) value', params: [JSON.stringify(session)] })))
    assert.deepEqual(paidRace.map(result => result.ok), [true, true])
    const paidCounts = (await admin.query(`select jsonb_build_object('observations',(select count(*) from public.shop_xpay_paid_observations where order_id=$1),
      'payments',(select count(*) from public.shop_xpay_payments where order_id=$1),'settlements',(select count(*) from public.shop_proration_settlements where quote_id=$2),
      'ledger',(select count(*) from public.shop_proration_credit_ledger where quote_id=$2),'periods',(select count(*) from public.subscription_commercial_periods where proration_quote_id=$2)) value`, [order.id, quote.quoteId])).rows[0].value
    assert.deepEqual(paidCounts, { observations: 1, payments: 1, settlements: 1, ledger: 1, periods: 1 })
    const credit = (await owner(paidOwner, 'select pg_temp.historical_quote_create($1,$2,$3) value', [randomUUID(), shop, low])).rows[0].value
    assert.equal(credit.calculation.amountDueMinor, 0)
    const creditRace = await race({ role: 'authenticated', id: paidOwner }, [1, 2].map(() => ({ sql: 'select public.shop_xpay_proration_credit_confirm($1,$2) value', params: [shop, credit.quoteId] })))
    assert.deepEqual(creditRace.map(result => result.ok), [true, true])
    const creditCounts = (await admin.query(`select jsonb_build_object('settlements',(select count(*) from public.shop_proration_settlements where quote_id=$1),
      'ledger',(select count(*) from public.shop_proration_credit_ledger where quote_id=$1),'periods',(select count(*) from public.subscription_commercial_periods where proration_quote_id=$1),
      'orders',(select count(*) from public.shop_xpay_orders where quote->>'prorationQuoteId'=$1::text)) value`, [credit.quoteId])).rows[0].value
    assert.deepEqual(creditCounts, { settlements: 1, ledger: 1, periods: 1, orders: 0 })
    const version = (await admin.query('select version from public.shop_proration_credit_accounts where subscription_id=(select subscription_id from public.shop_proration_quotes where id=$1)', [credit.quoteId])).rows[0].version
    assert.equal(Number(version), 2)
    const quoteShop = (await owner(quoteOwner, "select public.create_owner_shop('Proration race quotes','mixed'::public.business_mode,'Main',null,null,null) id")).rows[0].id
    const quoteRace = await race({ role: 'authenticated', id: quoteOwner }, [1, 2].map(() => ({ sql: 'select public.shop_xpay_proration_quote($1,$2,$3) value', params: [randomUUID(), quoteShop, high] })))
    assert.equal(quoteRace.filter(result => result.ok).length, 1)
    assert.equal(quoteRace.find(result => !result.ok)?.code, '55000')
    const snapshotSql = `select jsonb_build_object('subscription',to_jsonb(s),'orders',(select count(*) from public.shop_xpay_orders where shop_id=$2)) value from public.subscriptions s where id=(select subscription_id from public.shop_proration_quotes where id=$1)`
    const beforeRepurchase = (await admin.query(snapshotSql, [credit.quoteId, shop])).rows[0].value
    const repurchases = await race({ role: 'authenticated', id: paidOwner }, [1, 2].map(() => ({ sql: 'select public.shop_xpay_order_create($1,$2,$3) value', params: [randomUUID(), shop, low] })))
    assert.ok(repurchases.every(result => !result.ok && result.code === '55000' && result.message === 'XPAY_ACTIVE_PERIOD_EXISTS'))
    assert.deepEqual((await admin.query(snapshotSql, [credit.quoteId, shop])).rows[0].value, beforeRepurchase)
    assert.equal(clientCount, 8)
    console.log('Eight independent PostgreSQL workers: paid/credit replays settle once, competing quotes admit one, active prepaid repurchases both deny. Shared start barriers verified.')
  } finally { await admin.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Requires GitHub Actions')
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'No self-hosted or customer environment')
  assert.equal(process.env.SHOP_XPAY_DISPOSABLE, '1', 'Explicit disposable payment job required')
  await runProrationConcurrency({ host: '127.0.0.1', port: 61322, user: 'postgres', password: 'postgres', database: 'postgres' })
}
