import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
// Explicitly local disposable backend only. No hosted connection/env override.
function sql(input) {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'])
    let output = '', error = ''
    process.stdout.on('data', chunk => { output += chunk })
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve(output.trim().split('\n').at(-1)) : reject(new Error(error)))
    process.stdin.end(input)
  })
}
const owner = randomUUID()
const fixture = JSON.parse(await sql(`
 insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('${owner}','${owner}@concurrent-return.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());
 select set_config('request.jwt.claim.sub','${owner}',false),set_config('request.jwt.claim.role','authenticated',false);
 set role authenticated;
 do $$declare shop uuid; loc uuid; customer uuid; product uuid; sale uuid; line uuid; lines jsonb;plan jsonb;
 begin
 shop:=public.create_owner_shop('Concurrent returns fixture','mixed'::public.business_mode);
 select id into loc from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Concurrent customer',null,null,null,null);
 product:=public.save_product(shop,null,'Concurrent product',null,null,10);
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,3,'Original lot');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',10)));
 select id into line from public.invoice_items where invoice_id=sale;perform public.issue_sale(gen_random_uuid(),shop,sale);
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,100,clock_timestamp(),'card','original-card',null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',100)));
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',8,'disposition','resellable'));plan:=public.preview_sale_return(shop,loc,sale,lines);
 perform set_config('returns.fixture',jsonb_build_object('shop',shop,'loc',loc,'sale',sale,'line',line,'lines',lines,'plan',plan)::text,false);
 end;$$;select current_setting('returns.fixture');
`))
const auth = `select set_config('request.jwt.claim.sub','${owner}',false),set_config('request.jwt.claim.role','authenticated',false);set role authenticated;`
const command = (request, lines, plan, reason = 'Concurrent return') => `${auth} select public.create_sale_return('${request}','${fixture.shop}','${fixture.loc}','${fixture.sale}',$json$${JSON.stringify(lines)}$json$::jsonb,'${reason}',$json$${JSON.stringify(plan)}$json$::jsonb);`
const request = randomUUID()
const replay = await Promise.all([sql(command(request, fixture.lines, fixture.plan)), sql(command(request, fixture.lines, fixture.plan))])
assert.equal(replay[0], replay[1], 'concurrent replay returns one stable record')
await assert.rejects(sql(command(request, fixture.lines, fixture.plan, 'Conflicting payload')), /RETURN_REQUEST_CONFLICT/)
const doc = JSON.parse(await sql(`${auth}select public.get_sale_return('${fixture.shop}','${fixture.loc}','${replay[0]}');`))
const refund = doc.refunds[0].id
const complete = request => `${auth} select public.record_sale_return_refund('${request}','${fixture.shop}','${fixture.loc}','${refund}','external_record','bank-confirmed','External completion');`
const concurrent = await Promise.allSettled([sql(complete(randomUUID())), sql(complete(randomUUID()))])
assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1, 'one completion wins')
assert.match(concurrent.find(r => r.status === 'rejected').reason.message, /REFUND_ALREADY_COMPLETED/)
const lines = [{ lineId: fixture.line, quantity: 2, disposition: 'damaged' }]
const plan = JSON.parse(await sql(`${auth}select public.preview_sale_return('${fixture.shop}','${fixture.loc}','${fixture.sale}',$json$${JSON.stringify(lines)}$json$::jsonb);`))
const competing = await Promise.allSettled([sql(command(randomUUID(), lines, plan)), sql(command(randomUUID(), lines, plan))])
assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1, 'returnable quantity cannot be concurrently overspent')
assert.match(competing.find(r => r.status === 'rejected').reason.message, /RETURN_QUANTITY_EXCEEDED|RETURN_PREVIEW_CHANGED/)
const totals = JSON.parse(await sql(`select jsonb_build_object('returns',(select count(*) from public.sale_returns where invoice_id='${fixture.sale}'),'reserved',(select sum(f.amount) from public.sale_return_refunds f join public.sale_returns r on r.id=f.return_id where r.invoice_id='${fixture.sale}'),'completed',(select count(*) from public.sale_return_refund_events where refund_id='${refund}' and state='completed'));`))
assert.deepEqual(totals, { returns: 2, reserved: 100, completed: 1 })
console.log('Concurrent identical/conflicting returns, quantity/capacity races and refund completion passed; disposable fixture retained')
