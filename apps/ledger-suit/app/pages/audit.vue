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
</script>

<template>
  <BsStack gap="lg">
    <BsBox as="header">
      <BsHeading :level="1" size="h1">{{ t('audit.title') }}</BsHeading>
      <BsText size="sm" tone="muted">{{ t('audit.subtitle') }}</BsText>
    </BsBox>
    <BsCard v-if="windowUnlimited || windowDays" role="status" as="section" padding="md">
      <BsStack gap="xs">
        <BsText emphasis="semibold">{{ windowUnlimited ? t('audit.windowUnlimited') : t('audit.window', { days: windowDays }) }}</BsText>
        <BsText size="sm" tone="muted">{{ t('audit.stored') }}</BsText>
      </BsStack>
    </BsCard>
    <BsText v-if="errorMessage" role="alert" tone="danger">{{ errorMessage }}</BsText>
    <BsSectionSkeleton v-if="loading" variant="table" :rows="7" />
    <BsEmptyState v-else-if="!rows.length && !errorMessage" :title="t('audit.empty')" />
    <template v-else-if="rows.length">
      <BsCard as="div" padding="none">
        <BsDataTable
          :value="rows"
          row-key="id"
          :columns="[{ key: 'column1', header: (t('audit.date')) }, { key: 'column2', header: (t('audit.actor')) }, { key: 'column3', header: (t('audit.activity')) }, { key: 'column4', header: (t('audit.record')) }, { key: 'column5', header: (t('audit.changes')) }]"
        >
          <template #header-column1>{{ t('audit.date') }}</template>
          <template #cell-column1="{ row }">{{ formatTimestamp(row.created_at) }}</template>
          <template #header-column2>{{ t('audit.actor') }}</template>
          <template #cell-column2="{ row }">
            <BsBox dir="ltr">{{ row.actor_email || t('audit.system') }}</BsBox>
          </template>
          <template #header-column3>{{ t('audit.activity') }}</template>
          <template #cell-column3="{ row }">
            <BsText>{{ activityLabel(row) }}</BsText>
            <BsText dir="ltr" size="xs" tone="muted">{{ row.action }}</BsText>
          </template>
          <template #header-column4>{{ t('audit.record') }}</template>
          <template #cell-column4="{ row }">
            <BsText>{{ entityLabel(row.entity_type) }}</BsText>
            <BsText v-if="row.entity_id" dir="ltr" size="xs" tone="muted">{{ row.entity_id }}</BsText>
          </template>
          <template #header-column5>{{ t('audit.changes') }}</template>
          <template #cell-column5="{ row }">
            <BsDisclosure>
              <template #summary>{{ t('audit.viewChanges') }}</template>
              <BsGrid :columns="1" gap="md">
                <BsBox>
                  <BsText emphasis="semibold">{{ t('audit.before') }}</BsText>
                  <BsCodeBlock dir="ltr">{{ jsonText(row.before_state) }}</BsCodeBlock>
                </BsBox>
                <BsBox>
                  <BsText emphasis="semibold">{{ t('audit.after') }}</BsText>
                  <BsCodeBlock dir="ltr">{{ jsonText(row.after_state) }}</BsCodeBlock>
                </BsBox>
                <BsBox>
                  <BsText emphasis="semibold">{{ t('audit.metadata') }}</BsText>
                  <BsCodeBlock dir="ltr">{{ jsonText(row.metadata) }}</BsCodeBlock>
                </BsBox>
              </BsGrid>
            </BsDisclosure>
          </template>
        </BsDataTable>
      </BsCard>
      <BsInline v-if="hasMore" gap="none" :wrap="false" justify="center">
        <BsButton type="button" :disabled="loadingMore" @click="fetchRows(true)">{{ t('audit.loadMore') }}</BsButton>
      </BsInline>
    </template>
  </BsStack>
</template>
