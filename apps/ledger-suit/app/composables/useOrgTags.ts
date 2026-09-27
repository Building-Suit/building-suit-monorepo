import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

export function useOrgTags() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const config = useRuntimeConfig()
  const { currentId, can } = useTenant()
  const { revision } = useOperationsCenter()
  const key = computed(() => `org:${scopedQueryKey({
    environment: String(config.public.supabase.url),
    portal: 'ledger-suit',
    userId: user.value?.id ?? '',
    tenantId: currentId.value ?? '',
  }, 'tags')}`)
  const result = useLazyAsyncData(key, async (_app, { signal }) => {
    const requestKey = key.value
    const organizationId = currentId.value
    if (!organizationId || !can('tags.read')) return { key: requestKey, rows: [] }
    const rows = await fetchAccountPages<{ id: string, name: string, color: string | null }>((from, to) => supabase
      .from('tags')
      .select('id,name,color', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('name')
      .order('id')
      .range(from, to)
      .abortSignal(signal), signal)
    return { key: requestKey, rows }
  }, { default: () => ({ key: '', rows: [] }), watch: [() => revision.value.tags] })

  return {
    ...result,
    data: computed(() => result.data.value?.key === key.value ? result.data.value.rows : []),
  }
}
