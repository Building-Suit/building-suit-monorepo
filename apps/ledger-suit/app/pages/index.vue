<script setup lang="ts">
import { useLedgerBillingCheckoutView } from '~/composables/useLedgerBillingCheckoutView'
import { useLedgerManualPaymentCheckoutView } from '~/composables/useLedgerManualPaymentCheckoutView'
definePageMeta({ layout: 'marketing' })

const { t } = useI18n()
useHead(() => ({
  title: `${t('landing.title')} · ${t('app.name')}`,
  meta: [{ name: 'description', content: t('landing.metaDescription') }],
}))

const features = [
  { icon: 'cash', key: 'cashflow' },
  { icon: 'ledger', key: 'ledger' },
  { icon: 'invoice', key: 'commitments' },
  { icon: 'automation', key: 'automation' },
  { icon: 'reports', key: 'reports' },
  { icon: 'team', key: 'team' },
]
const content = computed(() => ({
  eyebrow: t('landing.eyebrow'),
  heroTitle: t('landing.heroTitle'),
  heroBody: t('landing.heroBody'),
  createWorkspace: t('landing.createWorkspace'),
  explore: t('landing.explore'),
  trialNote: t('landing.trialNote'),
  featuresEyebrow: t('landing.featuresEyebrow'),
  featuresTitle: t('landing.featuresTitle'),
  featuresBody: t('landing.featuresBody'),
  workflowEyebrow: t('landing.workflowEyebrow'),
  workflowTitle: t('landing.workflowTitle'),
  pricingEyebrow: t('landing.pricingEyebrow'),
  pricingTitle: t('landing.pricingTitle'),
  pricingBody: t('landing.pricingBody'),
  features: features.map(item => ({ icon: item.icon, title: t(`landing.features.${item.key}.title`), body: t(`landing.features.${item.key}.body`) })),
  workflow: [1, 2, 3].map(step => ({ title: t(`landing.workflow.${step}.title`), body: t(`landing.workflow.${step}.body`) })),
}))
</script>

<template>
  <BsLandingPage :content="content">
    <template #preview>
      <BsDashboardPreview
        :label="t('landing.previewLabel')"
        :title="t('landing.cashflowPreview')"
        :period-label="'6 ' + t('landing.months')"
        :metrics="['cash', 'revenue', 'expenses', 'profit'].map((metric, index) => ({ label: t(`landing.metrics.${metric}`), value: ['EGP 482,400', 'EGP 96,800', 'EGP 51,200', 'EGP 45,600'][index]! }))"
      />
    </template>
    <template #pricing>
      <BsWorkflowScope :factory="useLedgerBillingCheckoutView" :input="{ surface: 'public' }">
        <template #default="{ state: ledgerView8 }">
          <BsBox data-testid="plan-pricing">
            <BsBox
              v-if="ledgerView8.trialPlanCurrent && ledgerView8.surface === 'checkout'"
              data-testid="trial-summary"
              as="section"
              padding="lg"
              border
              radius="card"
            >
              <template v-if="ledgerView8.accessState === 'trialing'">
                <BsHeading :level="2" size="h3">{{ ledgerView8.t('billing.trial.activeTitle') }}</BsHeading>
                <BsText size="sm">{{ ledgerView8.t('billing.trial.activeBenefits') }}</BsText>
                <BsText size="sm" tone="muted">{{ ledgerView8.t('billing.trial.endsOn', { date: ledgerView8.formatDate(ledgerView8.subscription?.trial_ends_at) }) }}</BsText>
                <BsText size="sm" tone="muted">{{ ledgerView8.t('billing.trial.optionalConversion') }}</BsText>
              </template>
              <template v-else-if="ledgerView8.accessState === 'read_only'">
                <BsHeading :level="2" size="h3">{{ ledgerView8.t('billing.trial.expiredTitle') }}</BsHeading>
                <BsText size="sm">{{ ledgerView8.t('billing.trial.expiredBody', { date: ledgerView8.formatDate(ledgerView8.subscription?.trial_ends_at) }) }}</BsText>
                <BsText size="sm" emphasis="semibold">{{ ledgerView8.t('billing.trial.resumeWrites') }}</BsText>
              </template>
            </BsBox>
            <BsButton
              v-if="['checkout', 'manage', 'display'].includes(ledgerView8.surface) && ledgerView8.can('billing.manage')"
              type="button"
              @click="ledgerView8.manualPlan = undefined; ledgerView8.manualOpen = true"
            >{{ ledgerView8.t('billing.manual.requests') }}</BsButton>
            <BsWorkflowScope
              v-if="ledgerView8.manualOpen"
              :key="`${ledgerView8.currentId}:${ledgerView8.user?.id}`"
              :factory="useLedgerManualPaymentCheckoutView"
              :input="{ plan: (ledgerView8.manualPlan), interval: (ledgerView8.interval) }"
              @close="ledgerView8.manualOpen = false"
            >
              <template #default="{ state: ledgerView9 }">
                <BsDialog
                  :visible="true"
                  :title="ledgerView9.t('billing.manual.title')"
                  :dirty="ledgerView9.dirty"
                  :pending="ledgerView9.pending"
                  size="lg"
                  @update:visible="(value: boolean) => { if (!value) ledgerView9.emit('close') }"
                >
                  <BsStack gap="md" padding="lg">
                    <BsText v-if="!ledgerView9.can('billing.manage')" role="alert">{{ ledgerView9.t('billing.manual.denied') }}</BsText>
                    <template v-else>
                      <BsText v-if="ledgerView9.pending" role="status">{{ ledgerView9.t('app.loading') }}</BsText>
                      <BsText v-if="ledgerView9.error || ledgerView9.validation" role="alert" tone="danger">{{ ledgerView9.error || ledgerView9.validation }}</BsText>
                      <BsButton
                        type="button"
                        :disabled="ledgerView9.pending || ledgerView9.dirty"
                        @click="ledgerView9.load(ledgerView9.plan, ledgerView9.interval, ledgerView9.quoteId)"
                      >{{ ledgerView9.t('common.refresh') }}</BsButton>
                      <BsText v-if="!ledgerView9.pending && !ledgerView9.selected && !ledgerView9.error">{{ ledgerView9.t('billing.manual.empty') }}</BsText>
                      <template v-if="ledgerView9.selected">
                        <BsText size="sm" tone="muted">{{ ledgerView9.t('billing.manual.pendingHint') }}</BsText>
                        <BsText emphasis="bold">{{ ledgerView9.t(`billing.plans.${ledgerView9.selected.plan_key}.name`) }} · {{ ledgerView9.t(`billing.${ledgerView9.selected.billing_interval}`) }} · {{ new Intl.NumberFormat(ledgerView9.locale, { style: 'currency', currency: ledgerView9.selected.currency_code.trim() }).format(ledgerView9.selected.amount_minor / 100) }}</BsText>
                        <BsText role="status">{{ ledgerView9.t(`billing.manual.states.${ledgerView9.selected.status}`) }}</BsText>
                        <BsButton v-if="ledgerView9.selected.status === 'approved'" type="button" variant="primary" @click="reloadNuxtApp({ path: '/billing' })">{{ ledgerView9.t('billing.manual.openSubscription') }}</BsButton>
                        <BsText wrap="preserve">{{ ledgerView9.selected.instructions }}</BsText>
                        <BsText size="sm">{{ ledgerView9.t('billing.manual.reference') }}: {{ ledgerView9.selected.id }}</BsText>
                        <BsText v-if="ledgerView9.selected.period_start && ledgerView9.selected.period_end">{{ ledgerView9.date(ledgerView9.selected.period_start) }} — {{ ledgerView9.date(ledgerView9.selected.period_end) }}</BsText>
                        <BsForm v-if="ledgerView9.cancelAllowed" @submit.prevent="ledgerView9.send">
                          <BsFieldLabel v-if="ledgerView9.uploadAllowed">
                            <BsText as="span">{{ ledgerView9.t('billing.manual.receipt') }}</BsText>
                            <BsFileInput
                              :key="ledgerView9.selected.evidence_id ?? ledgerView9.selected.id"
                              accept="image/jpeg,image/png,application/pdf"
                              :disabled="ledgerView9.pending"
                              bare
                              @change="ledgerView9.chooseFile"
                            />
                            <BsText as="span" size="xs" tone="muted">{{ ledgerView9.t('billing.manual.fileHint') }}</BsText>
                          </BsFieldLabel>
                          <BsFloatingField :label="ledgerView9.t('billing.manual.reason')">
                            <BsTextarea v-model="ledgerView9.reason" maxlength="1000" required :disabled="ledgerView9.pending" />
                          </BsFloatingField>
                          <BsInline gap="sm" :wrap="true">
                            <BsButton
                              v-if="ledgerView9.uploadAllowed"
                              type="submit"
                              :disabled="ledgerView9.pending || !ledgerView9.file || !ledgerView9.reason.trim()"
                              variant="primary"
                            >{{ ledgerView9.t('billing.manual.submit') }}</BsButton>
                            <BsButton type="button" :disabled="ledgerView9.pending || !ledgerView9.reason.trim()" @click="ledgerView9.cancelRequest">{{ ledgerView9.t('billing.manual.cancel') }}</BsButton>
                          </BsInline>
                        </BsForm>
                        <BsHeading :level="3" size="body">{{ ledgerView9.t('billing.manual.history') }}</BsHeading>
                        <BsList :ordered="true" marker="none">
                          <BsListItem v-for="event in ledgerView9.history" :key="event.id">{{ ledgerView9.date(event.occurred_at) }} · {{ ledgerView9.t(`billing.manual.states.${event.after_state}`) }} · {{ event.reason }}</BsListItem>
                        </BsList>
                        <BsList :ordered="false" marker="none">
                          <BsListItem v-for="receipt in ledgerView9.evidence" :key="receipt.id">
                            <BsButton variant="link" type="button" :disabled="ledgerView9.pending" @click="ledgerView9.download(receipt)">{{ receipt.filename }} · {{ ledgerView9.date(receipt.submitted_at) }}</BsButton>
                          </BsListItem>
                        </BsList>
                      </template>
                      <BsList v-if="ledgerView9.requests.length > 1" :ordered="false" marker="none">
                        <BsListItem v-for="payment in ledgerView9.requests" :key="payment.id">
                          <BsButton variant="link" type="button" :disabled="ledgerView9.pending || ledgerView9.dirty" @click="ledgerView9.select(payment)">{{ ledgerView9.date(payment.created_at) }} · {{ ledgerView9.t(`billing.plans.${payment.plan_key}.name`) }}</BsButton>
                        </BsListItem>
                      </BsList>
                    </template>
                  </BsStack>
                </BsDialog>
              </template>
            </BsWorkflowScope>
            <BsMarketingPricing
              :interval="ledgerView8.interval"
              :plans="ledgerView8.pricingPlans"
              test-id="plan-pricing-grid"
              :interval-options="[{ value: 'monthly', label: ledgerView8.t('billing.monthly') }, { value: 'yearly', label: ledgerView8.t('billing.yearly') }]"
              :copy="{ cycleLabel: ledgerView8.t('billing.billingCycle'), loading: ledgerView8.t('billing.plans.loading'), empty: ledgerView8.t('billing.plans.loadFailed'), retry: ledgerView8.t('common.retry'), included: ledgerView8.t('billing.plans.included'), notIncluded: ledgerView8.t('billing.plans.notIncluded') }"
              :annual-saving="ledgerView8.annualDiscount === null ? null : ledgerView8.t('billing.plans.annualDiscount', { percent: ledgerView8.annualDiscount })"
              :loading="ledgerView8.catalogPending"
              :error="ledgerView8.catalogError ? ledgerView8.t('billing.plans.loadFailed') : null"
              @update:interval="value => { if (value === 'monthly' || value === 'yearly') ledgerView8.interval = value }"
              @retry="ledgerView8.refresh"
              @action="ledgerView8.choosePlan"
              @secondary-action="ledgerView8.chooseManualPlan"
            />
            <BsBox v-if="ledgerView8.surface === 'checkout'" data-testid="checkout-policy-review" role="note" as="section" padding="lg">
              <BsI18nText keypath="billing.policyReview" tag="p" scope="global">
                <template #terms>
                  <BsLink to="/terms" target="_blank" rel="noopener">{{ ledgerView8.t('marketing.terms') }}</BsLink>
                </template>
                <template #refund>
                  <BsLink to="/refund-cancellation" target="_blank" rel="noopener">{{ ledgerView8.t('marketing.refundCancellation') }}</BsLink>
                </template>
                <template #privacy>
                  <BsLink to="/privacy" target="_blank" rel="noopener">{{ ledgerView8.t('marketing.privacy') }}</BsLink>
                </template>
              </BsI18nText>
            </BsBox>
            <BsBox v-if="ledgerView8.surface === 'checkout' || ledgerView8.surface === 'public'" data-testid="payment-method-branding" role="note" as="section">{{ ledgerView8.t('billing.securePayments') }}</BsBox>
            <BsText v-if="ledgerView8.surface === 'checkout'" size="xs" tone="muted" align="center">{{ ledgerView8.t('billing.paymentRequired') }}</BsText>
            <BsText v-if="ledgerView8.surface === 'manage' && ledgerView8.compatibilityPlanCurrent" role="note" size="sm" tone="muted">{{ ledgerView8.t('billing.planChange.legacyGrandfathered') }}</BsText>
            <BsText v-if="ledgerView8.errorMessage" role="alert" tone="danger">{{ ledgerView8.errorMessage }}</BsText>
            <BsDialog
              v-if="ledgerView8.planImpact"
              :visible="true"
              :title="ledgerView8.t('billing.planChange.title')"
              :aria-label="ledgerView8.t('billing.planChange.title')"
              :show-header="false"
              size="md"
              @update:visible="(value: boolean) => { if (!value) ledgerView8.planImpact = null }"
            >
              <template #default="{ close: dismiss }">
                <BsCard data-testid="plan-change-impact" as="section" padding="lg">
                  <BsInline gap="md" :wrap="false" align="start" justify="between">
                    <BsBox>
                      <BsHeading id="plan-change-title" :level="2" size="h3">{{ ledgerView8.t('billing.planChange.title') }}</BsHeading>
                      <BsText size="sm" tone="muted">{{ ledgerView8.t('billing.planChange.summary', {
                current: ledgerView8.planNameForKey(ledgerView8.planImpact.current_plan_key),
                target: ledgerView8.planNameForKey(ledgerView8.planImpact.target_plan_key),
              }) }}</BsText>
                    </BsBox>
                    <BsButton variant="icon" type="button" :aria-label="ledgerView8.t('common.close')" @click="dismiss">
                      <BsIcon name="close" :size="20" />
                    </BsButton>
                  </BsInline>
                  <BsBox padding="lg" surface="muted" radius="card">
                    <BsText emphasis="bold">{{ ledgerView8.t('billing.planChange.noDeletion') }}</BsText>
                    <BsText tone="muted">{{ ledgerView8.t('billing.planChange.targetPrice', {
              price: ledgerView8.t('billing.plans.price', { amount: ledgerView8.formatAmount(ledgerView8.planImpact.target_amount_minor) }),
              interval: ledgerView8.t(`billing.${ledgerView8.planImpact.target_interval}`),
            }) }}</BsText>
                  </BsBox>
                  <BsHeading :level="3" size="body">{{ ledgerView8.t('billing.planChange.capacityTitle') }}</BsHeading>
                  <BsList :ordered="false" marker="none">
                    <BsListItem v-for="quota in ledgerView8.quotaImpacts" :key="quota.quota_key" :data-impact-quota="quota.quota_key">
                      <BsInline gap="md" :wrap="false" align="start" justify="between">
                        <BsText as="span" emphasis="semibold">{{ ledgerView8.t(`usage.quotas.${quota.quota_key}`) }}</BsText>
                        <BsText v-if="quota.will_block_new_activity" as="span" size="xs" tone="danger" emphasis="bold">{{ ledgerView8.t('billing.planChange.blocked') }}</BsText>
                        <BsText v-else as="span" size="xs" tone="success" emphasis="bold">{{ ledgerView8.t('billing.planChange.available') }}</BsText>
                      </BsInline>
                      <BsText tone="muted">{{ ledgerView8.t('billing.planChange.usageLimit', {
                used: ledgerView8.formatQuota(quota.quota_key, quota.used_value),
                limit: ledgerView8.formatQuota(quota.quota_key, quota.target_limit_value),
              }) }}</BsText>
                    </BsListItem>
                  </BsList>
                  <BsBox v-if="ledgerView8.gainedFeatures.length || ledgerView8.auditHistoryIncreased">
                    <BsHeading :level="3" size="body">{{ ledgerView8.t('billing.planChange.gainedTitle') }}</BsHeading>
                    <BsList :ordered="false" marker="disc">
                      <BsListItem v-for="feature in ledgerView8.gainedFeatures" :key="feature.feature_key">{{ ledgerView8.featureName(feature.feature_key) }}</BsListItem>
                      <BsListItem v-if="ledgerView8.auditHistoryIncreased">{{ ledgerView8.t('billing.planChange.auditHistoryIncreased', { days: ledgerView8.formatNumber(ledgerView8.planImpact.audit_history_target_days) }) }}</BsListItem>
                    </BsList>
                  </BsBox>
                  <BsBox v-if="ledgerView8.lostFeatures.length || ledgerView8.planImpact.audit_history_reduced">
                    <BsHeading :level="3" size="body">{{ ledgerView8.t('billing.planChange.lostTitle') }}</BsHeading>
                    <BsList :ordered="false" marker="disc">
                      <BsListItem v-for="feature in ledgerView8.lostFeatures" :key="feature.feature_key">{{ ledgerView8.featureName(feature.feature_key) }}</BsListItem>
                      <BsListItem v-if="ledgerView8.planImpact.audit_history_reduced">{{ ledgerView8.t('billing.planChange.auditHistoryReduced', { days: ledgerView8.formatNumber(ledgerView8.planImpact.audit_history_target_days) }) }}</BsListItem>
                    </BsList>
                  </BsBox>
                  <BsBox v-if="ledgerView8.planImpact.requires_manual_handoff" role="note" padding="lg" border radius="card">
                    <BsText emphasis="bold">{{ ledgerView8.t('billing.planChange.handoffTitle') }}</BsText>
                    <BsText tone="muted">{{ ledgerView8.t('billing.planChange.handoffBody') }}</BsText>
                  </BsBox>
                  <BsText v-else size="sm" tone="muted">{{ ledgerView8.t('billing.planChange.noChange') }}</BsText>
                  <BsInline gap="none" :wrap="false" justify="end">
                    <BsButton type="button" variant="primary" @click="dismiss">{{ ledgerView8.t('common.close') }}</BsButton>
                  </BsInline>
                </BsCard>
              </template>
            </BsDialog>
          </BsBox>
        </template>
      </BsWorkflowScope>
    </template>
  </BsLandingPage>
</template>
