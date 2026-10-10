<script setup lang="ts">
import { useLedgerBillingCheckoutView } from '~/composables/useLedgerBillingCheckoutView'
import { useLedgerManualPaymentCheckoutView } from '~/composables/useLedgerManualPaymentCheckoutView'
const { t, te, locale } = useI18n()
const { accessState, subscription } = useBilling()
const { rows: usageRows, catalog } = usePlanUsage()

useHead({ title: () => `${t('billing.title')} · ${t('app.name')}` })

function displayDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value)) : '—'
}

const renewalDate = computed(() => accessState.value === 'trialing'
  ? subscription.value?.trial_ends_at
  : subscription.value?.current_period_end)
const checkoutEnabled = computed(() => ['trialing', 'checkout_required', 'read_only'].includes(accessState.value))
const pricingSurface = computed(() => checkoutEnabled.value
  ? 'checkout' as const
  : ['active', 'grace_period'].includes(accessState.value)
    ? 'manage' as const
    : 'display' as const)
const currentPlanKey = computed(() => usageRows.value[0]?.plan_key ?? null)
const currentPlanName = computed(() => {
  const key = currentPlanKey.value
  if (!key) return t('billing.singlePlan')
  const translation = `billing.plans.${key}.name`
  const catalogName = catalog.value.find(plan => plan.plan_key === key)?.name
  return locale.value === 'ar' && te(translation) ? t(translation) : catalogName ?? (te(translation) ? t(translation) : key)
})

// The global entitlement middleware owns the initial load. Loading again from
// onMounted made the layout remove and remount this page on every request.
const ledgerUsage = useLedgerUsagePresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsBox as="header">
      <BsHeading :level="1" size="h1">{{ t('billing.title') }}</BsHeading>
      <BsText size="sm" tone="muted">{{ t('billing.subtitle') }}</BsText>
    </BsBox>
    <BsCard as="div" padding="lg">
      <BsStack gap="lg">
        <BsInline gap="md" :wrap="true" align="start" justify="between">
          <BsBox>
            <BsText size="xs" tone="muted">{{ t('billing.currentPlan') }}</BsText>
            <BsText size="lg" emphasis="bold">{{ currentPlanName }}</BsText>
            <BsText size="sm" tone="muted">{{ t(`billing.states.${accessState}`) }}</BsText>
          </BsBox>
          <BsStatusBadge :status="accessState" />
        </BsInline>
        <BsDescriptionList :columns="2">
          <BsBox>
            <BsDescriptionTerm>{{ t('billing.billingCycle') }}</BsDescriptionTerm>
            <BsDescriptionValue>{{ subscription?.billing_interval ? t(`billing.${subscription.billing_interval}`) : '—' }}</BsDescriptionValue>
          </BsBox>
          <BsBox>
            <BsDescriptionTerm>{{ t('billing.nextDate') }}</BsDescriptionTerm>
            <BsDescriptionValue>{{ displayDate(renewalDate) }}</BsDescriptionValue>
          </BsBox>
        </BsDescriptionList>
        <BsText v-if="subscription?.provider === 'paymob'" size="sm" tone="muted">{{ t('billing.managedByPaymob') }}</BsText>
        <BsText v-if="subscription?.provider === 'manual'" size="sm" tone="muted">{{ t('billing.manual.managed') }}</BsText>
        <BsBox id="plans">
          <BsWorkflowScope :factory="useLedgerBillingCheckoutView" :input="{ surface: (pricingSurface), compact: true }">
            <template #default="{ state: ledgerView6 }">
              <BsBox data-testid="plan-pricing">
                <BsBox
                  v-if="ledgerView6.trialPlanCurrent && ledgerView6.surface === 'checkout'"
                  data-testid="trial-summary"
                  as="section"
                  padding="lg"
                  border
                  radius="card"
                >
                  <template v-if="ledgerView6.accessState === 'trialing'">
                    <BsHeading :level="2" size="h3">{{ ledgerView6.t('billing.trial.activeTitle') }}</BsHeading>
                    <BsText size="sm">{{ ledgerView6.t('billing.trial.activeBenefits') }}</BsText>
                    <BsText size="sm" tone="muted">{{ ledgerView6.t('billing.trial.endsOn', { date: ledgerView6.formatDate(ledgerView6.subscription?.trial_ends_at) }) }}</BsText>
                    <BsText size="sm" tone="muted">{{ ledgerView6.t('billing.trial.optionalConversion') }}</BsText>
                  </template>
                  <template v-else-if="ledgerView6.accessState === 'read_only'">
                    <BsHeading :level="2" size="h3">{{ ledgerView6.t('billing.trial.expiredTitle') }}</BsHeading>
                    <BsText size="sm">{{ ledgerView6.t('billing.trial.expiredBody', { date: ledgerView6.formatDate(ledgerView6.subscription?.trial_ends_at) }) }}</BsText>
                    <BsText size="sm" emphasis="semibold">{{ ledgerView6.t('billing.trial.resumeWrites') }}</BsText>
                  </template>
                </BsBox>
                <BsButton
                  v-if="['checkout', 'manage', 'display'].includes(ledgerView6.surface) && ledgerView6.can('billing.manage')"
                  type="button"
                  @click="ledgerView6.manualPlan = undefined; ledgerView6.manualOpen = true"
                >{{ ledgerView6.t('billing.manual.requests') }}</BsButton>
                <BsWorkflowScope
                  v-if="ledgerView6.manualOpen"
                  :key="`${ledgerView6.currentId}:${ledgerView6.user?.id}`"
                  :factory="useLedgerManualPaymentCheckoutView"
                  :input="{ plan: (ledgerView6.manualPlan), interval: (ledgerView6.interval) }"
                  @close="ledgerView6.manualOpen = false"
                >
                  <template #default="{ state: ledgerView7 }">
                    <BsDialog
                      :visible="true"
                      :title="ledgerView7.t('billing.manual.title')"
                      :dirty="ledgerView7.dirty"
                      :pending="ledgerView7.pending"
                      size="lg"
                      @update:visible="(value: boolean) => { if (!value) ledgerView7.emit('close') }"
                    >
                      <BsStack gap="md" padding="lg">
                        <BsText v-if="!ledgerView7.can('billing.manage')" role="alert">{{ ledgerView7.t('billing.manual.denied') }}</BsText>
                        <template v-else>
                          <BsText v-if="ledgerView7.pending" role="status">{{ ledgerView7.t('app.loading') }}</BsText>
                          <BsText v-if="ledgerView7.error || ledgerView7.validation" role="alert" tone="danger">{{ ledgerView7.error || ledgerView7.validation }}</BsText>
                          <BsButton
                            type="button"
                            :disabled="ledgerView7.pending || ledgerView7.dirty"
                            @click="ledgerView7.load(ledgerView7.plan, ledgerView7.interval, ledgerView7.quoteId)"
                          >{{ ledgerView7.t('common.refresh') }}</BsButton>
                          <BsText v-if="!ledgerView7.pending && !ledgerView7.selected && !ledgerView7.error">{{ ledgerView7.t('billing.manual.empty') }}</BsText>
                          <template v-if="ledgerView7.selected">
                            <BsText size="sm" tone="muted">{{ ledgerView7.t('billing.manual.pendingHint') }}</BsText>
                            <BsText emphasis="bold">{{ ledgerView7.t(`billing.plans.${ledgerView7.selected.plan_key}.name`) }} · {{ ledgerView7.t(`billing.${ledgerView7.selected.billing_interval}`) }} · {{ new Intl.NumberFormat(ledgerView7.locale, { style: 'currency', currency: ledgerView7.selected.currency_code.trim() }).format(ledgerView7.selected.amount_minor / 100) }}</BsText>
                            <BsText role="status">{{ ledgerView7.t(`billing.manual.states.${ledgerView7.selected.status}`) }}</BsText>
                            <BsButton v-if="ledgerView7.selected.status === 'approved'" type="button" variant="primary" @click="reloadNuxtApp({ path: '/billing' })">{{ ledgerView7.t('billing.manual.openSubscription') }}</BsButton>
                            <BsText wrap="preserve">{{ ledgerView7.selected.instructions }}</BsText>
                            <BsText size="sm">{{ ledgerView7.t('billing.manual.reference') }}: {{ ledgerView7.selected.id }}</BsText>
                            <BsText v-if="ledgerView7.selected.period_start && ledgerView7.selected.period_end">{{ ledgerView7.date(ledgerView7.selected.period_start) }} — {{ ledgerView7.date(ledgerView7.selected.period_end) }}</BsText>
                            <BsForm v-if="ledgerView7.cancelAllowed" @submit.prevent="ledgerView7.send">
                              <BsFieldLabel v-if="ledgerView7.uploadAllowed">
                                <BsText as="span">{{ ledgerView7.t('billing.manual.receipt') }}</BsText>
                                <BsFileInput
                                  :key="ledgerView7.selected.evidence_id ?? ledgerView7.selected.id"
                                  accept="image/jpeg,image/png,application/pdf"
                                  :disabled="ledgerView7.pending"
                                  bare
                                  @change="ledgerView7.chooseFile"
                                />
                                <BsText as="span" size="xs" tone="muted">{{ ledgerView7.t('billing.manual.fileHint') }}</BsText>
                              </BsFieldLabel>
                              <BsFloatingField :label="ledgerView7.t('billing.manual.reason')">
                                <BsTextarea v-model="ledgerView7.reason" maxlength="1000" required :disabled="ledgerView7.pending" />
                              </BsFloatingField>
                              <BsInline gap="sm" :wrap="true">
                                <BsButton
                                  v-if="ledgerView7.uploadAllowed"
                                  type="submit"
                                  :disabled="ledgerView7.pending || !ledgerView7.file || !ledgerView7.reason.trim()"
                                  variant="primary"
                                >{{ ledgerView7.t('billing.manual.submit') }}</BsButton>
                                <BsButton type="button" :disabled="ledgerView7.pending || !ledgerView7.reason.trim()" @click="ledgerView7.cancelRequest">{{ ledgerView7.t('billing.manual.cancel') }}</BsButton>
                              </BsInline>
                            </BsForm>
                            <BsHeading :level="3" size="body">{{ ledgerView7.t('billing.manual.history') }}</BsHeading>
                            <BsList :ordered="true" marker="none">
                              <BsListItem v-for="event in ledgerView7.history" :key="event.id">{{ ledgerView7.date(event.occurred_at) }} · {{ ledgerView7.t(`billing.manual.states.${event.after_state}`) }} · {{ event.reason }}</BsListItem>
                            </BsList>
                            <BsList :ordered="false" marker="none">
                              <BsListItem v-for="receipt in ledgerView7.evidence" :key="receipt.id">
                                <BsButton variant="link" type="button" :disabled="ledgerView7.pending" @click="ledgerView7.download(receipt)">{{ receipt.filename }} · {{ ledgerView7.date(receipt.submitted_at) }}</BsButton>
                              </BsListItem>
                            </BsList>
                          </template>
                          <BsList v-if="ledgerView7.requests.length > 1" :ordered="false" marker="none">
                            <BsListItem v-for="payment in ledgerView7.requests" :key="payment.id">
                              <BsButton variant="link" type="button" :disabled="ledgerView7.pending || ledgerView7.dirty" @click="ledgerView7.select(payment)">{{ ledgerView7.date(payment.created_at) }} · {{ ledgerView7.t(`billing.plans.${payment.plan_key}.name`) }}</BsButton>
                            </BsListItem>
                          </BsList>
                        </template>
                      </BsStack>
                    </BsDialog>
                  </template>
                </BsWorkflowScope>
                <BsMarketingPricing
                  :interval="ledgerView6.interval"
                  :plans="ledgerView6.pricingPlans"
                  test-id="plan-pricing-grid"
                  :interval-options="[{ value: 'monthly', label: ledgerView6.t('billing.monthly') }, { value: 'yearly', label: ledgerView6.t('billing.yearly') }]"
                  :copy="{ cycleLabel: ledgerView6.t('billing.billingCycle'), loading: ledgerView6.t('billing.plans.loading'), empty: ledgerView6.t('billing.plans.loadFailed'), retry: ledgerView6.t('common.retry'), included: ledgerView6.t('billing.plans.included'), notIncluded: ledgerView6.t('billing.plans.notIncluded') }"
                  :annual-saving="ledgerView6.annualDiscount === null ? null : ledgerView6.t('billing.plans.annualDiscount', { percent: ledgerView6.annualDiscount })"
                  :loading="ledgerView6.catalogPending"
                  :error="ledgerView6.catalogError ? ledgerView6.t('billing.plans.loadFailed') : null"
                  @update:interval="value => { if (value === 'monthly' || value === 'yearly') ledgerView6.interval = value }"
                  @retry="ledgerView6.refresh"
                  @action="ledgerView6.choosePlan"
                  @secondary-action="ledgerView6.chooseManualPlan"
                />
                <BsBox v-if="ledgerView6.surface === 'checkout'" data-testid="checkout-policy-review" role="note" as="section" padding="lg">
                  <BsI18nText keypath="billing.policyReview" tag="p" scope="global">
                    <template #terms>
                      <BsLink to="/terms" target="_blank" rel="noopener">{{ ledgerView6.t('marketing.terms') }}</BsLink>
                    </template>
                    <template #refund>
                      <BsLink to="/refund-cancellation" target="_blank" rel="noopener">{{ ledgerView6.t('marketing.refundCancellation') }}</BsLink>
                    </template>
                    <template #privacy>
                      <BsLink to="/privacy" target="_blank" rel="noopener">{{ ledgerView6.t('marketing.privacy') }}</BsLink>
                    </template>
                  </BsI18nText>
                </BsBox>
                <BsBox v-if="ledgerView6.surface === 'checkout' || ledgerView6.surface === 'public'" data-testid="payment-method-branding" role="note" as="section">{{ ledgerView6.t('billing.securePayments') }}</BsBox>
                <BsText v-if="ledgerView6.surface === 'checkout'" size="xs" tone="muted" align="center">{{ ledgerView6.t('billing.paymentRequired') }}</BsText>
                <BsText v-if="ledgerView6.surface === 'manage' && ledgerView6.compatibilityPlanCurrent" role="note" size="sm" tone="muted">{{ ledgerView6.t('billing.planChange.legacyGrandfathered') }}</BsText>
                <BsText v-if="ledgerView6.errorMessage" role="alert" tone="danger">{{ ledgerView6.errorMessage }}</BsText>
                <BsDialog
                  v-if="ledgerView6.planImpact"
                  :visible="true"
                  :title="ledgerView6.t('billing.planChange.title')"
                  :aria-label="ledgerView6.t('billing.planChange.title')"
                  :show-header="false"
                  size="md"
                  @update:visible="(value: boolean) => { if (!value) ledgerView6.planImpact = null }"
                >
                  <template #default="{ close: dismiss }">
                    <BsCard data-testid="plan-change-impact" as="section" padding="lg">
                      <BsInline gap="md" :wrap="false" align="start" justify="between">
                        <BsBox>
                          <BsHeading id="plan-change-title" :level="2" size="h3">{{ ledgerView6.t('billing.planChange.title') }}</BsHeading>
                          <BsText size="sm" tone="muted">{{ ledgerView6.t('billing.planChange.summary', {
                current: ledgerView6.planNameForKey(ledgerView6.planImpact.current_plan_key),
                target: ledgerView6.planNameForKey(ledgerView6.planImpact.target_plan_key),
              }) }}</BsText>
                        </BsBox>
                        <BsButton variant="icon" type="button" :aria-label="ledgerView6.t('common.close')" @click="dismiss">
                          <BsIcon name="close" :size="20" />
                        </BsButton>
                      </BsInline>
                      <BsBox padding="lg" surface="muted" radius="card">
                        <BsText emphasis="bold">{{ ledgerView6.t('billing.planChange.noDeletion') }}</BsText>
                        <BsText tone="muted">{{ ledgerView6.t('billing.planChange.targetPrice', {
              price: ledgerView6.t('billing.plans.price', { amount: ledgerView6.formatAmount(ledgerView6.planImpact.target_amount_minor) }),
              interval: ledgerView6.t(`billing.${ledgerView6.planImpact.target_interval}`),
            }) }}</BsText>
                      </BsBox>
                      <BsHeading :level="3" size="body">{{ ledgerView6.t('billing.planChange.capacityTitle') }}</BsHeading>
                      <BsList :ordered="false" marker="none">
                        <BsListItem v-for="quota in ledgerView6.quotaImpacts" :key="quota.quota_key" :data-impact-quota="quota.quota_key">
                          <BsInline gap="md" :wrap="false" align="start" justify="between">
                            <BsText as="span" emphasis="semibold">{{ ledgerView6.t(`usage.quotas.${quota.quota_key}`) }}</BsText>
                            <BsText v-if="quota.will_block_new_activity" as="span" size="xs" tone="danger" emphasis="bold">{{ ledgerView6.t('billing.planChange.blocked') }}</BsText>
                            <BsText v-else as="span" size="xs" tone="success" emphasis="bold">{{ ledgerView6.t('billing.planChange.available') }}</BsText>
                          </BsInline>
                          <BsText tone="muted">{{ ledgerView6.t('billing.planChange.usageLimit', {
                used: ledgerView6.formatQuota(quota.quota_key, quota.used_value),
                limit: ledgerView6.formatQuota(quota.quota_key, quota.target_limit_value),
              }) }}</BsText>
                        </BsListItem>
                      </BsList>
                      <BsBox v-if="ledgerView6.gainedFeatures.length || ledgerView6.auditHistoryIncreased">
                        <BsHeading :level="3" size="body">{{ ledgerView6.t('billing.planChange.gainedTitle') }}</BsHeading>
                        <BsList :ordered="false" marker="disc">
                          <BsListItem v-for="feature in ledgerView6.gainedFeatures" :key="feature.feature_key">{{ ledgerView6.featureName(feature.feature_key) }}</BsListItem>
                          <BsListItem v-if="ledgerView6.auditHistoryIncreased">{{ ledgerView6.t('billing.planChange.auditHistoryIncreased', { days: ledgerView6.formatNumber(ledgerView6.planImpact.audit_history_target_days) }) }}</BsListItem>
                        </BsList>
                      </BsBox>
                      <BsBox v-if="ledgerView6.lostFeatures.length || ledgerView6.planImpact.audit_history_reduced">
                        <BsHeading :level="3" size="body">{{ ledgerView6.t('billing.planChange.lostTitle') }}</BsHeading>
                        <BsList :ordered="false" marker="disc">
                          <BsListItem v-for="feature in ledgerView6.lostFeatures" :key="feature.feature_key">{{ ledgerView6.featureName(feature.feature_key) }}</BsListItem>
                          <BsListItem v-if="ledgerView6.planImpact.audit_history_reduced">{{ ledgerView6.t('billing.planChange.auditHistoryReduced', { days: ledgerView6.formatNumber(ledgerView6.planImpact.audit_history_target_days) }) }}</BsListItem>
                        </BsList>
                      </BsBox>
                      <BsBox v-if="ledgerView6.planImpact.requires_manual_handoff" role="note" padding="lg" border radius="card">
                        <BsText emphasis="bold">{{ ledgerView6.t('billing.planChange.handoffTitle') }}</BsText>
                        <BsText tone="muted">{{ ledgerView6.t('billing.planChange.handoffBody') }}</BsText>
                      </BsBox>
                      <BsText v-else size="sm" tone="muted">{{ ledgerView6.t('billing.planChange.noChange') }}</BsText>
                      <BsInline gap="none" :wrap="false" justify="end">
                        <BsButton type="button" variant="primary" @click="dismiss">{{ ledgerView6.t('common.close') }}</BsButton>
                      </BsInline>
                    </BsCard>
                  </template>
                </BsDialog>
              </BsBox>
            </template>
          </BsWorkflowScope>
        </BsBox>
      </BsStack>
    </BsCard>
    <BsContentSection id="usage" :title="t('usage.title')" :description="t('usage.subtitle')">
      <BsStateSurface v-if="ledgerUsage.loading && !ledgerUsage.items.length" state="loading" :title="t('usage.loading')" />
      <BsStateSurface
        v-else-if="ledgerUsage.loadError && !ledgerUsage.items.length"
        state="error"
        :title="t('usage.loadFailed')"
        :action-label="t('common.retry')"
        @action="ledgerUsage.refresh()"
      />
      <template v-else>
        <BsButton v-if="ledgerUsage.loadError" variant="link" @click="ledgerUsage.refresh()">{{ t('common.retry') }}</BsButton>
        <BsUsageMeterGrid :items="ledgerUsage.items" />
      </template>
    </BsContentSection>
  </BsStack>
</template>
