import type { HqAgentPresentation } from '@building-suit/ui/types/hqAgentsPresentation'
import { SHOP_SUIT_DEPARTMENT_HEAD, SHOP_SUIT_OFFICE } from '#shared/shopSuitStaff'

type Staff = { employeeId: string; shopName: string; state: 'idle' | 'busy' }
type StaffPage = { status: 'ready' | 'unconfigured' | 'overflow'; staff: Staff[]; next: string | null; observedAt: string | null }

export function useHqShopSuitStaff(isFounder: () => boolean) {
  const { t, locale } = useI18n()
  const live = useHqLiveEvents()
  const staff = shallowRef<Staff[]>([])
  const lastObserved = ref<string | null>(null)
  const status = ref<StaffPage['status'] | 'loading' | 'unavailable'>('loading')
  let current: AbortController | undefined
  let refreshQueued = false

  function reset() {
    current?.abort()
    current = undefined
    refreshQueued = false
    staff.value = []
    lastObserved.value = null
    status.value = 'loading'
  }

  async function refresh() {
    if (!import.meta.client || !isFounder()) return
    if (current) { refreshQueued = true; return }
    const request = new AbortController()
    current = request
    const rows = new Map<string, Staff>()
    let after: string | null = null
    let observedAt: string | null = null
    let nextStatus: StaffPage['status'] = 'unconfigured'
    try {
      do {
        const result: StaffPage = await $fetch('/api/hq/shop-suit-staff', {
          headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
          query: after ? { after } : undefined, signal: request.signal, timeout: 12_000,
        })
        if (request.signal.aborted || !isFounder()) return
        if (after && observedAt !== result.observedAt) throw new Error('Shop roster changed during refresh')
        observedAt = result.observedAt
        for (const employee of result.staff) {
          if (rows.has(employee.employeeId)) throw new Error('Repeated employee')
          rows.set(employee.employeeId, employee)
        }
        after = result.next
        nextStatus = result.status
      } while (after && !request.signal.aborted)
      if (request.signal.aborted || !isFounder()) return
      lastObserved.value = observedAt
      staff.value = [...rows.values()]
      status.value = nextStatus
    } catch {
      if (!request.signal.aborted) {
        status.value = 'unavailable'
      }
    } finally {
      if (current === request) {
        current = undefined
        if (refreshQueued) { refreshQueued = false; void refresh() }
      }
    }
  }

  const agents = computed<HqAgentPresentation[]>(() => {
    if (!isFounder()) return []
    const syncedLabel = lastObserved.value
      ? t('hq.agents.shopRoster.lastSync', { time: new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
      }).format(new Date(lastObserved.value)) })
      : t('hq.agents.shopRoster.unconfigured')
    const rosterStatus = status.value === 'ready' ? syncedLabel : t(`hq.agents.shopRoster.${status.value}`)
    return [{
      ...SHOP_SUIT_DEPARTMENT_HEAD, role: 'agent', roleLabel: t('hq.agents.shopRoster.head'),
      managerId: 'AG-CEO-001', managerName: 'Steve', departmentId: SHOP_SUIT_OFFICE.id,
      deskIndex: null, activity: 'unknown', configured: true, connected: false,
      activityLabel: t('hq.agents.shopRoster.appointed'), lifecycleLabel: t('hq.agents.shopRoster.appointed'),
      connectionLabel: rosterStatus,
    }, ...staff.value.map<HqAgentPresentation>(employee => ({
      id: employee.employeeId, name: employee.shopName, role: 'agent', roleLabel: t('hq.agents.shopRoster.employee'),
      departmentId: SHOP_SUIT_OFFICE.id, deskIndex: null, managerId: SHOP_SUIT_DEPARTMENT_HEAD.id,
      managerName: SHOP_SUIT_DEPARTMENT_HEAD.name, activity: 'unknown',
      configured: true, connected: false,
      activityLabel: t(`hq.agents.shopRoster.${employee.state}`),
      lifecycleLabel: t('hq.agents.shopRoster.assigned'),
      connectionLabel: syncedLabel,
    }))]
  })
  const department = computed(() => isFounder() ? {
    ...SHOP_SUIT_OFFICE,
    ...(status.value === 'ready' ? { agents: [{ id: SHOP_SUIT_DEPARTMENT_HEAD.id, name: SHOP_SUIT_DEPARTMENT_HEAD.name }] } : {}),
  } : null)

  live.subscribe('company', refresh, reset)
  onMounted(() => { if (isFounder()) void refresh() })
  watch(isFounder, active => { if (active) void refresh(); else reset() }, { flush: 'sync' })
  onScopeDispose(reset)

  return { department, agents, refresh }
}
