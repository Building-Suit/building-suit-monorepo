<script setup lang="ts">
import { useLedgerBillingCheckoutView } from '~/composables/useLedgerBillingCheckoutView'
import { useLedgerManualPaymentCheckoutView } from '~/composables/useLedgerManualPaymentCheckoutView'
import { useLedgerOrganizationSwitcherView } from '~/composables/useLedgerOrganizationSwitcherView'
import { useLedgerSubscriptionGateView } from '~/composables/useLedgerSubscriptionGateView'
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { t } = useI18n()
const { current, loadOrganizations } = useTenant()
const { paymentRequired, loading, load } = useBilling()
const { restore } = useTheme()
const route = useRoute()
const redirecting = ref(false)
const checkoutConfirmationActive = ref(false)
const paymentFailed = computed(() => route.query.checkout === 'complete' && route.query.success === 'false')
const processing = computed(() => route.query.checkout === 'complete' && !paymentFailed.value)

useHead({ title: () => `${t('billing.title')} · ${t('app.name')}` })

await loadOrganizations()
await load()
onMounted(() => {
  restore()
  if (processing.value) {
    checkoutConfirmationActive.value = true
    void confirmCheckout()
  }
})
onBeforeUnmount(() => (checkoutConfirmationActive.value = false))

async function confirmCheckout() {
  // Paymob redirects before its webhook is guaranteed to have updated our
  // subscription row. Poll briefly, then leave an explicit retry button rather
  // than issuing unbounded background requests.
  for (let attempt = 0; attempt < 10 && paymentRequired.value && checkoutConfirmationActive.value; attempt++) {
    try {
      await load({ force: true })
    }
    catch {
      return
    }
    if (!paymentRequired.value) return
    if (attempt < 9) await new Promise(resolve => setTimeout(resolve, 1_500))
  }
}

watch([current, loading, paymentRequired], async () => {
  if (!current.value || loading.value || paymentRequired.value || redirecting.value) return
  redirecting.value = true
  await navigateTo('/dashboard', { replace: true })
}, { immediate: true })

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <BsAppShell
    :product-name="t('app.name')"
    :groups="[]"
    :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }"
  >
    <template #logo>
      <BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" />
    </template>
    <template #context>
      <BsWorkflowScope v-if="current" :factory="useLedgerOrganizationSwitcherView" :input="{  }">
        <template #default="{ state: ledgerView16 }">
          <BsContextSwitcher
            :model-value="ledgerView16.current?.id ?? null"
            :label="ledgerView16.t('org.switcher')"
            :placeholder="ledgerView16.t('org.none')"
            :options="ledgerView16.contextOptions"
            :create-label="!ledgerView16.ownsOrganization ? ledgerView16.t('org.createAnother') : undefined"
            @update:model-value="value => { if (value) ledgerView16.choose(value) }"
            @create="ledgerView16.showCreate"
          />
          <BsRecordActionDialog
            v-if="ledgerView16.createOpen"
            :visible="true"
            :title="ledgerView16.t('org.createAnother')"
            size="md"
            :dirty="ledgerView16.overlayDirty0"
            :pending="ledgerView16.pending"
            :error="ledgerView16.errorMessage"
            @update:visible="(value: boolean) => { if (!value) ledgerView16.closeCreate() }"
            @submit="ledgerView16.createAndStartTrial"
          >
            <BsText tone="link" emphasis="semibold">{{ ledgerView16.t('org.additionalEyebrow') }}</BsText>
            <BsText tone="muted">{{ ledgerView16.t('org.additionalBillingHint') }}</BsText>
            <BsField :label="ledgerView16.t('org.name')" required>
              <template #default="field">
                <BsInput :id="field.id" v-model="ledgerView16.name" required />
              </template>
            </BsField>
            <BsField :label="ledgerView16.t('onboarding.legalName')" required>
              <template #default="field">
                <BsInput :id="field.id" v-model="ledgerView16.legalName" required />
              </template>
            </BsField>
            <BsField :label="ledgerView16.t('accounts.currency')">
              <BsSelect v-model="ledgerView16.currency" :label="ledgerView16.t('accounts.currency')" :options="['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED']" />
            </BsField>
            <BsAlert tone="info" :title="ledgerView16.t('org.separateSubscriptionTitle')" :description="ledgerView16.t('org.separateSubscriptionBody')" />
            <template #actions="{ close }">
              <BsButton type="button" :disabled="ledgerView16.pending" @click="close">{{ ledgerView16.t('common.cancel') }}</BsButton>
              <BsButton type="submit" variant="accent" :pending="ledgerView16.pending">{{ ledgerView16.t('org.createAndStartTrial') }}</BsButton>
            </template>
          </BsRecordActionDialog>
        </template>
      </BsWorkflowScope>
    </template>
    <template #header>
      <BsUserMenu :email="user?.email" :account-label="t('common.accountMenu')" :sign-out-label="t('common.signOut')" @sign-out="signOut" />
    </template>
    <BsBox v-if="loading">{{ t('app.loading') }}</BsBox>
    <BsWorkflowScope v-else-if="current && paymentRequired" :factory="useLedgerSubscriptionGateView" :input="{  }">
      <template #default="{ state: ledgerView17 }">
        <BsBox as="section">
          <BsCard as="div" padding="lg">
            <BsStack gap="lg">
              <BsBox>
                <BsText size="sm" emphasis="semibold">{{ ledgerView17.t('billing.singlePlan') }}</BsText>
                <BsHeading :level="1" size="h1">{{ ledgerView17.t('billing.unlock', { organization: ledgerView17.current?.name }) }}</BsHeading>
                <BsText size="sm" tone="muted">{{ ledgerView17.t('billing.gateDescription') }}</BsText>
              </BsBox>
              <BsList :ordered="false" marker="none">
                <BsListItem><BsIcon name="check" :size="18" />{{ ledgerView17.t('billing.featureAccounting') }}</BsListItem>
                <BsListItem><BsIcon name="check" :size="18" />{{ ledgerView17.t('billing.featureAutomation') }}</BsListItem>
                <BsListItem><BsIcon name="check" :size="18" />{{ ledgerView17.t('billing.featureTeam') }}</BsListItem>
              </BsList>
              <BsBox v-if="ledgerView17.processing" role="status" padding="md" surface="muted" radius="control">
                <BsText emphasis="semibold">{{ ledgerView17.t('billing.confirming') }}</BsText>
                <BsButton variant="link" type="button" :disabled="ledgerView17.loading" @click="ledgerView17.checkAgain">{{ ledgerView17.t('billing.checkAgain') }}</BsButton>
              </BsBox>
              <BsBox v-else-if="ledgerView17.paymentFailed" role="alert">{{ ledgerView17.t('billing.paymentFailed') }}</BsBox>
              <BsWorkflowScope :factory="useLedgerBillingCheckoutView" :input="{  }">
                <template #default="{ state: ledgerView18 }">
                  <BsBox data-testid="plan-pricing">
                    <BsBox
                      v-if="ledgerView18.trialPlanCurrent && ledgerView18.surface === 'checkout'"
                      data-testid="trial-summary"
                      as="section"
                      padding="lg"
                      border
                      radius="card"
                    >
                      <template v-if="ledgerView18.accessState === 'trialing'">
                        <BsHeading :level="2" size="h3">{{ ledgerView18.t('billing.trial.activeTitle') }}</BsHeading>
                        <BsText size="sm">{{ ledgerView18.t('billing.trial.activeBenefits') }}</BsText>
                        <BsText size="sm" tone="muted">{{ ledgerView18.t('billing.trial.endsOn', { date: ledgerView18.formatDate(ledgerView18.subscription?.trial_ends_at) }) }}</BsText>
                        <BsText size="sm" tone="muted">{{ ledgerView18.t('billing.trial.optionalConversion') }}</BsText>
                      </template>
                      <template v-else-if="ledgerView18.accessState === 'read_only'">
                        <BsHeading :level="2" size="h3">{{ ledgerView18.t('billing.trial.expiredTitle') }}</BsHeading>
                        <BsText size="sm">{{ ledgerView18.t('billing.trial.expiredBody', { date: ledgerView18.formatDate(ledgerView18.subscription?.trial_ends_at) }) }}</BsText>
                        <BsText size="sm" emphasis="semibold">{{ ledgerView18.t('billing.trial.resumeWrites') }}</BsText>
                      </template>
                    </BsBox>
                    <BsButton
                      v-if="['checkout', 'manage', 'display'].includes(ledgerView18.surface) && ledgerView18.can('billing.manage')"
                      type="button"
                      @click="ledgerView18.manualPlan = undefined; ledgerView18.manualOpen = true"
                    >{{ ledgerView18.t('billing.manual.requests') }}</BsButton>
                    <BsWorkflowScope
                      v-if="ledgerView18.manualOpen"
                      :key="`${ledgerView18.currentId}:${ledgerView18.user?.id}`"
                      :factory="useLedgerManualPaymentCheckoutView"
                      :input="{ plan: (ledgerView18.manualPlan), interval: (ledgerView18.interval) }"
                      @close="ledgerView18.manualOpen = false"
                    >
                      <template #default="{ state: ledgerView19 }">
                        <BsDialog
                          :visible="true"
                          :title="ledgerView19.t('billing.manual.title')"
                          :dirty="ledgerView19.dirty"
                          :pending="ledgerView19.pending"
                          size="lg"
                          @update:visible="(value: boolean) => { if (!value) ledgerView19.emit('close') }"
                        >
                          <BsStack gap="md" padding="lg">
                            <BsText v-if="!ledgerView19.can('billing.manage')" role="alert">{{ ledgerView19.t('billing.manual.denied') }}</BsText>
                            <template v-else>
                              <BsText v-if="ledgerView19.pending" role="status">{{ ledgerView19.t('app.loading') }}</BsText>
                              <BsText v-if="ledgerView19.error || ledgerView19.validation" role="alert" tone="danger">{{ ledgerView19.error || ledgerView19.validation }}</BsText>
                              <BsButton
                                type="button"
                                :disabled="ledgerView19.pending || ledgerView19.dirty"
                                @click="ledgerView19.load(ledgerView19.plan, ledgerView19.interval, ledgerView19.quoteId)"
                              >{{ ledgerView19.t('common.refresh') }}</BsButton>
                              <BsText v-if="!ledgerView19.pending && !ledgerView19.selected && !ledgerView19.error">{{ ledgerView19.t('billing.manual.empty') }}</BsText>
                              <template v-if="ledgerView19.selected">
                                <BsText size="sm" tone="muted">{{ ledgerView19.t('billing.manual.pendingHint') }}</BsText>
                                <BsText emphasis="bold">{{ ledgerView19.t(`billing.plans.${ledgerView19.selected.plan_key}.name`) }} · {{ ledgerView19.t(`billing.${ledgerView19.selected.billing_interval}`) }} · {{ new Intl.NumberFormat(ledgerView19.locale, { style: 'currency', currency: ledgerView19.selected.currency_code.trim() }).format(ledgerView19.selected.amount_minor / 100) }}</BsText>
                                <BsText role="status">{{ ledgerView19.t(`billing.manual.states.${ledgerView19.selected.status}`) }}</BsText>
                                <BsButton v-if="ledgerView19.selected.status === 'approved'" type="button" variant="primary" @click="reloadNuxtApp({ path: '/billing' })">{{ ledgerView19.t('billing.manual.openSubscription') }}</BsButton>
                                <BsText wrap="preserve">{{ ledgerView19.selected.instructions }}</BsText>
                                <BsText size="sm">{{ ledgerView19.t('billing.manual.reference') }}: {{ ledgerView19.selected.id }}</BsText>
                                <BsText v-if="ledgerView19.selected.period_start && ledgerView19.selected.period_end">{{ ledgerView19.date(ledgerView19.selected.period_start) }} — {{ ledgerView19.date(ledgerView19.selected.period_end) }}</BsText>
                                <BsForm v-if="ledgerView19.cancelAllowed" @submit.prevent="ledgerView19.send">
                                  <BsFieldLabel v-if="ledgerView19.uploadAllowed">
                                    <BsText as="span">{{ ledgerView19.t('billing.manual.receipt') }}</BsText>
                                    <BsFileInput
                                      :key="ledgerView19.selected.evidence_id ?? ledgerView19.selected.id"
                                      accept="image/jpeg,image/png,application/pdf"
                                      :disabled="ledgerView19.pending"
                                      bare
                                      @change="ledgerView19.chooseFile"
                                    />
                                    <BsText as="span" size="xs" tone="muted">{{ ledgerView19.t('billing.manual.fileHint') }}</BsText>
                                  </BsFieldLabel>
                                  <BsFloatingField :label="ledgerView19.t('billing.manual.reason')">
                                    <BsTextarea v-model="ledgerView19.reason" maxlength="1000" required :disabled="ledgerView19.pending" />
                                  </BsFloatingField>
                                  <BsInline gap="sm" :wrap="true">
                                    <BsButton
                                      v-if="ledgerView19.uploadAllowed"
                                      type="submit"
                                      :disabled="ledgerView19.pending || !ledgerView19.file || !ledgerView19.reason.trim()"
                                      variant="primary"
                                    >{{ ledgerView19.t('billing.manual.submit') }}</BsButton>
                                    <BsButton type="button" :disabled="ledgerView19.pending || !ledgerView19.reason.trim()" @click="ledgerView19.cancelRequest">{{ ledgerView19.t('billing.manual.cancel') }}</BsButton>
                                  </BsInline>
                                </BsForm>
                                <BsHeading :level="3" size="body">{{ ledgerView19.t('billing.manual.history') }}</BsHeading>
                                <BsList :ordered="true" marker="none">
                                  <BsListItem v-for="event in ledgerView19.history" :key="event.id">{{ ledgerView19.date(event.occurred_at) }} · {{ ledgerView19.t(`billing.manual.states.${event.after_state}`) }} · {{ event.reason }}</BsListItem>
                                </BsList>
                                <BsList :ordered="false" marker="none">
                                  <BsListItem v-for="receipt in ledgerView19.evidence" :key="receipt.id">
                                    <BsButton variant="link" type="button" :disabled="ledgerView19.pending" @click="ledgerView19.download(receipt)">{{ receipt.filename }} · {{ ledgerView19.date(receipt.submitted_at) }}</BsButton>
                                  </BsListItem>
                                </BsList>
                              </template>
                              <BsList v-if="ledgerView19.requests.length > 1" :ordered="false" marker="none">
                                <BsListItem v-for="payment in ledgerView19.requests" :key="payment.id">
                                  <BsButton variant="link" type="button" :disabled="ledgerView19.pending || ledgerView19.dirty" @click="ledgerView19.select(payment)">{{ ledgerView19.date(payment.created_at) }} · {{ ledgerView19.t(`billing.plans.${payment.plan_key}.name`) }}</BsButton>
                                </BsListItem>
                              </BsList>
                            </template>
                          </BsStack>
                        </BsDialog>
                      </template>
                    </BsWorkflowScope>
                    <BsMarketingPricing
                      :interval="ledgerView18.interval"
                      :plans="ledgerView18.pricingPlans"
                      test-id="plan-pricing-grid"
                      :interval-options="[{ value: 'monthly', label: ledgerView18.t('billing.monthly') }, { value: 'yearly', label: ledgerView18.t('billing.yearly') }]"
                      :copy="{ cycleLabel: ledgerView18.t('billing.billingCycle'), loading: ledgerView18.t('billing.plans.loading'), empty: ledgerView18.t('billing.plans.loadFailed'), retry: ledgerView18.t('common.retry'), included: ledgerView18.t('billing.plans.included'), notIncluded: ledgerView18.t('billing.plans.notIncluded') }"
                      :annual-saving="ledgerView18.annualDiscount === null ? null : ledgerView18.t('billing.plans.annualDiscount', { percent: ledgerView18.annualDiscount })"
                      :loading="ledgerView18.catalogPending"
                      :error="ledgerView18.catalogError ? ledgerView18.t('billing.plans.loadFailed') : null"
                      @update:interval="value => { if (value === 'monthly' || value === 'yearly') ledgerView18.interval = value }"
                      @retry="ledgerView18.refresh"
                      @action="ledgerView18.choosePlan"
                      @secondary-action="ledgerView18.chooseManualPlan"
                    />
                    <BsBox v-if="ledgerView18.surface === 'checkout'" data-testid="checkout-policy-review" role="note" as="section" padding="lg">
                      <BsI18nText keypath="billing.policyReview" tag="p" scope="global">
                        <template #terms>
                          <BsLink to="/terms" target="_blank" rel="noopener">{{ ledgerView18.t('marketing.terms') }}</BsLink>
                        </template>
                        <template #refund>
                          <BsLink to="/refund-cancellation" target="_blank" rel="noopener">{{ ledgerView18.t('marketing.refundCancellation') }}</BsLink>
                        </template>
                        <template #privacy>
                          <BsLink to="/privacy" target="_blank" rel="noopener">{{ ledgerView18.t('marketing.privacy') }}</BsLink>
                        </template>
                      </BsI18nText>
                    </BsBox>
                    <BsBox v-if="ledgerView18.surface === 'checkout' || ledgerView18.surface === 'public'" data-testid="payment-method-branding" role="note" as="section">{{ ledgerView18.t('billing.securePayments') }}</BsBox>
                    <BsText v-if="ledgerView18.surface === 'checkout'" size="xs" tone="muted" align="center">{{ ledgerView18.t('billing.paymentRequired') }}</BsText>
                    <BsText v-if="ledgerView18.surface === 'manage' && ledgerView18.compatibilityPlanCurrent" role="note" size="sm" tone="muted">{{ ledgerView18.t('billing.planChange.legacyGrandfathered') }}</BsText>
                    <BsText v-if="ledgerView18.errorMessage" role="alert" tone="danger">{{ ledgerView18.errorMessage }}</BsText>
                    <BsDialog
                      v-if="ledgerView18.planImpact"
                      :visible="true"
                      :title="ledgerView18.t('billing.planChange.title')"
                      :aria-label="ledgerView18.t('billing.planChange.title')"
                      :show-header="false"
                      size="md"
                      @update:visible="(value: boolean) => { if (!value) ledgerView18.planImpact = null }"
                    >
                      <template #default="{ close: dismiss }">
                        <BsCard data-testid="plan-change-impact" as="section" padding="lg">
                          <BsInline gap="md" :wrap="false" align="start" justify="between">
                            <BsBox>
                              <BsHeading id="plan-change-title" :level="2" size="h3">{{ ledgerView18.t('billing.planChange.title') }}</BsHeading>
                              <BsText size="sm" tone="muted">{{ ledgerView18.t('billing.planChange.summary', {
                current: ledgerView18.planNameForKey(ledgerView18.planImpact.current_plan_key),
                target: ledgerView18.planNameForKey(ledgerView18.planImpact.target_plan_key),
              }) }}</BsText>
                            </BsBox>
                            <BsButton variant="icon" type="button" :aria-label="ledgerView18.t('common.close')" @click="dismiss">
                              <BsIcon name="close" :size="20" />
                            </BsButton>
                          </BsInline>
                          <BsBox padding="lg" surface="muted" radius="card">
                            <BsText emphasis="bold">{{ ledgerView18.t('billing.planChange.noDeletion') }}</BsText>
                            <BsText tone="muted">{{ ledgerView18.t('billing.planChange.targetPrice', {
              price: ledgerView18.t('billing.plans.price', { amount: ledgerView18.formatAmount(ledgerView18.planImpact.target_amount_minor) }),
              interval: ledgerView18.t(`billing.${ledgerView18.planImpact.target_interval}`),
            }) }}</BsText>
                          </BsBox>
                          <BsHeading :level="3" size="body">{{ ledgerView18.t('billing.planChange.capacityTitle') }}</BsHeading>
                          <BsList :ordered="false" marker="none">
                            <BsListItem v-for="quota in ledgerView18.quotaImpacts" :key="quota.quota_key" :data-impact-quota="quota.quota_key">
                              <BsInline gap="md" :wrap="false" align="start" justify="between">
                                <BsText as="span" emphasis="semibold">{{ ledgerView18.t(`usage.quotas.${quota.quota_key}`) }}</BsText>
                                <BsText v-if="quota.will_block_new_activity" as="span" size="xs" tone="danger" emphasis="bold">{{ ledgerView18.t('billing.planChange.blocked') }}</BsText>
                                <BsText v-else as="span" size="xs" tone="success" emphasis="bold">{{ ledgerView18.t('billing.planChange.available') }}</BsText>
                              </BsInline>
                              <BsText tone="muted">{{ ledgerView18.t('billing.planChange.usageLimit', {
                used: ledgerView18.formatQuota(quota.quota_key, quota.used_value),
                limit: ledgerView18.formatQuota(quota.quota_key, quota.target_limit_value),
              }) }}</BsText>
                            </BsListItem>
                          </BsList>
                          <BsBox v-if="ledgerView18.gainedFeatures.length || ledgerView18.auditHistoryIncreased">
                            <BsHeading :level="3" size="body">{{ ledgerView18.t('billing.planChange.gainedTitle') }}</BsHeading>
                            <BsList :ordered="false" marker="disc">
                              <BsListItem v-for="feature in ledgerView18.gainedFeatures" :key="feature.feature_key">{{ ledgerView18.featureName(feature.feature_key) }}</BsListItem>
                              <BsListItem v-if="ledgerView18.auditHistoryIncreased">{{ ledgerView18.t('billing.planChange.auditHistoryIncreased', { days: ledgerView18.formatNumber(ledgerView18.planImpact.audit_history_target_days) }) }}</BsListItem>
                            </BsList>
                          </BsBox>
                          <BsBox v-if="ledgerView18.lostFeatures.length || ledgerView18.planImpact.audit_history_reduced">
                            <BsHeading :level="3" size="body">{{ ledgerView18.t('billing.planChange.lostTitle') }}</BsHeading>
                            <BsList :ordered="false" marker="disc">
                              <BsListItem v-for="feature in ledgerView18.lostFeatures" :key="feature.feature_key">{{ ledgerView18.featureName(feature.feature_key) }}</BsListItem>
                              <BsListItem v-if="ledgerView18.planImpact.audit_history_reduced">{{ ledgerView18.t('billing.planChange.auditHistoryReduced', { days: ledgerView18.formatNumber(ledgerView18.planImpact.audit_history_target_days) }) }}</BsListItem>
                            </BsList>
                          </BsBox>
                          <BsBox v-if="ledgerView18.planImpact.requires_manual_handoff" role="note" padding="lg" border radius="card">
                            <BsText emphasis="bold">{{ ledgerView18.t('billing.planChange.handoffTitle') }}</BsText>
                            <BsText tone="muted">{{ ledgerView18.t('billing.planChange.handoffBody') }}</BsText>
                          </BsBox>
                          <BsText v-else size="sm" tone="muted">{{ ledgerView18.t('billing.planChange.noChange') }}</BsText>
                          <BsInline gap="none" :wrap="false" justify="end">
                            <BsButton type="button" variant="primary" @click="dismiss">{{ ledgerView18.t('common.close') }}</BsButton>
                          </BsInline>
                        </BsCard>
                      </template>
                    </BsDialog>
                  </BsBox>
                </template>
              </BsWorkflowScope>
            </BsStack>
          </BsCard>
        </BsBox>
      </template>
    </BsWorkflowScope>
  </BsAppShell>
</template>
