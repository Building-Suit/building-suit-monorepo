import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chromium} from '@playwright/test'
import {classifyHealth} from '../runner/dot-health-state.mjs'
test('operator health renders actionable exhaustion and never a bare unaudited human gate',async()=>{
 const browser=await chromium.launch({headless:true})
 try{
 const page=await browser.newPage(),now=new Date().toISOString()
 const audit={all_attempts_audited:true,action:'operator-gate',root_cause:'Active rail is inaccessible to keyboard users',failed_check:'shell-keyboard',entries:[1,2,3,4,5].map(attempt=>({attempt,charged:true})),remaining_product_defect:'Focus never reaches active workspace',automatic_repair_blocker:'Five genuine product repairs exhausted',required_authorization:'Authorize exactly one additional bounded shell repair'}
 const input={run:{run_id:'original',status:'running',max_tasks:2,completed_tasks:0},task:{task_id:'SHELL',status:'failed'},recovery:{status:'active',error_code:'retry_budget_exhausted',condition:{exhaustion_audit:audit}}}
 let row=classifyHealth(input)
 await page.route('http://dot.fixture/api/status',r=>r.fulfill({json:{rows:[row],alerts:[],collected_at:now,watchdog_last_cycle:now}}))
 await page.route('http://dot.fixture/',r=>r.fulfill({contentType:'text/html',body:readFileSync(new URL('../runner/dot-health.html',import.meta.url),'utf8')}))
 await page.goto('http://dot.fixture/')
 await page.waitForFunction(()=>document.body.textContent.includes('shell-keyboard'))
 const body=await page.locator('body').innerText()
 for(const value of [audit.root_cause,audit.failed_check,audit.remaining_product_defect,audit.automatic_repair_blocker,audit.required_authorization,'legitimate_attempts'])assert.ok(body.includes(value))
 row=classifyHealth({...input,recovery:{status:'active',error_code:'retry_budget_exhausted',next_action:'wait-operator'}})
 await page.reload()
 await page.waitForFunction(()=>document.body.textContent.includes('Retry exhaustion requires automatic evidence audit'))
 assert.equal(row.operator_action_required,false)
 assert.ok((await page.locator('#runs').innerText()).includes('NO'))
 }finally{await browser.close()}
})
