// Mirrors the database predicate; historical observations cannot revive a run.
export function runIsActionable(run) {
 return run?.status==='running'||(run?.status==='failed'&&!!run.current_task_id)
}
export function historicalHealth(run,audit) {
 return {key:'run:'+run.run_id,run_id:run.run_id,run_status:run.status,history_only:true,
 activity_state:'IDLE',lifecycle_outcome:lifecycleOutcome(run),workstream:run.workstream_slug,task_id:run.current_task_id,completed_tasks:run.completed_tasks,max_tasks:run.max_tasks,
 state:audit?.classification??run.status.toUpperCase(),why:audit?.reason??`Historical lifecycle ended: ${run.status}`,
 last_progress_at:run.finished_at??run.updated_at,next_automatic_action:'None — historical run',operator_action_required:false}
}

export function lifecycleOutcome(run, task) {
 const status=run?.status??task?.status
 if(status==='superseded')return 'SUPERSEDED'
 if(status==='cancelled')return 'CANCELLED'
 if(status==='failed')return 'FAILED'
 if(['complete','completed'].includes(status))return 'COMPLETE'
 if(status==='limit_reached')return Number(run?.completed_tasks)>=Number(run?.max_tasks)?'COMPLETE':'CLOSED'
 if(['closed','stopped','finished'].includes(status))return 'CLOSED'
 return 'ACTIVE'
}
export function activityState(state, historyOnly=false) {
 if(historyOnly||['COMPLETE','FAILED','CLOSED','CANCELLED','STOPPED','SUPERSEDED','FINISHED','LIMIT_REACHED'].includes(state))return 'IDLE'
 if(state==='WAITING_ADMISSION')return 'RECONCILING'
 return state
}
