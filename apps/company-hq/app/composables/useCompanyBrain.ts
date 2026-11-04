import type { BrainIndex, BrainNote, BrainNoteSummary } from '../../shared/types/brain'
import type { HqBrainPresentation } from '@building-suit/ui/types/hqLayoutPresentation'

const REFRESH_INTERVAL_MS = 15_000

/** Cloud reads happen through the private HQ server; no filesystem or persistent client cache. */
export function useCompanyBrain() {
  const { locale } = useI18n()
  const index = shallowRef<BrainIndex | null>(null)
  const note = shallowRef<BrainNote | null>(null)
  const status = ref<HqBrainPresentation['status']>('loading')
  const reason = ref<HqBrainPresentation['reason']>(null)
  const refreshing = ref(false)
  const lastSuccessfulCheck = ref<string | null>(null)
  const noteStatus = ref<HqBrainPresentation['noteStatus']>('idle')
  const selectedId = ref<string | null>(null)
  let indexRequest: AbortController | null = null
  let noteRequest: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let failures = 0
  const headers = { 'X-HQ-Brain': '1' }
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
      const result = await $fetch<BrainNote>(`/api/brain/notes/${encodeURIComponent(id)}`, { headers, signal: request.signal, cache: 'no-store', retry: 0 })
      if (request.signal.aborted || disposed) return
      note.value = result
      noteStatus.value = 'ready'
    }
    catch { if (!request.signal.aborted && !disposed) noteStatus.value = 'error' }
  }

  function stopTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  function scheduleRefresh() {
    stopTimer()
    if (disposed || document.hidden || !navigator.onLine) return
    const delay = Math.min(120_000, REFRESH_INTERVAL_MS * 2 ** failures)
    timer = setTimeout(() => { void refresh() }, delay)
  }

  async function refresh() {
    if (disposed || refreshing.value) return
    stopTimer()
    const request = new AbortController()
    indexRequest = request
    refreshing.value = true
    if (!index.value) status.value = 'loading'
    try {
      const result = await $fetch<BrainIndex>('/api/brain', { headers, signal: request.signal, cache: 'no-store', retry: 0 })
      if (request.signal.aborted || disposed) return
      reason.value = result.reason ?? null
      status.value = result.status
      if (result.status !== 'connected') {
        failures = Math.min(failures + 1, 3)
        clearNotes()
        return
      }
      failures = 0
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
      if (request.signal.aborted || disposed) return
      failures = Math.min(failures + 1, 3)
      reason.value = 'cloud-unavailable'
      status.value = 'error'
      clearNotes()
    }
    finally {
      if (!disposed) {
        refreshing.value = false
        indexRequest = null
        scheduleRefresh()
      }
    }
  }

  function resume() {
    if (document.hidden || !navigator.onLine) { stopTimer(); return }
    void refresh()
  }
  function goOffline() {
    stopTimer()
    indexRequest?.abort()
    clearNotes()
    status.value = 'error'
    reason.value = 'cloud-unavailable'
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', goOffline)
    resume()
  })
  onScopeDispose(() => {
    disposed = true
    stopTimer()
    indexRequest?.abort()
    noteRequest?.abort()
    index.value = null
    note.value = null
    if (typeof window === 'undefined') return
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', goOffline)
  })
  return { brain, refresh, selectNote }
}
