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
