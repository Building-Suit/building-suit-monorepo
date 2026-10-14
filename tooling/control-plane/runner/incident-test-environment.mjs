import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readdirSync,readFileSync} from 'node:fs'
import path from 'node:path'
// Mandatory database regressions run only in an explicitly configured disposable
// container. Product/provider credentials never enter this test environment.
export function incidentTestEnvironment(source,env=process.env){
 const container=env.BS_CONTROL_INCIDENT_TEST_CONTAINER
 if(!/^cp-remediation-disposable-[0-9]{8}$/.test(container??''))throw Error('explicit_disposable_incident_test_container_required')
 const database='cp_egress_incident_'+process.pid+'_'+Date.now(),directory=path.join(source,'.local/incident-tests',database)
 mkdirSync(directory,{recursive:true,mode:0o700})
 const run=(args,input)=>{const result=spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});if(result.status!==0)throw Error('disposable_incident_test_setup_failed');return result}
 run(['createdb','-U','postgres',database])
 try{
  for(const name of readdirSync(path.join(source,'tooling/control-plane/sql')).filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort())run(['psql','-U','postgres','-d',database,'-Xq','-v','ON_ERROR_STOP=1'],readFileSync(path.join(source,'tooling/control-plane/sql',name)))
  const shim=`#!${process.execPath}\nimport {spawn} from 'node:child_process';import {readFileSync} from 'node:fs';let args=process.argv.slice(2),input=null;if(args[0]?.startsWith('postgres')){const u=new URL(args.shift());if(!['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error('disposable_only');args=['-U',u.username||'postgres','-d',u.pathname.slice(1)||'postgres',...args]}const i=args.indexOf('-f');if(i>=0){input=readFileSync(args[i+1]);args.splice(i,2)}const child=spawn('docker',['exec','-i',${JSON.stringify(container)},'psql',...args],{stdio:['pipe','inherit','inherit']});if(input)child.stdin.end(input);else process.stdin.pipe(child.stdin);child.on('exit',code=>process.exit(code??1));child.on('error',()=>process.exit(1));\n`
  writeFileSync(path.join(directory,'psql'),shim,{mode:0o700})
  const testEnv={HOME:env.HOME,LANG:env.LANG??'C.UTF-8',PATH:directory+':'+env.PATH,CP_EGRESS_TEST_DATABASE:database,CP_EGRESS_TEST_CONTAINER:container,CP_BATCH_READY_TEST_POSTGRES_URL:'postgres://postgres@localhost/postgres',CP_BATCH_READY_TEST_REQUIRE_POSTGRES:'1'}
  return {env:testEnv,database,close:()=>run(['dropdb','-U','postgres',database])}
 }catch(error){run(['dropdb','-U','postgres',database]);throw error}
}
