<script setup lang="ts">
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

const props = defineProps<{ transactionId: string | null }>()
const emit = defineEmits<{ changed: [] }>()
const selected = defineModel<string>('selected', { default: '' })
const busy = defineModel<boolean>('pending', { default: false })
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
</script>

<template>
  <section v-if="can('tags.read')" aria-labelledby="transaction-tags-heading" class="space-y-3">
    <div>
      <h3 id="transaction-tags-heading" class="font-bold">{{ t('operations.tabs.tags') }}</h3>
      <p class="mt-1 text-sm text-fg-muted">{{ t('tagsGuide.detailHint') }}</p>
    </div>
    <p v-if="pending || tagsPending" role="status" class="text-sm text-fg-muted">{{ t('app.loading') }}</p>
    <div v-else-if="error || tagsError" role="alert" class="ls-error">
      {{ t('tagsGuide.loadError') }}
      <button type="button" class="ls-btn ls-btn-sm ms-2" @click="refresh(); refreshOptions()">{{ t('accounts.retry') }}</button>
    </div>
    <template v-else>
      <ul v-if="assigned.length" class="flex flex-wrap gap-2" :aria-label="t('tagsGuide.assigned')">
        <li v-for="row in assigned" :key="row.tag_id" class="inline-flex max-w-full items-center gap-2 rounded-control border border-line bg-surface-muted px-3 py-1 text-sm">
          <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: row.tags?.color ?? 'var(--bs-primary)' }" />
          <span class="break-words">{{ row.tags?.name }}</span>
          <button v-if="canManage" type="button" class="ls-btn ls-btn-sm" :disabled="busy" :aria-label="t('tagsGuide.remove', { name: row.tags?.name })" @click="changeTag(row.tag_id, true)"><AppIcon name="close" :size="14" /></button>
        </li>
      </ul>
      <p v-else class="text-sm text-fg-muted">{{ t('tagsGuide.noneAssigned') }}</p>
      <div v-if="canManage && available.length" class="flex flex-wrap items-end gap-2">
        <FloatingField class="min-w-0 flex-1" :label="t('tagsGuide.choose')">
          <select id="transaction-tag" v-model="selected" class="ls-input" :disabled="busy">
            <option value="">{{ t('tagsGuide.choose') }}</option>
            <option v-for="tag in available" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
          </select>
        </FloatingField>
        <button type="button" class="ls-btn" :disabled="!selected || busy" @click="changeTag(selected)">{{ t('operations.assign') }}</button>
      </div>
      <p v-if="!tags.length" class="text-sm text-fg-muted">{{ t('tagsGuide.noOptions') }}</p>
      <p v-if="failure" role="alert" class="ls-error">{{ failure }}</p>
    </template>
  </section>
</template>
