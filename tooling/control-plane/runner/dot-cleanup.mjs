import { spawnSync } from 'node:child_process'
import { readdirSync, readlinkSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanupEligibility } from './dot.mjs'
function command(program,args,cwd){const r=spawnSync(program,args,{cwd,encoding:'utf8',timeout:30000});return {ok:r.status===0,stdout:r.stdout?.trim() ?? ''}}
export function worktreeWorkerActive(root){
 for(const pid of readdirSync('/proc').filter(p=>/^\d+$/.test(p))){try{
  const cwd=readlinkSync(`/proc/${pid}/cwd`)
  const argv=readFileSync(`/proc/${pid}/cmdline`,'utf8')
  if(cwd===root || cwd.startsWith(root+path.sep) || argv.includes(root)) return true
 }catch{/* exited or inaccessible */}}
 return false
}
export function cleanupIntegratedWorktrees({repository,tasks,runs,publications}){
 const result=command('gh',['pr','list','--repo',repository.github_repository,'--state','open','--limit','1000','--json','baseRefName,headRefName'],repository.root)
 if(!result.ok)return {removed:[],reason:'github_state_unavailable'}
 let prs;try{prs=JSON.parse(result.stdout)}catch{return {removed:[],reason:'github_state_unavailable'}}
 const removed=[]
 for(const task of tasks.filter(t=>t.status==='complete')){
  const prepared=task.metadata?.preparation?.worktree ?? task.preparation?.worktree
  if(!prepared?.worktree_path || !prepared.branch_name)continue
  const root=prepared.worktree_path,branch=prepared.branch_name
  if(!branch.startsWith('codex/') || !path.resolve(root).startsWith(path.resolve(repository.root,'.local','worktrees')+path.sep))continue
  const publication=publications.find(p=>p.task_id===task.task_id && p.state==='merged')
  const activeReference=tasks.some(t=>t.status!=='complete' && t.status!=='cancelled' && JSON.stringify(t).includes(root)) || runs.some(r=>r.status==='running' && (r.current_task_id===task.task_id || JSON.stringify(r).includes(branch)))
  const status=command('git',['status','--porcelain'],root)
  const integrated=command('git',['merge-base','--is-ancestor',branch,`origin/${repository.integration_branch}`],repository.root).ok
  const branchHead=command('git',['branch','--show-current'],root)
  const eligible=cleanupEligibility({activeReference,workerActive:worktreeWorkerActive(root),clean:status.ok && !status.stdout && branchHead.stdout===branch,published:!!publication,integrated,openChild:prs.some(p=>p.baseRefName===branch || p.headRefName===branch),uniqueWork:!integrated})
  if(!eligible)continue
  if(!command('git',['worktree','remove',root],repository.root).ok)continue
  // -d independently refuses unique local work. No remote branches are deleted.
  const deleted=command('git',['branch','-d',branch],repository.root).ok
  removed.push({task_id:task.task_id,worktree:root,branch_deleted:deleted})
 }
 if(removed.length)command('git',['worktree','prune'],repository.root)
 return {removed}
}
