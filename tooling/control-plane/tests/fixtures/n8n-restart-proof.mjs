import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
const container='cp-n8n-restart-20261007',postgres='cp-n8n-postgres-20261007'
const execute=(program,args,options={})=>{const r=spawnSync(program,args,{encoding:'utf8',timeout:25_000,...options});if(r.status!==0)throw Error('Isolated restart fixture command failed: '+r.stderr);return r.stdout.trim()}
const databaseQuery=sql=>execute('docker',['exec',postgres,'psql','-U','postgres','-d','cp_n8n_restart_20261007','-XqAt','-v','ON_ERROR_STOP=1','-c',sql])
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function processIdentity(pid) {if(!pid)return null;const raw=readFileSync('/proc/'+pid+'/stat','utf8');const fields=raw.slice(raw.lastIndexOf(')')+2).split(' ');return {pid,start_stamp:fields[19],state:fields[0]}}
function request(url,body) {
 return JSON.parse(execute('docker',['exec',container,'node','-e',`fetch(${JSON.stringify(url)},{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))}}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);console.log(await r.text())}).catch(()=>process.exit(1))`]))
}
export async function n8nRestartProof({phase,runId,taskId,controlSnapshot,output,workerPid}) {
 const before=controlSnapshot(),worker=processIdentity(workerPid)
 if(worker)assert.ok(!['Z','X'].includes(worker.state))
 const initial=request('http://localhost:5678/webhook/cp-synthetic-restart-20261007',{fixture:true,run_id:runId,task_id:taskId,phase})
 assert.equal(initial.run_id,runId);assert.equal(initial.task_id,taskId)
 const execution=String(initial.execution_id);assert.match(execution,/^[0-9]+$/)
 const state=()=>JSON.parse(databaseQuery(`SELECT jsonb_build_object('id',id,'status',status,'workflow_id',"workflowId",'wait_until',"waitTill") FROM execution_entity WHERE id=${execution};`))
 for(let i=0;i<20&&state().status!=='waiting';i++)await pause(200)
 assert.equal(state().status,'waiting')
 const persisted=databaseQuery(`SELECT data FROM execution_data WHERE "executionId"=${execution};`)
 execute('docker',['restart',container])
 let ready=false
 for(let i=0;i<40;i++) {
  const check=spawnSync('docker',['exec',container,'node','-e',"fetch('http://localhost:5678/healthz/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],{encoding:'utf8',timeout:2500})
  if(check.status===0){ready=true;break}await pause(250)
 }
 assert.equal(ready,true,'Actual n8n did not become ready after restart')
 assert.equal(state().status,'waiting');assert.equal(String(state().id),execution)
 assert.equal(databaseQuery(`SELECT data FROM execution_data WHERE "executionId"=${execution};`),persisted)
 assert.deepEqual(controlSnapshot(),before,'Restart changed control run, claim, budget or publication identity')
 if(worker)assert.deepEqual(processIdentity(workerPid),worker,'Restart interrupted or replaced the host worker')
 const resume=new URL(initial.resume_url);resume.port='5678'
 request(resume.href,{fixture:true,resume:true})
 for(let i=0;i<30&&state().status!=='success';i++)await pause(250)
 assert.equal(state().status,'success','Same persisted n8n execution did not resume')
 const records=path.join(output,'n8n-restart-proof.json')
 const prior=existsSync(records)?JSON.parse(readFileSync(records)) : []
 prior.push({phase,passed:true,container,execution_id:execution,run_id:runId,task_id:taskId,worker,
  persisted_state_sha256:createHash('sha256').update(persisted).digest('hex'),control_snapshot:before})
 writeFileSync(records,JSON.stringify(prior,null,2));console.log('Actual isolated n8n restart passed: '+phase)
}
