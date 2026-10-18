// Deterministic old-code negative control and fixed-code report/prepare race.
// Every schema rewrite below is confined to the run-owned disposable database.
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{spawn,spawnSync}from'node:child_process'
import{doctorSaasFinancialStatus}from'../app/utils/saasFinancialRepository.ts'
export async function verifySaasReportSnapshot({container,id,claim,revision}){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 function sql(input){const result=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
 function process(input,open=false){const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',v=>{output+=v});child.stderr.on('data',v=>{errors+=v});const done=new Promise(resolve=>child.on('close',status=>resolve({status,output,errors})));child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}}
 async function until(check){const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Financial snapshot handshake timed out');await new Promise(resolve=>setTimeout(resolve,25))}}
 const definition=sql("select pg_get_functiondef('doctor_private.saas_financial_status(integer,integer)'::regprocedure);")
 const historical=await readFile(new URL('../supabase/migrations/20261018023210_doctor_saas_reconciliation.sql',import.meta.url),'utf8')
 const old=historical.slice(historical.indexOf('create function doctor_private.saas_financial_status'),historical.indexOf('create function public.doctor_saas_financial_status')).replace('create function','create or replace function')
 const join='join public.doctor_saas_quotes q'
 assert.equal(definition.split(join).length,2);assert.equal(old.split(join).length,2)
 // Pause a genuine quote amount read while preserving the function's exact
 // production logic. Preparation still uses the original table and real RPC.
 sql(`create function doctor_private.report_snapshot_pause(value bigint)returns bigint language plpgsql volatile set search_path=''as $$begin if current_setting('application_name')='doctor_report_snapshot_wait'then perform pg_advisory_xact_lock(29005,7);end if;return value;end$$;`)
 const columns=sql("select string_agg(case when attname='amount_minor'then'doctor_private.report_snapshot_pause(q.amount_minor) as amount_minor'else format('q.%I',attname)end,','order by attnum)from pg_attribute where attrelid='public.doctor_saas_quotes'::regclass and attnum>0 and not attisdropped;")
 sql(`create view doctor_private.report_snapshot_quotes as select ${columns} from public.doctor_saas_quotes q;`)
 const before=JSON.parse(sql(`${claim(4)}select public.doctor_saas_financial_status(0,100);`).split('\n').at(-1)).total
 async function control(source,key){
  const quote=JSON.parse(sql(`${claim(4)}select public.doctor_create_saas_quote('${id(51)}',${revision},0,'monthly','synthetic-financial-race/v1','${id(key)}');`).split('\n').at(-1))
  sql(source.replace(join,'join doctor_private.report_snapshot_quotes q'))
  const locker=process('begin;select pg_advisory_xact_lock(29005,7);\n\\echo report_snapshot_held\n',true);let reader
  try{
   await until(()=>locker.output().includes('report_snapshot_held'))
   reader=process(`set application_name='doctor_report_snapshot_wait';${claim(4)}select public.doctor_saas_financial_status(0,100);`)
   await until(()=>sql("select count(*)from pg_stat_activity where application_name='doctor_report_snapshot_wait'and wait_event='advisory';")==='1')
   // This commits a real prepare operation before the paused report continues.
   sql(`${claim(4)}select public.doctor_prepare_saas_payment('${quote.quote_id}','${id(key+1)}');`)
   locker.child.stdin.end('commit;\n\\q\n');const held=await locker.done,result=await reader.done
   assert.equal(held.status,0,held.errors);assert.equal(result.status,0,result.errors)
   return JSON.parse(result.output.trim().split('\n').at(-1))
  }finally{for(const item of[locker,reader])if(item?.child.exitCode===null)item.child.kill('SIGTERM')}
 }
 try{
  const broken=await control(old,91)
  assert.equal(broken.total,before);assert.equal(broken.items.length,before+1)
  assert.throws(()=>doctorSaasFinancialStatus(broken,{userId:id(4),practiceId:null}),/CONTRACT_INVALID/,'historical multi-statement report must reproduce the independently reviewed failure')
  const fixed=await control(definition,93)
  const decoded=doctorSaasFinancialStatus(fixed,{userId:id(4),practiceId:null})
  assert.equal(decoded.total,before+1);assert.equal(decoded.items.length,before+1)
  assert.equal(decoded.currencies.reduce((sum,row)=>sum+row.heldIntents,0),decoded.total)
  const next=JSON.parse(sql(`${claim(4)}select public.doctor_saas_financial_status(0,100);`).split('\n').at(-1))
  assert.equal(doctorSaasFinancialStatus(next,{userId:id(4),practiceId:null}).total,before+2)
  console.log('Two report/prepare snapshot controls passed: preserved historical code reproduces total/page disagreement and strict-decoder denial; the single-statement materialized cohort stays coherent across the same real concurrent preparation commit, and the next report sees it')
 }finally{
  sql(definition)
  sql('drop view doctor_private.report_snapshot_quotes;drop function doctor_private.report_snapshot_pause(bigint);')
 }
}
