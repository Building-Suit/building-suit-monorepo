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
const closeForm = reactive({ fiscalYearStart: '', reason: '' })

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
  if (!currentId.value || !createForm.start || !createForm.end) return
  pendingAction.value = 'create'
  try {
    const { error } = await supabase.rpc('create_accounting_period', {
      p_organization_id: currentId.value, p_start_date: createForm.start, p_end_date: createForm.end,
    })
    if (error) throw error
    createForm.start = ''; createForm.end = ''
    await refresh()
    toasts.success(t('periods.savedTitle'), t('periods.created'))
  }
  catch (failure) { toasts.error(t('periods.errorTitle'), describeError(failure)) }
  finally { pendingAction.value = '' }
}

async function transition(period: Period, target: PeriodStatus) {
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
  if (!currentId.value || !closeForm.fiscalYearStart || !closeForm.reason.trim()) return
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
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-h1 font-bold">{{ t('periods.title') }}</h1>
      <p class="mt-1 text-sm text-fg-muted">{{ t('periods.subtitle') }}</p>
    </header>

    <p v-if="!can('periods.read')" class="ls-card p-6 text-fg-muted" role="status">{{ t('periods.noAccess') }}</p>
    <p v-else-if="error" class="ls-error" role="alert">{{ t('periods.loadFailed') }}</p>
    <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
    <template v-else>
      <section class="ls-card space-y-3 p-5" aria-labelledby="fiscal-year-heading">
        <h2 id="fiscal-year-heading" class="text-h2 font-bold">{{ t('periods.fiscalYear') }}</h2>
        <p>{{ t('periods.fiscalMonth', { month: fiscalMonth }) }}</p>
        <p class="text-sm text-fg-muted">{{ t('periods.fiscalHint') }}</p>
      </section>

      <form v-if="can('periods.manage')" class="ls-card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" @submit.prevent="createPeriod">
        <FloatingField :label="t('periods.startDate')"><input id="period-start" v-model="createForm.start" type="date" class="ls-input" required></FloatingField>
        <FloatingField :label="t('periods.endDate')"><input id="period-end" v-model="createForm.end" type="date" class="ls-input" :min="createForm.start" required></FloatingField>
        <button class="ls-btn ls-btn-primary" :disabled="pendingAction === 'create'">{{ t('periods.create') }}</button>
      </form>

      <EmptyState v-if="!periods.length" :title="t('periods.empty')" :description="t('periods.emptyHint')" />
      <section v-for="period in periods" :key="period.id" class="ls-card space-y-4 p-5" :data-period-status="period.status" :data-period-start="period.start_date">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h2 class="font-bold">{{ date(period.start_date) }} — {{ date(period.end_date) }}</h2><p class="text-sm text-fg-muted">{{ t('periods.fiscalRange', { start: date(period.fiscal_year_start), end: date(period.fiscal_year_end) }) }}</p></div>
          <span class="rounded-control border border-line px-3 py-1 text-sm font-semibold">{{ statusLabel(period.status) }}</span>
        </div>

        <div v-if="can('periods.manage')" class="space-y-3 border-t border-line pt-4">
          <FloatingField :label="t('periods.reason')"><input :id="`reason-${period.id}`" v-model="actionReason[period.id]" class="ls-input" :placeholder="t('periods.reasonHint')"></FloatingField>
          <div class="flex flex-wrap gap-2">
            <button v-for="target in transitionOptions(period)" :key="target" type="button" class="ls-btn" :class="{ 'ls-btn-primary': target !== 'open' }" :disabled="pendingAction === `${period.id}:${target}` || (reopening(period, target) && !actionReason[period.id]?.trim())" @click="transition(period, target)">
              {{ target === 'soft_closed' && period.status === 'hard_closed' ? t('periods.reopen') : target === 'soft_closed' ? t('periods.softClose') : target === 'hard_closed' ? t('periods.hardClose') : t('periods.reopen') }}
            </button>
          </div>
        </div>

        <div v-if="closeFor(period)" class="rounded-control bg-surface-muted p-3 text-sm">
          <p class="font-semibold">{{ t('periods.yearEndComplete') }}</p>
          <p>{{ t('periods.netResult') }}: <MoneyText :amount-minor="closeFor(period)!.net_income_minor" /></p>
          <NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: closeFor(period)!.closing_transaction_id } }">{{ t('periods.closingJournal') }}</NuxtLink>
        </div>

        <details v-if="transitionsFor(period.id).length">
          <summary class="cursor-pointer font-semibold">{{ t('periods.history') }}</summary>
          <ol class="mt-3 space-y-2 text-sm">
            <li v-for="item in transitionsFor(period.id)" :key="item.id" class="rounded-control bg-surface-muted p-3">
              <p>{{ statusLabel(item.previous_status) }} → {{ statusLabel(item.new_status) }}</p>
              <p class="text-fg-muted">{{ timestamp(item.transitioned_at) }}<template v-if="item.reason"> · {{ item.reason }}</template></p>
            </li>
          </ol>
        </details>
      </section>

      <form v-if="can('periods.year_end_close')" class="ls-card grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end" @submit.prevent="closeYear">
        <FloatingField :label="t('periods.fiscalYearStart')"><input id="year-start" v-model="closeForm.fiscalYearStart" type="date" class="ls-input" required></FloatingField>
        <FloatingField :label="t('periods.yearEndReason')"><input id="year-end-reason" v-model="closeForm.reason" class="ls-input" required></FloatingField>
        <button class="ls-btn ls-btn-primary" :disabled="pendingAction === 'year-end' || !closeForm.reason.trim()">{{ t('periods.yearEnd') }}</button>
      </form>
    </template>
  </div>
</template>
