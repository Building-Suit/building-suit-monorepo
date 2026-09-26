import { scopedQueryKey } from '@building-suit/data-access'
import type { Database, Json } from '~~/types/database.types'
import type { JournalFilterState, JournalSortState } from './useTransactionWorkspace'

export interface JournalSavedView {
  id: string
  name: string
  filters: Partial<JournalFilterState>
  sort: JournalSortState
}

export function useJournalSavedViews() {
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const { currentId } = useTenant()
  const key = computed(() => scopedQueryKey({
    environment: String(config.public.supabase.url),
    portal: 'ledger-suit',
    userId: user.value?.id ?? '',
    tenantId: currentId.value ?? '',
  }, 'journal-saved-views'))

  const { data, pending, error, refresh } = useLazyAsyncData(key, async () => {
    if (!currentId.value || !user.value?.id) return []
    const { data: rows, error: failure } = await supabase
      .from('saved_views')
      .select('id, name, filters, sort')
      .eq('organization_id', currentId.value)
      .eq('created_by', user.value.id)
      .eq('resource', 'journal_center')
      .order('name')
    if (failure) throw failure
    return (rows ?? []).map(row => ({
      id: row.id,
      name: row.name,
      filters: row.filters as Partial<JournalFilterState>,
      sort: row.sort as JournalSortState,
    }))
  }, { default: () => [] as JournalSavedView[] })

  async function save(name: string, state: { filters: JournalFilterState, sort: JournalSortState }) {
    if (!currentId.value || !user.value?.id) throw new Error('Missing journal view scope')
    const filters = Object.fromEntries(Object.entries(state.filters).filter(([, value]) => Boolean(value)))
    const { error: failure } = await supabase.from('saved_views').insert({
      organization_id: currentId.value,
      created_by: user.value.id,
      resource: 'journal_center',
      visibility: 'private',
      name: name.trim(),
      filters: filters as Json,
      sort: state.sort as unknown as Json,
    })
    if (failure) throw failure
    await refresh()
  }

  async function remove(id: string) {
    const { error: failure } = await supabase.from('saved_views').delete().eq('id', id)
    if (failure) throw failure
    await refresh()
  }

  return { views: data, pending, error, refresh, save, remove }
}
