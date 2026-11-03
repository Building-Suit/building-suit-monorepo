import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile,readdir } from 'node:fs/promises'
import { load } from '../../scripts/load-test-module.mjs'
const {HqRemoteStore}=await load('../server/utils/hqRemoteStore.ts')
const {parseFounderAction}=await load('../server/utils/hqDomain.ts')
const {configuration}=await load('../server/utils/hqAuth.ts')
const {scryptSync}=await import('node:crypto')
test('dedicated Postgres migration denies direct clients and atomically saves state, sessions and attempts',async()=>{
 const db=new PGlite()
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 const file=(await readdir(new URL('../../supabase/migrations',import.meta.url))).find(f=>f.endsWith('.sql'))
 await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'))
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role)
  await assert.rejects(()=>db.query('select * from public.hq_workspace'))
  await assert.rejects(()=>db.query('select public.hq_read_workspace()'))
  await db.exec('reset role')
 }
 const rls=await db.query("select relname from pg_class where relname in ('hq_workspace','hq_sessions','hq_login_limits') and relrowsecurity")
 assert.equal(rls.rows.length,3)
 await db.exec('set role service_role')
 const current=(await db.query('select public.hq_read_workspace() as state')).rows[0].state
 const changed=structuredClone(current.document);changed.events=[]
 assert.equal((await db.query('select public.hq_commit_workspace($1,$2) ok',[0,changed])).rows[0].ok,true)
 assert.equal((await db.query('select public.hq_commit_workspace($1,$2) ok',[0,changed])).rows[0].ok,false)
 changed.tasks[0].budget=2
 await assert.rejects(()=>db.query('select public.hq_commit_workspace($1,$2)',[1,changed]),/HQ_INVALID_TASK/)
 const hash='a'.repeat(64),now=Date.now()
 await db.query('select public.hq_save_session($1,$2)',[hash,now+1000]);assert.equal((await db.query('select public.hq_session_valid($1,$2) ok',[hash,now])).rows[0].ok,true)
 assert.equal((await db.query('select public.hq_session_valid($1,$2) ok',[hash,now+1000])).rows[0].ok,false)
 await db.query('select public.hq_revoke_session($1)',[hash]);assert.equal((await db.query('select public.hq_session_valid($1,$2) ok',[hash,now])).rows[0].ok,false)
 for(let i=0;i<8;i++)assert.equal((await db.query('select public.hq_consume_login_attempt($1,$2) ok',[hash,now])).rows[0].ok,true)
 assert.equal((await db.query('select public.hq_consume_login_attempt($1,$2) ok',[hash,now])).rows[0].ok,false)
 await db.close()
})
test('remote adapter retries CAS conflicts and reuses receipt after transport uncertainty',async()=>{
 const {initialDocument}=await load('../server/utils/hqDomain.ts')
 let document=initialDocument(),revision=0,conflicts=1
 const send=async(url,options)=>{
  assert.equal(options.headers.apikey,'synthetic-server-key')
  assert.equal(options.redirect,'error')
  const name=url.split('/').at(-1),body=JSON.parse(options.body)
  let result
  if(name==='hq_read_workspace')result={document,revision}
  if(name==='hq_commit_workspace'){
   if(conflicts-- >0){revision++;result=false}
   else if(body.p_revision!==revision)result=false
   else{document=body.p_document;revision++;result=true}
  }
  return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}})
 }
 const store=new HqRemoteStore('https://synthetic.supabase.co','synthetic-server-key',send)
 const actor={id:'founder',role:'founder'},command=parseFounderAction({action:'send_message',idempotencyKey:'once',text:'Synthetic CEO message'},actor)
 const first=await store.execute(actor,command);assert.deepEqual(await store.execute(actor,command),first);assert.equal(document.messages.length,1)
 const modern=new HqRemoteStore('https://synthetic.supabase.co','sb_secret_synthetic',async(_url,options)=>{assert.equal(options.headers.apikey,'sb_secret_synthetic');assert.equal(options.headers.Authorization,undefined);return new Response(JSON.stringify({document,revision}),{status:200})});await modern.read()
 const unavailable=new HqRemoteStore('https://synthetic.supabase.co','key',async()=>new Response('',{status:403}));await assert.rejects(()=>unavailable.read(),e=>e.status===503)
})
test('environment guard binds selected staging/production refs and blocks unverified scope/cost',()=>{
 const salt='a'.repeat(32),env={HQ_APP_ORIGIN:'https://hq.example',HQ_FOUNDER_PASSWORD_HASH:salt+':'+scryptSync('synthetic-password',salt,64).toString('hex'),HQ_ENVIRONMENT:'staging',HQ_SUPABASE_URL:'https://lwecnmsosfwovlzxauml.supabase.co',HQ_SUPABASE_SECRET_KEY:'synthetic-secret',HQ_HOSTING_COST_VERIFIED:'true'}
 assert.equal(configuration(env),null)
 assert.ok(configuration({...env,HQ_BACKEND_SCOPE_VERIFIED:'true'}))
 assert.equal(configuration({...env,HQ_BACKEND_SCOPE_VERIFIED:'true',HQ_SUPABASE_URL:'https://dfeiuxsqhgzontefmrjc.supabase.co'}),null)
})
