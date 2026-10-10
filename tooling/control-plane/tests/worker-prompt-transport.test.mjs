import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { receiptPaths, startReceipt, readJson, atomicJson, durableExecute, stdinPromptRequest, storedPrompt, settleInterruptedReceipt, recoverInterruptedHandoff, receiptProcessAlive, receiptLocked } from '../runner/durable-process.mjs'
import { workerProcessClassification } from '../runner/dot.mjs'
import { retryWithoutProductAttempt } from '../runner/selfhealing.mjs'
import { planSupervisorStep } from '../runner/task-supervisor.mjs'
import { repairRetryDecision } from '../lib/retry-policy.mjs'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn) { for(let i=0;i<300;i++) { const value=fn(); if(value) return value; await sleep(20) } throw Error('fixture_timeout') }
function fixture() {
  const root=mkdtempSync(path.join(tmpdir(),'cp-prompt-'))
  const codex=path.join(root,'codex')
  writeFileSync(codex, `#!/usr/bin/env node\nconst fs=require('fs'),crypto=require('crypto');let prompt='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>prompt+=x);process.stdin.on('end',()=>{fs.appendFileSync(${JSON.stringify(path.join(root,'calls'))},'one\\n');console.log(JSON.stringify({hash:crypto.createHash('sha256').update(prompt).digest('hex'),bytes:Buffer.byteLength(prompt),args:process.argv.slice(2)}));});`,{mode:0o700})
  return {root,codex,cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
const hash = text => createHash('sha256').update(text).digest('hex')
const deadState = {pid:2147483647,start_stamp:'dead',started_at:new Date().toISOString()}

test('large multibyte stdin prompt preserves exact bytes and model/reasoning; no temporary prompt file', async()=>{
  const f=fixture();try {
    const prompt=' \n\t'+ 'أ🚀'.repeat(400000)+'\n\n '
    const args=['exec','--model','gpt-6.1-sol','-c','model_reasoning_effort="high"',prompt]
    const normalized=stdinPromptRequest(f.codex,args,{timeout:5000})
    assert.equal(normalized.args.at(-1),'-');assert.equal(normalized.options.input,prompt)
    const result=durableExecute(f.root,'large',f.codex,args,{cwd:f.root,timeout:5000})
    assert.equal(result.code,0);const output=JSON.parse(result.stdout)
    assert.equal(output.hash,hash(prompt));assert.equal(output.bytes,Buffer.byteLength(prompt))
    assert.deepEqual(output.args,[...args.slice(0,-1),'-'])
    const paths=receiptPaths(f.root,'large')
    assert.equal(readJson(paths.request).input,prompt);assert.equal(statSync(paths.request).mode&0o777,0o600)
    assert.equal(statSync(paths.dir).mode&0o777,0o700);assert.equal(existsSync(path.join(paths.dir,'prompt.txt')),false)
    assert.equal(storedPrompt(prompt+'\n'),prompt)
  } finally { f.cleanup() }
})
test('immutable legacy argv request is consumed through stdin after restart',async()=>{
 const f=fixture();try {
  const paths=receiptPaths(f.root,'legacy');const prompt=' '+ 'x'.repeat(200000)+'\n'
  const request={program:f.codex,args:['exec','--model','gpt-6.1-sol',prompt],cwd:f.root,timeout:5000}
  atomicJson(paths.request,request);startReceipt(paths,request)
  const result=await until(()=>readJson(paths.result));assert.equal(result.code,0);assert.equal(JSON.parse(result.stdout).hash,hash(prompt))
  assert.deepEqual(readJson(paths.request),request)
 }finally{f.cleanup()}
})
test('spawn failure before PID settles a private infrastructure receipt',async()=>{
 const f=fixture();try {
  const paths=receiptPaths(f.root,'missing');startReceipt(paths,{program:path.join(f.root,'missing'),args:[],cwd:f.root,timeout:1000})
  const result=await until(()=>readJson(paths.result));assert.equal(result.code,1);assert.equal(result.error,'ENOENT');assert.equal(readJson(paths.state).child,undefined)
  assert.equal(workerProcessClassification(result).component,'worker-transport');assert.equal(retryWithoutProductAttempt(workerProcessClassification(result)),true)
 }finally{f.cleanup()}
})
test('synchronous E2BIG writes a result without exposing the oversized argument',async()=>{
 const f=fixture();try {
  const paths=receiptPaths(f.root,'e2big');const privateText='PRIVATE_MARKER'+ 'x'.repeat(200000)
  startReceipt(paths,{program:process.execPath,args:['-e','',privateText],cwd:f.root,timeout:1000})
  const result=await until(()=>readJson(paths.result));assert.equal(result.error,'E2BIG');assert.equal(readJson(paths.state).child,undefined)
  assert.equal(JSON.stringify(result).includes('PRIVATE_MARKER'),false);assert.equal(workerProcessClassification(result).failure_class,'transient-infrastructure')
 }finally{f.cleanup()}
})
test('interrupted no-child/no-result/no-log receipt settles idempotently after restart',async()=>{
 const f=fixture();try {
  const paths=receiptPaths(f.root,'interrupted');atomicJson(paths.state,deadState)
  const launcher=path.join(f.root,'restart.mjs')
  writeFileSync(launcher,`import {receiptPaths,startReceipt} from ${JSON.stringify(new URL('../runner/durable-process.mjs',import.meta.url).href)};startReceipt(receiptPaths(${JSON.stringify(f.root)},'interrupted'),{program:'false',args:[],cwd:${JSON.stringify(f.root)}});`)
  const child=spawn(process.execPath,[launcher]);await new Promise(resolve=>child.on('close',resolve))
  assert.equal(readJson(paths.result).error,'receipt_writer_interrupted');assert.equal(settleInterruptedReceipt(paths),false)
  assert.equal(existsSync(path.join(f.root,'calls')),false)
 }finally{f.cleanup()}
})
test('duplicate watchdog wakes create exactly one child and replay one result',async()=>{
 const f=fixture();try {
  const paths=receiptPaths(f.root,'duplicate'), request={program:f.codex,args:['exec','small'],cwd:f.root,timeout:2000}
  for(let i=0;i<20;i++)startReceipt(paths,request)
  assert.equal((await until(()=>readJson(paths.result))).code,0)
  await until(()=>!receiptLocked(paths));assert.equal(readFileSync(path.join(f.root,'calls'),'utf8'),'one\n')
  assert.equal(startReceipt(paths,request).settled,true)
 }finally{f.cleanup()}
})
test('watchdog recovers old alive outer waiter only when inner handoff died before spawn',async()=>{
 const f=fixture();try {
  const outer=receiptPaths(f.root,'outer'),op='same-execution-299'
  startReceipt(outer,{program:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.root,timeout:5000})
  const state=await until(()=>{const s=readJson(outer.state);return s?.child?s:null})
  const inner=receiptPaths(f.root,op+':codex');atomicJson(inner.state,deadState)
  assert.equal(recoverInterruptedHandoff(f.root,op,outer),true)
  assert.equal((await until(()=>readJson(outer.result))).code,1);assert.equal(receiptProcessAlive(state.child),false)
  assert.equal(readJson(inner.result).error,'receipt_writer_interrupted');assert.equal(recoverInterruptedHandoff(f.root,op,outer),false)
 }finally{f.cleanup()}
})
test('active inner worker is never cancelled or duplicated by handoff recovery',async()=>{
 const f=fixture();try {
  const op='active',inner=receiptPaths(f.root,op+':codex'),outer=receiptPaths(f.root,'outer')
  startReceipt(inner,{program:process.execPath,args:['-e',"setTimeout(()=>console.log('ok'),300)"],cwd:f.root,timeout:2000})
  await until(()=>readJson(inner.state)?.child)
  assert.equal(recoverInterruptedHandoff(f.root,op,outer),false);assert.equal((await until(()=>readJson(inner.result))).code,0)
 }finally{f.cleanup()}
})
test('infrastructure generation recovers execution 299 attempt 3 with unchanged budget/profile/run',()=>{
 const f=fixture();try {
  const key='operation-299:codex',old=receiptPaths(f.root,key);atomicJson(old.state,deadState)
  const prompt=' '+ 'x'.repeat(200000)+'\n';const args=['exec','--model','gpt-6.1-sol','-c','model_reasoning_effort="high"',prompt]
  const failed=durableExecute(f.root,key,f.codex,args,{cwd:f.root,timeout:2000,retryProcessFailure:true})
  assert.equal(failed.error,'receipt_writer_interrupted')
  const recovered=durableExecute(f.root,key,f.codex,args,{cwd:f.root,timeout:2000,retryProcessFailure:true})
  assert.equal(recovered.code,0);assert.equal(JSON.parse(recovered.stdout).hash,hash(prompt))
  const running={task_id:'BS-UI-ZN-FINAL-001',execution_id:299,attempt:3,status:'running',model_profile:'deep',model_name:'gpt-6.1-sol',reasoning_effort:'high'}
  const policy={policy_id:'shared-foundation-five',max_attempts:5,attempt_profiles:['standard','standard','deep','deep','review']}
  const s={packet:{task:{task_id:running.task_id,status:'in_progress'},retry_policy:policy},executions:[running],workflow_run:{run_id:'original-run',status:'running',completed_tasks:7,max_tasks:9},runtime_operations:[{operation_id:'operation-299',execution_id:299,status:'pending',action:'task-retry'}]}
  const before=JSON.stringify(s);const next=planSupervisorStep(s);assert.equal(next.command,'task-retry');assert.equal(next.execution.execution_id,299)
  const decision=repairRetryDecision(policy,{task_id:running.task_id,attempt:2},{consumed:3},running)
  assert.equal(decision.resumed,true);assert.equal(decision.next_attempt,3);assert.equal(decision.next_profile,'deep')
  assert.equal(JSON.stringify(s),before);assert.equal(retryWithoutProductAttempt(workerProcessClassification(failed)),true)
  assert.equal(readJson(old.result).error,'receipt_writer_interrupted');assert.equal(readFileSync(path.join(f.root,'calls'),'utf8'),'one\n')
 }finally{f.cleanup()}
})

test('Codex process setup failure is distinct from an actual model turn',async()=>{
 const f=fixture();try{
  writeFileSync(f.codex,'#!/usr/bin/env node\nconsole.error("synthetic authentication setup failure");process.exitCode=1\n',{mode:0o700})
  const paths=receiptPaths(f.root,'setup');startReceipt(paths,{program:f.codex,args:['exec','--json','-'],cwd:f.root,timeout:2000})
  assert.equal((await until(()=>readJson(paths.result))).code,1)
  const state=readJson(paths.state);assert.ok(state.child.launched_at);assert.equal(state.child.model_started_at,undefined)
 }finally{f.cleanup()}
})
test('Codex streamed turn event durably identifies the actual investigation start',async()=>{
 const f=fixture();try{
  writeFileSync(f.codex,'#!/usr/bin/env node\nconsole.log(JSON.stringify({type:"turn.started"}));setTimeout(()=>console.log(JSON.stringify({type:"turn.completed"})),100)\n',{mode:0o700})
  const paths=receiptPaths(f.root,'model');startReceipt(paths,{program:f.codex,args:['exec','--json','-'],cwd:f.root,timeout:2000})
  assert.equal((await until(()=>readJson(paths.result))).code,0)
  assert.ok(readJson(paths.state).child.model_started_at)
 }finally{f.cleanup()}
})
test('publisher transport death advances only an infrastructure receipt and preserves failure evidence',()=>{
 const f=fixture();try{
  const paths=receiptPaths(f.root,'publisher');atomicJson(paths.result,{code:1,stdout:'',stderr:'',error:'receipt_writer_interrupted'})
  const result=durableExecute(f.root,'publisher',process.execPath,['-e','console.log("reconciled")'],{cwd:f.root,timeout:2000,retryTransportFailure:true})
  assert.equal(result.code,0);assert.equal(result.stdout,'reconciled');assert.equal(readJson(paths.result).error,'receipt_writer_interrupted')
 }finally{f.cleanup()}
})
