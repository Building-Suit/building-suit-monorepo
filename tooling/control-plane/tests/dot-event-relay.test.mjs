import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

test('actual observer relay wakes persisted events once, stays quiet on unchanged state and accepts notifications',async()=>{
 const home=mkdtempSync(path.join(tmpdir(),'cp-event-relay-')),record=path.join(home,'wakes'),sql=path.join(home,'queries')
 const fake=path.join(home,'psql'),hook=path.join(home,'fetch.mjs')
 writeFileSync(fake,`#!/usr/bin/env node\nimport('node:readline').then(({createInterface})=>{const fs=require('node:fs');createInterface({input:process.stdin}).on('line',line=>{fs.appendFileSync(${JSON.stringify(sql)},line+'\\n');if(line.startsWith('SELECT')){process.stdout.write('bs_dot_event:41\\n');process.stdout.write('bs_dot_event:41\\n');setTimeout(()=>process.stdout.write('Asynchronous notification "bs_dot_wake"\\n'),100);}})});\n`)
 chmodSync(fake,0o700)
 writeFileSync(hook,`import {appendFileSync} from 'node:fs';globalThis.fetch=async(url,options)=>{appendFileSync(${JSON.stringify(record)},JSON.stringify({url,body:options.body})+'\\n');return {ok:true}};`)
 const child=spawn(process.execPath,['--import',hook,fileURLToPath(new URL('../runner/dot-event-relay.mjs',import.meta.url))],{env:{...process.env,PATH:home+':'+process.env.PATH,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'5432',BS_CONTROL_DB_USER:'observer',BS_CONTROL_DB_NAME:'fixture'},stdio:'ignore'})
 try{
  await new Promise(resolve=>setTimeout(resolve,500))
  const wakes=readFileSync(record,'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(wakes.length,2)
  assert.ok(wakes.every(w=>w.url==='http://127.0.0.1:5678/webhook/building-suit-dot-wake'))
  const queries=readFileSync(sql,'utf8')
  assert.match(queries,/LISTEN bs_dot_wake/)
  assert.match(queries,/FROM control\.dot_wake_events WHERE consumed_at IS NULL/)
  assert.doesNotMatch(queries,/UPDATE|DELETE|INSERT|claim|codex/i)
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));rmSync(home,{recursive:true,force:true})}
})
