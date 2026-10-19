// Actual independent PostgreSQL transactions; this does not emulate Storage bytes.
import { spawn,spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyDocumentConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  function sql(input) { const result = spawnSync('docker',args,{ input,encoding: 'utf8' }); assert.equal(result.status,0,result.stderr); return result.stdout.trim() }
  const id = (prefix,n) => `${prefix}000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const user = n => id('71',n); const session = n => id('72',n); const practice = id('73',1); const location = id('74',1); const member = id('75',1); const patient = id('78',1); const key = n => id('76',n)
  const service = `set role service_role; set request.jwt.claims='{"role":"service_role"}';`
  const owner = `set role authenticated; set request.jwt.claims='{"sub":"${user(1)}","session_id":"${session(1)}","role":"authenticated"}';`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) select ('71000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-document-race-'||n||'@example.test',now(),false from generate_series(1,2)n;
    insert into auth.sessions(id,user_id,not_after)select ('72000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('71000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,2)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(1)}','Synthetic document race doctor');
    insert into public.practices(id,owner_user_id,name)values('${practice}','${user(1)}','Synthetic document race practice');
    insert into public.locations(id,practice_id,name,timezone)values('${location}','${practice}','Synthetic document race clinic','Etc/UTC');
    insert into public.memberships(id,practice_id,user_id,capabilities)values('${member}','${practice}','${user(2)}',array['patients.read','documents.read','documents.write']);
    insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values('${practice}','${member}','${location}',array['patients.read','documents.read','documents.write']);
    insert into public.patient_identities(id)values('${id('77',1)}');
    insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values('${patient}','${practice}','${id('77',1)}','Synthetic document race patient','${location}','${user(1)}');`)
  const json = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
  const reserve = (n,actor = 1,document = null,version = null) => json(sql(`${service} select public.doctor_reserve_document('${user(actor)}','${session(actor)}','${practice}','${location}','${patient}','synthetic-${n}.pdf','application/pdf',128,repeat('a',64),'${key(n)}',${document ? `'${document}'` : 'null'},${version ?? 'null'});`))
  const finalize = (intent,actor = 1) => `${service} select public.doctor_finalize_document('${user(actor)}','${session(actor)}','${intent.intent_id}');`
  function start(input,open = false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] }); let output = ''; let errors = ''
    child.stdout.on('data',value => { output+=value }); child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input); if (!open) child.stdin.end(); return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000; while (!check()) { if (Date.now()>deadline) throw new Error('Document concurrency handshake timed out'); await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(n,firstSql,secondSql) {
    const first = start(`begin; ${firstSql}\n\\echo document_transaction_held\n`,true); let second
    try {
      await until(() => first.output().includes('document_transaction_held')); second = start(`set application_name='doctor_document_race_${n}'; ${secondSql}`)
      await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_document_race_${n}' and wait_event='advisory');`)==='t')
      first.child.stdin.end('commit;\n\\q\n'); const a = await first.done; const b = await second.done; assert.equal(a.status,0,a.errors); return { a,b }
    } finally { for (const process of [first,second]) if (process && !process.child.killed && process.child.exitCode===null) process.child.kill('SIGTERM') }
  }
  const initial = reserve(1); const same = await race(1,finalize(initial),finalize(initial)); assert.equal(same.b.status,0,same.b.errors); assert.deepEqual(json(same.a.output),json(same.b.output))
  assert.equal(sql(`select count(*) from public.patient_document_versions where document_id='${initial.document_id}';`),'1')
  const first = reserve(2,1,initial.document_id,1); const stale = reserve(3,1,initial.document_id,1)
  const cas = await race(2,finalize(first),finalize(stale)); assert.notEqual(cas.b.status,0); assert.match(cas.b.errors,/DOCTOR_DOCUMENT_CONFLICT/)
  assert.equal(sql(`select version from public.patient_documents where id='${initial.document_id}';`),'2'); assert.equal(sql(`select count(*) from public.patient_document_versions where document_id='${initial.document_id}';`),'2')
  const staff = reserve(4,2)
  const revoked = await race(3,`${owner} select public.doctor_set_membership_status('${practice}','${member}',1,'revoked','${key(50)}');`,finalize(staff,2)); assert.notEqual(revoked.b.status,0); assert.match(revoked.b.errors,/DOCTOR_ACCESS_DENIED/)
  assert.equal(sql(`select count(*) from public.patient_documents where id='${staff.document_id}';`),'0')
  sql(`update public.memberships set status='active',version=version+1 where id='${member}';`)
  const delivery = await race(4,`${owner} select public.doctor_set_membership_status('${practice}','${member}',3,'revoked','${key(51)}');`,`${service} select public.doctor_document_delivery('${user(2)}','${session(2)}','${practice}','${location}','${patient}','${initial.document_id}','${initial.version_id}','${key(52)}');`)
  assert.notEqual(delivery.b.status,0); assert.match(delivery.b.errors,/DOCTOR_ACCESS_DENIED/)
  sql(`update public.memberships set status='active',version=version+1 where id='${member}';`)
  const expired = reserve(5,2)
  const signedOut = await race(5,`select pg_advisory_xact_lock(hashtextextended('${practice}',1)); delete from auth.sessions where id='${session(2)}';`,finalize(expired,2)); assert.notEqual(signedOut.b.status,0); assert.match(signedOut.b.errors,/DOCTOR_AUTH_REQUIRED/)
  const afterArchive = reserve(6,1)
  const archived = await race(6,`${owner} select public.doctor_archive_patient('${practice}','${location}','${patient}',1,'${key(53)}');`,finalize(afterArchive)); assert.notEqual(archived.b.status,0); assert.match(archived.b.errors,/DOCTOR_ACCESS_DENIED/)
  assert.equal(sql(`select count(*) from public.patient_document_events where document_id='${initial.document_id}';`),'2')
  console.log('Six concurrent document scenarios passed: exact finalize retry, replacement CAS, upload/delivery revocation, signout and patient archive after lock wait')
}
