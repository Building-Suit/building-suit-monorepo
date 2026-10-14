import assert from 'node:assert/strict'
import test from 'node:test'
import { projectOfflineCash, isCounterCashAmount } from '../../app/utils/offlineCashProjection.js'
const record = (kind,args,state='unsynced',resolution) => ({ state,resolution,envelope:{command:{kind,args}} })
test('provisional drawer sums exact cents and isolates non-cash/other-drawer commands',()=>{
  const records=[record('sale',{p_shift_id:'drawer',p_method:'cash',p_amount:0.1}),record('movement',{p_session_id:'drawer',p_kind:'pay_in',p_amount:0.2}),record('sale',{p_shift_id:'drawer',p_method:'card',p_amount:100}),record('movement',{p_session_id:'other',p_kind:'pay_out',p_amount:100}),record('close',{p_session_id:'drawer',p_counted_amount:100})]
  assert.equal(projectOfflineCash({id:'drawer',expectedCash:1},records),1.3)
})
test('failed amounts remain provisional until acknowledged; synced and reconciled effects do not count twice',()=>{
  const records=[record('sale',{p_shift_id:'drawer',p_method:'cash',p_amount:5},'failed',{phase:'cancelled'}),record('movement',{p_session_id:'drawer',p_kind:'pay_out',p_amount:2}),record('sale',{p_shift_id:'drawer',p_method:'cash',p_amount:20},'synced'),record('sale',{p_shift_id:'drawer',p_method:'cash',p_amount:100},'failed',{phase:'reconciled'})]
  assert.equal(projectOfflineCash({id:'drawer',expectedCash:20},records),23)
  assert.equal(projectOfflineCash(null,records),0)
})

test('cash validation accepts genuine cents despite floating-point multiplication and rejects fractional cents',()=>{
  assert.equal(isCounterCashAmount(0.29),true)
  assert.equal(isCounterCashAmount(0.291),false)
  assert.equal(isCounterCashAmount(0,true),true)
  assert.equal(isCounterCashAmount(-1),false)
})
