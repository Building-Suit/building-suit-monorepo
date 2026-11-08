/** Disposable mock transport; never calls a model. */
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
export async function fake(events,action,{meeting=false,cliVersion='codex-cli 0.159.2',versionProbe={},appServer={},eventsByModel={}}={}){
 const directory=await mkdtemp(join(tmpdir(),'hq-mock-cli-'));const bin=join(directory,'mock-codex')
 await writeFile(bin,`#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import readline from 'node:readline';
const args=process.argv.slice(2);
if(args[0]==='--version'){await new Promise(done=>setTimeout(done,${JSON.stringify(versionProbe.delayMs??0)}));process.stdout.write(${JSON.stringify(versionProbe.stdout??cliVersion+'\n')});process.stderr.write(${JSON.stringify(versionProbe.stderr??'')});process.exitCode=${JSON.stringify(versionProbe.exitCode??0)};await new Promise(done=>setImmediate(done));process.exit()}
if(args[0]==='app-server'){
 const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let start=null,threadId='018f0000-0000-7000-8000-000000000001',turnId='018f0000-0000-7000-8000-000000000002',done=false;
 const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
 const publicDiscovery=${JSON.stringify(appServer.publicDiscovery===true)};
 const validArgs=args.includes('--stdio')&&args.includes('--strict-config')&&args.includes('--disable')&&args.includes('shell_tool')&&(publicDiscovery?args.some(value=>value.startsWith('mcp_servers={hq_public_discovery=')):args.includes('mcp_servers={}'));
 if(!validArgs||process.env.HQ_WORKER_PASSWORD||process.env.OPENAI_API_KEY||process.env.HQ_BRAIN_GOOGLE_PRIVATE_KEY)process.exit(77);
 lines.on('line',raw=>{const req=JSON.parse(raw);if(req.method==='initialize'){send({id:req.id,result:{userAgent:${JSON.stringify(cliVersion)}}});return}if(req.method==='initialized')return;
 if(req.method==='thread/start'){start=req.params;if(start.approvalPolicy!=='never'||start.sandbox!=='read-only'||start.ephemeral!==true||start.config?.web_search!=='disabled'||(publicDiscovery?Object.keys(start.config?.mcp_servers??{}).join(',')!=='hq_public_discovery':Object.keys(start.config?.mcp_servers??{}).length!==0)||start.config?.agents?.enabled!==false||start.model!=='gpt-6.1-terra'||start.modelProvider!=='openai'||start.developerInstructions!=='')process.exit(78);
 if(publicDiscovery){const server=start.config.mcp_servers.hq_public_discovery;if(Object.keys(server).sort().join(',')!=='args,command,enabled,enabled_tools,required,startup_timeout_sec,tool_timeout_sec'||server.enabled!==true||server.required!==true||server.enabled_tools.join(',')!=='public_business_discovery'||server.args[0]!=='--preserve-symlinks-main'||server.args[2]!=='--public-discovery-mcp'||server.args[3]!==start.cwd+'/exa-discovery-budget')process.exit(81)}
 if(${JSON.stringify(appServer.missingSettings===true)}){send({id:req.id,result:{thread:{id:threadId,model:start.model,modelProvider:start.modelProvider}}});return}
 const t={id:threadId};const resolution={model:start.model,modelProvider:start.modelProvider,reasoningEffort:start.config.model_reasoning_effort};
 if(${JSON.stringify(appServer.nestedSettings===true)})Object.assign(t,resolution);
 if(${JSON.stringify(appServer.nestedConflict===true)})t.model='gpt-6-luna';
 if(${JSON.stringify(appServer.nullEffort===true)})resolution.reasoningEffort=null;
 if(${JSON.stringify(appServer.modelMismatch===true)})resolution.model='gpt-6-luna';
 send({id:req.id,result:{...resolution,thread:t}});send({method:'thread/started',params:{thread:{id:threadId}}});
 if(${JSON.stringify(appServer.override===true)})send({method:'thread/settings/updated',params:{threadId,threadSettings:{model:'gpt-6-luna',modelProvider:'openai',reasoningEffort:'medium'}}});
 return}
 if(req.method==='turn/start'){if(!start||req.params.threadId!==threadId||Object.keys(req.params).sort().join(',')!=='input,threadId'||!req.params.input?.[0]?.text?.includes('untrusted data'))process.exit(79);
 send({id:req.id,result:{turn:{id:turnId,status:'inProgress',items:[]}}});send({method:'turn/started',params:{threadId,turn:{id:turnId,status:'inProgress',items:[]}}});
 for(const event of ${JSON.stringify(appServer.events??[])})send({method:event.method,params:{threadId,turnId,...event.params}});
 if(!${JSON.stringify(appServer.noAnswer===true)})send({method:'item/completed',params:{threadId,turnId,item:{type:'agentMessage',id:'item_1',text:'Synthetic trial result'}}});
 send({method:'turn/completed',params:{threadId,turn:{id:turnId,status:${JSON.stringify(appServer.turnStatus??'completed')},items:${JSON.stringify(appServer.turnItems??[])}}}});done=true;lines.close();return}
 process.exit(80)});
 lines.on('close',()=>process.exit(done?0:0));
} else {
let prompt='';for await(const c of process.stdin)prompt+=c;
if(!args.includes('--ignore-user-config')||!args.includes('--strict-config')||!['gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-6-astra'].some(model=>args.includes(model))||!args.includes('model_reasoning_effort="medium"')||process.env.HQ_WORKER_PASSWORD||process.env.OPENAI_API_KEY||process.env.HQ_BRAIN_GOOGLE_PRIVATE_KEY) {process.stdout.write(JSON.stringify({type:'error',message:'boundary-failed'})+'\\n');process.exit(1)}
if(!prompt.includes('profile_source_1')||!prompt.includes('untrusted data'))process.exit(1);
if(${JSON.stringify(meeting)}&&(!args.includes('web_search="disabled"')||args[args.indexOf('--sandbox')+1]!=='read-only'||!args.includes('mcp_servers={}')||!args.includes('shell_tool')||!args.includes('browser_use')||!prompt.includes('actual named employee Noah (AG-HR-002)')||!prompt.includes('conversation from supplied context only')||prompt.includes('You are Steve, the CEO')))process.exit(1);
const selected=['gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'].find(model=>args.includes(model));const byModel=${JSON.stringify(eventsByModel)};const values=byModel[selected]??${JSON.stringify(events)};for(const event of values){const bytes=Buffer.from(JSON.stringify(event)+'\\n');for(let i=0;i<bytes.length;i+=7)process.stdout.write(bytes.subarray(i,i+7));}
}
`,{mode:0o700})
 try{return await action({bin})}finally{await rm(directory,{recursive:true,force:true})}
}
