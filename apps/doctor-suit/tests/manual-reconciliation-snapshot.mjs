// GitHub-owned disposable PostgreSQL only. Real command commits while a report
// statement is paused; production definition is restored before recovery tests.
import assert from'node:assert/strict'
import{spawn,spawnSync}from'node:child_process'
import{decodeManualReport}from'../app/utils/manualReconciliation.ts'
export async function verifyManualReportSnapshot({container,id,claim,verify,activate}){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At'],query={review:false,from:null,until:null,status:'all',page:1}
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const start=(input,open=false)=>{const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>errors+=v);const done=new Promise(resolve=>child.on('close',status=>resolve({status,output,errors})));child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}}
 const until=async check=>{const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Manual report snapshot handshake timed out');await new Promise(r=>setTimeout(r,25))}}
 const definition=sql("select pg_get_functiondef('doctor_private.manual_payment_reconciliation(boolean,timestamptz,timestamptz,text,integer)'::regprocedure);"),source='from public.doctor_manual_payment_notices n'
 assert.equal(definition.split(source).length,2)
 sql(`create function doctor_private.manual_report_pause(value uuid)returns uuid language plpgsql volatile set search_path=''as $$begin if current_setting('application_name')='doctor_manual_report_snapshot'then perform pg_advisory_xact_lock(33005,7);end if;return value;end$$;`)
 const columns=sql("select string_agg(case when attname='id'then'doctor_private.manual_report_pause(n.id) as id'else format('n.%I',attname)end,','order by attnum)from pg_attribute where attrelid='public.doctor_manual_payment_notices'::regclass and attnum>0 and not attisdropped;")
 sql(`create view doctor_private.manual_report_snapshot_notices as select ${columns} from public.doctor_manual_payment_notices n;`)
 try{
  sql(definition.replace(source,'from doctor_private.manual_report_snapshot_notices n'))
  async function snapshot(command){
   const locker=start('begin;select pg_advisory_xact_lock(33005,7);\n\\echo manual_report_held\n',true);let reader
   try{
    await until(()=>locker.output().includes('manual_report_held'))
    reader=start(`set application_name='doctor_manual_report_snapshot';${claim(3)}select public.doctor_manual_payment_reconciliation();`)
    await until(()=>sql("select count(*)from pg_stat_activity where application_name='doctor_manual_report_snapshot'and wait_event='advisory';")==='1')
    sql(command);locker.child.stdin.end('commit;\n\\q\n');const held=await locker.done,result=await reader.done;assert.equal(held.status,0,held.errors);assert.equal(result.status,0,result.errors)
    return decodeManualReport(JSON.parse(result.output.trim().split('\n').at(-1)),{userId:id(3),sessionId:id(13),practiceId:null},query)
   }finally{for(const process of[locker,reader])if(process?.child.exitCode===null)process.child.kill('SIGTERM')}
  }
  const claimSnapshot=await snapshot(verify);assert.equal(claimSnapshot.items[0].status,'submitted');assert.equal(claimSnapshot.currencies[0].verified,'0')
  const fundsSnapshot=await snapshot(activate);assert.equal(fundsSnapshot.items[0].status,'funds_verified');assert.equal(fundsSnapshot.currencies[0].verified,'29900');assert.equal(fundsSnapshot.currencies[0].activated,'0');assert.equal(fundsSnapshot.items[0].periodId,null)
  const next=decodeManualReport(JSON.parse(sql(`${claim(3)}select public.doctor_manual_payment_reconciliation();`).split('\n').at(-1)),{userId:id(3),sessionId:id(13),practiceId:null},query)
  assert.equal(next.items[0].status,'activated');assert.equal(next.currencies[0].activated,'29900');assert.equal(next.currencies[0].awaiting,'0');assert.equal(next.items[0].periodBound,true)
  console.log('Two manual reconciliation races passed: real independent verification and activation commit during paused report statements; each report stays internally coherent and the next report sees committed evidence')
 }finally{sql(definition);sql('drop view doctor_private.manual_report_snapshot_notices;drop function doctor_private.manual_report_pause(uuid);')}
}
