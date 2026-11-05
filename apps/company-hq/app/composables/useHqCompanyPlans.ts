import type { HqCompanyPlansPresentation, HqDepartmentOffice, HqFounderAccessPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import { HQ_PLAN_UUID, parseHqCompanySnapshot, type HqCompanySnapshot } from '#shared/types/companyPlans'

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
  const live = useHqLiveEvents()
  const snapshot = shallowRef<HqCompanySnapshot | null>(null)
  const status = ref<HqCompanyPlansPresentation['status']>('unavailable')
  const pending = ref(false)
  const messageReason = ref<MessageReason | null>(null)
  const attempts = new Map<string, DecisionAttempt>()
  const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
  let controller: AbortController | null = null
  let inFlight: Promise<boolean> | null = null
  let refreshQueued = false
  let epoch = 0
  let mounted = false
  let disposed = false

  const workspace = computed<HqCompanyPlansPresentation>(() => ({
    status: status.value,
    pending: pending.value,
    plans: snapshot.value?.plans ?? [],
    ...(messageReason.value && messages ? { message: messages()[messageReason.value] } : {}),
  }))
  const departments = computed<readonly HqDepartmentOffice[]>(() => snapshot.value?.departments ?? [])

  function allowed() {
    return mounted && !disposed && getAccessStatus() === 'founder' && navigator.onLine
  }

  function invalidate(clearAttempts: boolean, reason: MessageReason | null = null) {
    epoch += 1
    controller?.abort()
    controller = null
    inFlight = null
    refreshQueued = false
    pending.value = false
    snapshot.value = null
    status.value = 'unavailable'
    messageReason.value = reason
    if (clearAttempts) attempts.clear()
  }

  function apply(result: HqCompanySnapshot) {
    snapshot.value = result
    status.value = 'ready'
    // A completed/changed plan settles an earlier unknown network outcome.
    for (const [key, attempt] of attempts) {
      const plan = result.plans.find(item => item.id === attempt.planId)
      if (!plan || plan.status !== 'ready' || plan.revision !== attempt.revision) attempts.delete(key)
    }
  }

  function run(attempt?: DecisionAttempt): Promise<boolean> {
    if (!allowed()) return Promise.resolve(false)
    if (inFlight) return attempt ? Promise.resolve(false) : inFlight
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
        if (code === 401 || code === 403) live.invalidate('access')
        if (attempt && code !== undefined && code >= 400 && code < 500) attempts.delete(`${attempt.planId}:${attempt.revision}:${attempt.decision}`)
        // Remove the whole projection when authority or data cannot be read.
        snapshot.value = null
        status.value = 'unavailable'
        messageReason.value = code === 409 ? 'conflict' : attempt ? 'decisionFailed' : 'unavailable'
        return false
      }
      finally {
        if (!disposed && expected === epoch) {
          pending.value = false
          if (controller === request) controller = null
          if (inFlight === task) inFlight = null
          if (refreshQueued) {
            refreshQueued = false
            if (allowed()) void refresh()
          }
        }
      }
    })
    inFlight = task
    return task
  }

  function refresh(): Promise<boolean> {
    if (inFlight) { refreshQueued = true; return inFlight }
    return run()
  }

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

  // Actual plan/department/roster changes publish company. Brain knowledge and
  // worker-presence updates do not require reading this independent snapshot.
  live.subscribe('company', refresh, reason => invalidate(false, reason === 'offline' ? 'unavailable' : null))
  watch(getAccessStatus, value => {
    if (value !== 'founder') {
      // Temporary loading/errors clear visible state immediately. Idempotency
      // keys contain no identity/content and survive an uncertain retry; an
      // explicit signed-out/denied transition ends the current owner scope.
      invalidate(value === 'anonymous' || value === 'denied')
      return
    }
  }, { immediate: true, flush: 'sync' })

  onMounted(() => {
    mounted = true
  })
  onScopeDispose(() => {
    disposed = true
    invalidate(true)
  })

  return { workspace, departments, refresh, decide }
}
