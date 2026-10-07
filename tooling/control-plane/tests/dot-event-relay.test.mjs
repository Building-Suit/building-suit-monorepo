import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

test('actual observer relay wakes persisted events once per burst, persists its watermark and ignores duplicate notifications',async()=>{
 const home=mkdtempSync(path.join(tmpdir(),'cp-event-relay-')),record=path.join(home,'wakes'),sql=path.join(home,'queries')
 const fake=path.join(home,'psql'),hook=path.join(home,'fetch.mjs')
 writeFileSync(fake,`#!/usr/bin/env node\nimport('node:readline').then(({createInterface})=>{const fs=require('node:fs');createInterface({input:process.stdin}).on('line',line=>{fs.appendFileSync(${JSON.stringify(sql)},line+'\\n');if(line.startsWith('SELECT')){process.stdout.write('bs_dot_event:41\\n');process.stdout.write('bs_dot_event:41\\n');setTimeout(()=>process.stdout.write('Asynchronous notification "bs_dot_wake"\\n'),100);}})});\n`)
 chmodSync(fake,0o700)
 writeFileSync(hook,`import {appendFileSync} from 'node:fs';const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>realTimeout(fn,delay===15000?50:delay,...args);globalThis.fetch=async(url,options)=>{appendFileSync(${JSON.stringify(record)},JSON.stringify({url,body:options.body})+'\\n');return {ok:true}};`)
 const child=spawn(process.execPath,['--import',hook,fileURLToPath(new URL('../runner/dot-event-relay.mjs',import.meta.url))],{env:{...process.env,PATH:home+':'+process.env.PATH,BS_CONTROL_REPOSITORY_ROOT:home,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'5432',BS_CONTROL_DB_USER:'observer',BS_CONTROL_DB_NAME:'fixture'},stdio:'ignore'})
 try{
  await waitUntil(()=>readFileSyncSafe(path.join(home,'.local/control-egress/relay-watermark.json')).includes('41'))
  await new Promise(resolve=>setTimeout(resolve,200))
  const wakes=readFileSync(record,'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(wakes.length,1);assert.equal(JSON.parse(wakes[0].body).event_id,41);assert.equal(JSON.parse(readFileSync(path.join(home,'.local/control-egress/relay-watermark.json'),'utf8')).event_id,41)
  assert.ok(wakes.every(w=>w.url==='http://127.0.0.1:5678/webhook/building-suit-dot-wake'))
  const queries=readFileSync(sql,'utf8')
  assert.match(queries,/LISTEN bs_dot_wake/)
  assert.match(queries,/FROM control\.dot_wake_events WHERE consumed_at IS NULL/)
  assert.doesNotMatch(queries,/UPDATE|DELETE|INSERT|claim|codex/i)
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));rmSync(home,{recursive:true,force:true})}
})

test('100 derived notifications never reach BS31; a state burst wakes once and relay restart retains delivery identity',async()=>{
 const home=mkdtempSync(path.join(tmpdir(),'cp-derived-relay-')),record=path.join(home,'wakes'),state=path.join(home,'state'),fake=path.join(home,'psql'),hook=path.join(home,'fetch.mjs')
 writeFileSync(fake,`#!/usr/bin/env node\nconst fs=require('node:fs');require('node:readline').createInterface({input:process.stdin}).on('line',line=>{if(line.startsWith('SELECT')){const filtered=line.includes("wake_kind='state'")&&line.includes('retry_exhaustion_audited');const id=fs.existsSync(${JSON.stringify(state)})?41:filtered?0:40;for(let i=0;i<100;i++)console.log('bs_dot_event:'+id);}});`);chmodSync(fake,0o700)
 writeFileSync(hook,`import {appendFileSync} from 'node:fs';const later=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>later(fn,delay===15000?25:delay,...args);globalThis.fetch=async(url,options)=>{appendFileSync(${JSON.stringify(record)},options.body+'\\n');return {ok:true}};`)
 const start=()=>spawn(process.execPath,['--import',hook,fileURLToPath(new URL('../runner/dot-event-relay.mjs',import.meta.url))],{env:{...process.env,PATH:home+':'+process.env.PATH,BS_CONTROL_REPOSITORY_ROOT:home,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'1',BS_CONTROL_DB_USER:'observer',BS_CONTROL_DB_NAME:'fixture'},stdio:'ignore'})
 const stop=async child=>{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r))}
 let child
 try{child=start();await new Promise(r=>setTimeout(r,500));assert.equal(readFileSyncSafe(record),'');await stop(child)
 writeFileSync(state,'new state');child=start();await new Promise(r=>setTimeout(r,500));await stop(child);assert.equal(readFileSyncSafe(record).trim().split('\n').length,1)
 child=start();await new Promise(r=>setTimeout(r,500));await stop(child);assert.equal(readFileSyncSafe(record).trim().split('\n').length,1)
 }finally{if(child?.exitCode===null)await stop(child);rmSync(home,{recursive:true,force:true})}
})
function readFileSyncSafe(file){try{return readFileSync(file,'utf8')}catch(error){if(error.code==='ENOENT')return '';throw error}}

test('authoritative gate during debounce survives an empty poll and 100 reordered duplicate deliveries',async()=>{
 const home=mkdtempSync(path.join(tmpdir(),'cp-racing-relay-')),record=path.join(home,'wakes'),fake=path.join(home,'psql'),hook=path.join(home,'fetch.mjs')
 writeFileSync(fake,`#!/usr/bin/env node\nrequire('node:readline').createInterface({input:process.stdin}).on('line',line=>{if(line.startsWith('SELECT')){for(let n=0;n<100;n++)console.log('bs_dot_event:41');setTimeout(()=>console.log('bs_dot_event:0'),10);setTimeout(()=>{for(let n=0;n<100;n++)console.log('bs_dot_event:42')},75)}});`);chmodSync(fake,0o700)
 writeFileSync(hook,`import {appendFileSync} from 'node:fs';const later=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>later(fn,delay===15000?50:delay,...args);globalThis.fetch=async(url,options)=>{appendFileSync(${JSON.stringify(record)},options.body+'\\n');await new Promise(r=>later(r,40));return {ok:true}};`)
 const child=spawn(process.execPath,['--import',hook,fileURLToPath(new URL('../runner/dot-event-relay.mjs',import.meta.url))],{env:{...process.env,PATH:home+':'+process.env.PATH,BS_CONTROL_REPOSITORY_ROOT:home,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'1',BS_CONTROL_DB_USER:'observer',BS_CONTROL_DB_NAME:'fixture'},stdio:'ignore'})
 try{await waitUntil(()=>readFileSyncSafe(path.join(home,'.local/control-egress/relay-watermark.json')).includes('42'));const wakes=readFileSyncSafe(record).trim().split('\n').map(JSON.parse);assert.deepEqual(wakes.map(w=>w.event_id),[41,42]);assert.equal(JSON.parse(readFileSync(path.join(home,'.local/control-egress/relay-watermark.json'))).event_id,42)}finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));rmSync(home,{recursive:true,force:true})}
})

test('n8n unavailable after approval does not acknowledge the persisted wake; restarted relay retries it once',async()=>{
 const home=mkdtempSync(path.join(tmpdir(),'cp-failed-wake-')),record=path.join(home,'wakes'),available=path.join(home,'n8n-ready'),fake=path.join(home,'psql'),hook=path.join(home,'fetch.mjs')
 writeFileSync(fake,`#!/usr/bin/env node\nrequire('node:readline').createInterface({input:process.stdin}).on('line',line=>{if(line.startsWith('SELECT'))console.log('bs_dot_event:51')});`);chmodSync(fake,0o700)
 writeFileSync(hook,`import {appendFileSync,existsSync} from 'node:fs';const later=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>later(fn,delay===15000?25:delay,...args);globalThis.fetch=async(url,options)=>{if(!existsSync(${JSON.stringify(available)}))throw Error('n8n unavailable');appendFileSync(${JSON.stringify(record)},options.body+'\\n');return {ok:true}};`)
 const start=()=>spawn(process.execPath,['--import',hook,fileURLToPath(new URL('../runner/dot-event-relay.mjs',import.meta.url))],{env:{...process.env,PATH:home+':'+process.env.PATH,BS_CONTROL_REPOSITORY_ROOT:home,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'1',BS_CONTROL_DB_USER:'observer',BS_CONTROL_DB_NAME:'fixture'},stdio:'ignore'})
 const stop=async child=>{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r))}
 let child
 try{child=start();await new Promise(r=>setTimeout(r,400));assert.equal(readFileSyncSafe(record),'');assert.equal(readFileSyncSafe(path.join(home,'.local/control-egress/relay-watermark.json')),'');await stop(child);writeFileSync(available,'ready');child=start();await waitUntil(()=>readFileSyncSafe(path.join(home,'.local/control-egress/relay-watermark.json')).includes('51'));await stop(child);assert.equal(readFileSyncSafe(record).trim().split('\n').length,1);assert.equal(JSON.parse(readFileSync(path.join(home,'.local/control-egress/relay-watermark.json'))).event_id,51)}finally{if(child?.exitCode===null)await stop(child);rmSync(home,{recursive:true,force:true})}
})

async function waitUntil(predicate){const deadline=Date.now()+8000;while(!predicate()){assert.ok(Date.now()<deadline,'relay did not reach its persisted delivery boundary');await new Promise(r=>setTimeout(r,25))}}
