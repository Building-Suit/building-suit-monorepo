import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { collectHealth,readHealth } from './dot-health-collector.mjs'
const port=Number(process.env.BS_DOT_HEALTH_PORT??8787)
let pending=false,collecting=false,lastError=null
function collect(){if(collecting){pending=true;return}collecting=true;try{collectHealth();lastError=null}catch{lastError='Health collection unavailable; check the control connection/service'}finally{collecting=false;if(pending){pending=false;setTimeout(collect,1000)}}}
collect()
const interval=setInterval(collect,30000)
const server=createServer((req,res)=>{
 const allowed=new Set([`localhost:${port}`,`127.0.0.1:${port}`])
 if(!allowed.has(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end();return}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'")
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync(new URL('./dot-health.html',import.meta.url)));return}
 if(req.url==='/api/status'){try{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...readHealth(),collector_error:lastError,llm_used:false}))}catch{res.writeHead(503);res.end(JSON.stringify({error:'Health status unavailable',llm_used:false}))}return}
 res.writeHead(404);res.end()
})
server.listen(port,'127.0.0.1')
// Same persisted event channel used by the installed Dot relay. Notifications
// refresh observability only, never invoke an implementation or recovery command.
const env=process.env
const listener=spawn('psql',['-X','-q','-A','-t','-w','-h',env.BS_CONTROL_DB_HOST,'-p',env.BS_CONTROL_DB_PORT,'-U',env.BS_CONTROL_DB_USER,'-d',env.BS_CONTROL_DB_NAME],{env:{...env,PGSSLMODE:env.BS_CONTROL_DB_SSLMODE??'require'},stdio:['pipe','pipe','pipe']})
let scheduled=false
function event(chunk){if(!String(chunk).includes('bs_dot_wake')||scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;collect()},200)}
listener.stdout.on('data',event);listener.stderr.on('data',event)
listener.stdin.on('error',()=>process.exit(1));listener.on('close',()=>process.exit(1))
listener.stdin.write('LISTEN bs_dot_wake;\n')
const tick=setInterval(()=>listener.stdin.write('SELECT 1;\n'),5000)
process.on('SIGTERM',()=>{clearInterval(interval);clearInterval(tick);listener.kill();server.close();process.exit(0)})
