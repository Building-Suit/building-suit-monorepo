import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { protectedVerification, assertReady } from './publisher.mjs'
const sha='a'.repeat(40)
const push={id:101,run_number:4,event:'push',path:'.github/workflows/ci.yml',head_sha:sha,head_branch:'stg'}
function request(runs,jobs) { return async path=>path.startsWith('actions/workflows/') ? {total_count:runs.length,workflow_runs:runs} : {total_count:jobs.length,jobs} }
test('same-SHA PR verification cannot shadow a successful protected push verification',async()=>{
  const calls=[]
  const invoke=request([{...push,id:102,event:'pull_request',run_number:5},push],[{name:'verify',status:'completed',conclusion:'success'}])
  const verify=await protectedVerification(async path=>{calls.push(path);return invoke(path)},sha,'stg')
  assert.match(calls[0],/head_sha=.*&branch=stg&event=push/)
  assert.equal(calls[1],'actions/runs/101/jobs?filter=latest&per_page=100')
  assertReady({contexts:[],checks:[verify,{name:'verify',status:'in_progress',conclusion:null}],required:['verify']})
})
test('latest protected push attempt still blocks on pending, failed, cancelled or skipped verification',async()=>{
  for(const conclusion of [null,'failure','cancelled','skipped']) {
    const result=await protectedVerification(request([push],[{name:'verify',status:conclusion?'completed':'in_progress',conclusion}]),sha,'stg')
    assert.throws(()=>assertReady({contexts:[],checks:[result],required:['verify']}),/Deployment not ready: verify/)
  }
})
test('newest protected run wins regardless of delivery order; do not fall back to an earlier success',async()=>{
  const paths=[]
  const result=await protectedVerification(async path=>{
    paths.push(path)
    return path.startsWith('actions/workflows/')?{total_count:2,workflow_runs:[push,{...push,id:103,run_number:6}]}:{total_count:1,jobs:[{name:'verify',status:'completed',conclusion:'failure'}]}
  },sha,'stg')
  assert.match(paths[1],/runs\/103\/jobs/)
  assert.equal(result.conclusion,'failure')
})
test('wrong branch, SHA, workflow, event, missing jobs and ambiguous or paginated results fail closed',async()=>{
  for(const patch of [{head_sha:'b'.repeat(40)},{head_branch:'main'},{path:'.github/workflows/untrusted.yml'},{event:'pull_request'}]) {
    const result=await protectedVerification(request([{...push,...patch}],[{name:'verify',status:'completed',conclusion:'success'}]),sha,'stg')
    assert.notEqual(result.conclusion,'success')
  }
  assert.notEqual((await protectedVerification(request([push],[]),sha,'stg')).conclusion,'success')
  await assert.rejects(protectedVerification(request([push],[{name:'verify'},{name:'verify'}]),sha,'stg'),/Ambiguous/)
  await assert.rejects(protectedVerification(async()=>({total_count:101}),sha,'stg'),/pagination/)
})
test('both publisher jobs can read authoritative workflow jobs without changing deployment gates',()=>{
  for(const path of ['../../.github/workflows/ci.yml','../../.github/workflows/releases.yml']) {
    const yaml=readFileSync(new URL(path,import.meta.url),'utf8')
    assert.match(yaml,/actions: read/)
    assert.match(yaml,/RELEASE_REQUIRED_CONTEXTS: \$\{\{ vars.RELEASE_REQUIRED_CONTEXTS \}\}/)
  }
})
