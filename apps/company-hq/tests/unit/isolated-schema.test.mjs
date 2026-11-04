import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const sql=await readFile(new URL('../../supabase/prepared/20261104002826_isolated_hq_review_only.sql',import.meta.url),'utf8')
const document={tasks:[],messages:[],events:[],receipts:{},lastAgentSeen:null}
async function fixture() {
 const db=new PGlite()
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema super_admin;')
 // Representative synthetic inventory; no real account or control-plane data is used.
 for(let n=1;n<=36;n++)await db.exec(`create table public.controlplane_${n}(id integer primary key,value text); insert into public.controlplane_${n} values(1,'synthetic-${n}'); grant select on public.controlplane_${n} to authenticated;`)
 await db.exec("create table auth.users(id integer primary key); insert into auth.users values(1),(2); create table super_admin.control_state(id integer primary key,value text); insert into super_admin.control_state values(1,'synthetic private'); create function public.controlplane_probe() returns integer language sql as 'select 7';")
 return db
}
async function inventory(db) {
 const rows=[]
 for(let n=1;n<=36;n++)rows.push((await db.query(`select * from public.controlplane_${n} order by id`)).rows)
 return {
  rows,
  users:(await db.query('select * from auth.users order by id')).rows,
  privateRows:(await db.query('select * from super_admin.control_state')).rows,
  relations:(await db.query("select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','super_admin') order by 1,2")).rows,
  schemas:(await db.query("select nspname,nspowner,nspacl::text from pg_namespace where nspname in ('public','auth','super_admin') order by 1")).rows,
  publications:(await db.query('select * from pg_publication order by pubname')).rows,
  probe:(await db.query('select public.controlplane_probe() value')).rows,
 }
}
test('prepared isolated schema preserves populated control-plane inventory and denies every application role',async()=>{
 const db=await fixture();try{
  const before=await inventory(db)
  await db.exec(sql)
  assert.deepEqual(await inventory(db),before)
  assert.equal((await db.query('select count(*)::integer count from company_hq.hq_workspace')).rows[0].count,0)
  assert.equal((await db.query('select company_hq.hq_initialize_workspace($1) ok',[document])).rows[0].ok,true)
  const changed={...document,messages:[{id:'synthetic',text:'retained HQ evidence'}]}
  assert.equal((await db.query('select company_hq.hq_commit_workspace(0,$1) ok',[changed])).rows[0].ok,true)
  await db.exec(sql)
  assert.deepEqual(await inventory(db),before)
  const stored=(await db.query('select company_hq.hq_read_workspace() value')).rows[0].value
  assert.equal(stored.revision,1);assert.deepEqual(stored.document,changed)
  assert.equal((await db.query('select company_hq.hq_initialize_workspace($1) ok',[document])).rows[0].ok,false)
  const rls=(await db.query("select count(*)::integer count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='company_hq' and c.relkind='r' and c.relrowsecurity")).rows[0].count
  assert.equal(rls,4)
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('set role '+role)
   await assert.rejects(()=>db.query('select * from company_hq.hq_workspace'),/permission denied/)
   await assert.rejects(()=>db.query('select company_hq.hq_read_workspace()'),/permission denied/)
   await db.exec('reset role')
  }
 }finally{await db.close()}
})
test('prepared schema refuses an unrecognized namespace without altering its existing records',async()=>{
 const db=new PGlite();try{
  await db.exec("create role anon; create role authenticated; create role service_role; create schema company_hq; create table company_hq.existing(id integer); insert into company_hq.existing values(7);")
  await assert.rejects(()=>db.exec(sql),/HQ_SCHEMA_OWNERSHIP_UNVERIFIED/)
  await db.exec('rollback')
  assert.deepEqual((await db.query('select * from company_hq.existing')).rows,[{id:7}])
  assert.equal((await db.query("select to_regclass('company_hq.installation') value")).rows[0].value,null)
 }finally{await db.close()}
})
test('isolated owner-only functions enforce CAS, zero budget, byte capacity and retained session revocation',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await db.exec(sql);await db.query('select company_hq.hq_initialize_workspace($1)',[document])
  assert.equal((await db.query('select company_hq.hq_commit_workspace(1,$1) ok',[document])).rows[0].ok,false)
  await assert.rejects(()=>db.query('select company_hq.hq_commit_workspace(0,$1)',[{...document,tasks:[{budget:1,owner:'ceo',status:'proposed'}]}]),/HQ_INVALID_TASK/)
  await assert.rejects(()=>db.query('select company_hq.hq_commit_workspace(0,$1)',[{...document,extra:'ع'.repeat(4_000_001)}]),/HQ_INVALID_DOCUMENT/)
  const hash='a'.repeat(64),now=1000
  await db.query('select company_hq.hq_save_session($1,$2)',[hash,2000])
  assert.equal((await db.query('select company_hq.hq_session_valid($1,$2) ok',[hash,now])).rows[0].ok,true)
  await db.query('select company_hq.hq_revoke_session($1)',[hash])
  assert.equal((await db.query('select company_hq.hq_session_valid($1,$2) ok',[hash,now])).rows[0].ok,false)
  assert.equal((await db.query('select count(*)::integer count from company_hq.hq_sessions')).rows[0].count,1)
  for(let n=1;n<=9;n++)assert.equal((await db.query('select company_hq.hq_consume_login_attempt($1,$2) ok',[hash,now])).rows[0].ok,n<=8)
  assert.equal((await db.query('select company_hq.hq_consume_login_attempt($1,$2) ok',[hash,901000])).rows[0].ok,true)
 }finally{await db.close()}
})
