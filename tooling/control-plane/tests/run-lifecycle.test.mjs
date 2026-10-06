import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runIsActionable,historicalHealth} from '../runner/run-lifecycle.mjs'
import {classifyHealth} from '../runner/dot-health-state.mjs'
import {dispatchRecovery} from '../runner/dot-general-recovery.mjs'
test('terminal runs excluded despite stale STUCK observations or counters',async()=>{
 for(const status of ['finished','limit_reached','cancelled','stopped','closed','superseded','failed']){
  const run={run_id:'history',status,current_task_id:null,finished_at:'2026-10-01',completed_tasks:0,max_tasks:7}
  assert.equal(runIsActionable(run),false)
  const h=classifyHealth({run,recovery:{error_code:'retry_budget_exhausted',status:'active'}})
  assert.equal(h.history_only,true);assert.equal(h.operator_action_required,false)
  let claimed=0
  await dispatchRecovery({health:{...h,state:'STUCK'},claim:async()=>{claimed++;return {claimed:true}},start:async()=>{throw Error('terminal recovery launched')}})
  assert.equal(claimed,0)
  const old=JSON.stringify(run),history=historicalHealth(run,{classification:'CLOSED',reason:'audited no remaining scope'})
  assert.equal(history.state,'CLOSED');assert.equal(history.completed_tasks,0);assert.equal(JSON.stringify(run),old)
 }
})
test('actual active dependency remains visible; terminal history collapsed separately',()=>{
 const run={run_id:'active',status:'running',current_task_id:null,completed_tasks:2,max_tasks:14}
 assert.equal(runIsActionable(run),true)
 const h=classifyHealth({run,admission:{task_id:'SS-LAUNCH-TEAM-001',dependencies:[{task_id:'BS-REALTIME-FOUNDATION-001',status:'planned',owned:true}]}})
 assert.equal(h.state,'WAITING_DEPENDENCY');assert.match(h.why,/BS-REALTIME-FOUNDATION-001/)
 const html=readFileSync(new URL('../runner/dot-health.html',import.meta.url),'utf8')
 assert.match(html,/<details id="history-section">/);assert.doesNotMatch(html,/<details id="history-section"[^>]*open/)
 const sql=readFileSync(new URL('../runner/dot-health-inputs.sql',import.meta.url),'utf8')
 assert.match(sql,/control.run_is_actionable/);assert.doesNotMatch(sql,/OR EXISTS\(SELECT 1 FROM control.dot_health_observations/)
})
