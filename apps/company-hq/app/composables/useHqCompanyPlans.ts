import type { HqCompanyPlansPresentation, HqDepartmentOffice, HqFounderAccessPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import { HQ_PLAN_UUID, parseHqCompanySnapshot, type HqCompanySnapshot } from '../../shared/types/companyPlans'

export interface HqCompanyPlanMessages {
  unavailable: string
  conflict: string
  decisionFailed: string
}

interface DecisionAttempt { planId: string; revision: number; decision: 'approved' | 'rejected'; requestKey: string }
type MessageReason = keyof HqCompanyPlanMessages

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const data = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  const value = data.statusCode ?? data.status ?? data.response?.status
  return typeof value === 'number' ? value : undefined
}

/** Founder-only operation state; approving a plan does not execute its staffing. */
export function useHqCompanyPlans(getAccessStatus: () => HqFounderAccessPresentation['status'], messages?: () => HqCompanyPlanMessages) {
  const snapshot = shallowRef<HqCompanySnapshot | null>(null)
  const status = ref<HqCompanyPlansPresentation['status']>('unavailable')
  const pending = ref(false)
  const messageReason = ref<MessageReason | null>(null)
  const attempts = new Map<string, DecisionAttempt>()
  const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
  let controller: AbortController | null = null
  let inFlight: Promise<boolean> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let epoch = 0
  let mounted = false
  let disposed = false
  let failures = 0

  const workspace = computed<HqCompanyPlansPresentation>(() => ({
    status: status.value,
    pending: pending.value,
    plans: snapshot.value?.plans ?? [],
    ...(messageReason.value && messages ? { message: messages()[messageReason.value] } : {}),
  }))
  const departments = computed<readonly HqDepartmentOffice[]>(() => snapshot.value?.departments ?? [])

  function stopTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function allowed() {
    return mounted && !disposed && getAccessStatus() === 'founder' && navigator.onLine
  }

  function schedule() {
    stopTimer()
    if (!allowed() || document.hidden) return
    timer = setTimeout(() => { void refresh() }, Math.min(120_000, 15_000 * 2 ** failures))
  }

  function invalidate(clearAttempts: boolean, reason: MessageReason | null = null) {
    epoch += 1
    stopTimer()
    controller?.abort()
    controller = null
    inFlight = null
    pending.value = false
    snapshot.value = null
    status.value = 'unavailable'
    messageReason.value = reason
    if (clearAttempts) attempts.clear()
  }

  function apply(result: HqCompanySnapshot) {
    snapshot.value = result
    status.value = 'ready'
    failures = 0
    // A completed/changed plan settles an earlier unknown network outcome.
    for (const [key, attempt] of attempts) {
      const plan = result.plans.find(item => item.id === attempt.planId)
      if (!plan || plan.status !== 'ready' || plan.revision !== attempt.revision) attempts.delete(key)
    }
  }

  function run(attempt?: DecisionAttempt): Promise<boolean> {
    if (!allowed()) return Promise.resolve(false)
    if (inFlight) return attempt ? Promise.resolve(false) : inFlight
    stopTimer()
    const expected = epoch
    const request = new AbortController()
    controller = request
    pending.value = true
    messageReason.value = null
    if (!snapshot.value) status.value = 'loading'
    const task: Promise<boolean> = Promise.resolve().then(async () => {
      try {
        const result = await $fetch<unknown>(attempt ? `/api/hq/plans/${encodeURIComponent(attempt.planId)}/decision` : '/api/hq/company', {
          method: attempt ? 'POST' : 'GET',
          ...(attempt ? { body: { revision: attempt.revision, decision: attempt.decision, requestKey: attempt.requestKey } } : {}),
          headers, credentials: 'same-origin', cache: 'no-store', retry: 0, timeout: 45_000, signal: request.signal,
        })
        if (disposed || expected !== epoch || request.signal.aborted || getAccessStatus() !== 'founder') return false
        const data = parseHqCompanySnapshot(result)
        if (!data) throw new Error('Invalid company snapshot')
        apply(data)
        return true
      }
      catch (error: unknown) {
        if (disposed || expected !== epoch || request.signal.aborted) return false
        const code = errorStatus(error)
        if (attempt && code !== undefined && code >= 400 && code < 500) attempts.delete(`${attempt.planId}:${attempt.revision}:${attempt.decision}`)
        // Remove the whole projection when authority or data cannot be read.
        snapshot.value = null
        status.value = 'unavailable'
        failures = Math.min(failures + 1, 3)
        messageReason.value = code === 409 ? 'conflict' : attempt ? 'decisionFailed' : 'unavailable'
        return false
      }
      finally {
        if (!disposed && expected === epoch) {
          pending.value = false
          if (controller === request) controller = null
          if (inFlight === task) inFlight = null
          schedule()
        }
      }
    })
    inFlight = task
    return task
  }

  function refresh(): Promise<boolean> { return run() }

  function decide(id: string, revision: number, decision: 'approved' | 'rejected'): Promise<boolean> {
    if (!allowed() || inFlight || !HQ_PLAN_UUID.test(id) || !Number.isSafeInteger(revision) || revision < 1
      || decision !== 'approved' && decision !== 'rejected'
      || !snapshot.value?.plans.some(plan => plan.id === id && plan.revision === revision && plan.status === 'ready')) return Promise.resolve(false)
    const key = `${id}:${revision}:${decision}`
    let attempt = attempts.get(key)
    if (!attempt) {
      if (attempts.size >= 256 || typeof crypto.randomUUID !== 'function') {
        messageReason.value = 'decisionFailed'
        return Promise.resolve(false)
      }
      attempt = { planId: id, revision, decision, requestKey: crypto.randomUUID() }
      attempts.set(key, attempt)
    }
    // A network failure retains this exact request key for the same decision.
    return run(attempt)
  }

  function resume() {
    if (document.hidden || !navigator.onLine) { stopTimer(); return }
    if (getAccessStatus() === 'founder') void refresh()
  }

  function offline() { invalidate(false, 'unavailable') }

  watch(getAccessStatus, value => {
    if (value !== 'founder') {
      // Temporary loading/errors clear visible state immediately. Idempotency
      // keys contain no identity/content and survive an uncertain retry; an
      // explicit signed-out/denied transition ends the current owner scope.
      invalidate(value === 'anonymous' || value === 'denied')
      return
    }
    failures = 0
    if (mounted) void refresh()
  }, { immediate: true, flush: 'sync' })

  onMounted(() => {
    mounted = true
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', offline)
    resume()
  })
  onScopeDispose(() => {
    disposed = true
    invalidate(true)
    if (typeof window === 'undefined') return
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', offline)
  })

  return { workspace, departments, refresh, decide }
}
