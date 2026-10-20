// Run-owned local Auth/PostgREST/Storage only; no hosted configuration or real identities.
import {spawn,spawnSync}from'node:child_process'
import {once}from'node:events'
import {randomUUID}from'node:crypto'
import {readFile,mkdtemp,writeFile,rm,access}from'node:fs/promises'
import {tmpdir}from'node:os'
import path from'node:path'
import{fileURLToPath}from'node:url'
import{createServer}from'node:net'
import{createClient}from'@supabase/supabase-js'
import{validateLocalDoctorTarget}from'./local-lifecycle.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),app=path.join(root,'apps/doctor-suit'),api='http://127.0.0.1:65321',origin='http://127.0.0.1:4342',project='building-suit-doctor'
let owned=false,server,stage='guard'
const scratch=await mkdtemp(path.join(tmpdir(),'doctor-m3-provider-')),env={...process.env,SUPABASE_HOME:path.join(scratch,'cli')}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
function expect(value,label){if(!value)throw new Error(label)}
function docker(args){const r=spawnSync('docker',args,{encoding:'utf8',timeout:15000});expect(r.status===0,'Local container inventory unavailable');return r.stdout.trim().split('\n').filter(Boolean)}
async function cli(args,timeout=600000){return new Promise((resolve,reject)=>{const c=spawn(path.join(root,'node_modules/.bin/supabase'),['--workdir',app,...args],{cwd:root,env,stdio:['ignore','pipe','pipe']});let out='';const timer=setTimeout(()=>c.kill('SIGTERM'),timeout);c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.once('error',()=>{clearTimeout(timer);reject(new Error('Owned CLI unavailable'))});c.once('exit',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error('Owned CLI failed; private diagnostic output withheld'))})})}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
try{
 validateLocalDoctorTarget(JSON.parse(await readFile(path.join(root,'docs/architecture/environments.json'),'utf8')),await readFile(path.join(app,'supabase/config.toml'),'utf8'),process.env)
 try{await access(path.join(app,'supabase/.temp/project-ref'));throw new Error('Linked CLI forbidden')}catch(e){if(e.code!=='ENOENT')throw e}
 expect(!docker(['ps','-a','--format','{{.Names}}']).some(n=>n.endsWith(`_${project}`)),'Existing Doctor resources are not owned by this run')
 expect(!docker(['volume','ls','--format','{{.Name}}']).some(n=>n.endsWith(`_${project}`)),'Existing Doctor volumes are not owned by this run')
 const port=createServer();try{port.listen(4342,'127.0.0.1');await once(port,'listening');await new Promise(r=>port.close(r))}catch{try{port.close()}catch{/* Run-owned resources may be absent or starting. */}throw new Error('Browser port is already owned')}
 owned=true;stage='start owned services';await cli(['start','--exclude','studio,postgres-meta,logflare,vector,supavisor,imgproxy,edge-runtime'])
 const raw=await cli(['status','-o','json'],30000),status=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));expect(status.API_URL===api&&status.ANON_KEY&&status.SERVICE_ROLE_KEY,'Owned target mismatch')
 const admin=createClient(api,status.SERVICE_ROLE_KEY,options)
 async function rpc(client,name,args){const{data,error}=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000));expect(!error,`Synthetic operation ${name} failed`);return data}
 async function actor(label){const credentials={email:`synthetic-m3-${randomUUID()}@example.test`,password:`A!${randomUUID()}a9`};const made=await admin.auth.admin.createUser({...credentials,email_confirm:true});expect(!made.error&&made.data.user,'Synthetic Auth fixture creation failed');const client=createClient(api,status.ANON_KEY,options),login=await client.auth.signInWithPassword(credentials);expect(!login.error&&login.data.session,'Actual synthetic sign-in failed');const key=randomUUID(),draft=await rpc(client,'doctor_save_onboarding_draft',{p_key:key,p_expected_version:0,p_display_name:`Synthetic ${label}`,p_practice_name:`Synthetic ${label} practice`,p_location_name:`Synthetic ${label} clinic`,p_timezone:'Etc/UTC'}),scope=await rpc(client,'doctor_complete_onboarding',{p_key:key,p_draft_version:draft.version});const patient=await rpc(client,'doctor_write_patient',{p_practice:scope.practice_id,p_location:scope.location_id,p_input:{name:`Synthetic ${label} patient`,phone:'',email:'',date_of_birth:null},p_key:randomUUID()});return{client,credentials,scope:{practiceId:scope.practice_id,locationId:scope.location_id,patientId:patient.patient_id},userId:made.data.user.id}}
 stage='actual Auth and synthetic onboarding';const owner=await actor('operations owner'),other=await actor('independent owner');const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10)
 await rpc(owner.client,'doctor_write_schedule',{p_practice:owner.scope.practiceId,p_location:owner.scope.locationId,p_expected_version:0,p_location_version:1,p_input:{slot_minutes:10,weekly:Array.from({length:7},(_,weekday)=>({weekday,start:540,end:1080})),exceptions:[]},p_key:randomUUID()})
 stage='actual scheduling availability';const availabilityStart=Date.now();const availability=await owner.client.rpc('doctor_availability',{p_practice:owner.scope.practiceId,p_location:owner.scope.locationId,p_day:day}).abortSignal(AbortSignal.timeout(30000));console.log('Owned availability diagnostic',JSON.stringify({milliseconds:Date.now()-availabilityStart,code:availability.error?.code??null,slots:availability.data?.slots?.length??0}));expect(!availability.error,'Actual availability query failed')
 const denied=await other.client.rpc('doctor_consultation_types',{p_practice:owner.scope.practiceId,p_location:owner.scope.locationId});expect(denied.error?.code==='42501','Independent owner read admitted')
 server=spawn(process.execPath,['apps/doctor-suit/.output/server/index.mjs'],{cwd:root,env:{...env,NITRO_HOST:'127.0.0.1',NITRO_PORT:'4342',APP_URL:origin,NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED:'true',NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT:'local',NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN:origin,NUXT_PUBLIC_DOCTOR_AUTH_URL:api,NUXT_PUBLIC_DOCTOR_AUTH_KEY:status.ANON_KEY,NUXT_DOCTOR_AUTH_EMAIL_LOOKUP_KEY:status.SERVICE_ROLE_KEY},detached:true,stdio:'ignore'})
 stage='owned browser readiness';let ready=false;for(let i=0;i<120;i++){expect(server.exitCode===null,'Owned browser server exited');try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok}catch{/* Run-owned resources may be absent or starting. */}if(ready)break;await pause(250)}expect(ready,'Owned web app unavailable')
 stage='actual M3 browser assertions';const fixture={origin,api,publicKey:status.ANON_KEY,day,owner:{credentials:owner.credentials,scope:owner.scope},other:{credentials:other.credentials,scope:other.scope}}
 const result=await new Promise((resolve,reject)=>{const c=spawn('pnpm',['exec','playwright','test','--config','apps/doctor-suit/tests/e2e/playwright.operations.config.ts'],{cwd:root,env:{...env,DOCTOR_OPERATIONS_ACCEPTANCE:'owned-actual-provider',DOCTOR_OPERATIONS_FIXTURE:JSON.stringify(fixture)},stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>c.kill('SIGTERM'),600000);c.stdout.on('data',d=>output+=d);c.stderr.on('data',d=>output+=d);c.once('error',()=>{clearTimeout(timer);reject(new Error('M3 browser executor unavailable'))});c.once('exit',code=>{clearTimeout(timer);resolve({code,output})})})
 await writeFile('/tmp/doctor-m3-browser-result.log',result.output,{mode:0o600});expect(result.code===0&&/1 passed/.test(result.output),'Actual M3 browser assertions failed; see private local test result')
 console.log('M3 actual browser and service assertions passed against run-owned Auth/PostgREST. Synthetic data only; professional and provider approval remain OPEN.')
}catch(e){console.error(`M3 actual-provider FAILED at ${stage}: ${e.message}`);process.exitCode=1}
finally{
 if(server?.pid){try{process.kill(-server.pid,'SIGTERM')}catch{/* Run-owned resources may be absent or starting. */}if(server.exitCode===null)await Promise.race([once(server,'exit'),pause(2000)]);try{process.kill(-server.pid,'SIGKILL')}catch{/* Run-owned resources may be absent or starting. */}server.unref()}
 if(owned)try{await cli(['stop','--no-backup'],120000)}catch{process.exitCode=1;console.error('Owned Doctor cleanup failed; preserve resources for inspection')}
 await rm(scratch,{recursive:true,force:true})
}
