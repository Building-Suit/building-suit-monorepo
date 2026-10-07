#!/usr/bin/env node
// Thin local trigger only. BS-31 and PostgreSQL continue to own all recovery.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs'
import path from 'node:path'
import {recordEgress} from './dot-egress-telemetry.mjs'
import { spawn } from 'node:child_process'
const env=process.env
const args=['-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1','-h',env.BS_CONTROL_DB_HOST,'-p',env.BS_CONTROL_DB_PORT,'-U',env.BS_CONTROL_DB_USER,'-d',env.BS_CONTROL_DB_NAME]
if(args.some(x=>x===undefined)) throw new Error('existing_control_database_environment_required')
// psql stdout is otherwise block-buffered behind a pipe, delaying the wake
// watermark until several kilobytes accumulate on an idle installation.
const child=spawn('stdbuf',['-oL','-eL','psql',...args],{env:{...env,PGSSLMODE:env.BS_CONTROL_DB_SSLMODE ?? 'require'},stdio:['pipe','pipe','pipe']})
const checkpoint=path.join(env.BS_CONTROL_REPOSITORY_ROOT,'.local/control-egress/relay-watermark.json')
let observedEvent=0
try{observedEvent=JSON.parse(readFileSync(checkpoint,'utf8')).event_id??0}catch{/* first start */}
let pending=false, running=false, buffer='', latestEvent=observedEvent,debounce=null
function coalesce(){if(debounce){recordEgress('bs31',{coalesced:1});return}debounce=setTimeout(()=>{debounce=null;void wake()},15000)}
async function wake(){
 if(!pending || running)return
 running=true;pending=false
 const deliveredEvent=latestEvent
 try {const r=await fetch('http://127.0.0.1:5678/webhook/building-suit-dot-wake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'persisted-control-state',event_id:deliveredEvent}),signal:AbortSignal.timeout(10000)});if(!r.ok)pending=true;else {mkdirSync(path.dirname(checkpoint),{recursive:true,mode:0o700});writeFileSync(checkpoint+'.tmp',JSON.stringify({event_id:deliveredEvent}),{mode:0o600});renameSync(checkpoint+'.tmp',checkpoint);observedEvent=deliveredEvent;if(latestEvent>deliveredEvent)pending=true;console.log('Dot event batch delivered')}}
 catch {pending=true}
 finally {running=false}
}
child.stdout.on('data',chunk=>{
 buffer+=chunk.toString()
 const lines=buffer.split('\n');buffer=lines.pop()
 for(const line of lines){
  const event=/^bs_dot_event:([0-9]+)$/.exec(line.trim())
  if(event){const id=Number(event[1]);if(id>observedEvent){pending=true;latestEvent=Math.max(latestEvent,id)}else if(id===0&&pending&&!running){observedEvent=latestEvent;pending=false;clearTimeout(debounce);debounce=null;recordEgress('bs31',{coalesced:1})}}

 }
 if(buffer.length>8192)buffer=buffer.slice(-8192)
 if(pending)coalesce()
})
child.stderr.on('data',()=>{/* Persisted identifiers cover notification loss. */})
child.on('close',code=>process.exit(code || 1))
child.stdin.on('error',()=>process.exit(1))
child.stdin.write('LISTEN bs_dot_wake;\n')
// psql delivers asynchronous notifications after each command. This connection
// Persisted events also cover missed notifications and reconnects through a
// provider pooler. The observer reads the outbox; only BS-31 consumes it.
const poll="SELECT 'bs_dot_event:' || coalesce(max(event_id),0)::text FROM control.dot_wake_events WHERE consumed_at IS NULL;\n"
child.stdin.write(poll)
const tick=setInterval(()=>{child.stdin.write(poll);if(pending)coalesce()},5000)
process.on('SIGTERM',()=>{clearInterval(tick);clearTimeout(debounce);child.kill('SIGTERM');process.exit(0)})
