#!/usr/bin/env node
import {createPostgresSession} from './dot-postgres-session.mjs'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {runtimeIdentity} from './runtime-identity.mjs'

const source=path.dirname(fileURLToPath(import.meta.url))
let session
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
let stopping=false,child=null,activeJob=null
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
export function supervisorRetrySeconds(result){
 if(!result||result.ok!==true||result.status==='time-slice-yield')return 30
 if(result.status==='idle'&&result.acquisition?.next_wake_at){const when=Date.parse(result.acquisition.next_wake_at);return Number.isFinite(when)?Math.min(3600,Math.max(1,Math.ceil((when-Date.now())/1000))):null}
 const response=result.response??result,reason=response.reason??response.recovery?.reason
 if(['supervisor_lease_active','supervisor_lease_contended'].includes(reason))return 30
 if(['runtime_operation_in_flight','runtime_operation_resume','runtime_backoff_pending','execution_in_flight','supervisor_time_slice_yield','control_database_unavailable'].includes(reason)){
  const when=Date.parse(response.recovery?.next_wake_at)
  return Number.isFinite(when)?Math.min(3600,Math.max(1,Math.ceil((when-Date.now())/1000))):30
 }
 // Human/unknown/dependency waits resume only on authoritative change. The
 // inbox is independent of notifications and Dot; crash leases are reclaimable.
 return null
}
async function runSubject(job){
 return new Promise(resolve=>{
  let output=''
  child=spawn(process.execPath,[path.join(source,'bs-agent.mjs'),'run-supervise',job.run_id],{cwd:process.env.BS_CONTROL_REPOSITORY_ROOT,env:process.env,stdio:['ignore','pipe','pipe']})
  child.stdout.on('data',data=>{if(output.length<8*1024*1024)output+=data})
  child.stderr.on('data',()=>{})
  child.once('error',()=>resolve(null));child.once('close',()=>{child=null;try{resolve(JSON.parse(output))}catch{resolve(null)}})
 })
}
async function serve(){
 session=createPostgresSession(process.env)
 const identity=runtimeIdentity(path.resolve(source,'../../..'))
 const release=identity.release_id??createHash('sha256').update(identity.commit).digest('hex')
 // Upgrade adoption runs once at startup, even when no webhook/inbox survived
 // the old protocol. SQL excludes workers, stop/maintenance and terminal runs.
 await session.query(`SELECT coalesce(jsonb_agg(control.adopt_lifecycle_recovery(run_id,2,${quote(release)})),'[]') FROM control.workflow_runs WHERE status='running' AND current_task_id IS NOT NULL AND NOT stop_requested AND NOT maintenance_requested;`)
 while(!stopping){
  try {
   const job=await session.query('SELECT control.claim_supervisor_wake();')
   if(!job){await pause(5000);continue}
   activeJob=job
   const result=await runSubject(job),retry=supervisorRetrySeconds(result)
   await session.query(`SELECT to_jsonb(control.finish_supervisor_wake(${quote(job.run_id)}::uuid,${quote(job.claim_token)}::uuid,${job.version},${retry??'NULL'}));`)
   activeJob=null
  }catch{await pause(15000)}
 }
 session.close()
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;child?.kill(signal);void (async()=>{try{if(activeJob)await session.query(`SELECT to_jsonb(control.finish_supervisor_wake(${quote(activeJob.run_id)}::uuid,${quote(activeJob.claim_token)}::uuid,${activeJob.version},1));`)}catch{/* A crash lease remains reclaimable. */}finally{session?.close()}})()})
 void serve()
}
