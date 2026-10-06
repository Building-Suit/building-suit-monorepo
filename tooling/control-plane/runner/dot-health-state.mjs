import {exhaustionHealth} from './retry-exhaustion-audit.mjs'
export const HEALTH_STATES = Object.freeze(['RUNNING','VERIFYING','REPAIRING','PUBLISHING','WAITING_TIMER','WAITING_OPERATOR','WAITING_DEPENDENCY','STUCK','FAILED','COMPLETE'])
const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
export function classifyHealth(input, process = {}, now = Date.now(), graceMs = 60_000) {
 const {run,task,execution:e,verification:v,recovery:r,operation:o,publication:p,policy} = input
 const timestamps=[input.last_progress_at,e?.started_at,e?.finished_at,v?.started_at,v?.finished_at,process.last_output_at].map(time)
 const last=Math.max(...timestamps,run&&!task?time(run.updated_at):0)
 const age=last?now-last:Infinity
 const base={key:input.key,run_id:run?.run_id??null,workstream:run?.workstream_slug??task?.workstream_slug??task?.suit_slug,
 task_id:task?.task_id??run?.current_task_id??null,completed_tasks:run?.completed_tasks??null,max_tasks:run?.max_tasks??null,
 attempt:e?.attempt??0,max_attempts:policy?.max_attempts??null,model:e?.model_name??null,profile:e?.model_profile??task?.model_profile??null,reasoning_effort:e?.reasoning_effort??null,execution_id:e?.execution_id??null,
 worker_alive:process.worker_alive===true,process:process.worker??null,process_observed_at:process.observed_at??null,
 controller_lease:{token:run?.controller_lease_token??null,expires_at:run?.controller_lease_expires_at??null,valid:process.supervisor_alive===true&&time(run?.controller_lease_expires_at)>now},
 supervisor_lease:{owner:r?.lease_owner??null,expires_at:r?.lease_expires_at??null,valid:process.supervisor_alive===true&&time(r?.lease_expires_at)>now},
 last_progress_at:last?new Date(last).toISOString():null,elapsed_seconds:last?Math.max(0,Math.floor(age/1000)):null,execution_elapsed_seconds:e?.started_at?Math.max(0,Math.floor((now-time(e.started_at))/1000)):null,
 next_wake_at:r?.next_wake_at??o?.next_wake_at??null,recovery_classification:r?.failure_class??null,recovery_action:r?.next_action??null,
 publication_state:p?.state??(task?.status==='passed'?'pending':'not_started'),observed_at:new Date(now).toISOString(),llm_used:false}
 const incident=input.incident_recovery
 if(incident){base.recovery_owner=incident.owner;base.recovery_action=incident.action;base.incident_id=incident.incident_id;base.recovery_started=incident.started_at;base.next_recovery_check=incident.next_check_at}
 const state=(value,why,next,needs=false)=>({...base,state:value,why,next_automatic_action:next,operator_action_required:needs})
 if(run && (['finished','complete'].includes(run.status)||run.completed_tasks>=run.max_tasks))return state('COMPLETE','Bounded run completed','None')
 if(!run&&['complete','cancelled'].includes(task?.status))return state('COMPLETE','Task completed','None')
 if(incident?.status==='human-gate')return state('WAITING_OPERATOR',incident.evidence?.reason??'Incident investigation established a human gate','Resolve the recorded incident gate',true)
 if(run?.stop_requested||run?.maintenance_requested)return state('WAITING_OPERATOR',run.stop_requested?'Run stop requested':'Run maintenance hold','Operator must release the existing run hold',true)
 const audit=r?.condition?.exhaustion_audit
 if(['retry_budget_exhausted','retry_classification_review_required'].includes(r?.error_code)){const gate=exhaustionHealth(audit);return {...state(gate.needs?'WAITING_OPERATOR':'STUCK',gate.why,gate.next,gate.needs),exhaustion_audit:audit??null}}
 if(['wait-operator','wait-decision','safety-stop'].includes(r?.next_action)&&r.status==='active')return state('WAITING_OPERATOR',r.error_code??r.next_action,'Resolve the recorded operator/decision gate',true)

 if(process.worker_alive){
  if(time(process.worker?.deadline_at)&&time(process.worker.deadline_at)<now)return state('STUCK','Worker still alive beyond its enforced deadline','Dot must reconcile the overdue worker receipt')
  if(process.phase==='verification')return state('VERIFYING','Independent verifier process alive','Finish mandatory verification')
  if(o?.action==='task-retry'||e?.attempt>1)return state('REPAIRING','Repair worker process alive','Finish this reserved repair attempt, then verify')
  return state('RUNNING','Implementation worker process alive','Finish implementation, then verify')
 }
 if(o?.action==='task-publish'){
  const started=input.publication_started?.operation_id===o.operation_id?input.publication_started:null
  const publisher={operation_id:o.operation_id,receipt_id:process.publisher?.receipt_id??null,
   heartbeat_at:process.publisher?.heartbeat_at??null,publication_started_at:started?.at??null,
   next_recovery_check:incident?.next_check_at??r?.next_wake_at??null,deadline_at:process.publisher?.deadline_at??null}
  base.publisher=publisher;base.recovery_owner='Dot';base.recovery_action='publication-handoff'
  const fresh=process.publisher?.alive && !process.publisher?.settled && time(publisher.heartbeat_at)>now-30_000
   && (!time(publisher.deadline_at)||time(publisher.deadline_at)>now)
  const due=time(publisher.next_recovery_check)
  if(fresh && (started || !due || due>now))return state('PUBLISHING','Publisher receipt has a live child and fresh heartbeat','Finish publication, credit once, then acquire the next task')
  if(started && process.operation_alive && !process.publisher?.settled && time(started.at)>now-graceMs)return state('PUBLISHING','Authoritative publication_started handoff','Start/reconcile the persisted publisher receipt')
  return state('STUCK',!started&&due&&due<=now?'Publication recovery check expired before publication_started':'Publisher receipt missing, stale or exited before completion','Dot must reconcile the same publication operation; never spend a product attempt')
 }
 const timer=Math.max(time(r?.next_wake_at),time(o?.next_wake_at))
 const settledBackoff=!!o?.result || ['worker_transport_interrupted','process_recovery_required','malformed_child_response'].includes(r?.error_code)
 if(timer>now && (!(e?.status==='running')||settledBackoff))return state('WAITING_TIMER',r?.error_code??'Persisted recovery backoff','Wake the same operation at next_wake_at')
 if(o && process.operation_alive){
  if(o.action==='task-verify')return state('VERIFYING','Verification invocation alive','Run/reconcile mandatory verification')
  if(o.action==='task-prepare')return state('RUNNING','Task preparation invocation alive','Prepare the authorized parent/worktree, then dispatch')
  if(e?.status==='running' && now-time(o.updated_at??o.created_at)<=graceMs)return state('RUNNING','Worker dispatch in progress','Start the reserved worker')
 }
 if(e?.status==='running')return state('STUCK','Execution marked running but no live implementation/verifier worker','Dot must reconcile the same execution receipt')
 if(v?.status==='running')return state('STUCK','Verification marked running but no live verifier','Dot must recover/reconcile this verification')
 if(!task){
  if(input.next_eligible_task)return state('STUCK',`No current task despite eligible admitted work: ${input.next_eligible_task}`,'Controller must acquire the next task on this same run')
  if(input.unowned_prerequisite)return state('WAITING_OPERATOR',`Unowned prerequisite outside authorized runs: ${input.unowned_prerequisite}`,'Authorize the prerequisite within a correctly scoped run; never bypass the dependency',true)
  if(input.bounded_scope_exhausted)return state('WAITING_OPERATOR','All authorized batch tasks completed before the configured run limit','Operator must reconcile the existing batch scope/count; no scope expansion or replacement run',true)
  if(run?.status==='failed')return state('FAILED','Run failed without a current task','Inspect the recorded run failure',true)
  return state('WAITING_DEPENDENCY','No eligible admitted task','Wait for authoritative dependency/decision readiness')
 }
 if(task.status==='complete' && run?.current_task_id===task.task_id){
  if(age<=graceMs)return state('RUNNING','Publication complete; completion credit handoff pending','Credit once, then acquire the next eligible task')
  return state('STUCK','Completed task still held by run; completion credit/acquisition handoff missing','Controller must reconcile credit and next acquisition')
 }
 if(task.status==='passed' && v?.status==='passed'){
  if(age<=graceMs)return state('RUNNING','Verification passed; publication handoff pending','Supervisor must invoke publication preflight')
  return state('STUCK','Verification passed but publication transition never started','Supervisor must reconcile publication from passing evidence')
 }
 if(['planned','ready'].includes(task.status)&&!run)return state('WAITING_DEPENDENCY',input.blocking_decision?'Unapproved blocking decision':input.blocking_dependency?'Hard dependency incomplete':'Awaiting admission/current-task completion',input.blocking_decision?'Wait for the approved decision':'Acquire only when authoritative readiness permits',!!input.blocking_decision)
 if(!e && process.supervisor_alive && base.supervisor_lease.valid)return state('RUNNING','Supervisor preparing implementation preflight','Prepare dependencies and dispatch attempt 1')
 if(task.status==='failed')return state('STUCK','Task failed; no active repair, timer or human gate','Dot must classify the failure and route supported recovery')
 if(run?.status==='failed')return state('FAILED','Run failed','Inspect the run failure',true)
 if((base.controller_lease.valid||base.supervisor_lease.valid)&&age<=graceMs)return state('RUNNING','Controller/supervisor handoff in progress','Perform the next lifecycle action')
 return state('STUCK',timer&&timer<=now?'Recovery timer overdue without a live action':'Expected lifecycle action has no live owner or valid wake','Dot must reconcile the existing lifecycle')
}
