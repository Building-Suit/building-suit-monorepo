import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { parentContinuation } from '../runner/dot.mjs'
import { cleanupIntegratedWorktrees } from '../runner/dot-cleanup.mjs'
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
function fixture(){const root=mkdtempSync(path.join(tmpdir(),'dot-git-'));git(root,'init','-b','stg');git(root,'config','user.name','Dot Fixture');git(root,'config','user.email','dot@example.invalid');writeFileSync(path.join(root,'base'),'base');git(root,'add','.');git(root,'commit','-m','base');return root}
test('Dot injected actual parent advance preserves dirty task worktree and base',()=>{
 const root=fixture();try{
  const base=git(root,'rev-parse','HEAD'),task=path.join(root,'.local','worktrees','task');mkdirSync(path.dirname(task),{recursive:true});git(root,'worktree','add','-b','codex/shared/task',task,base)
  writeFileSync(path.join(task,'verified-work'),'preserve this dirty work');const before=readFileSync(path.join(task,'verified-work'),'utf8')
  writeFileSync(path.join(root,'parent-change'),'advance');git(root,'add','.');git(root,'commit','-m','advance actual intended parent');const current=git(root,'rev-parse','HEAD')
  const ancestor=git(root,'merge-base','--is-ancestor',base,current)===''
  const result=parentContinuation({sameBranch:true,oldPresent:true,newPresent:true,ancestor,containsOld:git(task,'merge-base','--is-ancestor',base,'HEAD')==='',dirty:true,workerActive:true})
  assert.equal(result.action,'continue-preserved-base');assert.equal(git(task,'rev-parse','HEAD'),base);assert.equal(readFileSync(path.join(task,'verified-work'),'utf8'),before)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('Dot actual cleanup removes only integrated published unused clean work',()=>{
 const root=fixture(),oldPath=process.env.PATH;try{
  const base=git(root,'rev-parse','HEAD'),task=path.join(root,'.local','worktrees','retired'),branch='codex/shared/retired';mkdirSync(path.dirname(task),{recursive:true});git(root,'worktree','add','-b',branch,task,base);git(root,'update-ref','refs/remotes/origin/stg',base)
  const bin=path.join(root,'fixture-bin');mkdirSync(bin);writeFileSync(path.join(bin,'gh'),'#!/bin/sh\nprintf \'[]\\n\'\n',{mode:0o755});process.env.PATH=bin+path.delimiter+oldPath
  const result=cleanupIntegratedWorktrees({repository:{root,github_repository:'fixture/disposable',integration_branch:'stg'},tasks:[{task_id:'DOT-RETIRED-001',status:'complete',metadata:{preparation:{worktree:{worktree_path:task,branch_name:branch}}}}],runs:[],publications:[{task_id:'DOT-RETIRED-001',state:'merged'}]})
  assert.equal(result.removed.length,1);assert.equal(result.removed[0].branch_deleted,true);assert.equal(existsSync(task),false);assert.equal(git(root,'branch','--list',branch),'')
 }finally{process.env.PATH=oldPath;rmSync(root,{recursive:true,force:true})}
})
