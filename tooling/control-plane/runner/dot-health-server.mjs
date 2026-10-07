import {createServer} from 'node:http'
import {readFileSync} from 'node:fs'
import {createPostgresSession} from './dot-postgres-session.mjs'
import {createHealthCache} from './dot-health-cache.mjs'
import {classifyCurrent,currentStateSql,healthOverview} from './dot-current-state.mjs'
import {readEgress,recordEgress} from './dot-egress-telemetry.mjs'
import {historicalHealth} from './run-lifecycle.mjs'
const port=Number(process.env.BS_DOT_HEALTH_PORT??8787),root=process.env.BS_CONTROL_REPOSITORY_ROOT
const session=createPostgresSession(),query=sql=>session.query(sql)
const literal=value=>"'"+String(value).replaceAll("'","''")+"'"
const cache=createHealthCache({root,load:async()=>{
 const inputs=await query(currentStateSql()),rows=classifyCurrent(inputs,root)
 const persisted=await query(`SELECT jsonb_build_object('written',control.record_dot_health(${literal(JSON.stringify(rows))}::jsonb),'watchdog_last_cycle',(SELECT max(started_at) FROM control.dot_cycles),'alerts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM (SELECT key,state,left(why,500) AS why,created_at FROM control.dot_health_alerts ORDER BY alert_id DESC LIMIT 10)a));`)
 return {...healthOverview(rows),watchdog_last_cycle:persisted.watchdog_last_cycle,alerts:persisted.alerts}
}})
let timer=null
function dirty(){if(timer)return;timer=setTimeout(()=>{timer=null;void cache.refresh()},2000)}
const interval=setInterval(()=>void cache.refresh(),120000)
// Listen immediately: a slow database cannot prevent cache reads from responding.
const server=createServer(async(req,res)=>{
 const allowed=new Set([`localhost:${port}`,`127.0.0.1:${port}`])
 if(!allowed.has(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end();return}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'")
 const url=new URL(req.url,`http://127.0.0.1:${port}`)
 // Event relay invalidation is local only and requires JSON (no HTML form writes).
 if(req.method==='POST'&&url.pathname==='/api/invalidate'&&req.headers['content-type']==='application/json'){dirty();res.writeHead(202);res.end();return}
 if(req.method==='POST'&&url.pathname==='/api/observation'&&req.headers['content-type']==='application/json'){
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100*1024){res.writeHead(413);res.end();return}}
  try{const value=JSON.parse(body);if(!Array.isArray(value.rows)||!Number.isFinite(Date.parse(value.collected_at))||Math.abs(Date.now()-Date.parse(value.collected_at))>60000)throw Error('invalid_observation');cache.publish({...healthOverview(value.rows),...value,alerts:undefined});res.writeHead(202);res.end()}catch{res.writeHead(400);res.end()}return
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync(new URL('./dot-health.html',import.meta.url)));return}
 res.setHeader('Content-Type','application/json')
 if(url.pathname==='/api/status'){res.end(JSON.stringify({...cache.read(),runtime_release_id:process.env.BS_CONTROL_RUNTIME_RELEASE_ID??null,telemetry:readEgress(root)}));return}
 try{
 if(url.pathname==='/api/pending'){
  const cursor=url.searchParams.get('page')??'0';if(!/^\d{1,5}$/.test(cursor))throw Error('invalid_cursor')
  const rows=await query(`SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',t.task_id,'workstream',t.workstream_slug,'profile',t.model_profile,'state','WAITING_ADMISSION','activity_state','RECONCILING','lifecycle_outcome','ACTIVE','why','Queued task: '||t.status,'next_automatic_action','Acquire only through authoritative readiness and bounded-run admission','operator_action_required',false)),'[]') FROM (SELECT task_id,workstream_slug,model_profile,status FROM control.tasks WHERE status IN('planned','ready','blocked') ORDER BY priority,sequence,task_id LIMIT 25 OFFSET ${Number(cursor)*25})t;`)
  res.end(JSON.stringify({rows,next:rows.length===25?String(Number(cursor)+1):null}));return
 }
 if(url.pathname==='/api/history'){
  const cursor=url.searchParams.get('page')??'0';if(!/^\d{1,5}$/.test(cursor))throw Error('invalid_cursor')
  const page=await query(`SELECT coalesce(jsonb_agg(jsonb_build_object('run',jsonb_build_object('run_id',r.run_id,'status',r.status,'workstream_slug',r.workstream_slug,'current_task_id',r.current_task_id,'completed_tasks',r.completed_tasks,'max_tasks',r.max_tasks,'finished_at',r.finished_at,'updated_at',r.updated_at),'audit',jsonb_build_object('classification',a.classification,'reason',left(a.reason,500)),'cursor',r.run_id) ORDER BY r.started_at DESC,r.run_id DESC),'[]') FROM (SELECT run_id,status,workstream_slug,current_task_id,completed_tasks,max_tasks,finished_at,updated_at,started_at FROM control.workflow_runs WHERE NOT control.run_is_actionable(status,current_task_id,finished_at) ORDER BY started_at DESC,run_id DESC LIMIT 25 OFFSET ${Number(cursor)*25})r LEFT JOIN control.run_lifecycle_audits a USING(run_id);`)
  res.end(JSON.stringify({rows:page.map(x=>historicalHealth(x.run,x.audit)),next:page.length===25?String(Number(cursor)+1):null}));return
 }
 if(url.pathname==='/api/detail'){
  const kind=url.searchParams.get('kind'),id=url.searchParams.get('id')
  let sql
  if(kind==='task'&&/^[A-Za-z0-9_-]{1,150}$/.test(id??''))sql=`SELECT jsonb_build_object('task_id',task_id,'title',title,'description',description,'status',status,'acceptance_criteria',acceptance_criteria,'verification_plan',verification_plan) FROM control.tasks WHERE task_id=${literal(id)};`
  if(kind==='verification'&&/^\d{1,18}$/.test(id??''))sql=`SELECT to_jsonb(v) FROM control.verification_runs v WHERE verification_run_id=${literal(id)}::bigint;`
  if(kind==='incident'&&/^[a-f0-9-]{36}$/i.test(id??''))sql=`SELECT to_jsonb(i) FROM control.dot_incidents i WHERE incident_id=${literal(id)}::uuid;`
  if(!sql){res.writeHead(400);res.end(JSON.stringify({error:'invalid_detail_identity'}));return}
  recordEgress('health',{heavy_evidence_loads:1},root);res.end(JSON.stringify(await query(sql)));return
 }
 res.writeHead(404);res.end()
 }catch{res.writeHead(503);res.end(JSON.stringify({error:'Requested evidence unavailable'}))}
})
server.listen(port,'127.0.0.1',()=>void cache.refresh())
process.on('SIGTERM',()=>{clearInterval(interval);clearTimeout(timer);session.close();server.close();process.exit(0)})
