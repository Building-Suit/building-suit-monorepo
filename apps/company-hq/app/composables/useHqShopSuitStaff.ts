import type { HqAgentPresentation } from '@building-suit/ui/types/hqAgentsPresentation'
import { SHOP_SUIT_DEPARTMENT_HEAD, SHOP_SUIT_OFFICE } from '#shared/shopSuitStaff'

type Staff = { employeeId: string; shopName: string; state: 'idle' | 'busy' }
type StaffPage = { status: 'ready' | 'unconfigured' | 'overflow'; staff: Staff[]; next: string | null; observedAt: string | null }

export function useHqShopSuitStaff(isFounder: () => boolean) {
  const live = useHqLiveEvents()
  const staff = shallowRef<Staff[]>([])
  const lastObserved = ref('')
  const status = ref<StaffPage['status'] | 'loading' | 'unavailable'>('loading')
  let current: AbortController | undefined
  let refreshQueued = false

  function reset() {
    current?.abort()
    current = undefined
    refreshQueued = false
    staff.value = []
    lastObserved.value = ''
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
        status.value = result.status
      } while (after && !request.signal.aborted)
      if (request.signal.aborted || !isFounder()) return
      lastObserved.value = observedAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(observedAt)) : ''
      staff.value = [...rows.values()]
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
    const rosterStatus = status.value === 'overflow' ? 'Shop roster exceeds the current display limit'
      : status.value === 'unavailable' ? 'Shop roster refresh unavailable' : 'Runtime verification pending'
    return [{
      ...SHOP_SUIT_DEPARTMENT_HEAD, role: 'agent', roleLabel: 'Department Head',
      managerId: 'AG-CEO-001', managerName: 'Steve', departmentId: SHOP_SUIT_OFFICE.id,
      deskIndex: null, activity: 'unknown', configured: true, connected: false,
      lifecycleLabel: 'Appointed', connectionLabel: rosterStatus,
    }, ...staff.value.map<HqAgentPresentation>(employee => ({
      id: employee.employeeId, name: employee.shopName, role: 'agent', roleLabel: 'Shop Suit employee',
      departmentId: SHOP_SUIT_OFFICE.id, deskIndex: null, managerId: SHOP_SUIT_DEPARTMENT_HEAD.id,
      managerName: SHOP_SUIT_DEPARTMENT_HEAD.name, activity: 'unknown',
      configured: true, connected: false,
      activityLabel: employee.state === 'busy' ? 'Request assigned at last sync' : 'No request assigned at last sync',
      lifecycleLabel: 'Assigned to shop',
      connectionLabel: lastObserved.value ? `Roster synced ${lastObserved.value}` : 'Runtime presence unavailable',
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
