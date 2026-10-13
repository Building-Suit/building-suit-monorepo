<script setup lang="ts">
import type { AccountOutcome, AccountRow, ActivationAttempt, AccountScope, PlanOption, SubscriptionSnapshot } from '../types/account-workflow'
import { attemptKey, restoreAttempt } from '../utils/activation-attempt'

definePageMeta({ layout: false })
const { t, locale } = useI18n()
const route = useRoute()
const { ready, state } = useAdminSession()
await ready
const bindingId = computed(() => typeof route.query.bindingId === 'string' ? route.query.bindingId : '')
const requestFetch = useRequestFetch()
const rows = ref<AccountRow[]>([])
const total = ref(0)
const page = ref(1)
const shopId = ref<string | null>(null)
const planId = ref<string | null>(null)
const plans = ref<PlanOption[]>([])
const subscription = ref<SubscriptionSnapshot | null>(null)
const reason = ref('')
const loading = ref(false)
const failed = ref(false)
const configured = ref(false)
const provisioningAvailable = ref(false)
const attempt = ref<ActivationAttempt | null>(null)
const outcome = ref<AccountOutcome | null>(null)
const storageFailed = ref(false)
const scope = computed<AccountScope | null>(() => ready.data.value && bindingId.value ? { ...ready.data.value, bindingId: bindingId.value } : null)
const action = useRecordAction(() => ({ shopId: shopId.value, planId: planId.value, reason: reason.value }))
const { visible, pending, dirty, error } = action
let generation = 0
const owner = computed(() => rows.value.find(row => row.id === shopId.value))
const selectedPlan = computed(() => plans.value.find(plan => plan.planId === planId.value))
const blocked = computed(() => !!selectedPlan.value?.blockers.length)
const canActivate = computed(() => configured.value && !loading.value && (attempt.value || (
  owner.value?.status === 'active' && subscription.value?.status === 'trialing' && !!selectedPlan.value && !blocked.value && reason.value.trim().length >= 8
)))
const rowOptions = computed(() => rows.value.map(row => ({ value: row.id, label: `${row.name} · ${row.ownerEmail || row.ownerName || row.id}` })))
const planOptions = computed(() => plans.value.map(plan => ({ value: plan.planId, label: `${plan.planName} · ${t(`accounts.intervals.${plan.billingInterval}`)}` })))
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString(locale.value) : t('accounts.none') }

async function loadShop() {
  if (!shopId.value || !configured.value || !scope.value) return
  const selected = shopId.value
  const identity = attemptKey(scope.value)
  subscription.value = null; plans.value = []; failed.value = false; loading.value = true
  try {
    const result = await requestFetch<AccountOutcome>('/api/accounts/shop', { query: { bindingId: bindingId.value, shopId: selected } })
    if (!scope.value || identity !== attemptKey(scope.value) || selected !== shopId.value) return
    if (result.state !== 'success') throw new Error('Projection unavailable')
    const projection = result.data as { subscription: SubscriptionSnapshot; availablePlans: PlanOption[] }
    subscription.value = projection.subscription; plans.value = projection.availablePlans
    if (!attempt.value) planId.value = null
  } catch { failed.value = true }
  finally { loading.value = false }
}
async function loadRows() {
  if (!configured.value || !scope.value) return
  const identity = attemptKey(scope.value)
  loading.value = true; failed.value = false
  try {
    const result = await requestFetch<AccountOutcome>('/api/accounts/shops', { query: { bindingId: bindingId.value, page: page.value } })
    if (!scope.value || identity !== attemptKey(scope.value)) return
    if (result.state !== 'success') throw new Error('Projection unavailable')
    const projection = result.data as { items: AccountRow[]; total: number }
    rows.value = projection.items; total.value = projection.total
  } catch { failed.value = true }
  finally { loading.value = false }
}
async function initialize() {
  const epoch = ++generation
  rows.value = []; plans.value = []; subscription.value = null; outcome.value = null; attempt.value = null; configured.value = false
  visible.value = false; failed.value = false; provisioningAvailable.value = false; page.value = 1; shopId.value = null; planId.value = null; reason.value = ''
  if (state.value !== 'success' || !scope.value) return
  const identity = attemptKey(scope.value)
  loading.value = true
  try {
    const context = await requestFetch<{ modules: { bindingId: string; provisioningAvailable: boolean }[] }>('/api/accounts/context')
    if (epoch !== generation || !scope.value || identity !== attemptKey(scope.value)) return
    configured.value = context.modules.some(module => module.bindingId === bindingId.value)
    provisioningAvailable.value = context.modules.some(module => module.bindingId === bindingId.value && module.provisioningAvailable)
    if (!configured.value) return
    if (import.meta.client) {
      try { attempt.value = restoreAttempt(sessionStorage.getItem(identity), scope.value) }
      catch { storageFailed.value = true }
    }
    if (attempt.value) {
      shopId.value = attempt.value.shopId; planId.value = attempt.value.planId; reason.value = attempt.value.reason
      outcome.value = { state: 'outcome_unknown', requestId: attempt.value.requestId }
    }
    await loadRows()
    if (attempt.value) { await loadShop(); action.open('edit') }
  } catch { failed.value = true }
  finally { if (epoch === generation) loading.value = false }
}
async function submit() {
  if (!canActivate.value || !scope.value || pending.value) return
  const identity = attemptKey(scope.value)
  if (!attempt.value) {
    const input: ActivationAttempt = {
      bindingId: bindingId.value, shopId: shopId.value!, subscriptionId: subscription.value!.id,
      planId: planId.value!, reason: reason.value.trim(), requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(),
    }
    try { sessionStorage.setItem(identity, JSON.stringify(input)); attempt.value = input }
    catch { storageFailed.value = true; action.fail(t('accounts.storageUnavailable')); return }
  }
  pending.value = true; error.value = null
  try {
    const result = await requestFetch<AccountOutcome>('/api/accounts/activate', { method: 'POST', body: attempt.value })
    if (!scope.value || identity !== attemptKey(scope.value)) return
    outcome.value = result
    if (result.state === 'outcome_unknown') { action.fail(t('accounts.unknown')); return }
    sessionStorage.removeItem(identity); attempt.value = null
    if (result.state === 'target_rejected') { action.fail(t('accounts.rejected')); await loadShop(); return }
    subscription.value = result.data as SubscriptionSnapshot
    action.complete()
    await loadRows()
  } catch {
    if (scope.value && identity === attemptKey(scope.value)) {
      outcome.value = { state: 'outcome_unknown', requestId: attempt.value!.requestId }
      action.fail(t('accounts.unknown'))
    }
  } finally { pending.value = false }
}
watch(() => [state.value, bindingId.value, ready.data.value?.userId, ready.data.value?.authorityEnvironmentId], initialize)
watch(shopId, () => { if (!attempt.value) void loadShop() })
onMounted(initialize)
onScopeDispose(() => { generation++; rows.value = []; plans.value = []; subscription.value = null; attempt.value = null })
useHead({ title: () => t('accounts.title') })

const pageCopy = computed(() => ({'accounts.account':t('accounts.account'),'accounts.activate':t('accounts.activate'),'accounts.activated':t('accounts.activated'),'accounts.audit':t('accounts.audit'),'accounts.choosePlan':t('accounts.choosePlan'),'accounts.close':t('accounts.close'),'accounts.confirm':t('accounts.confirm'),'accounts.consequences':t('accounts.consequences'),'accounts.description':t('accounts.description'),'accounts.empty':t('accounts.empty'),'accounts.end':t('accounts.end'),'accounts.home':t('accounts.home'),'accounts.keepRequest':t('accounts.keepRequest'),'accounts.loading':t('accounts.loading'),'accounts.next':t('accounts.next'),'accounts.noPayment':t('accounts.noPayment'),'accounts.none':t('accounts.none'),'accounts.notTrial':t('accounts.notTrial'),'accounts.open':t('accounts.open'),'accounts.owner':t('accounts.owner'),'accounts.plan':t('accounts.plan'),'accounts.previous':t('accounts.previous'),'accounts.quotaBlocked':t('accounts.quotaBlocked'),'accounts.reason':t('accounts.reason'),'accounts.request':t('accounts.request'),'accounts.retrySame':t('accounts.retrySame'),'accounts.start':t('accounts.start'),'accounts.startsNow':t('accounts.startsNow'),'accounts.status':t('accounts.status'),'accounts.storageUnavailable':t('accounts.storageUnavailable'),'accounts.term':t('accounts.term'),'accounts.title':t('accounts.title'),'accounts.trialEnd':t('accounts.trialEnd'),'accounts.trialStart':t('accounts.trialStart'),'accounts.unavailable':t('accounts.unavailable'),'accounts.unconfigured':t('accounts.unconfigured'),'accounts.unknown':t('accounts.unknown'),'auth.denied':t('auth.denied'),'auth.retry':t('auth.retry'),'product.name':t('product.name'),'provision.create':t('provision.create')}))
const pageView = computed(() => ({
 state:state.value,failed:failed.value,loading:loading.value,configured:configured.value,provisioningAvailable:provisioningAvailable.value,
 outcomeSuccess:outcome.value?.state==='success',auditId:outcome.value?.state==='success'?outcome.value.auditId:null,storageFailed:storageFailed.value,hasRows:!!rows.value.length,blocked:blocked.value,canActivate:!!canActivate.value,
 canChoosePlan:!!subscription.value&&subscription.value.status==='trialing'&&owner.value?.status==='active'&&!attempt.value,notTrial:!!subscription.value&&subscription.value.status!=='trialing',
 previousDisabled:page.value<=1||!!attempt.value,nextDisabled:page.value*50>=total.value||!!attempt.value,
 owner:owner.value?{name:owner.value.name,email:owner.value.ownerEmail||owner.value.ownerName,statusLabel:subscription.value?.status||owner.value.subscriptionStatus}:null,
 attempt:attempt.value?{shopId:attempt.value.shopId,planId:attempt.value.planId,requestId:attempt.value.requestId}:null,
 selectedPlan:selectedPlan.value?{planName:selectedPlan.value.planName,intervalLabel:t(`accounts.intervals.${selectedPlan.value.billingInterval}`)}:null,
 dates:{start:date(subscription.value?.periodStart),end:date(subscription.value?.periodEnd),trialStart:date(subscription.value?.trialStartAt),trialEnd:date(subscription.value?.trialEndAt)},
 rowOptions:rowOptions.value,planOptions:planOptions.value,dirty:dirty.value,pending:pending.value,error:error.value,
}))
</script>

<template>
  <BsAccountActivationPage v-model:shop-id="shopId" v-model:plan-id="planId" v-model:reason="reason" v-model:visible="visible" :copy="pageCopy" :view="pageView" @home="navigateTo('/')" @create="navigateTo({path:'/account-provisioning',query:{bindingId}})" @retry="initialize" @open="action.open('edit')" @previous="page--;loadRows()" @next="page++;loadRows()" @submit="submit" />
</template>
