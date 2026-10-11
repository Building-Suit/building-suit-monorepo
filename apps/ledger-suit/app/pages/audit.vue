<script setup lang="ts">
import type { Database, Json } from '~~/types/database.types'

definePageMeta({ layout: 'default' })

interface AuditRow {
  id: number
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_state: Json | null
  after_state: Json | null
  metadata: Json
  created_at: string
}

interface AuditRpcClient {
  rpc(name: 'audit_history_window', args: { p_organization_id: string }): PromiseLike<{
    data: Array<{ days: number | null, is_unlimited: boolean }> | null
    error: unknown | null
  }>
  rpc(name: 'list_audit_history', args: {
    p_organization_id: string
    p_limit: number
    p_before_created_at?: string
    p_before_id?: number
  }): PromiseLike<{ data: AuditRow[] | null, error: unknown | null }>
}

const PAGE_SIZE = 50
const supabase = useSupabaseClient<Database>()
const auditRpc = supabase as unknown as AuditRpcClient
const { currentId, can } = useTenant()
const { t, te, locale } = useI18n()

useHead({ title: () => `${t('audit.title')} · ${t('app.name')}` })

const rows = shallowRef<AuditRow[]>([])
const windowDays = ref<number | null>(null)
const windowUnlimited = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const errorMessage = ref('')
const hasMore = ref(false)

function localizedPart(group: 'actions' | 'entities', value: string) {
  const key = `audit.${group}.${value}`
  return te(key) ? t(key) : value.replaceAll('_', ' ')
}

function activityLabel(row: AuditRow) {
  const [, verb = row.action] = row.action.split('.', 2)
  return localizedPart('actions', verb)
}

function entityLabel(value: string) {
  return localizedPart('entities', value)
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function jsonText(value: Json | null) {
  return JSON.stringify(value ?? {}, null, 2)
}

async function fetchRows(append = false) {
  if (!currentId.value || !can('audit.read')) {
    rows.value = []
    windowDays.value = null
    windowUnlimited.value = false
    loading.value = false
    return
  }

  if (append) loadingMore.value = true
  else {
    rows.value = []
    windowDays.value = null
    windowUnlimited.value = false
    loading.value = true
  }
  errorMessage.value = ''
  try {
    const last = append ? rows.value.at(-1) : null
    if (!append) {
      const windowResult = await auditRpc.rpc('audit_history_window', {
        p_organization_id: currentId.value,
      })
      if (windowResult.error) throw windowResult.error
      const window = windowResult.data?.[0]
      windowUnlimited.value = window?.is_unlimited ?? false
      windowDays.value = window?.days ?? null
    }

    const historyResult = await auditRpc.rpc('list_audit_history', {
      p_organization_id: currentId.value,
      p_limit: PAGE_SIZE,
      p_before_created_at: last?.created_at,
      p_before_id: last?.id,
    })
    if (historyResult.error) throw historyResult.error

    const next = (historyResult.data ?? []) as AuditRow[]
    rows.value = append ? [...rows.value, ...next] : next
    hasMore.value = next.length === PAGE_SIZE
  }
  catch {
    errorMessage.value = t('audit.loadFailed')
  }
  finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch(currentId, () => fetchRows(), { immediate: true })

const auditViews = computed(() => rows.value.map(row => ({ id: String(row.id), timestamp: formatTimestamp(row.created_at), actor: row.actor_email || t('audit.system'), activity: activityLabel(row), action: row.action, entity: entityLabel(row.entity_type), entityId: row.entity_id ?? undefined, before: jsonText(row.before_state), after: jsonText(row.after_state), metadata: jsonText(row.metadata) })))
const windowLabel = computed(() => windowUnlimited.value ? t('audit.windowUnlimited') : windowDays.value ? t('audit.window', { days: windowDays.value }) : '')
const copy = computed(() => ({
  title: t('audit.title'),
  subtitle: t('audit.subtitle'),
  stored: t('audit.stored'),
  empty: t('audit.empty'),
  date: t('audit.date'),
  actor: t('audit.actor'),
  activity: t('audit.activity'),
  record: t('audit.record'),
  changes: t('audit.changes'),
  viewChanges: t('audit.viewChanges'),
  before: t('audit.before'),
  after: t('audit.after'),
  metadata: t('audit.metadata'),
  loadMore: t('audit.loadMore'),
}))
</script>
<template>
  <BsAuditHistoryPage :items="auditViews" :copy="copy" :window-label="windowLabel" :error-message="errorMessage" :loading="loading" :loading-more="loadingMore" :has-more="hasMore" @load-more="fetchRows(true)" />
</template>
