import {createHash} from 'node:crypto'
import {existsSync,readdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import path from 'node:path'
import {receiptLocked,receiptProcessAlive} from './durable-process.mjs'
import {readBoundArtifact} from './trusted-verifier-receipt.mjs'
import {publicationStateFingerprint} from './publication-preflight.mjs'

const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const classes=new Set(['unknown-outcome','verification-infrastructure','verification-configuration','external-wait','verification-required-check-unavailable'])
// A completed model invocation is an implementation outcome, never verifier PASS.
export const retryImplementationCompleted=({succeeded,lastExitCode,probe})=>!succeeded&&lastExitCode===0&&classes.has(probe?.classification?.failure_class)
const paths=dir=>({dir,request:path.join(dir,'request.json'),state:path.join(dir,'state.json'),result:path.join(dir,'result.json'),lock:path.join(dir,'process.lock')})
export function completedRetryReceipt(snapshot,root) {
 const task=snapshot.packet?.task, execution=snapshot.executions?.at(-1), run=snapshot.workflow_run
 const operation=snapshot.implementation_operation
 if(task?.status!=='in_progress'||execution?.status!=='running'||!operation||operation.action!=='task-retry'
  ||Number(operation.execution_id)!==Number(execution.execution_id)||Number(operation.descriptor?.previous_execution_id)===Number(execution.execution_id)
  ||!run||run.current_task_id!==task.task_id||operation.workflow_run_id!==run.run_id||run.status!=='running'||run.stop_requested||run.maintenance_requested||run.completed_tasks>=run.max_tasks
  ||snapshot.recovery?.status==='active'&&['wait-operator','wait-decision','safety-stop'].includes(snapshot.recovery.next_action))return null
 try {
  const read=file=>JSON.parse(readBoundArtifact(file,root))
  const idle=p=>existsSync(p.lock)&&!receiptLocked(p)&&!receiptProcessAlive(read(p.state))&&!receiptProcessAlive(read(p.state)?.child)
  const outer=paths(path.join(root,'.local/runtime-operations',digest(operation.operation_id),String(operation.infra_retries)))
  if(!idle(outer))return null
  const result=read(outer.result), request=read(outer.request), payload=JSON.parse(result.stdout)
  if(result.code!==1||payload.error!=='repair_verifier_recovery_required'||payload.command!==operation.action||payload.task_id!==task.task_id||Number(payload.execution_id)!==Number(execution.execution_id)
   ||request.cwd!==root||path.basename(request.program??'')!=='node'||request.args?.length!==3||request.args[0]!==operation.descriptor?.source
   ||request.args.at(-1)!==task.task_id||request.args.at(-2)!==operation.action
   ||payload.probe?.task_id!==task.task_id||payload.probe.ok!==true||payload.probe.passed!==false)return null
  if(operation.status==='consumed'&&!isDeepStrictEqual(operation.result,{result,payload}))return null
  const base=path.join(root,'.local/runtime-receipts',digest(operation.operation_id+':codex'))
  const generation=readdirSync(base).filter(n=>/^\d+$/.test(n)).map(Number).sort((a,b)=>a-b).at(-1)
  if(generation==null)return null
  const inner=paths(path.join(base,String(generation)))
  if(!idle(inner))return null
  const worker=read(inner.result), model=read(inner.request), context=model.context
  if(!retryImplementationCompleted({succeeded:false,lastExitCode:worker.code,probe:payload.probe})
   ||context?.task_id!==task.task_id||context.run_id!==run.run_id||Number(context.execution_id)!==Number(execution.execution_id)||Number(context.attempt)!==Number(execution.attempt)
   ||model.cwd!==execution.worktree_path||path.basename(model.program??'')!=='codex'||model.args?.[0]!=='exec')return null
  const git=args=>{const r=spawnSync('git',args,{cwd:execution.worktree_path,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error('receipt_source_unavailable');return r.stdout.trim()}
  const files=[...new Set([git(['diff','--name-only','HEAD']),git(['diff','--cached','--name-only']),git(['ls-files','--others','--exclude-standard'])].flatMap(s=>s.split('\n').filter(Boolean)))].sort()
  const state={base_sha:git(['rev-parse','HEAD']),files:files.map(file=>({file,object:existsSync(path.join(execution.worktree_path,file))?git(['hash-object','--',file]):'deleted'}))}
  if(publicationStateFingerprint(state)!==payload.probe?.verified_state?.fingerprint)return null
  return {version:1,operation_id:operation.operation_id,execution_id:execution.execution_id,attempt:execution.attempt,infra_generation:operation.infra_retries,
   run_id:run.run_id,task_id:task.task_id,outer_sha256:digest(readBoundArtifact(outer.result,root)),worker_sha256:digest(readBoundArtifact(inner.result,root)),worker_exit_code:0,
   worker_context:context,source_fingerprint:publicationStateFingerprint(state),probe:payload.probe,log_path:payload.execution?.log_path??execution.run_log_path,
   original_result:{result,payload},mandatory_verification_pending:true}
 }catch{return null}
}
