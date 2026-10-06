import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerTransactionTagsView(_values: ({ transactionId: string | null }) & { selected?: unknown; pending?: unknown }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const transactionId = computed(() => _props.transactionId)
const props = _props
const emit = _emit as <K extends keyof ({ changed: [] })>(event: K, ...args: ({ changed: [] })[K]) => void
const selected = computed<string>({ get: () => (_values.selected ?? '') as string, set: value => _emit('update:selected', value) })
const busy = computed<boolean>({ get: () => (_values.pending ?? false) as boolean, set: value => _emit('update:pending', value) })
const { t } = useI18n()
const { can, currentId } = useTenant()
const { writesAllowed } = useBilling()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const supabase = useSupabaseClient<Database>()
const describeError = useErrorMessage()
const { data: tags, pending: tagsPending, error: tagsError, refresh: refreshOptions } = useOrgTags()
const canManage = computed(() => writesAllowed.value && can('transactions.create') && can('tags.read'))
const failure = ref('')
const key = computed(() => `org:${scopedQueryKey({
  environment: String(config.public.supabase.url), portal: 'ledger-suit',
  userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'transaction-tags', { transactionId: props.transactionId ?? '' })}`)

const { data, pending, error, refresh } = useLazyAsyncData(key, async (_app, { signal }) => {
  const requestKey = key.value
  const organizationId = currentId.value
  if (!props.transactionId || !organizationId || !can('tags.read')) return { key: requestKey, rows: [] }
  const { data: rows, error } = await supabase
    .from('transaction_tags')
    .select('tag_id,tags(id,name,color)')
    .eq('organization_id', organizationId)
    .eq('transaction_id', props.transactionId)
    .abortSignal(signal)
  if (error) throw error
  return { key: requestKey, rows: rows ?? [] }
}, { default: () => ({ key: '', rows: [] }) })

const assigned = computed(() => data.value?.key === key.value ? data.value.rows : [])
const available = computed(() => tags.value.filter(tag => !assigned.value.some(row => row.tag_id === tag.id)))
watch(key, () => { selected.value = ''; failure.value = ''; busy.value = false }, { flush: 'sync' })

async function changeTag(tagId: string, remove = false) {
  const transactionId = props.transactionId
  const organizationId = currentId.value
  if (!transactionId || !organizationId || !tagId || busy.value || !canManage.value) return
  const requestKey = key.value
  busy.value = true
  failure.value = ''
  try {
    const result = remove
      ? await supabase.from('transaction_tags').delete().eq('organization_id', organizationId).eq('transaction_id', transactionId).eq('tag_id', tagId)
      : await supabase.from('transaction_tags').insert({ organization_id: organizationId, transaction_id: transactionId, tag_id: tagId, created_by: user.value?.id })
    if (requestKey !== key.value) return
    if (result.error && !(result.error.code === '23505' && !remove)) throw result.error
    selected.value = ''
    await refresh()
    if (requestKey === key.value) emit('changed')
  }
  catch (cause) {
    if (requestKey === key.value) failure.value = describeError(cause)
  }
  finally {
    if (requestKey === key.value) busy.value = false
  }
}
return { selected, pending, scopedQueryKey, props, emit, busy, t, can, currentId, writesAllowed, user, config, supabase, describeError, tags, tagsPending, tagsError, refreshOptions, canManage, failure, key, data, error, refresh, assigned, available, changeTag, transactionId }
}
