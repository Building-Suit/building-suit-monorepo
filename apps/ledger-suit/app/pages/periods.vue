<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsAccountingPeriodCopy, BsAccountingPeriodView, BsAccountingPeriodCreateForm, BsAccountingPeriodCloseForm } from '@building-suit/ui/types/accountingPeriodPresentation'
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

const periodCopy = computed<BsAccountingPeriodCopy>(() => ({
  common_cancel: t('common.cancel'),
  common_saving: t('common.saving'),
  periods_closingJournal: t('periods.closingJournal'),
  periods_create: t('periods.create'),
  periods_empty: t('periods.empty'),
  periods_emptyHint: t('periods.emptyHint'),
  periods_endDate: t('periods.endDate'),
  periods_fiscalHint: t('periods.fiscalHint'),
  periods_fiscalMonth: t('periods.fiscalMonth', { month: fiscalMonth.value }),
  periods_fiscalYear: t('periods.fiscalYear'),
  periods_fiscalYearStart: t('periods.fiscalYearStart'),
  periods_hardClose: t('periods.hardClose'),
  periods_history: t('periods.history'),
  periods_loadFailed: t('periods.loadFailed'),
  periods_netResult: t('periods.netResult'),
  periods_noAccess: t('periods.noAccess'),
  periods_reason: t('periods.reason'),
  periods_reasonHint: t('periods.reasonHint'),
  periods_reopen: t('periods.reopen'),
  periods_softClose: t('periods.softClose'),
  periods_startDate: t('periods.startDate'),
  periods_subtitle: t('periods.subtitle'),
  periods_title: t('periods.title'),
  periods_yearEnd: t('periods.yearEnd'),
  periods_yearEndComplete: t('periods.yearEndComplete'),
  periods_yearEndReason: t('periods.yearEndReason'),
}))
const periodCreateForm = computed<BsAccountingPeriodCreateForm>({ get: () => ({ ...createForm }), set: value => Object.assign(createForm, value) })
const periodCloseForm = computed<BsAccountingPeriodCloseForm>({ get: () => ({ ...closeForm }), set: value => Object.assign(closeForm, value) })
const periodView = computed<BsAccountingPeriodView>(() => ({
  context: ledgerPresentation.context(currentPeriod.value?.start_date, currentPeriod.value?.end_date), contextLabel: t('pageContext.label'), canRead: can('periods.read'), canManage: can('periods.manage'), canCloseYear: can('periods.year_end_close'), pending: pending.value, loadError: Boolean(error.value),
  createDirty: createDirty.value, createPending: pendingAction.value === 'create', createError: createError.value, closePending: pendingAction.value === 'year-end', closeDisabled: Boolean(pendingAction.value) || !closeForm.reason.trim(), closeLabel: pendingAction.value === 'year-end' ? t('common.saving') : t('periods.yearEnd'),
  periods: periods.value.map(period => {
    const yearClose = closeFor(period)
    return { id: period.id, status: period.status, start: period.start_date, title: `${date(period.start_date)} — ${date(period.end_date)}`, fiscalRange: t('periods.fiscalRange', { start: date(period.fiscal_year_start), end: date(period.fiscal_year_end) }), statusLabel: statusLabel(period.status), statusTone: period.status === 'open' ? 'success' : period.status === 'soft_closed' ? 'warning' : 'neutral', reason: actionReason[period.id] ?? '',
      actions: transitionOptions(period).map(target => ({ id: target, label: pendingAction.value === `${period.id}:${target}` ? t('common.saving') : target === 'soft_closed' && period.status === 'hard_closed' ? t('periods.reopen') : target === 'soft_closed' ? t('periods.softClose') : target === 'hard_closed' ? t('periods.hardClose') : t('periods.reopen'), primary: target !== 'open', disabled: Boolean(pendingAction.value) || (reopening(period, target) && !actionReason[period.id]?.trim()) })),
      close: yearClose ? { net: formatPresentationMoney(yearClose.net_income_minor, { currency: ledgerPresentation.currency(), locale: locale.value, unit: 'minor', numberingSystem: 'latn' }), journalTo: `/transactions?q=${encodeURIComponent(yearClose.closing_transaction_id ?? '')}` } : null,
      history: transitionsFor(period.id).map(item => ({ id: String(item.id), transition: `${statusLabel(item.previous_status)} → ${statusLabel(item.new_status)}`, description: `${timestamp(item.transitioned_at)}${item.reason ? ` · ${item.reason}` : ''}` })),
    }
  }),
}))
function updatePeriodReason(id: string, reason: string) { actionReason[id] = reason }
async function transitionPeriod(id: string, action: string) { const period = periods.value.find(row => row.id === id); if (period && (action === 'open' || action === 'soft_closed' || action === 'hard_closed')) await transition(period, action) }
</script>
<template>
  <BsAccountingPeriodsPage v-model:create-open="createOpen" v-model:create-form="periodCreateForm" v-model:close-form="periodCloseForm" :copy="periodCopy" :view="periodView" @create="createPeriod" @close-year="closeYear" @transition="transitionPeriod" @reason="updatePeriodReason" />
</template>
