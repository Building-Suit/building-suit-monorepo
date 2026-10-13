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
  visible.value = false; failed.value = false; page.value = 1; shopId.value = null; planId.value = null; reason.value = ''
  if (state.value !== 'success' || !scope.value) return
  const identity = attemptKey(scope.value)
  loading.value = true
  try {
    const context = await requestFetch<{ modules: { bindingId: string }[] }>('/api/accounts/context')
    if (epoch !== generation || !scope.value || identity !== attemptKey(scope.value)) return
    configured.value = context.modules.some(module => module.bindingId === bindingId.value)
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
</script>

<template>
  <BsAppShell :product-name="t('product.name')" :groups="[]" home-path="/" :labels="{ open: t('accounts.open'), close: t('accounts.close'), navigation: t('accounts.title'), dashboard: t('accounts.title') }">
    <template #logo><BsProductLogo :name="t('product.name')" /></template>
    <template #header><BsSettingsMenu /></template>
    <BsContentSection :title="t('accounts.title')" :description="t('accounts.description')" padding="lg">
      <BsStack gap="lg">
        <BsButton @click="navigateTo('/')">{{ t('accounts.home') }}</BsButton>
        <BsStateSurface v-if="state !== 'success'" :state="state === 'loading' ? 'loading' : 'permission'" :title="t('auth.denied')" />
        <BsStateSurface v-else-if="failed" state="error" :title="t('accounts.unavailable')" :action-label="t('auth.retry')" @action="initialize" />
        <BsStateSurface v-else-if="loading" state="loading" :title="t('accounts.loading')" />
        <BsStateSurface v-else-if="!configured" state="empty" :title="t('accounts.unconfigured')" />
        <BsStack v-else gap="lg">
          <BsAlert v-if="outcome?.state === 'success'" tone="success" :title="t('accounts.activated')" :description="t('accounts.noPayment')" />
          <BsDescriptionList v-if="outcome?.state === 'success'" :columns="2">
            <BsDescriptionItem :term="t('accounts.start')">{{ date(subscription?.periodStart) }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('accounts.end')">{{ date(subscription?.periodEnd) }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('accounts.audit')">{{ outcome.auditId }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsAlert v-if="attempt" tone="warning" :title="t('accounts.unknown')" :description="t('accounts.keepRequest')" />
          <BsButton v-if="attempt" @click="action.open('edit')">{{ t('accounts.retrySame') }}</BsButton>
          <BsAlert v-if="storageFailed" tone="error" :title="t('accounts.storageUnavailable')" />
          <BsStateSurface v-if="!rows.length" state="empty" :title="t('accounts.empty')" />
          <BsForm v-else @submit="action.open('edit')">
            <BsField :label="t('accounts.account')" for="sas-account">
              <BsSelect id="sas-account" v-model="shopId" :label="t('accounts.account')" :options="rowOptions" option-label="label" option-value="value" filter :disabled="!!attempt || pending || loading" />
            </BsField>
            <BsDescriptionList v-if="owner" :columns="2">
              <BsDescriptionItem :term="t('accounts.owner')">{{ owner.ownerEmail || owner.ownerName }}</BsDescriptionItem>
              <BsDescriptionItem :term="t('accounts.status')">{{ subscription?.status || owner.subscriptionStatus }}</BsDescriptionItem>
              <BsDescriptionItem :term="t('accounts.trialStart')">{{ date(subscription?.trialStartAt) }}</BsDescriptionItem>
              <BsDescriptionItem :term="t('accounts.trialEnd')">{{ date(subscription?.trialEndAt) }}</BsDescriptionItem>
            </BsDescriptionList>
            <BsAlert v-if="subscription && subscription.status !== 'trialing'" tone="info" :title="t('accounts.notTrial')" />
            <BsFormActions align="between">
              <BsButton type="button" :disabled="page <= 1 || !!attempt" @click="page--; loadRows()">{{ t('accounts.previous') }}</BsButton>
              <BsButton type="button" :disabled="page * 50 >= total || !!attempt" @click="page++; loadRows()">{{ t('accounts.next') }}</BsButton>
              <BsButton type="submit" variant="primary" :disabled="!subscription || subscription.status !== 'trialing' || owner?.status !== 'active' || !!attempt">{{ t('accounts.choosePlan') }}</BsButton>
            </BsFormActions>
          </BsForm>
        </BsStack>
      </BsStack>
    </BsContentSection>
    <BsRecordActionDialog v-model:visible="visible" :title="t('accounts.confirm')" :dirty="dirty" :pending="pending" :error="error" :submit-disabled="!canActivate" :submit-label="attempt ? t('accounts.retrySame') : t('accounts.activate')" @submit="submit">
      <BsField :label="t('accounts.plan')" for="sas-plan" required>
        <BsSelect id="sas-plan" v-model="planId" :label="t('accounts.plan')" :options="planOptions" option-label="label" option-value="value" :disabled="!!attempt" required />
      </BsField>
      <BsField :label="t('accounts.reason')" for="sas-reason" required>
        <BsTextarea id="sas-reason" v-model="reason" :disabled="!!attempt" minlength="8" maxlength="1000" required />
      </BsField>
      <BsAlert v-if="blocked && !attempt" tone="warning" :title="t('accounts.quotaBlocked')" />
      <BsAlert tone="info" :title="t('accounts.startsNow')" :description="t('accounts.consequences')" />
      <BsDescriptionList :columns="2">
        <BsDescriptionItem :term="t('accounts.account')">{{ owner?.name || attempt?.shopId }}</BsDescriptionItem>
        <BsDescriptionItem :term="t('accounts.plan')">{{ selectedPlan?.planName || attempt?.planId }}</BsDescriptionItem>
        <BsDescriptionItem :term="t('accounts.term')">{{ selectedPlan ? t(`accounts.intervals.${selectedPlan.billingInterval}`) : t('accounts.none') }}</BsDescriptionItem>
        <BsDescriptionItem :term="t('accounts.request')">{{ attempt?.requestId || t('accounts.none') }}</BsDescriptionItem>
      </BsDescriptionList>
    </BsRecordActionDialog>
  </BsAppShell>
</template>
