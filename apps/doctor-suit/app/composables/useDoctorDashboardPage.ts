import { usePageRevalidation } from '@building-suit/ux'
import { doctorDashboardCopy } from '../utils/dashboardPresentation'
import { doctorAppointmentsCopy } from '../utils/appointmentsPresentation'
import { doctorContextId } from '../utils/locationContext'
export function useDoctorDashboardPage() {
  const nuxt = useNuxtApp();const context = useDoctorContext();const dashboard = nuxt.$doctorDashboard;const { locale } = useI18n()
  const copy = computed(() => doctorDashboardCopy(locale.value==='ar'));const states = computed(() => doctorAppointmentsCopy(locale.value==='ar').states)
  const pending = ref(false);const hydrated = ref(false);const pages = ref<Record<string,{ page: number; queuePage: number }>>({})
  let queued = false;let queuedContext = false;let stopped = false
  function settled() { pending.value = false;if(queued && !stopped) { const reconcile = queuedContext;queued = queuedContext = false;void read(reconcile) } }
  async function read(reconcileContext = false): Promise<void> {
    if(stopped)return
    if(pending.value) { queued = true;queuedContext ||= reconcileContext;return }
    pending.value = true
    try { if(reconcileContext)await context.refresh();if(!stopped)await dashboard.load(pages.value) } finally { settled() }
  }
  function refresh() { return read(true) }
  onMounted(async () => { hydrated.value = true;await refresh() });onBeforeUnmount(() => { stopped = true;queued = queuedContext = false;dashboard.clear() })
  const key = computed(() => dashboard.scopeKey())
  const optionsKey = computed(() => JSON.stringify(context.state.options.map(option => dashboard.sourceKey(option))))
  watch([key,optionsKey],() => { pages.value = {};dashboard.clear();if(hydrated.value)void read() },{ flush: 'sync' })
  watch(() => context.state.current ? dashboard.sourceKey(context.state.current) : null,() => {
    dashboard.clear()
    if(hydrated.value)void nextTick(() => { if(!stopped && ['ready','choosing'].includes(context.state.phase))void read() })
  },{ flush: 'sync' })
  usePageRevalidation(async () => { await context.refresh();await read() },() => hydrated.value)
  const error = computed(() => dashboard.state.error==='denied' ? copy.value.denied : dashboard.state.error==='conflict' ? copy.value.conflict : dashboard.state.error ? copy.value.error : null)
  const sections = computed(() => dashboard.state.sections.map(({ context: place,board }) => {
    const stamp = (value: string,zone: string) => `${new Intl.DateTimeFormat(locale.value==='ar' ? 'ar-EG' : 'en-GB',{ timeZone: zone,dateStyle: 'medium',timeStyle: 'short' }).format(new Date(value))} · ${zone}`
    const rows = (items: typeof board.items) => items.map(item => ({ id: item.id,patient: item.patientName || copy.value.restricted,time: stamp(item.startsAt,item.timezone),status: states.value[item.state] }))
    return { id: doctorContextId(place),scope: dashboard.sourceKey(place),title: `${place.practiceName} · ${place.locationName}`,window: `${board.date} · ${board.timezone}`,total: board.total,queueTotal: board.queueTotal,page: board.page,queuePage: board.queuePage,items: rows(board.items),queue: rows(board.queue) }
  }))
  async function page(scope: string,value: number,queue = false) { const item = dashboard.state.sections.find(item => dashboard.sourceKey(item.context)===scope);if(!item || pending.value || !Number.isSafeInteger(value) || value<0)return;const id = doctorContextId(item.context);pages.value[id] = { page: queue ? item.board.page : value,queuePage: queue ? value : item.board.queuePage };await refresh() }
  async function source(scope: string,id: string) {
    const item = dashboard.state.sections.find(item => dashboard.sourceKey(item.context)===scope)
    const row = item && [...item.board.items,...item.board.queue].find(row => row.id===id)
    if(!item || !row || pending.value || stopped)return
    const selected = item.context;const day = item.board.date;const page = String(item.board.page);const queuePage = String(item.board.queuePage);pending.value = true
    try {
      await context.refresh()
      if(stopped || !context.state.options.some(option => dashboard.sourceKey(option)===scope))return
      if(!await context.choose(doctorContextId(selected)))return
      if(stopped || !context.state.current || dashboard.sourceKey(context.state.current)!==scope || !context.state.current.capabilities.includes('appointments.read'))return
      await navigateTo({ path: '/appointments',query: { appointment: id,day,page,queuePage,practice: selected.practiceId,location: selected.locationId } })
    } finally { settled() }
  }
  return { dashboard,copy,sections,error,pending,loading: computed(() => !hydrated.value || pending.value || dashboard.state.loading || ['loading','switching'].includes(context.state.phase)),refresh,page,source,refreshedAt: computed(() => dashboard.state.refreshedAt) }
}
