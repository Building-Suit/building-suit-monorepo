import test from 'node:test'
import assert from 'node:assert/strict'
import {incidentBudget,incidentProgressFingerprint} from '../runner/incident-progress.mjs'
const launch=(i,progressed=true)=>({status:'finished',launched_at:new Date(i*1000).toISOString(),finished_at:new Date(i*1000+1).toISOString(),progressed})
test('only actual child launches count; reservations prevent concurrent overspend',()=>{
 assert.equal(incidentBudget([{status:'aborted'}],0).actual_invocations,0)
 assert.equal(incidentBudget([launch(0),launch(1),launch(2)],3000).reason,'invocation_limit')
 assert.equal(incidentBudget([launch(0),launch(1),{status:'reserved'}],3000).allowed,false)
})
test('45 minute deadline persists across claims and restart',()=>{
 assert.equal(incidentBudget([launch(0)],45*60_000).reason,'wall_clock_limit')
})
test('two consecutive investigations without meaningful progress trip fuse',()=>{
 assert.equal(incidentBudget([launch(0,false),launch(1,false)],3000).reason,'no_progress_fuse')
 assert.equal(incidentBudget([launch(0,false),launch(1,true)],3000).allowed,true)
})
test('timestamps, claims and prose do not count as progress',()=>{
 assert.equal(incidentProgressFingerprint({timestamp:1,claims:2}),incidentProgressFingerprint({timestamp:99,claims:100}))
 assert.notEqual(incidentProgressFingerprint({source_hash:'a'}),incidentProgressFingerprint({source_hash:'b'}))
})
