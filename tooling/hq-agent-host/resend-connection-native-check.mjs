/** Real PostgreSQL row/advisory races. Fixed disposable DB; no provider transport. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {setTimeout as delay} from 'node:timers/promises'
import {authenticatedWorkerFixture,root,worker,workerUser,workerSession,founder,session} from './public-repository-db-fixture.mjs'
const {Client}=createRequire(new URL('../../package.json',import.meta.url))('pg')
const database='hq_resend_race_disposable'
const clients=[]
async function connect(name){
 const c=new Client({host:'127.0.0.1',port:5432,database,user:'postgres',password:'disposable-only',ssl:false,application_name:name,connectionTimeoutMillis:5000,query_timeout:25000,statement_timeout:20000})
 await c.connect();clients.push(c);return c
}
async function as(c,who){
 await c.query('reset role')
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:who==='worker'?workerUser:founder,session_id:who==='worker'?workerSession:session,role:'authenticated'})])
 await c.query('set role authenticated')
}
async function rpc(c,name,args){return(await c.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result}
async function blocked(observer,contender,holder){
 const deadline=Date.now()+5000
 while(Date.now()<deadline){
  const row=(await observer.query('select wait_event_type,pg_blocking_pids($1) blockers from pg_stat_activity where pid=$1',[contender])).rows[0]
  if(row?.wait_event_type==='Lock'&&row.blockers.includes(holder))return
  await delay(20)
 }
 assert.fail('contender never entered an observed native PostgreSQL lock wait')
}
test('native Resend: paused deny, revoke/reserve in both orders, duplicate reserve one winner',{timeout:90000},async t=>{
 t.after(async()=>{await Promise.all(clients.map(c=>c.query('rollback').catch(()=>{})));await Promise.all(clients.map(c=>c.end()))})
 const admin=await connect('resend-installer'),a=await connect('resend-holder'),b=await connect('resend-contender')
 const identity=(await admin.query(`select current_database() name,current_user username,host(inet_server_addr()) address,current_setting('server_version_num') version,to_regnamespace('hq_private') private_schema,to_regnamespace('auth') auth_schema,(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')) public_relations,(select count(*)::int from pg_roles where rolname in ('anon','authenticated','service_role')) roles`)).rows[0]
 assert.deepEqual(identity,{name:database,username:'postgres',address:'127.0.0.1',version:'170011',private_schema:null,auth_schema:null,public_relations:0,roles:0})
 const adapter={query:(...args)=>admin.query(...args),exec:sql=>admin.query(sql),close:async()=>{}}
 const h=await authenticatedWorkerFixture(true,false,true,false,false,true,adapter)
 await admin.query('reset role')
 await admin.query("insert into hq_private.agent_roster(id,name,role,department_key,manager_id) values('AG-EMAIL-002','Dina','Email Worker','email-lifecycle','AG-EMAIL-001')")
 await admin.query(await readFile(new URL('20261112213000_hq_resend_connection_test.sql',root),'utf8'))
 const apid=(await a.query('select pg_backend_pid() pid')).rows[0].pid,bpid=(await b.query('select pg_backend_pid() pid')).rows[0].pid
 assert.notEqual(apid,bpid)
 async function approved(){await h.as('founder');const msg=await h.rpc('hq_email_test_prepare',['recipient@example.invalid','Native synthetic test','No provider call.',randomUUID()]);await h.rpc('hq_email_test_decide',[msg.id,msg.digest,true]);await admin.query('reset role');return msg}
 const paused=await approved()
 await admin.query("select hq_private.set_worker_admission_pause($1,true,0,$2,'Synthetic pause')",[worker,randomUUID()])
 await as(a,'worker');await assert.rejects(rpc(a,'hq_email_test_reserve',[worker,paused.id]),/HQ_ADMISSION_PAUSED/)
 await admin.query("select hq_private.set_worker_admission_pause($1,false,1,$2,'Synthetic resume')",[worker,randomUUID()])
 await as(a,'founder');await rpc(a,'hq_email_test_decide',[paused.id,paused.digest,false])
 // Revocation holds the actual ledger row before reserve reaches it.
 const revoked=await approved();await as(a,'founder');await as(b,'worker');await a.query('begin')
 await rpc(a,'hq_email_test_decide',[revoked.id,revoked.digest,false])
 let pending=rpc(b,'hq_email_test_reserve',[worker,revoked.id]).then(value=>({value}),error=>({error}))
 await blocked(admin,bpid,apid);await a.query('commit')
 assert.match((await pending).error?.message??'',/HQ_EMAIL_TEST_NOT_AUTHORIZED/)
 // Reservation first: revoke must wait, then refuse rather than report false cancellation.
 const reserved=await approved();await as(a,'worker');await as(b,'founder');await a.query('begin')
 const permit=await rpc(a,'hq_email_test_reserve',[worker,reserved.id]);assert.ok(permit.reservation)
 pending=rpc(b,'hq_email_test_decide',[reserved.id,reserved.digest,false]).then(value=>({value}),error=>({error}))
 await blocked(admin,bpid,apid);await a.query('commit')
 assert.match((await pending).error?.message??'',/HQ_EMAIL_TEST_NOT_APPROVABLE/)
 await rpc(a,'hq_email_test_finish',[worker,reserved.id,permit.reservation,'rejected',null])
 // Two live sessions contend for the same permit, not a serialized JS mock.
 const duplicate=await approved();await as(a,'worker');await as(b,'worker');await a.query('begin')
 const winner=await rpc(a,'hq_email_test_reserve',[worker,duplicate.id])
 pending=rpc(b,'hq_email_test_reserve',[worker,duplicate.id]).then(value=>({value}),error=>({error}))
 await blocked(admin,bpid,apid);await a.query('commit')
 assert.match((await pending).error?.message??'',/HQ_EMAIL_TEST_NOT_AUTHORIZED/)
 const rows=(await admin.query('select state,reservation from public.hq_email_connection_tests where id=$1',[duplicate.id])).rows
 assert.deepEqual(rows,[{state:'reserved',reservation:winner.reservation}])
 assert.equal((await admin.query("select count(*)::int n from public.hq_email_connection_tests where state='accepted' or provider_id is not null")).rows[0].n,0)
 t.diagnostic('PostgreSQL 17.11: three observed cross-session lock waits; paused/revoked deny; exactly one durable reservation; zero provider calls.')
})
