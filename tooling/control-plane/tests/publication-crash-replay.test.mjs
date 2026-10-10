import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {publicationStateFingerprint} from '../runner/publication-preflight.mjs'

for(const phase of ['commit','push','pr'])test(`actual publisher replays a lost ${phase} response with one Git/PR identity`,()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-publication-crash-'))
 try {
  const repository=path.join(root,'source'),remote=path.join(root,'remote.git'),bin=path.join(root,'bin')
  mkdirSync(repository);mkdirSync(bin)
  const git=(args,cwd=repository)=>{const r=spawnSync('/usr/bin/git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
  git(['init','--bare','-q',remote]);git(['init','-q','-b','stg'])
  git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.invalid'])
  mkdirSync(path.join(repository,'tooling/git'),{recursive:true});mkdirSync(path.join(repository,'src'))
  // A preserved authorization helper triggers the reviewed-source Git-object check.
  mkdirSync(path.join(repository,'apps/super-admin-suit/server/utils'),{recursive:true})
  writeFileSync(path.join(repository,'apps/super-admin-suit/server/utils/authorize.ts'),'export const witness=true\n')
  writeFileSync(path.join(repository,'tooling/git/preflight.mjs'),'console.log(JSON.stringify({errors:[]}))\n')
  writeFileSync(path.join(repository,'src/fixture.mjs'),'export const result=0\n')
  git(['add','.']);git(['commit','-qm','Synthetic parent']);const parent=git(['rev-parse','HEAD'])
  git(['remote','add','origin',remote]);git(['push','-q','-u','origin','stg'])
  const branch='codex/automation-suit/synthetic-publication';git(['checkout','-qb',branch])
  writeFileSync(path.join(repository,'src/fixture.mjs'),'export const result=1\n')
  const fingerprint=publicationStateFingerprint({base_sha:parent,files:[{file:'src/fixture.mjs',object:git(['hash-object','src/fixture.mjs'])}]})
  const state=path.join(root,'pr.json'),counts=path.join(root,'counts.json'),fault=path.join(root,'fault')
  writeFileSync(fault,phase);writeFileSync(counts,JSON.stringify({commit:0,push:0,pr:0}))
  const wrapper=`#!${process.execPath}\nconst fs=require('node:fs'),cp=require('node:child_process');const a=process.argv.slice(2),f=process.env.FIXTURE_FAULT,c=process.env.FIXTURE_COUNTS;const r=cp.spawnSync('/usr/bin/git',a,{stdio:'inherit'});if(r.status===0&&['commit','push'].includes(a[0])){const n=JSON.parse(fs.readFileSync(c));n[a[0]]++;fs.writeFileSync(c,JSON.stringify(n));if(fs.existsSync(f)&&fs.readFileSync(f,'utf8')===a[0]){fs.unlinkSync(f);process.exit(74)}}process.exit(r.status??1)\n`
  writeFileSync(path.join(bin,'git'),wrapper,{mode:0o700})
  const gh=`#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2),s=process.env.FIXTURE_PR,f=process.env.FIXTURE_FAULT,c=process.env.FIXTURE_COUNTS;let p=fs.existsSync(s)?JSON.parse(fs.readFileSync(s)):null;if(a[0]==='api'){console.log(JSON.stringify([[{number:9101,state:'open',head:{ref:'${branch}',repo:{full_name:'Synthetic/Disposable'}},base:{ref:'stg',repo:{full_name:'Synthetic/Disposable'}}}]]));process.exit(0)}if(a[0]==='repo'){console.log(JSON.stringify({nameWithOwner:'Synthetic/Disposable'}));process.exit(0)}if(a[0]!=='pr')process.exit(65);if(a[1]==='list'){console.log(JSON.stringify(p?[p]:[]));process.exit(0)}if(a[1]==='create'){if(p)process.exit(66);p={number:9101,headRefName:'${branch}',baseRefName:'stg',isDraft:true,url:'https://example.invalid/pr/9101',state:'OPEN'};fs.writeFileSync(s,JSON.stringify(p));const n=JSON.parse(fs.readFileSync(c));n.pr++;fs.writeFileSync(c,JSON.stringify(n));if(fs.existsSync(f)&&fs.readFileSync(f,'utf8')==='pr'){fs.unlinkSync(f);process.exit(74)}console.log(p.url);process.exit(0)}if(a[1]==='view'){console.log(JSON.stringify(p));process.exit(0)}process.exit(65)\n`
  writeFileSync(path.join(bin,'gh'),gh,{mode:0o700})
  const context={task:{task_id:'CP-PUBLISH-001',title:'Synthetic publication',task_type:'feature'},suit:{stack_key:'automation-suit'},execution:{execution_id:1,worktree_path:repository,branch_name:branch,parent_branch:'stg',parent_sha:parent},allowed_paths:['src/**'],publication_boundaries:{task_paths:['src/**'],project_paths:['src/'],workstream_paths:['src/']},project:{github_repository:'Synthetic/Disposable',local_repository_root:repository,integration_branch:'stg'},verification:{execution_id:1,verification_run_id:1,status:'passed',state_fingerprint:fingerprint,verified_state:{base_sha:parent},checks:[]},run_publication_authority:{unattended_queue_authority:true,authorized:true,mode:'ordinary-draft',task_id:'CP-PUBLISH-001',run_id:'synthetic-run',contract_fingerprint:'synthetic-contract'}}
  const contextPath=path.join(root,'context.json');writeFileSync(contextPath,JSON.stringify(context))
  const invoke=()=>spawnSync(process.execPath,[fileURLToPath(new URL('../runner/task-publisher.mjs',import.meta.url)),contextPath],{encoding:'utf8',timeout:30_000,env:{...process.env,PATH:bin+':'+process.env.PATH,FIXTURE_PR:state,FIXTURE_FAULT:fault,FIXTURE_COUNTS:counts}})
  const interrupted=invoke();assert.notEqual(interrupted.status,0,'Fault must interrupt publication')
  const replay=invoke();assert.equal(replay.status,0,replay.stdout+'\n'+replay.stderr)
  const result=JSON.parse(replay.stdout);assert.equal(result.ok,true);assert.equal(result.pr.number,9101)
  const secondReplay=invoke();assert.equal(secondReplay.status,0,secondReplay.stdout+'\n'+secondReplay.stderr)
  assert.deepEqual(JSON.parse(readFileSync(counts)),{commit:1,push:1,pr:1})
  assert.equal(git(['rev-list','--count',parent+'..HEAD']),'1')
  assert.equal(git(['ls-remote','--heads','origin',branch]).split(/\s/)[0],result.commit_sha)
 } finally {rmSync(root,{recursive:true,force:true})}
})
