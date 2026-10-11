import { parseActivityQuery } from '../utils/activity'
import type { ActivityRow, AuditStream } from '../utils/activity'
export interface ActivitySource {
  bindingId: string; suit: string; environment: string; stream: AuditStream; nextPage: number
  lastObservedAt: string | null; lastFailedAt: string | null; observedTotal: number | null; coverage: 'partial'
}
interface ActivityPage { items: ActivityRow[]; total: number; sources: ActivitySource[]; coverage: 'partial' }
/** Request-scoped state, cleared on identity/context changes; late responses cannot restore old data. */
export function useActivity(context: () => string, active: () => boolean) {
  const fetch = useRequestFetch()
  const query = reactive(parseActivityQuery({}))
  const rows = ref<ActivityRow[]>([]), sources = ref<ActivitySource[]>([]), total = ref(0)
  const status = ref<'loading' | 'success' | 'empty' | 'error' | 'denied'>('loading')
  const retrieving = ref(false), remoteFailed = ref(false)
  let generation = 0
  async function load() {
    const current = ++generation
    rows.value = []; sources.value = []; total.value = 0; status.value = 'loading'
    if (!active()) return
    try {
      const result = await fetch<ActivityPage>('/api/activity', { query: Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== '')) })
      if (current !== generation || !active()) return
      rows.value = result.items; sources.value = result.sources; total.value = result.total
      status.value = result.items.length ? 'success' : 'empty'
    } catch (cause) {
      if (current !== generation) return
      status.value = [401, 403].includes((cause as { statusCode?: number }).statusCode || 0) ? 'denied' : 'error'
    }
  }
  async function retrieve(source: ActivitySource) {
    if (retrieving.value) return
    const current = generation
    retrieving.value = true; remoteFailed.value = false
    try {
      await fetch('/api/activity', { method: 'POST', body: { bindingId: source.bindingId, stream: source.stream } })
    } catch { if (current === generation) remoteFailed.value = true }
    finally {
      if (current === generation) { retrieving.value = false; if (active()) await load() }
    }
  }
  function apply() { query.page = 1; return load() }
  const queryAdapter = {
    page: (event: { page: number; rows: number }) => { query.page = event.page + 1; query.pageSize = event.rows; void load() },
    sort: (event: { sortOrder?: number | null }) => { query.order = event.sortOrder === 1 ? 'asc' : 'desc'; void apply() },
  }
  watch([context, active], () => {
    ++generation; rows.value = []; sources.value = []; total.value = 0; retrieving.value = false; remoteFailed.value = false
    Object.assign(query, parseActivityQuery({}))
    if (active()) void load()
  }, { immediate: true })
  onScopeDispose(() => { ++generation; rows.value = []; sources.value = [] })
  return { query, rows, sources, total, status, retrieving, remoteFailed, load, apply, retrieve, queryAdapter }
}
