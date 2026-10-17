import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { makeFixture,login,rpc,saleArgs,sql,localApi,localAnonKey } from './helpers/offline-fixture.mjs'
const fixture=makeFixture()
const [tokenA,tokenB]=await Promise.all([login(fixture),login(fixture)])
const args=saleArgs(fixture)
const duplicates=await Promise.all([rpc(tokenA,'replay_offline_pos_sale',args),rpc(tokenB,'replay_offline_pos_sale',args)])
assert.ok(duplicates.every(result=>result.ok),JSON.stringify(duplicates.map(result=>({status:result.status,code:result.data?.code,message:result.data?.message}))));assert.equal(duplicates[0].data,duplicates[1].data)
assert.equal(sql(`select count(*) from public.payments where invoice_id='${duplicates[0].data}';`),'1')
assert.equal(sql(`select count(*) from public.inventory_movements where reference_id='${duplicates[0].data}';`),'1')
const changed=await rpc(tokenA,'replay_offline_pos_sale',{...args,p_amount:21})
assert.ok(!changed.ok&&changed.data.message.includes('POS_REQUEST_CONFLICT'))
const anonymous=await fetch(`${localApi}/rest/v1/rpc/replay_offline_pos_sale`,{method:'POST',headers:{apikey:localAnonKey,'content-type':'application/json'},body:JSON.stringify(args)})
assert.ok(!anonymous.ok)
const outsider=makeFixture();const outsiderToken=await login(outsider)
assert.ok(!(await rpc(outsiderToken,'replay_offline_pos_sale',args)).ok)
const raceArgs=saleArgs(fixture)
const race=await Promise.all([
  rpc(tokenA,'replay_offline_pos_sale',raceArgs),
  rpc(tokenB,'reconcile_offline_pos_sale',{p_request_id:raceArgs.p_request_id,p_shop_id:fixture.shopId,p_location_id:fixture.locationId,p_original_args:raceArgs,p_resolution_request_id:randomUUID(),p_reason:'Operator requested cancellation of unposted offline transaction'}),
])
assert.ok(race[1].ok)
const cancelled=race[1].data.state==='cancelled'
if(cancelled) assert.ok(!race[0].ok&&race[0].data.message.includes('OFFLINE_SALE_CANCELLED'))
else {assert.ok(race[0].ok);assert.equal(race[0].data,race[1].data.invoiceId)}
const countBefore=Number(sql(`select count(*) from public.payments where shop_id='${fixture.shopId}';`))
assert.equal(countBefore,cancelled?1:2)
const closeArgs={p_request_id:randomUUID(),p_shop_id:fixture.shopId,p_session_id:fixture.shiftId,p_counted_amount:100+countBefore*20,p_notes:null}
const closingSale=saleArgs(fixture)
const closeRace=await Promise.all([
  rpc(tokenA,'replay_offline_pos_sale',closingSale),
  rpc(tokenB,'replay_offline_cash_command',{p_kind:'close',p_shop_id:fixture.shopId,p_args:closeArgs}),
])
assert.ok(closeRace[1].ok)
if(!closeRace[0].ok) assert.ok(closeRace[0].data.message.includes('OFFLINE_SHIFT_CONFLICT'))
const countAfter=Number(sql(`select count(*) from public.payments where shop_id='${fixture.shopId}';`))
assert.equal(countAfter,countBefore+(closeRace[0].ok?1:0))
const expected=Number(sql(`select expected_amount from public.cash_sessions where id='${fixture.shiftId}';`))
assert.equal(expected,100+countAfter*20)
assert.equal(Number(sql(`select count(*) from public.inventory_movements where shop_id='${fixture.shopId}' and reference_id in (select id from public.invoices where shop_id='${fixture.shopId}');`)),countAfter)
console.log('PASS: two real authenticated sessions replay identical IDs once; changed payload/anonymous/outsider denied; cancellation-vs-replay and close-vs-sale races preserve one outcome and exact drawer/stock effects. Synthetic fixture data retained; no physical-device claim.')
