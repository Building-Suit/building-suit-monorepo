const TRANSIENT_CONTROL_DATABASE_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
])

const NON_TRANSIENT_PATTERNS = [
  /password authentication failed/i,
  /authentication method .* failed/i,
  /no pg_hba\.conf entry/i,
  /permission denied/i,
  /must be (?:owner|superuser)/i,
  /certificate verify failed/i,
  /database ["'][^"']+["'] does not exist/i,
  /role ["'][^"']+["'] does not exist/i,
  /\b(?:syntax error|undefined (?:table|column|function)|does not exist)\b/i,
  /\b(?:fingerprint mismatch|fingerprint_mismatch|lifecycle[_ -]policy)\b/i,
  /(?:^|\n)\s*(?:ERROR|PANIC):/i,
]

const TRANSIENT_PATTERNS = [
  /temporary failure in name resolution/i,
  /could not translate host name/i,
  /name or service not known/i,
  /nodename nor servname provided/i,
  /getaddrinfo\s+(?:EAI_AGAIN|ENOTFOUND)/i,
  /connection (?:refused|reset|timed out)/i,
  /timeout expired/i,
  /network is (?:down|unreachable)/i,
  /no route to host/i,
  /server closed the connection unexpectedly/i,
  /could not (?:connect to|receive data from|send data to) server/i,
  /SSL SYSCALL error: (?:EOF detected|Connection reset by peer)/i,
  /broken pipe/i,
  /the database system is (?:starting up|in recovery mode|shutting down)/i,
  /remaining connection slots are reserved/i,
  /sorry, too many clients already/i,
]

export const CONTROL_DATABASE_RETRY_POLICY = Object.freeze({
  max_attempts: 3,
  backoff_ms: Object.freeze([250, 1_000]),
  resume_after_ms: 30_000,
})

function failureText(failure) {
  if (typeof failure === 'string') return failure
  return [failure?.error, failure?.stderr, failure?.stdout]
    .filter(Boolean)
    .join('\n')
}

export function classifyControlDatabaseFailure(failure) {
  const text = failureText(failure)
  const code = typeof failure === 'object' ? failure?.code ?? failure?.error_code : null

  // PostgreSQL aborts these transactions. Reuse the bounded transport retry;
  // no implementation or product attempt is created for a lock conflict.
  if (['40P01','40001'].includes(code) || /(?:ERROR|FATAL):\s+(?:40P01|40001):/.test(text)) return { transient: true, category: 'transaction_conflict' }

  if (NON_TRANSIENT_PATTERNS.some(pattern => pattern.test(text))) {
    return { transient: false, category: 'non_transient_database_error' }
  }

  if (
    TRANSIENT_CONTROL_DATABASE_CODES.has(code) ||
    [...TRANSIENT_CONTROL_DATABASE_CODES].some(item => text.includes(item)) ||
    TRANSIENT_PATTERNS.some(pattern => pattern.test(text))
  ) {
    const category = /translate host|name resolution|name or service|getaddrinfo|nodename/i.test(text)
      ? 'dns'
      : /timed out|timeout expired|ETIMEDOUT/i.test(text)
        ? 'timeout'
        : 'connection'
    return { transient: true, category }
  }

  return { transient: false, category: 'unclassified_database_error' }
}

export class ControlDatabaseConnectivityError extends Error {
  constructor({ attempts, category }) {
    super('control_database_connectivity_exhausted')
    this.name = 'ControlDatabaseConnectivityError'
    this.code = 'CONTROL_DATABASE_CONNECTIVITY_EXHAUSTED'
    this.attempts = attempts
    this.category = category
  }
}

function sleepSync(delayMs) {
  if (delayMs <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
}

export function executeWithControlDatabaseRetry(operation, options = {}) {
  const policy = options.policy ?? CONTROL_DATABASE_RETRY_POLICY
  const successful = options.successful ?? (result => result?.code === 0 && !result?.error)
  const sleep = options.sleep ?? sleepSync

  for (let attempt = 1; attempt <= policy.max_attempts; attempt++) {
    const result = operation(attempt)
    if (successful(result)) return result

    const classification = classifyControlDatabaseFailure(result)
    if (!classification.transient) return result
    if (attempt === policy.max_attempts) {
      throw new ControlDatabaseConnectivityError({
        attempts: attempt,
        category: classification.category,
      })
    }

    sleep(policy.backoff_ms[attempt - 1] ?? policy.backoff_ms.at(-1) ?? 0)
  }

  throw new Error('control_database_retry_policy_invalid')
}

export function isControlDatabaseConnectivityError(error) {
  return error?.code === 'CONTROL_DATABASE_CONNECTIVITY_EXHAUSTED'
}

export function controlDatabaseWaitOutcome({ taskId, command, error, now = new Date() }) {
  return {
    ok: true,
    command,
    task_id: taskId,
    status: 'wait',
    reason: 'control_database_connectivity_unavailable',
    recovery: {
      kind: 'wait',
      next_action: 'wait-external',
      failure_class: 'external-wait',
      reason: 'control_database_connectivity_unavailable',
      recoverable: true,
      persisted: false,
      next_wake_at: new Date(now.getTime() + CONTROL_DATABASE_RETRY_POLICY.resume_after_ms).toISOString(),
      resume_identity: taskId ? `task:${taskId}` : null,
      controller_retry: {
        attempts: error.attempts,
        max_attempts: CONTROL_DATABASE_RETRY_POLICY.max_attempts,
        category: error.category,
        implementation_retry_budget_consumed: 0,
      },
    },
  }
}
