import type { HqAgentPresentation } from '@building-suit/ui/types/hqAgentsPresentation'
import { SHOP_SUIT_DEPARTMENT_HEAD, SHOP_SUIT_OFFICE } from '#shared/shopSuitStaff'

type Staff = { employeeId: string; shopName: string; state: 'idle' | 'busy' }
type StaffPage = { status: 'ready' | 'unconfigured'; staff: Staff[]; next: string | null }

export function useHqShopSuitStaff(isFounder: () => boolean) {
  const staff = shallowRef<Staff[]>([])
  const status = ref<'loading' | 'ready' | 'unconfigured' | 'unavailable'>('loading')
  let current: AbortController | undefined

  function reset() {
    current?.abort()
    current = undefined
    staff.value = []
    status.value = 'loading'
  }

  async function refresh() {
    if (!import.meta.client || !isFounder() || current) return
    const request = new AbortController()
    current = request
    const rows = new Map<string, Staff>()
    let after: string | null = null
    try {
      do {
        const result: StaffPage = await $fetch('/api/hq/shop-suit-staff', {
          headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
          query: after ? { after } : undefined, signal: request.signal, timeout: 12_000,
        })
        if (request.signal.aborted || !isFounder()) return
        for (const employee of result.staff) {
          if (rows.has(employee.employeeId)) throw new Error('Repeated employee')
          rows.set(employee.employeeId, employee)
        }
        status.value = result.status
        after = result.next
        staff.value = [...rows.values()]
      } while (after && !request.signal.aborted)
    } catch {
      if (!request.signal.aborted) {
        staff.value = []
        status.value = 'unavailable'
      }
    } finally {
      if (current === request) current = undefined
    }
  }

  const agents = computed<HqAgentPresentation[]>(() => {
    if (!isFounder()) return []
    return [{
      ...SHOP_SUIT_DEPARTMENT_HEAD, role: 'agent', roleLabel: 'Department Head',
      managerId: 'AG-CEO-001', managerName: 'Steve', departmentId: SHOP_SUIT_OFFICE.id,
      deskIndex: null, activity: 'unknown', configured: true, connected: false,
      lifecycleLabel: 'Appointed', connectionLabel: 'Runtime verification pending',
    }, ...staff.value.map<HqAgentPresentation>(employee => ({
      id: employee.employeeId, name: employee.shopName, role: 'agent', roleLabel: 'Shop Suit employee',
      departmentId: SHOP_SUIT_OFFICE.id, deskIndex: null, managerId: SHOP_SUIT_DEPARTMENT_HEAD.id,
      managerName: SHOP_SUIT_DEPARTMENT_HEAD.name, activity: 'unknown',
      configured: true, connected: false,
      activityLabel: employee.state === 'busy' ? 'Request assigned' : 'No request assigned',
      lifecycleLabel: 'Assigned to shop', connectionLabel: 'Runtime presence unavailable',
    }))]
  })
  const department = computed(() => isFounder() ? {
    ...SHOP_SUIT_OFFICE,
    ...(status.value === 'ready' ? { agents: [{ id: SHOP_SUIT_DEPARTMENT_HEAD.id, name: SHOP_SUIT_DEPARTMENT_HEAD.name }] } : {}),
  } : null)

  onMounted(() => { void refresh() })
  watch(isFounder, active => { if (active) void refresh(); else reset() }, { flush: 'sync' })
  onScopeDispose(reset)

  return { department, agents, refresh }
}
