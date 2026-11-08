/** Generated MCP/HTTPS/stdio fixtures only. No service requests or credentials. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { DISCOVERY_MCP_TOOL, DISCOVERY_MCP_POLICY, DISCOVERY_QUERY, DISCOVERY_OBJECTIVE,
  discoveryResultSources, createDiscoveryMcpServer, runFixedDiscovery, discoveryPublicAddress, discoveryPinnedPost, discoveryMcpConfig, researchDiscoveryTrialAllowed, workerExecutionBlock } from './departmentWorkflow.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
const sample='Title: Synthetic public business\nURL: https://example.com/official\nPublished: N/A\nAuthor: N/A\nHighlights:\nGenerated literal business service evidence.'
const schema={type:'object',properties:{query:{type:'string',minLength:1},objective:{type:'string',minLength:1,maxLength:4096},numResults:{type:'number'}},required:['query','objective'],additionalProperties:false}
function response(body,headers={},statusCode=200){const value=Readable.from([Buffer.from(body)]);value.headers={'content-type':'text/event-stream',...headers};value.statusCode=statusCode;return value}
const sse=(id,result)=>'event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id,result})+'\n\n'
function protocolFixture(mode){
 const calls=[],responses=[];let lastRaw
 const post=async(url,body,session,signal)=>{
  const request=JSON.parse(body);calls.push({url:url.href,request,session,signal})
  assert.equal(url.href,'https://mcp.exa.ai/mcp?tools=web_search_exa')
  let result,headers={},status=200
  if(mode==='403')status=403
  if(mode==='429')status=429
  if(request.method==='initialize'){result={protocolVersion:'2025-03-26',capabilities:{tools:{}}};headers['mcp-session-id']='synthetic-sensitive-session'}
  else if(request.method==='notifications/initialized'){const res=response('',mode==='notification-session-echo'?{'mcp-session-id':'synthetic-rotated-session'}:{},202);responses.push(res);return res}
  else if(request.method==='tools/list')result={tools:[{name:'web_search_exa',inputSchema:schema}]}
  else {
   assert.deepEqual(request.params,{name:'web_search_exa',arguments:{query:DISCOVERY_QUERY,objective:DISCOVERY_OBJECTIVE,numResults:3}})
   result={content:[{type:'text',text:mode==='no-source'?'No results':mode==='session-echo'?sample+' synthetic-sensitive-session':mode==='notification-session-echo'?sample+' synthetic-rotated-session':sample,_meta:{searchTime:12}}]}
  }
  if(mode==='extra-tool' && request.method==='tools/list')result.tools.push({name:'agent_run'})
  if(mode==='wrong-id'){const res=response(sse(999,result));responses.push(res);return res}
  lastRaw=sse(request.id,result)
  const res=response(mode==='oversize'?'x'.repeat(32769):lastRaw,mode==='compressed'?{'content-encoding':'gzip'}:headers,status)
  responses.push(res);return res
 }
 return {post,calls,responses,last:()=>lastRaw}
}
async function budget(t){const directory=await mkdtemp(join(tmpdir(),'hq-mcp-budget-'));t.after(()=>rm(directory,{recursive:true,force:true}));return join(directory,'exa-discovery-budget')}
async function init(server){await server.handle({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}});await server.handle({jsonrpc:'2.0',method:'notifications/initialized'})}
const call=id=>({jsonrpc:'2.0',id,method:'tools/call',params:{name:DISCOVERY_MCP_TOOL,arguments:{}}})

test('fixed upstream handshake/search preserves literal text and distinct partial MCP provenance',async()=>{
 const f=protocolFixture(),result=await runFixedDiscovery({post:f.post,now:()=>new Date('2026-01-01T00:00:00Z')})
 assert.equal(f.calls.length,4);assert.equal(f.calls.filter(x=>x.request.method==='tools/call').length,1)
 assert.equal(f.calls[0].session,null);assert.equal(f.calls[1].session,'synthetic-sensitive-session')
 assert.equal(result.content[0].text,sample);assert.equal(result.structuredContent.kind,'mcp-exa-public-discovery')
 assert.equal(result.structuredContent.rawResultSha256,hash(f.last()));assert.equal(result.structuredContent.observedAt,'2026-01-01T00:00:00.000Z')
 assert.equal(result.structuredContent.partial,true);assert.equal(result.structuredContent.wholePageVerified,false)
 assert.ok(!JSON.stringify(result).includes('synthetic-sensitive-session'));assert.ok(f.responses.every(x=>x.destroyed))
})
const block=(url,title='Synthetic business',excerpt='Literal location and service evidence.')=>'Title: '+title+'\nURL: '+url+'\nPublished: N/A\nAuthor: N/A\nHighlights:\n'+excerpt
async function withResults(text){
 const f=protocolFixture()
 return runFixedDiscovery({post:async(url,body,session,signal)=>JSON.parse(body).method==='tools/call'
  ?response(sse(3,{content:[{type:'text',text}]})):f.post(url,body,session,signal)})
}
test('shared parser returns exact eligible literal source tuples and rejects malformed input',()=>{
 const text=[block('https://thebarber-eg.com/en'),block('https://BUSINESS.org'),block('https://business.org/')].join('\n\n')
 assert.deepEqual(discoveryResultSources(text),[{url:'https://business.org/',title:'Synthetic business',excerpt:'Literal location and service evidence.'}])
 for(const invalid of [null,{},'Title:   \nURL: https://public.org/\nHighlights:\nLiteral','Title: Public\nHighlights:\nURL: https://public.org/'])assert.throws(()=>discoveryResultSources(invalid))
})
test('fixed three-result call preserves full literal text while selecting canonical unique public sources locally',async()=>{
 const text=[block('https://BUSINESS.org'),block('https://business.org/'),block('https://other.org/services')].join('\n\n')
 const result=await withResults(text)
 assert.equal(result.content[0].text,text);assert.equal(result.structuredContent.literalTextSha256,hash(text))
 assert.deepEqual(result.structuredContent.sourceUrls,['https://business.org/','https://other.org/services'])
})
test('known prior public source is excluded locally without changing upstream query',async()=>{
 const text=[block('https://thebarber-eg.com/en'),block('https://newbusiness.org/')].join('\n\n')
 const result=await withResults(text)
 assert.equal(result.content[0].text,text);assert.deepEqual(result.structuredContent.sourceUrls,['https://newbusiness.org/'])
 await assert.rejects(withResults(block('https://thebarber-eg.com/en')),/discovery-source-unavailable/)
})
test('known business hostname variants are excluded locally regardless of path or query',async()=>{
 for(const url of ['https://thebarber-eg.com/en/','https://thebarber-eg.com/ar','https://www.thebarber-eg.com/','https://THEBARBER-EG.COM/en?language=en','https://www.thebarber-eg.com/ar/?page=2','https://thebarber-eg.com./en','https://www.thebarber-eg.com./ar/']){
  const text=[block(url),block('https://newbusiness.org/')].join('\n\n')
  const result=await withResults(text)
  assert.equal(result.content[0].text,text);assert.equal(result.structuredContent.literalTextSha256,hash(text))
  assert.deepEqual(result.structuredContent.sourceUrls,['https://newbusiness.org/'])
  await assert.rejects(withResults(block(url)),/discovery-source-unavailable/)
 }
 const distinct='https://thebarber-eg.com.other.org/en'
 assert.deepEqual(discoveryResultSources(block(distinct)).map(source=>source.url),[distinct])
})
test('each source must be complete bounded and public even when duplicate or excluded',async()=>{
 const valid=block('https://business.org/')
 for(const bad of [block('http://public.org/'),block('https://127.0.0.1/'),block('https://private.local/'),block('https://public.org/?token=secret'),block('https://public.org/'+ 'x'.repeat(500)),block('https://public.org/','x'.repeat(241)),block('https://public.org/','Public','x'.repeat(4097)),block('https://public.org/','Public',''),valid+'\nURL: https://other.org/',block('https://thebarber-eg.com/en','Public','x'.repeat(4097)), 'URL: https://public.org/\nHighlights:\nNo title','Title:   \nURL: https://public.org/\nHighlights:\nLiteral evidence.','Title: Public\nHighlights:\nURL: https://public.org/']) {
  await assert.rejects(withResults(valid+'\n\n'+bad),/discovery-source-unavailable/)
 }
 await assert.rejects(withResults([valid,valid,valid,valid].join('\n\n')),/discovery-source-unavailable/)
})
test('search redirects are never replayed; setup redirects remain same-endpoint bounded',async()=>{
 const first=protocolFixture();let searchPosts=0
 await assert.rejects(runFixedDiscovery({post:async(url,body,session,signal)=>{
  if(JSON.parse(body).method==='tools/call'){searchPosts++;return response('',{location:url.href},307)}
  return first.post(url,body,session,signal)
 }}),/discovery-redirect-rejected/)
 assert.equal(searchPosts,1)
 const second=protocolFixture();let setup=0
 const result=await runFixedDiscovery({post:async(url,body,session,signal)=>{
  if(JSON.parse(body).method==='initialize' && setup++===0)return response('',{location:url.href},307)
  return second.post(url,body,session,signal)
 }})
 assert.equal(result.content[0].text,sample);assert.equal(setup,2)
 let outside=0
 await assert.rejects(runFixedDiscovery({post:async()=>{outside++;return response('',{location:'https://evil.invalid/'},307)}}))
 assert.equal(outside,1)
 let looping=0
 await assert.rejects(runFixedDiscovery({post:async(url)=>{looping++;return response('',{location:url.href},308)}}))
 assert.equal(looping,3)
})
for(const mode of ['403','429','extra-tool','oversize','compressed','wrong-id','no-source','session-echo','notification-session-echo'])test(mode+' fails without retry or alternate tools/routes',async()=>{
 const f=protocolFixture(mode);await assert.rejects(runFixedDiscovery({post:f.post}));assert.ok(f.calls.length<=4)
 if(['403','429','oversize','compressed','wrong-id'].includes(mode))assert.equal(f.calls.length,1)
 assert.equal(f.calls.filter(x=>x.request.method==='tools/call').length,['no-source','session-echo','notification-session-echo'].includes(mode)?1:0)
 assert.ok(f.responses.every(x=>x.destroyed))
})
test('argument/private query injection cannot consume a valid discovery slot or reach upstream',async t=>{
 let calls=0;const server=createDiscoveryMcpServer({budgetFile:await budget(t),upstream:async()=>{calls++;return{content:[]}}});await init(server)
 assert.deepEqual((await server.handle({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools.map(x=>x.name),[DISCOVERY_MCP_TOOL])
 for(const params of [{name:DISCOVERY_MCP_TOOL,arguments:{query:'private fixture'}},{name:'web_fetch_exa',arguments:{}},{name:'agent_run',arguments:{}},{name:DISCOVERY_MCP_TOOL,arguments:{},url:'private fixture'}])assert.equal((await server.handle({jsonrpc:'2.0',id:3,method:'tools/call',params})).error.code,-32602)
 const omitted=call(4);delete omitted.params.arguments
 assert.equal(calls,0);await server.handle(omitted);assert.equal(calls,1)
 assert.equal((await server.handle(call(5))).result.content[0].text,'discovery-budget-exhausted');assert.equal(calls,1)
})
test('atomic reservation is flushed before any upstream work and survives a new server instance',async t=>{
 const path=await budget(t);let calls=0
 const upstream=async()=>{calls++;assert.equal(await readFile(path,'utf8'),'reserved-before-exa-initialize\n');assert.equal((await stat(path)).mode&0o777,0o600);return{content:[]}}
 const first=createDiscoveryMcpServer({budgetFile:path,upstream});await init(first);await first.handle(call(2))
 const restarted=createDiscoveryMcpServer({budgetFile:path,upstream});await init(restarted)
 assert.equal((await restarted.handle(call(2))).result.content[0].text,'discovery-budget-exhausted');assert.equal(calls,1)
})
test('concurrent calls reserve once, and unknown outcome never releases the marker',async t=>{
 const path=await budget(t);let calls=0,started,release
 const ready=new Promise(r=>{started=r}),hold=new Promise(r=>{release=r})
 const first=createDiscoveryMcpServer({budgetFile:path,upstream:async()=>{calls++;started();await hold;throw Error('private provider detail')}});await init(first)
 const pending=first.handle(call(2));await ready
 assert.equal((await first.handle(call(3))).result.content[0].text,'discovery-budget-exhausted')
 release();assert.equal((await pending).result.content[0].text,'discovery-unavailable-no-retry');assert.equal(calls,1)
 assert.ok(await stat(path))
})
test('parent cancellation and independent deadline stop upstream work',async()=>{
 const controller=new AbortController();controller.abort();let calls=0
 await assert.rejects(runFixedDiscovery({signal:controller.signal,post:async()=>{calls++}}));assert.equal(calls,0)
 const timeout=AbortSignal.timeout;AbortSignal.timeout=ms=>timeout(ms===20000?20:ms)
 try {await assert.rejects(runFixedDiscovery({signal:new AbortController().signal,post:()=>new Promise(()=>{})}))}finally{AbortSignal.timeout=timeout}
})
for(const address of ['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','192.0.2.1','192.88.99.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','240.0.0.1','::','::1','fc00::1','fe80::1','fec0::1','::ffff:8.8.8.8','64:ff9b::808:808','2001:db8::1','2002::1','3fff::1','5f00::1','2001:4860::1%lo'])test('nonpublic/special DNS rejected '+address,()=>assert.equal(discoveryPublicAddress(address),false))
test('known global DNS addresses accepted',()=>{assert.equal(discoveryPublicAddress('1.1.1.1'),true);assert.equal(discoveryPublicAddress('2606:4700:4700::1111'),true);assert.equal(discoveryPublicAddress('2001:4860:4860::8888'),true)})
test('production request validates all DNS answers, pins lookup/peer/TLS, excludes proxy/auth/cookies',async()=>{
 const safe={address:'1.1.1.1',family:4};let options,requests=0
 const request=(value,callback)=>{requests++;options=value;const req=new EventEmitter();req.end=body=>{assert.equal(body,'{}');queueMicrotask(()=>{const res=response('{}',{'content-type':'application/json'});res.socket={remoteAddress:'1.1.1.1'};callback(res)})};return req}
 const url=new URL('https://mcp.exa.ai/mcp?tools=web_search_exa'),signal=new AbortController().signal
 const res=await discoveryPinnedPost(url,'{}',null,signal,{resolveDns:async()=>[safe],request});res.destroy()
 assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.servername,'mcp.exa.ai');assert.equal(options.signal,signal)
 assert.ok(!('Authorization' in options.headers));assert.ok(!('Cookie' in options.headers));assert.equal(options.headers['Accept-Encoding'],'identity')
 options.lookup('mcp.exa.ai',{all:true},(error,rows)=>{assert.equal(error,null);assert.deepEqual(rows,[safe])})
 options.lookup('mcp.exa.ai',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'1.1.1.1');assert.equal(family,4)})
 options.lookup('evil.invalid',{},error=>assert.ok(error))
 await assert.rejects(discoveryPinnedPost(url,'{}',null,signal,{resolveDns:async()=>[safe,{address:'127.0.0.1',family:4}],request}));assert.equal(requests,1)
 await assert.rejects(discoveryPinnedPost(new URL('https://evil.invalid/'),'{}',null,signal,{request}));assert.equal(requests,1)
})
test('only an explicit current Research permit yields a fixed stdio config',()=>{
 const agent={id:'AG-RES-002',modelTier:'T1_WORKER',departmentKey:'research-market-intelligence',managerId:'AG-RES-001',managerModelTier:'T2_HEAD',headAuthorization:true,model:'gpt-6.1-terra',lifecycle:'Active',profileFileId:'profile_fixture_01',skillFileIds:['skill_fixture_01']}
 agent.qualification={status:'qualified',scope:'bounded-drafting-v1',bindingDigest:'a'.repeat(64),evidenceId:'receipt_fixture_01',profileFileId:agent.profileFileId,modelTier:agent.modelTier,managerId:agent.managerId,departmentKey:agent.departmentKey,skillFileIds:agent.skillFileIds}
 const job={id:'job-fixture',agent_id:agent.id,context:{mode:'task-work',agent,task:{id:'task-fixture',attempt:0}}},paths={nodePath:'/trusted/node',modulePath:'/trusted/departmentWorkflow.mjs',budgetFile:'/trusted/ephemeral/exa-discovery-budget',executionModel:'gpt-6.1-terra'}
 assert.equal(discoveryMcpConfig(job,paths),null)
 job.context.publicDiscoveryPermit={version:1,policyId:DISCOVERY_MCP_POLICY,jobId:job.id,agentId:agent.id,bindingDigest:agent.qualification.bindingDigest}
 assert.deepEqual(discoveryMcpConfig(job,paths).enabled_tools,[DISCOVERY_MCP_TOOL])
 for(const mutate of [j=>{j.context.publicDiscoveryPermit.jobId='other'},j=>{j.context.agent.departmentKey='email-lifecycle'},j=>{j.context.mode='head-review'},j=>{j.context.agent.qualification.bindingDigest='b'.repeat(64)},j=>{j.context.agent.headAuthorization=false},j=>{j.context.task.attempt=1},j=>{j.agent_id='AG-RES-003';j.context.agent.id=j.agent_id}]){const changed=structuredClone(job);mutate(changed);assert.equal(discoveryMcpConfig(changed,paths),null)}
 assert.equal(discoveryMcpConfig(job,{...paths,executionModel:'gpt-6-luna'}),null)
 const trial=structuredClone(job);trial.context.mode='worker-trial';delete trial.context.agent.qualification
 trial.context.supervisedTrial={scope:'public-research-tool-trial-v1',status:'active',toolPolicyId:DISCOVERY_MCP_POLICY,
  agentId:agent.id,taskId:trial.context.task.id,managerId:agent.managerId,skillFileId:agent.skillFileIds[0],
  bindingDigest:'c'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),externalActionsAllowed:false,publishingAllowed:false}
 trial.context.publicDiscoveryPermit.bindingDigest='c'.repeat(64)
 assert.equal(researchDiscoveryTrialAllowed(trial),true);assert.equal(workerExecutionBlock(trial),null);assert.ok(discoveryMcpConfig(trial,paths))
 const start=structuredClone(trial);start.context.mode='trial-start'
 assert.equal(researchDiscoveryTrialAllowed(start),true);assert.equal(workerExecutionBlock(start),null);assert.equal(discoveryMcpConfig(start,paths),null)
 for(const mutate of [j=>{j.context.supervisedTrial.scope='synthetic-internal-trial-v1'},j=>{j.context.supervisedTrial.toolPolicyId='other'},j=>{j.context.supervisedTrial.expiresAt='2000-01-01T00:00:00Z'},j=>{j.context.supervisedTrial.skillFileId='other'},j=>{j.context.publicDiscoveryPermit.bindingDigest='d'.repeat(64)}]){const changed=structuredClone(trial);mutate(changed);assert.equal(discoveryMcpConfig(changed,paths),null)}
})
test('actual stdio process imports safely and restarts cannot replay a reserved discovery',async t=>{
 const path=await budget(t);await mkdir(join(path,'..','unused')).catch(()=>{})
 // Pre-reserve without network using the actual server's atomic file operation.
 const server=createDiscoveryMcpServer({budgetFile:path,upstream:async()=>({content:[]})});await init(server);await server.handle(call(2))
 const script=new URL('./departmentWorkflow.mjs',import.meta.url).pathname
 const child=spawn(process.execPath,[script,'--public-discovery-mcp',path],{env:{},stdio:['pipe','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')})
 let stdout='',stderr='';child.stdout.on('data',x=>{stdout+=x});child.stderr.on('data',x=>{stderr+=x})
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}})+'\n'+JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n'+JSON.stringify(call(2))+'\n')
 const end=Date.now()+3000
 while(!stdout.includes('discovery-budget-exhausted')&&Date.now()<end)await new Promise(r=>setTimeout(r,10))
 assert.ok(stdout.includes('discovery-budget-exhausted'));assert.equal(stderr,'');child.stdin.end()
 await new Promise(resolve=>child.once('exit',resolve))
})
