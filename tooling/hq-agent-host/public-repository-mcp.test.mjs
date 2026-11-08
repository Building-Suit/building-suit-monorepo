/** Offline generated Git objects and HTTPS stubs only. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {EventEmitter} from 'node:events'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import {PUBLIC_REPOSITORY_POLICY,PUBLIC_REPOSITORY_TOOL,PUBLIC_REPOSITORY_MANIFEST,PUBLIC_REPOSITORY_MANIFEST_DIGEST,PUBLIC_REPOSITORY_BOOTSTRAP,repositorySelectionValid,readPublicRepository,repositoryToolResult,repositoryPinnedGet,createRepositoryMcpServer,repositoryMcpConfig,repositoryTrialAllowed,workerExecutionBlock} from './departmentWorkflow.mjs'
const hash=(value,algorithm='sha256')=>createHash(algorithm).update(value).digest('hex')
const sha='a'.repeat(40),rootSha='b'.repeat(40),toolSha='c'.repeat(40),hostSha='d'.repeat(40),workflowSha='e'.repeat(40)
const selection=(preset='hq-worker-boundary-v1',mode='snapshot')=>({version:1,preset,mode,sha,pullRequestNumber:mode==='approved-pr'?7:null})
const identity={id:1376504404,full_name:'Building-Suit/building-suit-monorepo',private:false}
const prefix='/repos/Building-Suit/building-suit-monorepo'
function response(value,status=200,headers={}){const raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));const stream=Readable.from([raw]);stream.statusCode=status;stream.headers={'content-type':'application/json',...headers};return stream}
function fixture(mutate=()=>{},customBody){
 const calls=[],responses=[],data=new Map(),blobs=[]
 const body=customBody??Buffer.from(Array.from({length:700},(_,n)=>`export const generated_${n} = ${n}`).join('\n'))
 const blobSha=hash(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body]),'sha1')
 const entry=(path,type,sha,mode)=>({path,type,sha,mode})
 data.set(prefix,identity);data.set(prefix+'/git/commits/'+sha,{sha,tree:{sha:rootSha}})
 data.set(prefix+'/git/ref/heads/stg',{ref:'refs/heads/stg',object:{type:'commit',sha}})
 data.set(prefix+'/pulls/7',{number:7,base:{ref:'stg',repo:identity},head:{sha,repo:identity}})
 data.set(prefix+'/git/trees/'+rootSha,{sha:rootSha,truncated:false,tree:[entry('tooling','tree',toolSha,'040000'),entry('.github','tree',toolSha,'040000'),entry('package.json','blob',blobSha,'100644')]})
 data.set(prefix+'/git/trees/'+toolSha,{sha:toolSha,truncated:false,tree:[entry('hq-agent-host','tree',hostSha,'040000'),entry('workflows','tree',workflowSha,'040000')]})
 data.set(prefix+'/git/trees/'+hostSha,{sha:hostSha,truncated:false,tree:[entry('worker.mjs','blob',blobSha,'100644'),entry('departmentWorkflow.mjs','blob',blobSha,'100644')]})
 data.set(prefix+'/git/trees/'+workflowSha,{sha:workflowSha,truncated:false,tree:[entry('ci.yml','blob',blobSha,'100644')]})
 data.set(prefix+'/git/blobs/'+blobSha,{sha:blobSha,size:body.length,encoding:'base64',content:body.toString('base64')})
 data.set(prefix+'/actions/runs?head_sha='+sha+'&per_page=20',{total_count:3,workflow_runs:[{id:11,run_attempt:2,name:'Verify workspace',path:'.github/workflows/ci.yml',repository:identity,head_sha:sha,status:'completed',conclusion:'success',created_at:'2026-11-08T20:00:00Z',updated_at:'2026-11-08T20:01:00Z'},{id:12,run_attempt:1,name:'Verify workspace',path:'.github/workflows/ci.yml',repository:identity,head_sha:sha,status:'in_progress',conclusion:null,created_at:'2026-11-08T20:00:00Z',updated_at:'2026-11-08T20:01:00Z'}]})
 data.set(prefix+'/commits/'+sha+'/check-runs?per_page=20',{total_count:1,check_runs:[{id:21,name:'Full verify',head_sha:sha,status:'completed',conclusion:'success',started_at:'2026-11-08T20:00:00Z',completed_at:'2026-11-08T20:01:00Z'}]})
 for(const id of[11,12])data.set(prefix+'/actions/runs/'+id+'/attempts/'+(id===11?2:1)+'/jobs?per_page=3',{total_count:4,jobs:[{id:id+100,run_id:id,head_sha:sha,name:'Full verification',status:'completed',conclusion:'success',started_at:'2026-11-08T20:00:00Z',completed_at:'2026-11-08T20:01:00Z'}]})
 const get=async(path,signal)=>{calls.push(path);assert.equal(signal.aborted,false);let value=structuredClone(data.get(path));assert.ok(value,`unexpected generated path ${path}`);const options={status:200,headers:{}};mutate(value,path,options,data);const res=response(value,options.status,options.headers);responses.push(res);if(path.includes('/blobs/'))blobs.push(path);return res}
 return{get,calls,responses,data,blobs,blobSha}
}
const init=async server=>{await server.handle({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}});await server.handle({jsonrpc:'2.0',method:'notifications/initialized'})}
const call=id=>({jsonrpc:'2.0',id,method:'tools/call',params:{name:PUBLIC_REPOSITORY_TOOL,arguments:{}}})
async function budget(t){const directory=await mkdtemp('/tmp/hq-repository-test-');t.after(()=>rm(directory,{recursive:true,force:true}));return join(directory,'public-repository-11111111-1111-4111-8111-111111111111.budget')}
for(const preset of['hq-worker-boundary-v1','hq-ci-config-v1'])for(const mode of['snapshot','stg','approved-pr'])test(`${preset} ${mode} reads immutable bounded generated Git objects`,async()=>{
 const f=fixture(),result=await readPublicRepository({selection:selection(preset,mode),get:f.get,now:()=>new Date('2026-11-08T20:00:00Z')}),bundle=repositoryToolResult(result)
 assert.equal(bundle.selection.sha,sha);assert.equal(bundle.files.length,2);assert.equal(bundle.requestAttempts,f.calls.length);assert.ok(f.calls.length<=12);assert.ok(f.responses.every(row=>row.destroyed))
 assert.equal(bundle.authentication,'none');assert.equal(bundle.executedByThisEmployee,false);assert.equal(bundle.testedSourceSha,'unknown');assert.equal(bundle.requiredChecksVerified,false)
 for(const file of bundle.files){assert.equal(file.blobSha,f.blobSha);for(const window of file.windows)assert.equal(hash(window.text),window.sha256)}
 if(preset==='hq-ci-config-v1'){assert.equal(bundle.ci.jobs.length,2);assert.ok(bundle.ci.unknownReasons.includes('runs-window-only'));if(mode!=='snapshot')assert.equal(f.calls.length,12)}else assert.equal(bundle.ci.state,'not-requested')
})
test('manifest is immutable and matches the independently supplied canonical digest',()=>{
 assert.equal(PUBLIC_REPOSITORY_MANIFEST_DIGEST,'78a0caf4473e666b01062afeabd0de6407076de33f0cffe2dc4ad946595f2993')
 assert.throws(()=>{PUBLIC_REPOSITORY_MANIFEST.presets[0].files[0].path='private.env'})
 for(const value of[null,{}, {...selection(),url:'https://private/'},{...selection(),preset:'arbitrary'},{...selection(),sha:'stg'},{...selection(),mode:'approved-pr',pullRequestNumber:0},{...selection(),pullRequestNumber:7}])assert.equal(repositorySelectionValid(value),false)
})
for(const kind of['private','identity','ref','fork','tree-truncated','mode','symlink','base64','size','blob-sha','lfs','secret','utf8','compression','redirect','oversize'])test(kind+' fails closed with no retry',async()=>{
 const f=fixture((value,path,options)=>{
  if(kind==='private'&&path===prefix)value.private=true
  if(kind==='identity'&&path===prefix)value.id=1
  if(kind==='ref'&&path.includes('/git/ref/'))value.object.sha='f'.repeat(40)
  if(kind==='fork'&&path.includes('/pulls/'))value.head.repo.id=1
  if(kind==='tree-truncated'&&path.includes('/trees/'))value.truncated=true
  if(kind==='mode'&&path.endsWith('/trees/'+hostSha))value.tree[0].mode='100755'
  if(kind==='symlink'&&path.endsWith('/trees/'+hostSha)){value.tree[0].mode='120000';value.tree[0].type='blob'}
  if(path.includes('/blobs/')){
   if(kind==='base64')value.content+='!'
   if(kind==='size')value.size=131073
   if(kind==='blob-sha')value.sha='f'.repeat(40)
   if(['lfs','secret','utf8'].includes(kind)){const raw=kind==='lfs'?Buffer.from('version https://git-lfs.github.com/spec/v1\n'):kind==='secret'?Buffer.from('-----BEGIN PRIVATE KEY-----'):Buffer.from([255]);value.content=raw.toString('base64');value.size=raw.length}
  }
  if(kind==='compression')options.headers['content-encoding']='gzip'
  if(kind==='redirect'){options.status=302;options.headers.location='https://evil.invalid/'}
  if(kind==='oversize')options.headers['content-length']='262145'
 })
 await assert.rejects(readPublicRepository({selection:selection('hq-worker-boundary-v1',kind==='ref'?'stg':kind==='fork'?'approved-pr':'snapshot'),get:f.get}))
 assert.ok(f.calls.length<=12);assert.equal(new Set(f.calls.filter(path=>!path.includes('/blobs/'))).size,f.calls.filter(path=>!path.includes('/blobs/')).length)
})
for(const status of[403,429])test('CI HTTP '+status+' stops without error body consumption or later requests',async()=>{
 const f=fixture(),calls=[];let errorRead=false,errorResponse
 await assert.rejects(readPublicRepository({selection:selection('hq-ci-config-v1'),get:async(path,signal)=>{
  calls.push(path);if(path.includes('/actions/runs?')){errorResponse=new Readable({read(){errorRead=true;this.push('private provider error');this.push(null)}});errorResponse.statusCode=status;errorResponse.headers={};return errorResponse}return f.get(path,signal)
 }}),status===403?/repository-access-denied/:/repository-rate-limited/)
 assert.equal(errorRead,false);assert.equal(errorResponse.destroyed,true);assert.equal(calls.some(path=>path.includes('/check-runs')),false)
})
test('CI missing endpoint is honestly unavailable without reading its error body',async()=>{
 const f=fixture();let errorRead=false
 const result=repositoryToolResult(await readPublicRepository({selection:selection('hq-ci-config-v1'),get:async(path,signal)=>{
  if(path.includes('/actions/runs?')){const res=new Readable({read(){errorRead=true;this.push(null)}});res.statusCode=404;res.headers={};return res}return f.get(path,signal)
 }}))
 assert.equal(errorRead,false);assert.equal(result.ci.state,'unavailable');assert.ok(result.ci.unknownReasons.includes('runs-http-404'));assert.equal(result.requiredChecksVerified,false)
})
test('actual typed result validator rejects changed metadata, excerpt, mode, identity and execution claims',async()=>{
 const f=fixture(),result=await readPublicRepository({selection:selection(),get:f.get})
 for(const mutate of[x=>{x.structuredContent.bundleSha256='0'.repeat(64)},x=>{x.structuredContent.selection.sha='f'.repeat(40)},x=>{x.content[0].text+=' '},x=>{x.content=[]}]){const copy=structuredClone(result);mutate(copy);assert.throws(()=>repositoryToolResult(copy))}
 for(const mutate of[x=>{x.executedByThisEmployee=true},x=>{x.files[0].path='private.env'},x=>{x.files[0].windows[0].text='forged'},x=>{x.ci.unknownReasons=['private narrative']}]){const copy=structuredClone(result),bundle=JSON.parse(copy.content[0].text);mutate(bundle);copy.content[0].text=JSON.stringify(bundle);copy.structuredContent.bundleSha256=hash(copy.content[0].text);copy.structuredContent.bundleBytes=Buffer.byteLength(copy.content[0].text);assert.throws(()=>repositoryToolResult(copy))}
})
test('empty-argument MCP reserves durable budget before any GET and cannot reset on restart',async t=>{
 const path=await budget(t);let reads=0
 const upstream=async()=>{reads++;assert.equal(await readFile(path,'utf8'),'reserved-before-public-github-get\n');return{content:[]}}
 const server=createRepositoryMcpServer({selection:selection(),budgetFile:path,upstream});await init(server)
 assert.equal((await server.handle({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools[0].name,PUBLIC_REPOSITORY_TOOL)
 assert.equal((await server.handle({...call(3),params:{name:PUBLIC_REPOSITORY_TOOL,arguments:{ref:'main'}}})).error.code,-32602);assert.equal(reads,0)
 await server.handle(call(4));assert.equal(reads,1)
 const second=createRepositoryMcpServer({selection:selection(),budgetFile:path,upstream});await init(second);assert.equal((await second.handle(call(5))).result.content[0].text,'repository-budget-exhausted');assert.equal(reads,1)
})
test('pinned anonymous HTTPS validates DNS, TLS peer and excludes proxy/auth/cookies',async()=>{
 const safe={address:'1.1.1.1',family:4};let options,requests=0
 const request=(value,callback)=>{requests++;options=value;const req=new EventEmitter();req.end=()=>{const res=response({ok:true});res.socket={remoteAddress:'1.1.1.1'};callback(res)};return req}
 const res=await repositoryPinnedGet(prefix,new AbortController().signal,{resolveDns:async()=>[safe],request});res.destroy()
 assert.equal(options.method,'GET');assert.equal(options.hostname,'api.github.com');assert.equal(options.servername,'api.github.com');assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.headers['Accept-Encoding'],'identity');assert.doesNotMatch(JSON.stringify(options.headers),/authorization|cookie|proxy/i)
 await assert.rejects(repositoryPinnedGet(prefix,AbortSignal.timeout(100),{resolveDns:async()=>[safe,{address:'169.254.169.254',family:4}],request}));assert.equal(requests,1)
 await assert.rejects(repositoryPinnedGet('https://evil.invalid/',AbortSignal.timeout(100),{request}));assert.equal(requests,1)
})
test('parent cancellation prevents another GET',async()=>{
 const f=fixture(),controller=new AbortController();let count=0
 await assert.rejects(readPublicRepository({selection:selection(),signal:controller.signal,get:async(...args)=>{count++;const value=await f.get(...args);controller.abort();return value}}));assert.equal(count,1)
})
function job(){const agent={id:'AG-DEV-002',modelTier:'T1_WORKER',model:'gpt-6.1-terra',departmentKey:'development-maintenance',managerId:'AG-DEV-001',managerModelTier:'T2_HEAD',headAuthorization:true,lifecycle:'Active',profileFileId:'generated_profile',skillFileIds:['generated_skill']};agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'1'.repeat(64),evidenceId:'generated_receipt',profileFileId:agent.profileFileId,modelTier:agent.modelTier,managerId:agent.managerId,departmentKey:agent.departmentKey,skillFileIds:agent.skillFileIds};return{id:'generated_job',agent_id:agent.id,context:{mode:'task-work',task:{id:'generated_task',attempt:0},agent,publicRepositoryPermit:{version:1,policyId:PUBLIC_REPOSITORY_POLICY,jobId:'generated_job',agentId:agent.id,bindingDigest:'1'.repeat(64),selection:selection(),reservationId:'11111111-1111-4111-8111-111111111111',manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,expiresAt:new Date(Date.now()+60000).toISOString()}}}}
test('config requires current employee lane permit and matching durable reservation',()=>{
 const item=job(),paths={nodePath:'/trusted/node',modulePath:'/trusted/departmentWorkflow.mjs',budgetFile:'/trusted/public-repository-11111111-1111-4111-8111-111111111111.budget',executionModel:'gpt-6.1-terra'}
 assert.ok(repositoryMcpConfig(item,paths));assert.equal(repositoryMcpConfig(item,paths).args[3],PUBLIC_REPOSITORY_BOOTSTRAP)
 for(const mutate of[x=>{x.agent_id='AG-DEV-001';x.context.agent.id=x.agent_id},x=>{x.context.publicRepositoryPermit.selection=selection('hq-ci-config-v1')},x=>{x.context.task.attempt=1},x=>{x.context.publicRepositoryPermit.expiresAt='bad'},x=>{x.context.publicRepositoryPermit.manifestDigest='bad'},x=>{x.context.publicRepositoryPermit.extra='x'},x=>{x.context.agent.qualification.bindingDigest='2'.repeat(64)}]){const changed=structuredClone(item);mutate(changed);assert.equal(repositoryMcpConfig(changed,paths),null)}
 const trial=structuredClone(item);trial.context.mode='worker-trial';trial.context.supervisedTrial={scope:'public-repository-read-trial-v1',reviewerId:'AG-HR-003',reviewerBindingDigest:'2'.repeat(64),toolPolicyId:PUBLIC_REPOSITORY_POLICY,status:'active',agentId:trial.agent_id,taskId:trial.context.task.id,managerId:'AG-DEV-001',skillFileId:'generated_skill',bindingDigest:'1'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),externalActionsAllowed:false,publishingAllowed:false}
 assert.equal(repositoryTrialAllowed(trial),true);assert.equal(workerExecutionBlock(trial),null);assert.ok(repositoryMcpConfig(trial,paths));trial.context.mode='trial-start';trial.context.supervisedTrial.repositorySelection=trial.context.publicRepositoryPermit.selection;delete trial.context.publicRepositoryPermit;assert.equal(workerExecutionBlock(trial),null);assert.equal(repositoryMcpConfig(trial,paths),null)
})
test('fixed bootstrap clears inherited secrets before module import and dispatch',async t=>{
 const directory=await mkdtemp('/tmp/hq-repository-bootstrap-');t.after(()=>rm(directory,{recursive:true,force:true}));const module=join(directory,'departmentWorkflow.mjs')
 await writeFile(module,'console.log(JSON.stringify({keys:Object.keys(process.env).sort(),argv:process.argv.slice(2)}))\n')
 const child=spawn(process.execPath,['--preserve-symlinks-main','--input-type=module','--eval',PUBLIC_REPOSITORY_BOOTSTRAP,module,'public-selection','public-budget'],{env:{HOME:'/private',CODEX_HOME:'/private',SYNTHETIC_SECRET:'do-not-forward'},stdio:['ignore','pipe','pipe']})
 let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);const exit=await new Promise(resolve=>child.once('exit',resolve));assert.equal(exit,0);assert.equal(err,'');const result=JSON.parse(out);assert.deepEqual(result.keys,['LANG','TZ']);assert.deepEqual(result.argv,['--public-repository-mcp','public-selection','public-budget'])
})

for(const [name,body]of[['valid-hash-lfs',Buffer.from('version https://git-lfs.github.com/spec/v1\n')],['valid-hash-private-key',Buffer.from('-----BEGIN PRIVATE KEY-----')],['valid-hash-invalid-utf8',Buffer.from([255])],['valid-hash-NUL',Buffer.from('source\0')]])test(name+' still rejects before returning any excerpts',async()=>{
 const f=fixture(()=>{},body);await assert.rejects(readPublicRepository({selection:selection(),get:f.get}),/repository-content-rejected|repository-utf8-invalid/)
})

test('stalled media read obeys parent cancellation and destroys the response without another GET',async()=>{
 const controller=new AbortController();let calls=0,responseBody
 const promise=readPublicRepository({selection:selection(),signal:controller.signal,get:async()=>{calls++;responseBody=new Readable({read(){}});responseBody.statusCode=200;responseBody.headers={'content-type':'application/json'};return responseBody}})
 setTimeout(()=>controller.abort(),10);await assert.rejects(promise);assert.equal(calls,1);assert.equal(responseBody.destroyed,true)
})
test('unknown transport outcomes are never retried',async()=>{
 let calls=0;await assert.rejects(readPublicRepository({selection:selection(),get:async()=>{calls++;throw Error('synthetic connection failure')}}));assert.equal(calls,1)
})
test('aggregate response budget remains bounded below any combination of valid per-response sizes',async()=>{
 const f=fixture(value=>{value.padding='x'.repeat(220000)});await assert.rejects(readPublicRepository({selection:selection(),get:f.get}),/repository-byte-limit/);assert.ok(f.calls.length<=12)
})
test('a matching Git blob hash cannot bypass static credential literal rejection',async()=>{
 const f=fixture(()=>{},Buffer.from('const api_key = "generatedcredential00000000"'));await assert.rejects(readPublicRepository({selection:selection(),get:f.get}),/repository-content-rejected/)
})
test('wrong TLS peer and arbitrary same-origin paths fail before content exposure',async()=>{
 let calls=0;const request=(options,callback)=>{calls++;const req=new EventEmitter();req.end=()=>{const res=response({ok:true});res.socket={remoteAddress:'127.0.0.1'};callback(res)};return req}
 await assert.rejects(repositoryPinnedGet(prefix,AbortSignal.timeout(100),{resolveDns:async()=>[{address:'1.1.1.1',family:4}],request}),/repository-peer-rejected/)
 for(const path of[prefix+'/../private',prefix+'-other',prefix+'/contents/.env',prefix+'/git/ref/heads/main',prefix+'/actions/runs?head_sha='+sha+'&per_page=100'])await assert.rejects(repositoryPinnedGet(path,AbortSignal.timeout(100),{request}),/repository-path-invalid/)
 assert.equal(calls,1)
})
test('capability trials retain ordinary qualification and independently frozen Iris review',()=>{
 const item=job();item.context.mode='worker-trial';item.context.supervisedTrial={scope:'public-repository-read-trial-v1',toolPolicyId:PUBLIC_REPOSITORY_POLICY,status:'active',agentId:item.agent_id,taskId:item.context.task.id,managerId:'AG-DEV-001',skillFileId:'generated_skill',bindingDigest:'1'.repeat(64),reviewerId:'AG-HR-003',reviewerBindingDigest:'2'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),externalActionsAllowed:false,publishingAllowed:false}
 assert.equal(repositoryTrialAllowed(item),true)
 for(const mutate of[x=>{delete x.context.agent.qualification},x=>{x.context.agent.qualification.bindingDigest='3'.repeat(64)},x=>{x.context.supervisedTrial.reviewerId=x.agent_id},x=>{x.context.supervisedTrial.reviewerBindingDigest='bad'},x=>{x.context.supervisedTrial.externalActionsAllowed=true}]){const changed=structuredClone(item);mutate(changed);assert.equal(repositoryTrialAllowed(changed),false);assert.equal(workerExecutionBlock(changed),'trial-authorization-required')}
})

for(const kind of['wrong-run-repository','wrong-run-sha','invalid-attempt','wrong-job-sha','wrong-job-attempt','bad-name','bad-date'])test('CI '+kind+' rejects misleading source/attempt evidence',async()=>{
 const f=fixture((value,path)=>{
  if(path.includes('/actions/runs?')){if(kind==='wrong-run-repository')value.workflow_runs[0].repository.id=1;if(kind==='wrong-run-sha')value.workflow_runs[0].head_sha='f'.repeat(40);if(kind==='invalid-attempt')value.workflow_runs[0].run_attempt=0;if(kind==='bad-name')value.workflow_runs[0].name='x'.repeat(161);if(kind==='bad-date')value.workflow_runs[0].updated_at='not a date'}
  if(path.includes('/attempts/')){if(kind==='wrong-job-sha')value.jobs[0].head_sha='f'.repeat(40);if(kind==='wrong-job-attempt')value.jobs[0].run_attempt=99}
 })
 await assert.rejects(readPublicRepository({selection:selection('hq-ci-config-v1'),get:f.get}),/repository-ci-invalid/)
})
test('unrelated workflow rows do not authorize job reads or imply required-check success',async()=>{
 const f=fixture((value,path)=>{if(path.includes('/actions/runs?'))for(const row of value.workflow_runs)row.path='.github/workflows/unrelated.yml'})
 const bundle=repositoryToolResult(await readPublicRepository({selection:selection('hq-ci-config-v1'),get:f.get}))
 assert.equal(bundle.ci.runs.length,0);assert.equal(bundle.ci.jobs.length,0);assert.ok(bundle.ci.unknownReasons.includes('other-workflow-omitted'));assert.equal(f.calls.some(path=>path.includes('/attempts/')),false)
})

test('unexpected HTTP errors never consume provider bodies or trigger retries',async()=>{
 let reads=0,calls=0,res
 await assert.rejects(readPublicRepository({selection:selection(),get:async()=>{calls++;res=new Readable({read(){reads++;this.push('private error');this.push(null)}});res.statusCode=500;res.headers={'content-type':'application/json'};return res}}),/repository-response-invalid/)
 assert.equal(reads,0);assert.equal(calls,1);assert.equal(res.destroyed,true)
})

test('malformed capability trial envelopes return false before dereferencing absent identity',()=>{
 for(const value of[null,{}, {context:{mode:'worker-trial'}},{context:{mode:'trial-start',agent:{}}}])assert.equal(repositoryTrialAllowed(value),false)
})

test('resolved revision time is captured before content reads and stays distinct from completion',async()=>{
 const f=fixture(),times=['2026-11-08T20:00:00.000Z','2026-11-08T20:00:08.000Z'];let clockCalls=0
 const result=await readPublicRepository({selection:selection('hq-worker-boundary-v1','stg'),get:f.get,now:()=>{
  if(clockCalls===0){assert.ok(f.calls.at(-1).includes('/git/commits/'));assert.equal(f.calls.some(path=>path.includes('/trees/')),false)}
  return new Date(times[clockCalls++])
 }})
 const bundle=repositoryToolResult(result)
 assert.equal(clockCalls,2);assert.equal(bundle.resolvedSha,sha);assert.equal(bundle.revisionObservedAt,times[0]);assert.equal(bundle.observedAt,times[1])
 assert.equal(f.calls.filter(path=>path.includes('/git/ref/')).length,1)
 for(const mutate of[x=>{x.resolvedSha='f'.repeat(40)},x=>{x.revisionObservedAt='invalid'},x=>{x.revisionObservedAt='2026-11-08T20:00:09Z'},x=>{x.revisionObservedAt='2026-11-08T19:59:00Z'}]){
  const copy=structuredClone(result),changed=JSON.parse(copy.content[0].text);mutate(changed);copy.content[0].text=JSON.stringify(changed);copy.structuredContent.bundleSha256=hash(copy.content[0].text);copy.structuredContent.bundleBytes=Buffer.byteLength(copy.content[0].text);assert.throws(()=>repositoryToolResult(copy),/repository-result-invalid/)
 }
})

test('larger fixed input pages retain useful CI after unrelated workflows while output stays bounded',async()=>{
 const f=fixture((value,path)=>{
  if(path.includes('/actions/runs?')){
   const original=structuredClone(value.workflow_runs),unrelated=Array.from({length:4},(_,index)=>({...original[0],id:200+index,path:'.github/workflows/unrelated.yml'}))
   value.workflow_runs=[...unrelated,...original,{...original[0],id:13}];value.total_count=7
  }
  if(path.includes('/check-runs?')){value.check_runs=Array.from({length:8},(_,index)=>({...value.check_runs[0],id:300+index}));value.total_count=8}
 })
 const bundle=repositoryToolResult(await readPublicRepository({selection:selection('hq-ci-config-v1'),get:f.get}))
 assert.deepEqual(bundle.ci.runs.map(run=>run.id),[11,12]);assert.equal(bundle.ci.checks.length,3);assert.equal(bundle.ci.jobs.length,2)
 assert.ok(bundle.ci.unknownReasons.includes('other-workflow-omitted'));assert.ok(bundle.ci.unknownReasons.includes('runs-window-only'));assert.ok(bundle.ci.unknownReasons.includes('checks-window-only'))
 assert.ok(f.calls.includes(prefix+'/actions/runs?head_sha='+sha+'&per_page=20'));assert.ok(f.calls.includes(prefix+'/commits/'+sha+'/check-runs?per_page=20'));assert.equal(f.calls.some(path=>path.includes('/runs/13/attempts/')),false);assert.ok(f.calls.length<=12)
})

test('fair per-window allocation preserves literal text from both large selected source files',async()=>{
 const raw=Buffer.from(Array.from({length:700},(_,index)=>'generated_'+index+' '+ '🙂'.repeat(35)).join('\n')),f=fixture(()=>{},raw)
 const bundle=repositoryToolResult(await readPublicRepository({selection:selection(),get:f.get}))
 const windows=bundle.files.flatMap(file=>file.windows)
 assert.equal(windows.length,4);assert.ok(windows.every(window=>window.text.length>0&&window.truncated))
 assert.ok(windows.every(window=>Buffer.byteLength(window.text)<=5120&&!window.text.includes('\ufffd')))
 assert.ok(windows.reduce((bytes,window)=>bytes+Buffer.byteLength(window.text),0)<=20480)
 for(const file of bundle.files)assert.ok(file.windows.every(window=>window.text.startsWith('generated_'+(window.start-1)+' ')))
})
