import type { BrainIndex, BrainNote, BrainNoteSummary } from '../../shared/types/brain'
import type { HqBrainPresentation } from '@building-suit/ui/types/hqLayoutPresentation'

/** Cloud reads happen through the private HQ server; no filesystem or persistent client cache. */
export function useCompanyBrain() {
  const live = useHqLiveEvents()
  const { locale } = useI18n()
  const index = shallowRef<BrainIndex | null>(null)
  const note = shallowRef<BrainNote | null>(null)
  const status = ref<HqBrainPresentation['status']>('unavailable')
  const reason = ref<HqBrainPresentation['reason']>(null)
  const refreshing = ref(false)
  const lastSuccessfulCheck = ref<string | null>(null)
  const noteStatus = ref<HqBrainPresentation['noteStatus']>('idle')
  const selectedId = ref<string | null>(null)
  let indexRequest: AbortController | null = null
  let noteRequest: AbortController | null = null
  let inFlight: Promise<void> | null = null
  let refreshQueued = false
  let epoch = 0
  let disposed = false
  const headers = { 'X-HQ-Brain': '1', 'X-HQ-Access': '1' }
  const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }))
  const formatDate = (value: string) => dateFormatter.value.format(new Date(value))
  const summary = (value: BrainNoteSummary) => ({ id: value.id, title: value.title, path: value.path, modifiedLabel: formatDate(value.modifiedAt), version: value.version.split(':', 1)[0] || value.version })
  // Status and selection changes do not need to format the entire directory.
  const notes = computed(() => index.value?.notes.map(summary) ?? [])
  const brain = computed<HqBrainPresentation>(() => ({
    status: status.value,
    reason: reason.value,
    refreshing: refreshing.value,
    notes: notes.value,
    observedLabel: lastSuccessfulCheck.value ? formatDate(lastSuccessfulCheck.value) : '',
    partial: index.value?.partial ?? false,
    selectedId: selectedId.value,
    noteStatus: noteStatus.value,
    note: note.value ? { ...summary(note.value), content: note.value.content } : null,
  }))

  function clearNotes() {
    noteRequest?.abort()
    index.value = null
    note.value = null
    selectedId.value = null
    noteStatus.value = 'idle'
  }

  async function selectNote(id: string) {
    if (disposed || status.value !== 'connected' || !index.value?.notes.some(item => item.id === id)) return
    noteRequest?.abort()
    const request = new AbortController()
    noteRequest = request
    selectedId.value = id
    note.value = null
    noteStatus.value = 'loading'
    try {
      const result = await $fetch<BrainNote>(`/api/brain/notes/${encodeURIComponent(id)}`, { headers, credentials: 'same-origin', signal: request.signal, cache: 'no-store', retry: 0, timeout: 45_000 })
      if (request.signal.aborted || disposed) return
      note.value = result
      noteStatus.value = 'ready'
    }
    catch { if (!request.signal.aborted && !disposed) noteStatus.value = 'error' }
    finally { if (noteRequest === request) noteRequest = null }
  }

  function refresh(): Promise<void> {
    if (disposed || typeof window === 'undefined' || !navigator.onLine) return Promise.resolve()
    if (inFlight) { refreshQueued = true; return inFlight }
    const request = new AbortController()
    const expected = epoch
    indexRequest = request
    refreshing.value = true
    if (!index.value) status.value = 'loading'
    const task: Promise<void> = Promise.resolve().then(async () => {
      try {
        const result = await $fetch<BrainIndex>('/api/brain', { headers, credentials: 'same-origin', signal: request.signal, cache: 'no-store', retry: 0, timeout: 45_000 })
        if (request.signal.aborted || disposed || expected !== epoch) return
        reason.value = result.reason ?? null
        status.value = result.status
        if (result.status !== 'connected') {
          clearNotes()
          return
        }
        index.value = result
        lastSuccessfulCheck.value = result.observedAt
        const selected = result.notes.find(item => item.id === selectedId.value)
        if (selectedId.value && !selected) {
          noteRequest?.abort()
          selectedId.value = null
          note.value = null
          noteStatus.value = 'idle'
        }
        else if (selected && (note.value?.version !== selected.version || noteStatus.value === 'error')) await selectNote(selected.id)
      }
      catch {
        if (request.signal.aborted || disposed || expected !== epoch) return
        reason.value = 'cloud-unavailable'
        status.value = 'error'
        clearNotes()
      }
      finally {
        if (!disposed && expected === epoch) {
          refreshing.value = false
          if (indexRequest === request) indexRequest = null
          if (inFlight === task) inFlight = null
          if (refreshQueued) { refreshQueued = false; void refresh() }
        }
      }
    })
    inFlight = task
    return task
  }

  function clearProjection(offline: boolean) {
    epoch += 1
    indexRequest?.abort()
    indexRequest = null
    inFlight = null
    refreshQueued = false
    refreshing.value = false
    lastSuccessfulCheck.value = null
    clearNotes()
    status.value = offline ? 'error' : 'unavailable'
    reason.value = offline ? 'cloud-unavailable' : null
  }
  // Anonymous content is fetched only by explicit open/refresh actions.
  // Founder snapshots and subsequent reads are driven by the shared stream.
  live.subscribe('brain', refresh, reason => clearProjection(reason === 'offline'))
  onScopeDispose(() => {
    disposed = true
    clearProjection(false)
  })
  return { brain, refresh, selectNote }
}
