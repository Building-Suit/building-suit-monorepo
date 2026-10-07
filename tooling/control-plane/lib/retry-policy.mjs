const profiles = new Set(['fast', 'standard', 'deep', 'review'])

export function validateRetryPolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new Error('retry_policy_required')
  if (!/^[a-z][a-z0-9-]*$/.test(String(policy.policy_id ?? ''))) {
    throw new Error('invalid_policy_id')
  }
  if (!Number.isInteger(policy.max_attempts) || policy.max_attempts < 1 || policy.max_attempts > 20) {
    throw new Error('max_attempts_must_be_between_1_and_20')
  }
  if (!Array.isArray(policy.attempt_profiles)) throw new Error('attempt_profiles_must_be_an_array')
  if (policy.attempt_profiles.length !== policy.max_attempts) {
    throw new Error('attempt_profile_count_must_equal_max_attempts')
  }
  for (const profile of policy.attempt_profiles) {
    if (!profiles.has(profile)) throw new Error(`unsupported_attempt_profile:${profile}`)
  }
  return {
    policy_id: policy.policy_id,
    max_attempts: policy.max_attempts,
    attempt_profiles: [...policy.attempt_profiles],
    inherited_from: policy.inherited_from ?? null,
  }
}

export function profileForAttempt(policy, attempt) {
  const validated = validateRetryPolicy(policy)
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > validated.max_attempts) {
    throw new Error('attempt_outside_retry_policy')
  }
  return validated.attempt_profiles[attempt - 1]
}

export function retryDecision(policy, completedAttempt) {
  const validated = validateRetryPolicy(policy)
  if (!Number.isInteger(completedAttempt) || completedAttempt < 1) {
    throw new Error('invalid_completed_attempt')
  }
  if (completedAttempt >= validated.max_attempts) {
    return { allowed: false, reason: 'retry_limit_reached', max_attempts: validated.max_attempts }
  }
  const nextAttempt = completedAttempt + 1
  return {
    allowed: true,
    next_attempt: nextAttempt,
    next_profile: profileForAttempt(validated, nextAttempt),
    max_attempts: validated.max_attempts,
  }
}

// Resume an already-reserved execution using its recorded profile. It does not
// ask for a new slot, even when that reservation occupies the final slot.
export function repairRetryDecision(policy, previousExecution, accounting = null, runningExecution = null) {
  const validated = validateRetryPolicy(policy)
  if (runningExecution) {
    if (runningExecution.status !== 'running' || runningExecution.attempt <= previousExecution.attempt
      || previousExecution.task_id && runningExecution.task_id !== previousExecution.task_id) throw new Error('same_task_running_reservation_required')
    return { allowed: true, resumed: true, next_attempt: runningExecution.attempt, next_profile: runningExecution.model_profile, max_attempts: validated.max_attempts }
  }
  if(accounting && (!Number.isSafeInteger(accounting.consumed)||accounting.consumed<1))return {allowed:false,reason:'reviewed_product_evidence_required',max_attempts:validated.max_attempts}
  return retryDecision(validated, accounting?.consumed ?? previousExecution.attempt)
}
