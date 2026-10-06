import { readFileSync,readdirSync,existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { classifyHealth } from './dot-health-state.mjs'
import { executeWithControlDatabaseRetry } from '../lib/control-database.mjs'
export function healthQuery(sql, env=process.env, execute=spawnSync) {
 const args=['-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1','-h',env.BS_CONTROL_DB_HOST,'-p',env.BS_CONTROL_DB_PORT,'-U',env.BS_CONTROL_DB_USER,'-d',env.BS_CONTROL_DB_NAME]
 if(args.some(x=>x===undefined))throw Error('health_control_environment_missing')
 const r=executeWithControlDatabaseRetry(()=>{const v=execute('psql',args,{input:sql,encoding:'utf8',timeout:20_000,maxBuffer:20*1024*1024,env:{...env,PGSSLMODE:env.BS_CONTROL_DB_SSLMODE??'require'}});return {code:v.status??1,stdout:v.stdout,stderr:v.stderr,error:v.error?.code}})
 if(r.code!==0)throw Error('health_control_query_failed')
 return r.stdout.trim()?JSON.parse(r.stdout.trim()):null
}
function json(file) {try{return JSON.parse(readFileSync(file,'utf8'))}catch{return null}}
export function processAlive(identity) {
 if(!identity?.pid||!identity.start_stamp)return false
 try{const s=readFileSync(`/proc/${identity.pid}/stat`,'utf8');const fields=s.slice(s.lastIndexOf(')')+2).split(' ');return !['Z','X'].includes(fields[0])&&fields[19]===identity.start_stamp}catch{return false}
}
function latestDirectory(base) {
 if(!existsSync(base))return null
 const dirs=readdirSync(base).filter(x=>/^\d+$/.test(x)).map(Number).sort((a,b)=>a-b)
 return dirs.length?path.join(base,String(dirs.at(-1))):null
}
export function workerInventory(root, now=Date.now()) {
 const dir=path.join(root,'.local/runtime-receipts'), rows=[]
 if(!existsSync(dir))return rows
 for(const hash of readdirSync(dir)) {
  const latest=latestDirectory(path.join(dir,hash));if(!latest)continue
  const s=json(path.join(latest,'state.json'));if(!s)continue
  const live=processAlive(s.child)
  // Dead receipts need no sensitive request body read; never expose stdout/input.
  if(!live)continue
  const req=json(path.join(latest,'request.json'));if(!req)continue
  const verifierIndex=req.args?.findIndex(a=>String(a).endsWith('/task-verifier.mjs'))??-1
  const verifier=verifierIndex>=0
  if(path.basename(req.program??'')!=='codex'&&!verifier)continue
  const phase=verifier?'verification':'implementation'
  rows.push({cwd:verifier?req.args[verifierIndex+1]:req.cwd,phase,worker:{pid:s.child.pid,start_stamp:s.child.start_stamp,writer_pid:s.pid,started_at:s.started_at,
   heartbeat_at:s.heartbeat_at??null,process_seen_at:new Date(now).toISOString(),state:s.worker_state??'running',
   deadline_at:s.deadline_at??(req.timeout?new Date(Date.parse(s.started_at)+req.timeout).toISOString():null),
   last_output_at:s.last_output_at??null,heartbeat_source:s.heartbeat_at?'worker-receipt':'collector-process-observation'},worker_alive:true})
 }
 return rows
}
export function observeProcesses(input, root, inventory, now=Date.now()) {
 const observed_at=new Date(now).toISOString(),e=input.execution,o=input.operation
 const workers=inventory.filter(w=>w.cwd===e?.worktree_path && Date.parse(w.worker.started_at)>=Date.parse(e.started_at)-1000)
 const worker=workers.find(w=>w.phase==='verification')??workers.at(-1)
 let operation_alive=false
 if(o){const dir=path.join(root,'.local/runtime-operations',createHash('sha256').update(o.operation_id).digest('hex'),String(o.infra_retries));const s=json(path.join(dir,'state.json'));operation_alive=processAlive(s?.child)}
 let supervisor_alive=false
 const owner=input.recovery?.lease_owner?.match(/^(\d+)@/)
 if(owner){try{const args=readFileSync(`/proc/${owner[1]}/cmdline`,'utf8').split('\0');const i=args.indexOf('task-supervise');supervisor_alive=i>=0&&args[i+1]===input.task?.task_id}catch{/* not a local supervisor */}}
 return {observed_at,worker_alive:!!worker,worker:worker?.worker??null,phase:worker?.phase??null,last_output_at:worker?.worker.last_output_at??null,operation_alive,supervisor_alive}
}
export function collectHealth({root=process.env.BS_CONTROL_REPOSITORY_ROOT,query=healthQuery,now=Date.now(),inventory}={}) {
 if(!root)throw Error('health_repository_root_required')
 const sql=readFileSync(new URL('./dot-health-inputs.sql',import.meta.url),'utf8')
 const inputs=query(sql), workers=inventory??workerInventory(root,now)
 const rows=inputs.map(i=>classifyHealth(i,observeProcesses(i,root,workers,now),now))
 // One transaction serializes deduped alerts and all status observations. No
 // worker lifecycle/attempt/task rows are changed by health collection.
 query(`SELECT to_jsonb(control.record_dot_health('${JSON.stringify(rows).replaceAll("'","''")}'::jsonb));`)
 return rows
}
export function readHealth(query=healthQuery) {
 const result=query(`SELECT jsonb_build_object('collected_at',(SELECT max(observed_at) FROM control.dot_health_current),'watchdog_last_cycle',(SELECT max(started_at) FROM control.dot_cycles),'collection_interval_seconds',30,'rows',(SELECT coalesce(jsonb_agg(h.snapshot || jsonb_build_object('recovery_owner',j.owner,'recovery_action',coalesce(j.action,h.snapshot->>'recovery_action'),'incident_id',j.incident_id,'recovery_started',j.started_at,'next_recovery_check',j.next_check_at) ORDER BY h.snapshot->>'workstream',h.key),'[]') FROM control.dot_health_current h LEFT JOIN LATERAL(SELECT * FROM control.dot_recovery_jobs j WHERE j.run_id=h.run_id AND j.task_id IS NOT DISTINCT FROM h.task_id AND j.status IN('queued','running') ORDER BY j.started_at DESC LIMIT 1) j ON true),'alerts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM (SELECT key,state,why,created_at FROM control.dot_health_alerts ORDER BY alert_id DESC LIMIT 30)a));`)
 // A task-only observation predating admission is historical. Its current run
 // observation owns status; retaining both creates a phantom stale human gate.
 const owned=new Set((result?.rows??[]).filter(r=>r.run_id&&r.task_id).map(r=>r.task_id))
 if(result)result.rows=(result.rows??[]).filter(r=>r.run_id||!owned.has(r.task_id))
 return result
}
if(process.argv[1]===fileURLToPath(import.meta.url)){collectHealth();console.log(JSON.stringify({ok:true,health_collection:true,llm_used:false}))}
