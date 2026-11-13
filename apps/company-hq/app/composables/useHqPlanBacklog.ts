import type { HqBacklogPlan, HqCompanyPlansPresentation } from '@building-suit/ui/types/hqLayoutPresentation'

export function useHqPlanBacklog(hasAccess: () => boolean) {
  const live = useHqLiveEvents()
  const open = ref(false)
  const backlog = shallowRef<NonNullable<HqCompanyPlansPresentation['backlog']>>({ status: 'loading', plans: [] })
  let request: AbortController | undefined

  function clear(status: 'loading' | 'unavailable' = 'loading') {
    request?.abort()
    request = undefined
    backlog.value = { status, plans: [] }
  }

  async function refresh() {
    if (!open.value || !hasAccess() || !navigator.onLine) return
    request?.abort()
    const current = new AbortController()
    request = current
    try {
      const plans = await $fetch<HqBacklogPlan[]>('/api/hq/plans/backlog', {
        headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
        credentials: 'same-origin',
        cache: 'no-store',
        retry: 0,
        timeout: 30_000,
        signal: current.signal,
      })
      if (request === current) backlog.value = { status: 'ready', plans }
    }
    catch (error: unknown) {
      if (request !== current) return
      clear('unavailable')
      const status = (error as { statusCode?: number } | null)?.statusCode
      if (status === 401 || status === 403) live.invalidate('access')
    }
    finally {
      if (request === current) request = undefined
    }
  }

  function setOpen(value: boolean) {
    open.value = value
    if (!value) clear()
    else if (hasAccess() && !navigator.onLine) clear('unavailable')
    else void refresh()
  }

  watch(hasAccess, authorized => {
    if (!authorized) clear()
    else if (open.value) setOpen(true)
  }, { flush: 'sync' })
  live.subscribe('brain', refresh, reason => clear(reason === 'offline' ? 'unavailable' : 'loading'))
  onScopeDispose(() => clear())
  return { backlog, setOpen, refresh }
}
