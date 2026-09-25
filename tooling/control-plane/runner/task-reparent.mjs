#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const controlRoot = fileURLToPath(new URL('../../../', import.meta.url))
const [taskId, mode, dryRunFlag] = process.argv.slice(2)
const dryRun = mode === '--dry-run' || dryRunFlag === '--dry-run'
if (!/^[A-Z][A-Z0-9-]{2,63}$/.test(taskId ?? '') || ![undefined,'--to-current-parent','--dry-run'].includes(mode)) fail('usage: task-reparent TASK-ID --to-current-parent [--dry-run]')

const db = {
  host: process.env.AUTOMATION_CONTROL_DB_HOST ?? process.env.BS_CONTROL_DB_HOST ?? '127.0.0.1',
  port: process.env.AUTOMATION_CONTROL_DB_PORT ?? process.env.BS_CONTROL_DB_PORT ?? '54329',
  name: process.env.AUTOMATION_CONTROL_DB_NAME ?? process.env.BS_CONTROL_DB_NAME ?? 'building_suit_control',
  user: process.env.AUTOMATION_CONTROL_DB_USER ?? process.env.BS_CONTROL_DB_USER ?? 'bs_control_app',
  sslmode: process.env.AUTOMATION_CONTROL_DB_SSLMODE ?? process.env.BS_CONTROL_DB_SSLMODE ?? 'prefer',
}

function result(program,args,cwd=controlRoot,input) {
  const value=spawnSync(program,args,{cwd,input,encoding:'utf8',env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'},maxBuffer:50*1024*1024,timeout:10*60*1000})
  return {code:value.status??1,stdout:(value.stdout??'').trim(),stderr:(value.stderr??'').trim(),error:value.error?.message}
}
function requireResult(value,label) { if(value.code!==0||value.error) fail(label,{stderr:value.stderr,error_detail:value.error}); return value.stdout }
function fail(error,extra={}) { process.stdout.write(`${JSON.stringify({ok:false,error,...extra},null,2)}\n`); process.exit(1) }
function query(sql,variables={}) {
  const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',db.host,'-p',db.port,'-U',db.user,'-d',db.name]
  for(const [key,value] of Object.entries(variables)) args.push('--set',`${key}=${value}`)
  const value=result('psql',args,controlRoot,`${sql.trim()}\n`)
  return JSON.parse(requireResult(value,'control_database_query_failed'))
}

const state=query(`SELECT jsonb_build_object('packet',control.generic_task_packet(:'task'),'execution',(SELECT to_jsonb(e) FROM control.executions e WHERE e.task_id=:'task' ORDER BY attempt DESC LIMIT 1));`,{task:taskId})
if(!state?.packet||!state.execution) fail('task_or_execution_not_found')
if(state.execution.status!=='succeeded') fail('latest_execution_must_have_succeeded')
if(!['passed','failed','verification'].includes(state.packet.task.status)) fail('task_state_not_reparentable',{status:state.packet.task.status})
const worktree=state.execution.worktree_path
if(!worktree||!existsSync(worktree)) fail('worktree_not_found')
const branch=requireResult(result('git',['branch','--show-current'],worktree),'unable_to_read_branch')
if(branch!==state.execution.branch_name) fail('branch_mismatch',{expected:state.execution.branch_name,actual:branch})
requireResult(result('git',['fetch','origin','--prune'],worktree),'git_fetch_failed')
const remote=result('git',['ls-remote','--exit-code','--heads','origin',branch],worktree)
if(remote.code===0) fail('published_branch_requires_human_reparent',{branch})
if(remote.code!==2) fail('unable_to_determine_remote_branch_state',{stderr:remote.stderr})
const project=state.packet.project??{}
const parentResult=result(process.execPath,[path.join(controlRoot,'tooling/control-plane/runner/stack-parent.mjs'),state.packet.suit.stack_key,project.local_repository_root??'.',project.github_repository??'Building-Suit/building-suit-monorepo',project.integration_branch??'stg'],controlRoot)
const liveParent=JSON.parse(requireResult(parentResult,'parent_resolution_failed'))
const original={branch:state.execution.parent_branch,sha:state.execution.parent_sha}
if(original.branch===liveParent.parent_branch&&original.sha===liveParent.parent_sha) fail('parent_is_already_current',{parent:original})
const changed=requireResult(result('git',['status','--short'],worktree),'git_status_failed').split('\n').filter(Boolean)
const preview={ok:true,dry_run:dryRun,task_id:taskId,worktree,branch,original_parent:original,current_parent:{branch:liveParent.parent_branch,sha:liveParent.parent_sha},changed_files:changed}
if(dryRun){process.stdout.write(`${JSON.stringify(preview,null,2)}\n`);process.exit(0)}

const snapshotRoot=path.join(controlRoot,'.local','automation','reparent',`${taskId}-${Date.now()}`)
mkdirSync(path.join(snapshotRoot,'untracked'),{recursive:true})
const patchText=requireResult(result('git',['diff','--binary','--full-index',original.sha],worktree),'unable_to_snapshot_changes')
writeFileSync(path.join(snapshotRoot,'changes.patch'),`${patchText}\n`,{mode:0o600})
const untracked=requireResult(result('git',['ls-files','--others','--exclude-standard','-z'],worktree),'unable_to_list_untracked').split('\0').filter(Boolean)
for(const file of untracked){const source=path.join(worktree,file);const destination=path.join(snapshotRoot,'untracked',file);mkdirSync(path.dirname(destination),{recursive:true});cpSync(source,destination,{recursive:true,errorOnExist:true})}
requireResult(result('git',['reset','--hard',liveParent.parent_sha],worktree),'reparent_reset_failed')
if(patchText.trim()){
  const applied=result('git',['apply','--3way','--whitespace=nowarn',path.join(snapshotRoot,'changes.patch')],worktree)
  if(applied.code!==0) fail('reparent_conflicts_require_human_review',{snapshot:snapshotRoot,stderr:applied.stderr,worktree})
}
for(const file of untracked){const destination=path.join(worktree,file);if(!existsSync(destination)){mkdirSync(path.dirname(destination),{recursive:true});cpSync(path.join(snapshotRoot,'untracked',file),destination,{recursive:true})}}
const head=requireResult(result('git',['rev-parse','HEAD'],worktree),'unable_to_read_new_head')
const recorded=query(`
  WITH current_task AS (SELECT * FROM control.tasks WHERE task_id=:'task' FOR UPDATE),
  updated_execution AS (UPDATE control.executions SET parent_branch=:'parent_branch',parent_sha=:'parent_sha',engine_stage='reverification_required' WHERE execution_id=:'execution'::bigint RETURNING execution_id),
  updated_task AS (UPDATE control.tasks SET status='verification',engine_stage='reverification_required' WHERE task_id=:'task' RETURNING *)
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  SELECT :'task','task_reparented',current_task.status,'verification','human',jsonb_build_object('execution_id',:'execution'::bigint,'old_parent',jsonb_build_object('branch',:'old_branch','sha',:'old_sha'),'new_parent',jsonb_build_object('branch',:'parent_branch','sha',:'parent_sha'),'snapshot',:'snapshot') FROM current_task
  RETURNING jsonb_build_object('recorded',true,'event_id',event_id);
`,{task:taskId,execution:String(state.execution.execution_id),old_branch:original.branch,old_sha:original.sha,parent_branch:liveParent.parent_branch,parent_sha:liveParent.parent_sha,snapshot:snapshotRoot})
process.stdout.write(`${JSON.stringify({...preview,dry_run:false,new_head:head,snapshot: snapshotRoot,control:recorded,reverification_required:true},null,2)}\n`)
