// One serialized bounded session through the existing Supabase session pooler.
// No third party dependency; delimiters make each psql result unambiguous.
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {recordEgress} from './dot-egress-telemetry.mjs'
export function createPostgresSession(env=process.env){
 let openedAt=0,child=null,pending=null,buffer='',tail=Promise.resolve(),closed=false
 function stop(error){const old=child;child=null;if(old)old.kill();if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error)}}
 function start(){if(child&&Date.now()-openedAt>30*60000)stop(Error('health_session_rotated'));if(child)return;buffer='';openedAt=Date.now();const args=['-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1','-h',env.BS_CONTROL_DB_HOST,'-p',env.BS_CONTROL_DB_PORT,'-U',env.BS_CONTROL_DB_USER,'-d',env.BS_CONTROL_DB_NAME];if(args.some(x=>x===undefined))throw Error('health_control_environment_missing')
 child=spawn('stdbuf',['-oL','psql',...args],{env:{...env,PGSSLMODE:env.BS_CONTROL_DB_SSLMODE??'require',PGCONNECT_TIMEOUT:'10'},stdio:['pipe','pipe','pipe']});const owner=child;recordEgress('health',{connections:1},env.BS_CONTROL_REPOSITORY_ROOT)
 child.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>2*1024*1024){stop(Error('health_payload_budget_exceeded'));return}const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!pending)continue;if(line.trim()===pending.marker){const p=pending;pending=null;clearTimeout(p.timer);recordEgress('health',{queries:1,bytes:Buffer.byteLength(p.lines.join('\n'))},env.BS_CONTROL_REPOSITORY_ROOT);try{p.resolve(p.lines.join('\n').trim()?JSON.parse(p.lines.join('\n')):null)}catch{p.reject(Error('health_response_invalid'))}}else pending.lines.push(line)}})
 child.stderr.on('data',()=>{/* Never persist provider diagnostics or credentials. */});child.on('error',()=>{if(child===owner)stop(Error('health_connection_unavailable'))});child.on('close',()=>{if(child===owner)stop(Error('health_connection_closed'))});child.stdin.on('error',()=>{if(child===owner)stop(Error('health_connection_unavailable'))})
 }
 return {query(sql){const request=()=>new Promise((resolve,reject)=>{if(closed){reject(Error('health_session_closed'));return}start();const marker='dot_result_'+randomUUID().replaceAll('-','');pending={marker,lines:[],resolve,reject,timer:setTimeout(()=>stop(Error('health_query_timeout')),30000)};child.stdin.write(sql.trim()+"\n\\echo "+marker+'\n')});const result=tail.then(request);tail=result.catch(()=>{});return result},close(){closed=true;stop(Error('health_session_closed'))}}
}
