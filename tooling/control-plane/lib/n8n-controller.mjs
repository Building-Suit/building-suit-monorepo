const automaticResumeActions = new Set(['wait-external'])

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function resumeSchedule(payload, now = new Date()) {
  const recovery = payload?.recovery ?? null
  const nextAction = recovery?.next_action ?? null
  const leaseExpiry = payload?.lease_expires_at ?? recovery?.lease_expires_at ?? null
  const wake = recovery?.next_wake_at ?? leaseExpiry
  const leaseActive = validTimestamp(leaseExpiry) && Date.parse(leaseExpiry) > now.getTime()

  if (payload?.reason === 'supervisor_lease_active' || payload?.reason === 'supervisor_lease_contended') {
    return {
      outcome: 'wait',
      automatic_resume: validTimestamp(wake),
      wake_at: validTimestamp(wake) ? wake : null,
      reason: payload.reason,
      lease_active: leaseActive,
    }
  }

  if (payload?.status !== 'wait') return null
  return {
    outcome: 'wait',
    automatic_resume: automaticResumeActions.has(nextAction) && validTimestamp(wake),
    wake_at: validTimestamp(wake) ? wake : null,
    reason: recovery?.reason ?? payload?.reason ?? 'supervisor_wait',
    lease_active: leaseActive,
  }
}

export function normalizeSupervisorResult(runnerResult, now = new Date()) {
  const payload = runnerResult?.payload ?? runnerResult ?? {}
  const schedule = resumeSchedule(payload, now)
  if (schedule) return { ...schedule, task_id: payload.task_id ?? null, recovery: payload.recovery ?? null }

  if (payload.status === 'terminal') {
    const reason = payload.recovery?.reason ?? payload.reason ?? payload.error ?? 'supervisor_terminal'
    const success = ['task_complete', 'task_cancelled'].includes(reason) && payload.ok === true
    return {
      outcome: success ? 'success' : 'safety-stop',
      automatic_resume: false,
      wake_at: null,
      task_id: payload.task_id ?? null,
      reason,
      recovery: payload.recovery ?? null,
    }
  }

  if (runnerResult?.runner_ok === true && payload.ok === true) {
    return { outcome: 'success', automatic_resume: false, wake_at: null, task_id: payload.task_id ?? null, reason: payload.reason ?? 'complete', recovery: payload.recovery ?? null }
  }

  return {
    outcome: 'safety-stop',
    automatic_resume: false,
    wake_at: null,
    task_id: payload.task_id ?? null,
    reason: payload.error ?? runnerResult?.parse_error ?? runnerResult?.ssh_error ?? 'supervisor_failed',
    recovery: payload.recovery ?? null,
  }
}

export function continuousRunTransition({ gate, task, supervisor }) {
  if (gate?.reason === 'stop_requested' || gate?.status === 'stopped') return 'stop-requested'
  if (gate?.reason === 'limit_reached' || gate?.status === 'limit_reached') return 'task-limit'
  if (gate?.should_continue !== true) return 'safety-stop'
  if (!task) return 'no-ready-task'
  if (supervisor?.outcome === 'wait') return 'wait'
  if (supervisor?.outcome === 'success') return 'success'
  return 'safety-stop'
}
