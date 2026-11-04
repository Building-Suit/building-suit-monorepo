import type { BrainIndex, BrainNote, BrainNoteSummary } from '../../shared/types/brain'
import type { HqBrainPresentation } from '@building-suit/ui/types/hqLayoutPresentation'

/** Client-owned, read-only projection. Notes are never included in SSR payloads or persistent caches. */
export function useCompanyBrain() {
  const { locale } = useI18n()
  const index = shallowRef<BrainIndex | null>(null)
  const note = shallowRef<BrainNote | null>(null)
  const status = ref<HqBrainPresentation['status']>('loading')
  const noteStatus = ref<HqBrainPresentation['noteStatus']>('idle')
  const selectedId = ref<string | null>(null)
  let indexRequest: AbortController | null = null
  let noteRequest: AbortController | null = null
  const headers = { 'X-HQ-Brain': '1' }
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const summary = (value: BrainNoteSummary) => ({ id: value.id, title: value.title, path: value.path, modifiedLabel: formatDate(value.modifiedAt) })
  const brain = computed<HqBrainPresentation>(() => ({
    status: status.value,
    notes: index.value?.notes.map(summary) ?? [],
    observedLabel: index.value ? formatDate(index.value.observedAt) : '',
    partial: index.value?.partial ?? false,
    selectedId: selectedId.value,
    noteStatus: noteStatus.value,
    note: note.value ? { ...summary(note.value), content: note.value.content } : null,
  }))

  async function selectNote(id: string) {
    if (status.value !== 'connected' || !index.value?.notes.some(item => item.id === id)) return
    noteRequest?.abort()
    const request = new AbortController()
    noteRequest = request
    selectedId.value = id
    note.value = null
    noteStatus.value = 'loading'
    try {
      const result = await $fetch<BrainNote>(`/api/brain/notes/${encodeURIComponent(id)}`, { headers, signal: request.signal, cache: 'no-store' })
      if (request.signal.aborted) return
      note.value = result
      noteStatus.value = 'ready'
    }
    catch { if (!request.signal.aborted) noteStatus.value = 'error' }
  }

  async function refresh() {
    indexRequest?.abort()
    noteRequest?.abort()
    const request = new AbortController()
    indexRequest = request
    const previousId = selectedId.value
    index.value = null
    note.value = null
    selectedId.value = null
    noteStatus.value = 'idle'
    status.value = 'loading'
    try {
      const result = await $fetch<BrainIndex>('/api/brain', { headers, signal: request.signal, cache: 'no-store' })
      if (request.signal.aborted) return
      index.value = result
      status.value = result.status
      if (previousId && result.notes.some(item => item.id === previousId)) await selectNote(previousId)
    }
    catch { if (!request.signal.aborted) status.value = 'error' }
  }
  onMounted(refresh)
  onScopeDispose(() => { indexRequest?.abort(); noteRequest?.abort(); index.value = null; note.value = null })
  return { brain, refresh, selectNote }
}
