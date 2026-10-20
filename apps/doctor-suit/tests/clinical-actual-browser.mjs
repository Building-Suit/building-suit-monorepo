// Run-owned actual services only. Credentials stay in memory/process environment.
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {writeFile} from 'node:fs/promises'
export async function verifyDoctorClinicalBrowser({root,api,origin,publicKey,serviceKey,owner,other,recipient,staff,encounterId,releaseId,document,pdf,expect,setStage}){
 expect(api==='http://127.0.0.1:65321'&&origin==='http://127.0.0.1:4341','Owned clinical browser targets rejected')
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let server
 const probe=createServer();try{probe.listen(4341,'127.0.0.1');await once(probe,'listening');await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()))}catch{try{probe.close()}catch{/* Owned resources may be absent or still starting. */}throw new Error('Clinical browser port is already owned')}
 try{
  setStage('actual clinical browser server readiness')
  server=spawn(process.execPath,['apps/doctor-suit/.output/server/index.mjs'],{cwd:root,env:{...process.env,NITRO_HOST:'127.0.0.1',NITRO_PORT:'4341',APP_URL:origin,NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED:'true',NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT:'local',NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN:origin,NUXT_PUBLIC_DOCTOR_AUTH_URL:api,NUXT_PUBLIC_DOCTOR_AUTH_KEY:publicKey,NUXT_DOCTOR_AUTH_EMAIL_LOOKUP_KEY:serviceKey},detached:true,stdio:'ignore'})
  const deadline=Date.now()+30000;let ready=false
  while(Date.now()<deadline){expect(server.exitCode===null,'Owned clinical server exited');try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok}catch{/* Owned resources may be absent or still starting. */}if(ready)break;await pause(200)}
  expect(ready&&server.exitCode===null,'Owned clinical web app unavailable')
  setStage('actual clinical fourteen browser acceptance cases')
  const actors=Object.fromEntries(Object.entries({owner,other,recipient,staff}).map(([key,actor])=>[key,{userId:actor.user.id,token:actor.session.access_token,credentials:actor.credentials,scope:actor.scope}]))
  const config={api,origin,publicKey,actors,encounterId,releaseId,document:{versionId:document.versionId},pdf:Buffer.from(pdf).toString('base64')}
  const result=await new Promise((resolve,reject)=>{
   const child=spawn('pnpm',['exec','playwright','test','--config','apps/doctor-suit/tests/e2e/playwright.clinical.config.ts'],{cwd:root,env:{...process.env,DOCTOR_CLINICAL_ACCEPTANCE:'owned-actual-provider',DOCTOR_CLINICAL_FIXTURE:JSON.stringify(config)},stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>child.kill('SIGTERM'),600000)
   const collect=data=>{output+=data;for(const match of String(data).matchAll(/(?:✓|✔|✘|✖).*?dos-m2-(\d{3})\.spec\.ts/g))console.log(`Actual clinical browser task ${match[1]} completed; final assertions remain required`);if(output.length>4*1024*1024)child.kill('SIGTERM')};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',()=>{clearTimeout(timer);reject(new Error('Clinical browser executor unavailable'))});child.once('exit',code=>{clearTimeout(timer);resolve({code,output})})
  })
  // Sign-in errors are replaced before reaching the reporter; traces/video/auth screenshots are disabled.
  // Retain local diagnostics outside the repository, never fixture environment or credentials.
  if(result.code!==0){await writeFile('/tmp/doctor-clinical-browser-failure.log',result.output,{mode:0o600});const cases=[...result.output.matchAll(/dos-m2-(\d{3})\.spec\.ts/g)].map(match=>match[1]);throw new Error(`Actual clinical browser acceptance failed (${[...new Set(cases)].join(',')||'executor'})`)}
  expect(/14 passed/.test(result.output)&&!/[1-9]\d* skipped/.test(result.output),'Clinical browser cases were not all executed')
  console.log('Actual M2 browser: fourteen task cases passed against owned Auth/PostgREST/Storage/Functions, including typed editors, literal print, recipient byte download, verified export and eight responsive EN/AR light/dark screenshots. Visual inspection remains separately required.')
 }finally{
  if(server?.pid){try{process.kill(-server.pid,'SIGTERM')}catch{/* Owned resources may be absent or still starting. */}if(server.exitCode===null)await Promise.race([once(server,'exit'),pause(2000)]);try{process.kill(-server.pid,'SIGKILL')}catch{/* Owned resources may be absent or still starting. */}server.unref()}
 }
}
