// Real separate PostgreSQL receipts/audit + synthetic, memory-only protocol keys.
import assert from'node:assert/strict'
import{spawn,spawnSync}from'node:child_process'
import{handleDoctorAdministration}from'../supabase/functions/_shared/doctor-administration.mjs'
import{syntheticDoctorAdminId as id,syntheticDoctorAdminMaterial as material,syntheticDoctorAdminConfiguration as configuration,syntheticDoctorAdminPacket as packet}from'./helpers/administration-packet.mjs'
export async function verifyDoctorAdministrationProtocol(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 function sql(input){const result=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
 const literal=value=>`'${String(value).replaceAll("'","''")}'`
 const now=Date.now(),binding=configuration();binding.keyValidFrom=new Date(now-60000).toISOString();binding.keyValidUntil=new Date(now+600000).toISOString();binding.manifest.expiresAt=binding.keyValidUntil
 const read=async()=>JSON.parse(sql(`select jsonb_build_object('subscriberUserId',u.id,'practiceId',p.id,'authVerified',u.email_confirmed_at is not null and not u.is_anonymous,'storedOwner',p.owner_user_id=u.id,'state','unconfigured','subscriptionRevision',0)from auth.users u join public.practices p on p.owner_user_id=u.id where u.id='${id(11)}';`))
 sql(`insert into auth.users(id,email,email_confirmed_at)values('${id(11)}','synthetic-protocol-owner@example.test',now());insert into public.doctor_profiles(user_id,display_name)values('${id(11)}','Synthetic protocol owner');insert into public.practices(id,owner_user_id,name)values('${id(12)}','${id(11)}','Synthetic protocol practice');`)
 const dependencies={now:()=>now,loadBinding:async()=>binding,readVerificationKey:async()=>material,
  consumeNonce:async n=>sql(`select doctor_private.consume_administration_nonce('${n.sourceBindingId}',${literal(n.keyId)},'${n.nonce}','${n.requestId}','${n.expiresAt}');`)==='t',
  readTargetSubject:read,
  appendAudit:async entry=>sql(`select doctor_private.append_administration_audit(${literal(JSON.stringify(entry))}::jsonb);`)}
 const request=await packet({wire:{timestamp:Math.floor(now/1000)}})
 const results=await Promise.all([handleDoctorAdministration(request,dependencies),handleDoctorAdministration(request,dependencies)])
 assert.equal(results.filter(result=>result.status===200).length,1);assert.equal(results.filter(result=>result.status===409).length,1)
 assert.equal(sql(`select count(*)from public.doctor_administration_audit where request_id='${id(8)}';`),'1')
 const fresh=await packet({nonce:id(14),wire:{timestamp:Math.floor(now/1000)}})
 assert.equal((await handleDoctorAdministration(fresh,dependencies)).status,200)
 assert.equal(sql(`select count(*)from public.doctor_administration_audit where request_id='${id(8)}';`),'2')
 const denied=await packet({nonce:id(15),wire:{timestamp:Math.floor(now/1000)}})
 const response=await handleDoctorAdministration(denied,{...dependencies,readTargetSubject:async()=>{throw Error('synthetic target unavailable')}})
 assert.equal(response.status,403);assert.equal(JSON.parse(new TextDecoder().decode(response.bytes)).error.code,'DOCTOR_ADMIN_TARGET_DENIED')
 assert.equal(sql(`select count(*)from public.doctor_administration_nonces where nonce='${id(15)}';`),'1')
 assert.equal(sql(`select outcome from public.doctor_administration_audit where nonce='${id(15)}';`),'target_denied')
 assert.equal((await handleDoctorAdministration(denied,dependencies)).status,409)
 let schemaReads=0
 for(const [nonce,body]of[[id(17),{operation:'doctor.plan.command'}],[id(18),{payload:{subscriberUserId:id(11),unexpected:'synthetic-extra'}}]]){
  const request=await packet({nonce,body,wire:{timestamp:Math.floor(now/1000)}})
  const dependenciesWithReadGuard={...dependencies,readTargetSubject:async()=>{schemaReads++;throw Error('schema denial cannot read target')}}
  const response=await handleDoctorAdministration(request,dependenciesWithReadGuard)
  assert.equal(response.status,403);assert.ok(response.headers['x-bs-signature']);assert.equal(sql(`select count(*)from public.doctor_administration_nonces where nonce='${nonce}';`),'1')
  assert.equal(sql(`select outcome from public.doctor_administration_audit where nonce='${nonce}';`),'schema_denied')
  assert.equal((await handleDoctorAdministration(request,dependenciesWithReadGuard)).status,409)
  assert.equal(sql(`select count(*)from public.doctor_administration_audit where nonce='${nonce}';`),'1')
 }
 assert.equal(schemaReads,0)
 // Two separate open PostgreSQL sessions prove uniqueness after waiting for
 // an uncommitted conflicting insert, rather than relying on a JavaScript Set.
 function process(input,open=false){const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',data=>{output+=data});child.stderr.on('data',data=>{errors+=data});const done=new Promise(resolve=>child.on('close',status=>resolve({status,output,errors})));child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}}
 async function until(check){const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Administration receipt handshake timed out');await new Promise(resolve=>setTimeout(resolve,25))}}
 const consume=`select doctor_private.consume_administration_nonce('${id(1)}','synthetic-key-v1','${id(16)}','${id(8)}',clock_timestamp()+interval'2 minutes');`
 const first=process(`begin;${consume}\n\\echo admin_nonce_held\n`,true);let second
 try{await until(()=>first.output().includes('admin_nonce_held'));second=process(`set application_name='doctor_admin_nonce_wait';${consume}`)
  await until(()=>sql("select count(*)from pg_stat_activity where application_name='doctor_admin_nonce_wait'and wait_event_type='Lock';")==='1')
  first.child.stdin.end('commit;\n\\q\n');const a=await first.done,b=await second.done;assert.equal(a.status,0,a.errors);assert.equal(b.status,0,b.errors);assert.match(b.output,/\nf\s*$/)
 }finally{for(const item of[first,second])if(item?.child.exitCode===null)item.child.kill('SIGTERM')}
 assert.equal(sql(`select count(*)from public.doctor_administration_nonces where nonce='${id(16)}';`),'1')
 assert.equal(sql(`select count(*)from public.doctor_saas_accounts where subscriber_user_id='${id(11)}';`),'0')
 console.log('Six Doctor administration protocol/storage scenarios passed: authenticated synthetic response with concurrent replay denial, fresh-nonce query retry, signed target denial retaining committed nonce/audit, separate-transaction duplicate nonce wait, unsupported-operation replay and extra-payload replay;  no account/grant/payment/session creation')
}
