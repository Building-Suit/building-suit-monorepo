import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const migrations = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
export const worker = '3ead9a59-d84b-4e95-9871-abba0b129404'
export const founder = randomUUID(), workerUser = randomUUID(), session = randomUUID(), workerSession = randomUUID()
export const workerClaims = JSON.stringify({ sub: workerUser, role: 'authenticated', session_id: workerSession })

export async function setup(db) {
  await db.query(`create extension pg_cron;
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
    create table realtime.messages(id uuid primary key default gen_random_uuid(),topic text,event text,private boolean,payload jsonb,extension text default 'broadcast',inserted_at timestamptz default clock_timestamp());
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    grant usage on schema public,auth,extensions,realtime to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`)
  await installProviderSend(db)
  const names = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()
  const omit = new Set(['20261104231318_brain_sync_scheduler.sql','20261104232516_brain_sync_safeupdate.sql',
    '20261104233340_brain_sync_request_deadline.sql','20261105002521_brain_sync_durable_dispatch.sql',
    '20261107022638_hq_worker_admission_fence.sql','20261107142302_hq_worker_admission_resume.sql',
    '20261109150515_hq_live_dispatch_activation.sql'])
  for (const name of names) {
    if (omit.has(name)) continue
    let sql = await readFile(new URL(name, migrations), 'utf8')
    // Exact application DDL/functions; omit only the unrelated hosted Brain scheduler.
    if (name === '20261105000725_hq_live_push_events.sql') sql = sql.split('-- Remove the data-polling job.')[0]
    try { await db.query(sql) } catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }) }
    if (name === '20261105235516_hq_voice_meetings.sql') {
      await db.query(await readFile(new URL('./bootstrap/admission-pause.sql', import.meta.url), 'utf8'))
    }
  }
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',clock_timestamp()),($2,'worker@example.invalid',clock_timestamp())`,[founder,workerUser])
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[session,founder,workerSession,workerUser])
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:founder,role:'authenticated',session_id:session})])
  await db.query('select hq_private.bind_founder()')
  await db.query('select hq_private.register_agent_worker($1,$2)',[worker,workerUser])
  const ids=['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001']
  const departments=[null,'hr-agent-development','hr-agent-development','hr-agent-development','research-market-intelligence','customer-acquisition-partnerships','customer-success-onboarding','social-community','email-lifecycle','development-maintenance']
  const roster=ids.map((id,index)=>({id,name:`Employee ${index}`,role:'Fixture',departmentKey:departments[index],profileFileId:`profile_source_${index}`,skillFileIds:[],lifecycle:'configured trial pending',model:index===0?'gpt-6-astra':[2,3].includes(index)?'gpt-6.1-terra':'gpt-6.1-sol',effort:'medium',managerId:index===0?null:[2,3].includes(index)?'AG-HR-001':'AG-CEO-001',modelTier:index===0?'T3_EXEC':[2,3].includes(index)?'T1_WORKER':'T2_HEAD'}))
  const files=['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz','1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N',...roster.map(x=>x.profileFileId)]
  for (const file of files) await db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,trashed,in_scope) values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','fixture.md','text/markdown','1',false,true)`,[file])
  await asWorker(db)
  await db.query('select public.hq_worker_sync_roster($1,$2)',[worker,JSON.stringify(roster)])
  await db.query('reset role')
}

// Provider send contract includes ID augmentation and swallowed ordinary errors.
// This is a real PL/pgSQL function and real managed-message relation, not a JS
// mock. It does not emulate partitions, websocket delivery, or provider auth.
export async function installProviderSend(db) {
  await db.query(`create or replace function realtime.send(payload jsonb,event text,topic text,private boolean default true)
    returns void language plpgsql as $$
    declare generated_id uuid; final_payload jsonb;
    begin begin
      generated_id:=gen_random_uuid();
      if payload ? 'id' then final_payload:=payload; else final_payload:=jsonb_set(payload,'{id}',to_jsonb(generated_id)); end if;
      execute format('SET LOCAL realtime.topic TO %L',topic);
      insert into realtime.messages(id,payload,event,topic,private,extension)
      values(generated_id,final_payload,event,topic,private,'broadcast');
    exception when others then raise warning 'WarnSendingBroadcastMessage: %', SQLERRM;
    end; end $$;`)
}
export async function asWorker(db) {
  await db.query('reset role')
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[workerClaims])
  await db.query('set role authenticated')
}
export async function enqueue(db) {
  const conversation=randomUUID(), message=randomUUID(), job=randomUUID()
  await db.query(`insert into public.hq_agent_conversations(id,founder_user_id) values($1,$2) on conflict(founder_user_id) do nothing`,[conversation,founder])
  await db.query(`insert into public.hq_agent_messages(id,conversation_id,role,agent_id,text) select $1,id,'founder','AG-CEO-001','Synthetic native isolation test' from public.hq_agent_conversations where founder_user_id=$2`,[message,founder])
  await db.query(`insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind)
    select $1,id,$2,$3,'AG-CEO-001',$4,'conversation-ceo' from public.hq_agent_conversations where founder_user_id=$3`,[job,message,founder,randomUUID()])
  return job
}

export const activationPath=new URL('20261109150515_hq_live_dispatch_activation.sql',migrations)
export async function activationForFixture(db) {
  const original=await readFile(activationPath,'utf8')
  const begin='-- BEGIN EXACT REVIEWED PROPOSAL BODY\n', end='-- END EXACT REVIEWED PROPOSAL BODY'
  const [pre,tail]=original.split(begin)
  const [body,post]=tail.split(end)
  const proposal=await readFile(new URL('./proposed-migrations/hq_live_dispatch.sql',import.meta.url),'utf8')
  if(body!==proposal) throw new Error('Activation body must equal reviewed proposal byte-for-byte')
  let adapted=pre
  const substitutions=[]
  function replaceOnce(before,after,reason) {
    if(adapted.split(before).length!==2) throw new Error(`Non-unique fixture substitution: ${reason}`)
    adapted=adapted.replace(before,after); substitutions.push({reason,before,after})
  }
  const quote=value=>value===null?'null':"'"+value.replaceAll("'","''")+"'"
  const query=async(sql,args=[])=> (await db.query(sql,args)).rows[0]
  const database=(await query('select current_database() value')).value
  replaceOnce("pg_catalog.current_database()<>'postgres'",`pg_catalog.current_database()<>${quote(database)}`,'synthetic database name, not owner identity')
  const extension=(await query("select extversion value from pg_extension where extname='pg_cron'")).value
  replaceOnce("extname='pg_cron') is distinct from '1.6.4'",`extname='pg_cron') is distinct from ${quote(extension)}`,'actual upstream SQL extension version, not hosted package version')
  for(const [name,expected] of [['cron.database_name','postgres'],['cron.use_background_workers','off'],['cron.host','localhost']]) {
    const actual=(await query('select current_setting($1,true) value',[name])).value
    replaceOnce(`current_setting('${name}',true) is distinct from '${expected}'`,`current_setting('${name}',true) is distinct from ${quote(actual)}`,`actual disposable ${name}`)
  }
  const signatures=[...adapted.matchAll(/\('((?:hq_private|public)\.[^']+)','([0-9a-f]{32})',/g)]
  for(const [whole,signature,expected] of signatures) {
    const column=signature==='hq_private.require_brain_service()'||signature.startsWith('public.')?'pg_get_functiondef(oid)':'prosrc'
    const actual=(await query(`select md5(${column}) value from pg_proc where oid=$1::regprocedure`,[signature])).value
    replaceOnce(whole,whole.replace(expected,actual),`actual synthetic baseline fingerprint ${signature}`)
  }
  const cronOwners=(await db.query("select distinct pg_get_userbyid(proowner) owner from pg_proc where oid in ('cron.schedule(text,text,text)'::regprocedure,'cron.unschedule(bigint)'::regprocedure)")).rows
  if(cronOwners.length!==1) throw new Error('Disposable cron routines have different owners')
  replaceOnce("pg_catalog.pg_get_userbyid(p.proowner)<>'supabase_admin'",`pg_catalog.pg_get_userbyid(p.proowner)<>${quote(cronOwners[0].owner)}`,'actual extension installer owner')
  const provider=await query("select pg_get_userbyid(proowner) owner,md5(prosrc) body,md5(pg_get_functiondef(oid)) definition,proacl::text acl from pg_proc where oid='realtime.send(jsonb,text,text,boolean)'::regprocedure")
  replaceOnce("pg_catalog.pg_get_userbyid(routine.proowner)<>'supabase_realtime_admin'",`pg_catalog.pg_get_userbyid(routine.proowner)<>${quote(provider.owner)}`,'synthetic provider routine owner')
  replaceOnce("pg_catalog.md5(routine.prosrc)<>'c12384e30dda994bf2e0d23daeaea20b'",`pg_catalog.md5(routine.prosrc)<>${quote(provider.body)}`,'copied provider contract body fingerprint')
  replaceOnce("pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid))<>'77afe4a67a0330f080cb562cec0898bd'",`pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid))<>${quote(provider.definition)}`,'copied provider contract definition fingerprint')
  replaceOnce("routine.proacl::text is distinct from '{=X/supabase_realtime_admin,supabase_realtime_admin=X/supabase_realtime_admin,postgres=X/supabase_realtime_admin,dashboard_user=X/supabase_realtime_admin}'",`routine.proacl::text is distinct from ${quote(provider.acl)}`,'actual synthetic provider ACL')
  return {original,sql:adapted+begin+body+end+post,substitutions}
}
