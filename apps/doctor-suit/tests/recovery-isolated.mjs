// Functional application-database restore in the SQL runner's owned container.
// Minimal Auth/Storage schema scaffolds; no managed provider or hosted recovery claim.
import assert from 'node:assert/strict'
import { createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID } from 'node:crypto'
import { mkdtemp,writeFile,readFile,rm,chmod,stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { observeDoctorSyntheticRecovery } from '../supabase/functions/_shared/operational-signals.ts'
export async function verifyDoctorIsolatedRecovery(container, observe) {
  return observeDoctorSyntheticRecovery(() => verifyDoctorIsolatedRecoveryCore(container), observe)
}
async function verifyDoctorIsolatedRecoveryCore(container) {
  assert.match(container,/^doctor-sql-[0-9a-f-]{36}$/)
  const run=(args,input,encoding='utf8')=>{const r=spawnSync('docker',args,{input,encoding,timeout:60000,maxBuffer:64*1024*1024});assert.equal(r.status,0,'Owned recovery subprocess failed');return r.stdout}
  assert.equal(run(['inspect','--format','{{.HostConfig.NetworkMode}}',container]).trim(),'none','Recovery source must be the owned network-isolated fixture')
  const target=`doctor_restore_${randomUUID().replaceAll('-','')}`,directory=await mkdtemp(path.join(tmpdir(),'doctor-recovery-')),key=randomBytes(32),nonce=randomBytes(12)
  await chmod(directory,0o700)
  const sql=(database,input)=>run(['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-d',database,'-qAt','-v','ON_ERROR_STOP=1'],input).trim()
  const id=n=>`ae140000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const claim=n=>`set role authenticated;set request.jwt.claims='${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}';`
  const digest=value=>createHash('sha256').update(value).digest('hex')
  const schema=database=>run(['exec',container,'pg_dump','-h','127.0.0.1','-U','postgres','-d',database,'--schema-only','--no-comments']).replace(/^\\(?:un)?restrict .*\n/gm,'')
  const fingerprint=database=>sql(database,`create temporary table recovery_fingerprints(name text,rows bigint,digest text);
   do $body$ declare item record;begin for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('public','doctor_private','auth','storage')order by 1,2 loop
    execute format('insert into recovery_fingerprints select %L,count(*),md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),''[]''::jsonb)::text)from %I.%I t',item.nspname||'.'||item.relname,item.nspname,item.relname);
   end loop;end $body$;
   select coalesce(jsonb_agg(to_jsonb(f)order by name),'[]')from recovery_fingerprints f;`)
  let targetCreated=false,policyChanged=false
  const started=performance.now()
  try {
    sql('postgres',"update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned isolated synthetic restore fixture';");policyChanged=true
    const patient=JSON.parse(sql('postgres',`${claim(1)}select public.doctor_write_patient('${id(21)}','${id(31)}','{"name":"Synthetic recovery patient","phone":"","email":"","date_of_birth":null}'::jsonb,'${randomUUID()}');`)).patient_id
    assert.match(patient,/^[0-9a-f-]{36}$/)
    sql('postgres',`${claim(1)}select public.doctor_submit_privacy_request('access_review','${randomUUID()}');`)
    const before=fingerprint('postgres'),beforeSchema=schema('postgres')
    const archive=run(['exec',container,'pg_dump','-h','127.0.0.1','-U','postgres','-d','postgres','--format=custom'],undefined,null)
    const cipher=createCipheriv('aes-256-gcm',key,nonce),encrypted=Buffer.concat([cipher.update(archive),cipher.final()]),tag=cipher.getAuthTag(),file=path.join(directory,'synthetic-application-db.aes-gcm')
    await writeFile(file,Buffer.concat([nonce,tag,encrypted]),{mode:0o600});assert.equal((await stat(file)).mode&0o777,0o600)
    function decrypt(value){const decipher=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));decipher.setAuthTag(value.subarray(12,28));return Buffer.concat([decipher.update(value.subarray(28)),decipher.final()])}
    const persisted=await readFile(file),corrupt=Buffer.from(persisted);corrupt[corrupt.length-1]^=1
    assert.throws(()=>decrypt(corrupt),'Tampering must fail before any restore target is created')
    const restoredArchive=decrypt(persisted);assert.equal(digest(restoredArchive),digest(archive),'Archive authentication/bytes differ')
    sql('postgres',`create database ${target} template template0;`);targetCreated=true
    run(['exec','-i',container,'pg_restore','-h','127.0.0.1','-U','postgres','--exit-on-error','--dbname',target],restoredArchive)
    const afterSchema=schema(target)
    if(afterSchema!==beforeSchema){
      const prior=beforeSchema.split('\n'),restored=afterSchema.split('\n'),first=prior.findIndex((line,index)=>line!==restored[index])
      console.error(JSON.stringify({schemaDifferenceAt:first+1,before:prior.slice(Math.max(0,first-2),first+4),restored:restored.slice(Math.max(0,first-2),first+4)}))
    }
    assert.equal(digest(afterSchema),digest(beforeSchema),'Restored schema, grants, RLS, policies, triggers, constraints and functions differ')
    assert.equal(fingerprint(target),before,'Restored application/Auth-interface/Storage-interface rows and immutable histories differ')
    assert.equal(sql(target,`${claim(1)}select public.doctor_saas_status()->>'state';`),'trial')
    assert.equal(sql(target,`${claim(1)}select public.doctor_saas_status()->>'business_writes_allowed';`),'true')
    assert.equal(sql(target,`${claim(1)}select public.doctor_patient_profile('${id(21)}','${id(31)}','${patient}')->'patient'->>'id';`),patient)
    assert.equal(sql(target,`${claim(1)}select jsonb_array_length(public.doctor_privacy_requests()->'items');`),'1')
    assert.equal(sql(target,`${claim(1)}select public.doctor_administrative_edition()->>'clinical_records';`),'false')
    const denied=command=>{const result=spawnSync('docker',['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-d',target,'-qAt','-v','ON_ERROR_STOP=1'],{input:command,encoding:'utf8',timeout:10000});assert.notEqual(result.status,0);assert.match(result.stderr,/DOCTOR_ACCESS_DENIED|permission denied/)}
    denied(`${claim(2)}select public.doctor_patient_profile('${id(21)}','${id(31)}','${patient}');`)
    denied(`${claim(1)}select public.doctor_patient_documents('${id(21)}','${id(31)}','${patient}');`)
    denied(`${claim(1)}delete from public.patient_identities where id='${patient}';`)
    // A restored authorized write must execute final constraints, then roll back to the fingerprinted snapshot.
    sql(target,`begin;${claim(1)}select public.doctor_write_patient('${id(21)}','${id(31)}','{"name":"Synthetic rollback probe","phone":"","email":"","date_of_birth":null}'::jsonb,'${randomUUID()}');set constraints all immediate;rollback;`)
    assert.equal(fingerprint(target),before,'Recovery probes changed the restored snapshot')
    console.log(`Isolated synthetic application-database restore passed: ${JSON.parse(before).length} table fingerprints, exact schema/ACL/RLS/history, authenticated-encryption tamper rejection, candidate authority and cross-account/document denial; measured ${Math.ceil(performance.now()-started)} ms. Hosted provider recovery, Storage bytes, custody approval and RPO/RTO qualification: UNRUN.`)
  } finally {
    key.fill(0)
    try {
      if(targetCreated)sql('postgres',`drop database ${target} with(force);`)
      if(policyChanged)sql('postgres',"update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return owned fixture after isolated restore';")
    } finally { await rm(directory,{recursive:true,force:true}) }
  }
}
