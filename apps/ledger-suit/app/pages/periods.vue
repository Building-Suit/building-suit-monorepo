<script setup lang="ts">
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: 'default' })
type Period = Database['public']['Tables']['accounting_periods']['Row']
type Transition = Database['public']['Tables']['accounting_period_transitions']['Row']
type YearClose = Database['public']['Tables']['fiscal_year_closes']['Row']
type PeriodStatus = Database['public']['Enums']['accounting_period_status']

const supabase = useSupabaseClient<Database>()
const { currentId, can } = useTenant()
const { t, locale } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const pendingAction = ref('')
const actionReason = reactive<Record<string, string>>({})
const createForm = reactive({ start: '', end: '' })
const createOpen = ref(false)
const createError = ref('')
const { dirty: createDirty } = useRecordAction(() => createForm, computed(() => createOpen.value))
const closeForm = reactive({ fiscalYearStart: '', reason: '' })

watch(currentId, () => {
  pendingAction.value = ''
  for (const key of Object.keys(actionReason)) Reflect.deleteProperty(actionReason, key)
  Object.assign(createForm, { start: '', end: '' })
  createOpen.value = false
  createError.value = ''
  Object.assign(closeForm, { fiscalYearStart: '', reason: '' })
}, { flush: 'sync' })

useHead({ title: () => `${t('periods.title')} · ${t('app.name')}` })

const key = computed(() => `org:periods:${currentId.value ?? ''}`)
const { data, pending, error, refresh } = useLazyAsyncData(key, async () => {
  if (!currentId.value || !can('periods.read')) return { periods: [], transitions: [], closes: [], fiscalMonth: 1 }
  const [periodResult, transitionResult, closeResult, organizationResult] = await Promise.all([
    supabase.from('accounting_periods').select('*').eq('organization_id', currentId.value).order('start_date', { ascending: false }),
    supabase.from('accounting_period_transitions').select('*').eq('organization_id', currentId.value).order('transitioned_at', { ascending: false }),
    supabase.from('fiscal_year_closes').select('*').eq('organization_id', currentId.value).order('fiscal_year_start', { ascending: false }),
    supabase.from('organizations').select('fiscal_year_start_month').eq('id', currentId.value).single(),
  ])
  for (const result of [periodResult, transitionResult, closeResult, organizationResult]) if (result.error) throw result.error
  return {
    periods: (periodResult.data ?? []) as Period[],
    transitions: (transitionResult.data ?? []) as Transition[],
    closes: (closeResult.data ?? []) as YearClose[],
    fiscalMonth: organizationResult.data?.fiscal_year_start_month ?? 1,
  }
}, { default: () => ({ periods: [] as Period[], transitions: [] as Transition[], closes: [] as YearClose[], fiscalMonth: 1 }) })

const periods = computed(() => data.value?.periods ?? [])
const today = new Date().toISOString().slice(0, 10)
const currentPeriod = computed(() => periods.value.find(period => period.start_date <= today && period.end_date >= today))
const transitions = computed(() => data.value?.transitions ?? [])
const closes = computed(() => data.value?.closes ?? [])
const fiscalMonth = computed(() => data.value?.fiscalMonth ?? 1)
const transitionsFor = (periodId: string) => transitions.value.filter(item => item.period_id === periodId)
const closeFor = (period: Period) => closes.value.find(item => item.fiscal_year_start === period.fiscal_year_start)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`))
const timestamp = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusLabel = (status: PeriodStatus) => t(`periods.status.${status}`)

function transitionOptions(period: Period): PeriodStatus[] {
  if (period.status === 'open') return ['soft_closed']
  if (period.status === 'soft_closed') return ['hard_closed', 'open']
  return ['soft_closed']
}

function reopening(period: Period, target: PeriodStatus) {
  return (period.status === 'hard_closed' && target === 'soft_closed') || (period.status === 'soft_closed' && target === 'open')
}

async function createPeriod() {
  if (pendingAction.value || !currentId.value || !createForm.start || !createForm.end) return
  pendingAction.value = 'create'
  createError.value = ''
  try {
    const { error } = await supabase.rpc('create_accounting_period', {
      p_organization_id: currentId.value, p_start_date: createForm.start, p_end_date: createForm.end,
    })
    if (error) throw error
    createForm.start = ''; createForm.end = ''
    createOpen.value = false
    await refresh()
    toasts.success(t('periods.savedTitle'), t('periods.created'))
  }
  catch (failure) { createError.value = describeError(failure); toasts.error(t('periods.errorTitle'), createError.value) }
  finally { pendingAction.value = '' }
}

async function transition(period: Period, target: PeriodStatus) {
  if (pendingAction.value) return
  const reason = actionReason[period.id]?.trim() ?? ''
  if (reopening(period, target) && !reason) return
  pendingAction.value = `${period.id}:${target}`
  try {
    const { error } = await supabase.rpc('transition_accounting_period', {
      p_period_id: period.id, p_new_status: target, p_reason: reason || undefined,
    })
    if (error) throw error
    actionReason[period.id] = ''
    await refresh()
    toasts.success(t('periods.savedTitle'), t('periods.transitioned', { status: statusLabel(target) }))
  }
  catch (failure) { toasts.error(t('periods.errorTitle'), describeError(failure)) }
  finally { pendingAction.value = '' }
}

async function closeYear() {
  if (pendingAction.value || !currentId.value || !closeForm.fiscalYearStart || !closeForm.reason.trim()) return
  pendingAction.value = 'year-end'
  try {
    const { error } = await supabase.rpc('close_fiscal_year', {
      p_organization_id: currentId.value,
      p_fiscal_year_start: closeForm.fiscalYearStart,
      p_reason: closeForm.reason.trim(),
      p_idempotency_key: `year-end:${closeForm.fiscalYearStart}`,
    })
    if (error) throw error
    closeForm.reason = ''
    await refresh()
    toasts.success(t('periods.yearEnd'), t('periods.yearEndCreated'))
  }
  catch (failure) { toasts.error(t('periods.errorTitle'), describeError(failure)) }
  finally { pendingAction.value = '' }
}
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('periods.title')"
      :subtitle="t('periods.subtitle')"
      :context="ledgerPresentation.context(currentPeriod?.start_date, currentPeriod?.end_date, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText v-if="!can('periods.read')" role="status" tone="muted">{{ t('periods.noAccess') }}</BsText>
    <BsText v-else-if="error" role="alert" tone="danger">{{ t('periods.loadFailed') }}</BsText>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
    <template v-else>
      <BsCard aria-labelledby="fiscal-year-heading" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="fiscal-year-heading" :level="2" size="h2">{{ t('periods.fiscalYear') }}</BsHeading>
          <BsText>{{ t('periods.fiscalMonth', { month: fiscalMonth }) }}</BsText>
          <BsText size="sm" tone="muted">{{ t('periods.fiscalHint') }}</BsText>
        </BsStack>
      </BsCard>
      <BsButton v-if="can('periods.manage')" type="button" variant="primary" @click="createOpen = true">{{ t('periods.create') }}</BsButton>
      <BsRecordActionDialog
        v-if="createOpen"
        v-model:visible="createOpen"
        :title="t('periods.create')"
        :dirty="createDirty"
        :pending="pendingAction === 'create'"
        :error="createError"
        :submit-label="t('periods.create')"
        :cancel-label="t('common.cancel')"
        @submit="createPeriod"
      >
        <BsFloatingField :label="t('periods.startDate')">
          <BsInput id="period-start" v-model="createForm.start" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('periods.endDate')">
          <BsInput id="period-end" v-model="createForm.end" type="date" :min="createForm.start" required />
        </BsFloatingField>
      </BsRecordActionDialog>
      <BsEmptyState v-if="!periods.length" :title="t('periods.empty')" :description="t('periods.emptyHint')" />
      <BsCard v-for="period in periods" :key="period.id" :data-period-status="period.status" :data-period-start="period.start_date" as="section" padding="md">
        <BsStack gap="md">
          <BsInline gap="md" :wrap="true" align="start" justify="between">
            <BsBox>
              <BsHeading :level="2" size="body">{{ date(period.start_date) }} — {{ date(period.end_date) }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('periods.fiscalRange', { start: date(period.fiscal_year_start), end: date(period.fiscal_year_end) }) }}</BsText>
            </BsBox>
            <BsStatusBadge
              :status="period.status"
              :label="statusLabel(period.status)"
              :tone="period.status === 'open' ? 'success' : period.status === 'soft_closed' ? 'warning' : 'neutral'"
            />
          </BsInline>
          <BsStack v-if="can('periods.manage')" gap="md">
            <BsFloatingField :label="t('periods.reason')">
              <BsInput :id="`reason-${period.id}`" v-model="actionReason[period.id]" :placeholder="t('periods.reasonHint')" />
            </BsFloatingField>
            <BsInline gap="sm" :wrap="true">
              <BsButton
                v-for="target in transitionOptions(period)"
                :key="target"
                type="button"
                :disabled="Boolean(pendingAction) || (reopening(period, target) && !actionReason[period.id]?.trim())"
                :variant="(target !== 'open' ) ? 'primary' : 'default'"
                @click="transition(period, target)"
              >{{ pendingAction === `${period.id}:${target}` ? t('common.saving') : target === 'soft_closed' && period.status === 'hard_closed' ? t('periods.reopen') : target === 'soft_closed' ? t('periods.softClose') : target === 'hard_closed' ? t('periods.hardClose') : t('periods.reopen') }}</BsButton>
            </BsInline>
          </BsStack>
          <BsBox v-if="closeFor(period)" padding="md" surface="muted" radius="control">
            <BsText emphasis="semibold">{{ t('periods.yearEndComplete') }}</BsText>
            <BsText>{{ t('periods.netResult') }}: <BsMoneyText :amount="closeFor(period)!.net_income_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsText>
            <BsLink :to="{ path: '/transactions', query: { q: closeFor(period)!.closing_transaction_id } }">{{ t('periods.closingJournal') }}</BsLink>
          </BsBox>
          <BsDisclosure v-if="transitionsFor(period.id).length">
            <template #summary>{{ t('periods.history') }}</template>
            <BsList :ordered="true" marker="none">
              <BsListItem v-for="item in transitionsFor(period.id)" :key="item.id">
                <BsText>{{ statusLabel(item.previous_status) }} → {{ statusLabel(item.new_status) }}</BsText>
                <BsText tone="muted">{{ timestamp(item.transitioned_at) }}<template v-if="item.reason"> · {{ item.reason }}</template></BsText>
              </BsListItem>
            </BsList>
          </BsDisclosure>
        </BsStack>
      </BsCard>
      <BsForm v-if="can('periods.year_end_close')" :aria-busy="pendingAction === 'year-end'" layout="grid" @submit.prevent="closeYear">
        <BsFloatingField :label="t('periods.fiscalYearStart')">
          <BsInput id="year-start" v-model="closeForm.fiscalYearStart" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('periods.yearEndReason')">
          <BsInput id="year-end-reason" v-model="closeForm.reason" required />
        </BsFloatingField>
        <BsButton type="submit" :disabled="Boolean(pendingAction) || !closeForm.reason.trim()" variant="primary">{{ pendingAction === 'year-end' ? t('common.saving') : t('periods.yearEnd') }}</BsButton>
      </BsForm>
    </template>
  </BsStack>
</template>
