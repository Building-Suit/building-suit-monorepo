import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
if (process.env.ACCOUNT_PROVISION_DISPOSABLE !== '1') throw new Error('Run only in the explicitly disposable account verifier')
const target = ['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At']
function sql(value, allowFailure = false) {
  return new Promise((resolve,reject) => {
    const child = spawn('docker',target)
    let out=''; let err=''
    child.stdout.on('data',data => { out += data }); child.stderr.on('data',data => { err += data })
    child.on('error',reject)
    child.on('close',code => code && !allowFailure ? reject(new Error(err)) : resolve({code,out,err}))
    child.stdin.end(value)
  })
}
const auth = (user,command) => `select set_config('request.jwt.claim.sub','${user}',false); set role authenticated; ${command}`
for (const order of ['currency-first','issue-first','race']) {
  const user=randomUUID()
  const fixture = await sql(`insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${user}','${user}@currency-fixture.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());
    ${auth(user,`do $$ declare shop uuid; location uuid; staff uuid; service uuid; customer uuid; invoice uuid; begin
      shop := public.create_owner_shop('Currency concurrency fixture','team','service');
      perform public.save_business_currency(shop,'USD');
      select id into location from public.shop_locations where shop_id=shop and is_default;
      select id into staff from public.shop_memberships where shop_id=shop and role='owner';
      customer := public.save_customer(shop,null,'Synthetic credit customer',null,null,null,null);
      service := public.save_service(shop,null,'Synthetic service',null,75,'amount',5);
      invoice := public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
      perform set_config('currency.fixture',jsonb_build_object('shop',shop,'location',location,'invoice',invoice)::text,false);
    end; $$; select current_setting('currency.fixture');`)}`)
  const ids = JSON.parse(fixture.out.trim().split('\n').at(-1))
  const change = auth(user,`select public.save_business_currency('${ids.shop}','EUR');`)
  const issue = auth(user,`select public.issue_location_sale('${randomUUID()}','${ids.shop}','${ids.location}','${ids.invoice}');`)
  let result
  if (order==='currency-first') { result=await sql(change,true); await sql(issue) }
  else if (order==='issue-first') { await sql(issue); result=await sql(change,true) }
  else [result] = await Promise.all([sql(change,true),sql(issue)])
  if (result.code) assert.match(result.err,/SHOP_CURRENCY_LOCKED/)
  const state = await sql(auth(user,`select jsonb_build_object('settings',public.business_currency_settings('${ids.shop}'),'sale',public.get_location_sale('${ids.shop}','${ids.location}','${ids.invoice}'));`))
  const value = JSON.parse(state.out.trim().split('\n').at(-1))
  assert.equal(value.settings.locked,true)
  assert.equal(value.sale.currency,value.settings.currency)
  assert.equal(Number(value.sale.total_amount),70)
  assert.equal(value.settings.currency,result.code?'USD':'EUR')
  if (order==='currency-first') assert.equal(result.code,0)
  if (order==='issue-first') assert.notEqual(result.code,0)
  console.log(`business currency / first issuance ${order}: passed; issued units and amount preserved`)
}
// Fixtures are isolated in this disposable CI database and remain for diagnosis.
// This runner never deletes records or accepts a hosted target.
