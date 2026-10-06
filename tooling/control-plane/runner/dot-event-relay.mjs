#!/usr/bin/env node
// Thin local trigger only. BS-31 and PostgreSQL continue to own all recovery.
import { spawn } from 'node:child_process'
const env=process.env
const args=['-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1','-h',env.BS_CONTROL_DB_HOST,'-p',env.BS_CONTROL_DB_PORT,'-U',env.BS_CONTROL_DB_USER,'-d',env.BS_CONTROL_DB_NAME]
if(args.some(x=>x===undefined)) throw new Error('existing_control_database_environment_required')
const child=spawn('psql',args,{env:{...env,PGSSLMODE:env.BS_CONTROL_DB_SSLMODE ?? 'require'},stdio:['pipe','pipe','pipe']})
let pending=false, running=false, buffer=''
async function wake(){
 if(!pending || running)return
 running=true;pending=false
 try {const r=await fetch('http://127.0.0.1:5678/webhook/building-suit-dot-wake',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"source":"persisted-control-state"}',signal:AbortSignal.timeout(10000)});if(!r.ok)pending=true;else console.log('Dot event wake delivered')}
 catch {pending=true}
 finally {running=false}
}
child.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.includes('bs_dot_wake')){pending=true;buffer='';void wake()}if(buffer.length>8192)buffer=buffer.slice(-8192)})
child.stderr.on('data',chunk=>{if(chunk.toString().includes('bs_dot_wake')){pending=true;void wake()}})
child.on('close',code=>process.exit(code || 1))
child.stdin.on('error',()=>process.exit(1))
child.stdin.write('LISTEN bs_dot_wake;\n')
// psql delivers asynchronous notifications after each command. This connection
// performs no recovery or model call and survives ordinary healthy idle state.
const tick=setInterval(()=>{child.stdin.write('SELECT 1;\n');void wake()},5000)
process.on('SIGTERM',()=>{clearInterval(tick);child.kill('SIGTERM');process.exit(0)})
