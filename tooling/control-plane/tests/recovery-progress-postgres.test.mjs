import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const database=process.env.CP_EGRESS_TEST_DATABASE, container=process.env.CP_EGRESS_TEST_CONTAINER
// Explicitly provision schema <=103 +105; never install the unrelated draft 104.
test('Shop and SAS real recovery regressions preserve generations, charges, wakes, budgets and history',{skip:!database},()=>{
 assert.match(database,/^cp_[a-z0-9_]+$/);assert.match(container,/^cp-.*(?:disposable|test|fixture)/)
 const run=input=>{const r=spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-Xq','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stderr);return r.stdout}
 assert.match(run(readFileSync(new URL('./recovery-progress-smoke.sql',import.meta.url))),/SHOP_SAS_RECOVERY_PROGRESS_HISTORY_BUDGET_DEPENDENCY_PASS/)
})
