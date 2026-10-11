<script setup lang="ts">
import type { ActivityRow, ActivityQuery } from '../utils/activity'
import type { OfferVersion } from '../utils/custom-offer'
import Column from 'primevue/column'
import { approvalBlocked, paymentStatuses } from '../utils/payment-review'
definePageMeta({ layout: false })
const { t, locale } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const { registry, selection, state: registryState, label } = useAdminRegistry()
if (state.value === 'success') await registry.refresh()
watch(state, (value) => {
  registry.clear()
  if (value === 'success') void registry.refresh()
})
onMounted(() => {
  // Periodically re-resolve configuration and manifest expiry without a rebuild.
  const timer = setInterval(() => {
    if (state.value === 'success' && !transferVisible.value && !offerVisible.value && !offerRequest.value && !billingVisible.value && !reviewCommand.value && document.visibilityState === 'visible') void registry.refresh()
  }, 30_000)
  onScopeDispose(() => { clearInterval(timer); registry.clear() })
})
const transfer = useManualTransfer(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'manual-transfer')
const { configuration, draft, reason, status: transferStatus, command, action: transferAction } = transfer
const { visible: transferVisible, pending: transferPending, dirty: transferDirty, error: transferError } = transferAction
const activity = useActivity(() => `${ready.data.value?.userId}:${ready.data.value?.authorityEnvironmentId}:${state.value}:${selection.value.suit?.key}:${selection.value.item?.key}`, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'activity')
const { query: activityQuery, rows: activityRows, sources: activitySources, total: activityTotal, status: activityStatus, retrieving, remoteFailed } = activity
const filterKeys = ['suit', 'environment', 'action', 'actor', 'target', 'from', 'to', 'requestId', 'correlationId'] as const satisfies readonly (keyof ActivityQuery)[]
const activityColumns = computed(() => (['source', 'suit', 'environment', 'actor', 'action', 'target', 'status', 'reason', 'requestId', 'correlationId', 'occurredAt'] as const satisfies readonly (keyof ActivityRow)[]).map(field => ({ key: field, field, header: t(`activity.${field}`), sortable: field === 'occurredAt' })))
const offers = useCustomOffers(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'custom-offers')
const { versions: offerVersions, status: offerStatus, draft: offerDraft, reason: offerReason, command: offerRequest, revokeId, issueId, issuanceAvailable, customerLink } = offers
const { visible: offerVisible, pending: offerPending, dirty: offerDirty, error: offerError } = offers.action
const offerFields = ['recipientUserId', 'companyId', 'basePlanId', 'templateReference', 'displayName', 'priceAmount', 'currency', 'billingInterval', 'expiresAt'] as const
const offerColumns = computed(() => [{ key: 'displayName', field: 'displayName' as const, header: t('offers.displayName') }, { key: 'version', field: 'version' as const, header: t('offers.version') }, { key: 'priceAmount', field: 'priceAmount' as const, header: t('offers.priceAmount') }, { key: 'currency', field: 'currency' as const, header: t('offers.currency') }, { key: 'billingInterval', field: 'billingInterval' as const, header: t('offers.billingInterval') }, { key: 'expiresAt', field: 'expiresAt' as const, header: t('offers.expiresAt') }, { key: 'state', field: 'state' as const, header: t('offers.state') }, { key: 'delivery', header: t('offers.delivery') }])
const billing = usePaymentReview(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'payment-review')
const { queue, status: billingStatus, filter: billingFilter, page: billingPage, selected: payment, draft: reviewDraft, command: reviewCommand, receipt, evidence, evidencePending, evidenceError, action: billingAction } = billing
const { visible: billingVisible, pending: billingPending, dirty: billingDirty, error: billingError } = billingAction
const amount = (value: number, currency: string) => new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(value)
const email = ref('')
const password = ref('')
useHead({ title: () => t('product.name') })
async function submit() {
  const credential = password.value
  password.value = ''
  await signIn(email.value.trim(), credential)
}
</script>

<template>
  <BsRouteLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="t('welcome')" :description="t('description')" padding="lg">
      <BsStateSurface state="success" :title="t('auth.authorized')" />
      <BsStateSurface v-if="registryState !== 'success'" :state="registryState" :title="t(`registry.${registryState}`)" :action-label="registryState === 'loading' ? undefined : t('registry.retry')" @action="registry.refresh()" />
      <BsContentSection v-else :title="selection.item ? label(selection.item.label) : label(selection.suit!.label)" :description="label(selection.item?.description || selection.suit!.description)">
        <div v-if="selection.item?.module === 'payment-review'" class="space-y-4 min-w-0" data-payment-review>
          <p class="text-sm text-fg-muted">{{ t('billing.manual') }}</p>
          <BsField for="billing-filter" :label="t('billing.status')" class="max-w-xs">
            <BsSelect id="billing-filter" v-model="billingFilter" :label="t('billing.status')" :options="[{ label: t('billing.all'), value: '' }, ...paymentStatuses.map(value => ({ label: t(`billing.${value}`), value }))]" option-label="label" option-value="value" @update:model-value="billingPage = 1" />
          </BsField>
          <BsStateSurface v-if="billingStatus !== 'success'" :state="billingStatus" :title="t(`billing.${billingStatus}`)" :action-label="billingStatus === 'error' || billingStatus === 'denied' ? t('billing.reload') : undefined" @action="billing.load()" />
          <BsDataTable v-if="queue" :value="queue.items" :label="t('billing.queue')" lazy paginator :rows="25" :total-records="queue.total" :first="(billingPage - 1) * 25" data-key="id" :capabilities="{ edit: billingStatus === 'success' }" :loading="billingStatus === 'loading'" :action-labels="{ edit: t('billing.review') }" @edit="billing.review" @page="billingPage = $event.page + 1">
            <Column field="shopName" :header="t('billing.shop')" />
            <Column field="requestedPlanName" :header="t('billing.terms')" />
            <Column field="status" :header="t('billing.status')"><template #body="{ data }">{{ t(`billing.${data.status}`) }}</template></Column>
            <Column field="effectivePriceAmount" :header="t('billing.effectivePrice')"><template #body="{ data }">{{ amount(data.effectivePriceAmount, data.currency) }}</template></Column>
            <Column field="transferReference" :header="t('billing.transferReference')" />
          </BsDataTable>
          <BsButton v-if="reviewCommand && !billingVisible" @click="billingVisible = true">{{ t('billing.retry') }}</BsButton>
          <div v-if="receipt" role="status" class="space-y-2 break-all" data-payment-receipt>
            <p class="font-semibold">{{ t('billing.confirmed') }} · {{ t(`billing.${receipt.status}`) }} <span v-if="receipt.replayed">· {{ t('billing.replayed') }}</span></p>
            <p>{{ t('billing.request') }}: {{ receipt.requestId }} · {{ t('billing.correlation') }}: {{ receipt.correlationId }}</p>
            <p>{{ t('billing.audit') }}: {{ receipt.targetAuditId }} · {{ t('billing.resultVersion') }}: {{ receipt.targetResultVersion }}</p>
            <p v-if="receipt.subscriptionId">{{ t('billing.subscription') }}: {{ receipt.subscriptionId }} · {{ t('billing.periodEnd') }}: {{ receipt.periodEnd }}</p>
            <p v-if="receipt.status === 'approved'">{{ t('billing.commercialPeriod') }}: {{ receipt.commercialPeriodId || t('billing.unavailable') }}</p>
          </div>
          <BsRecordActionDialog v-model:visible="billingVisible" :title="t('billing.review')" :submit-disabled="!reviewCommand && (!payment || !['submitted', 'under_review'].includes(payment.status))" :pending="billingPending" :dirty="billingDirty" :error="billingError" :submit-label="reviewCommand ? t('billing.retry') : t('billing.submit')" @submit="billing.save()">
            <div v-if="payment" class="space-y-4 min-w-0 break-words" data-payment-detail>
              <p class="font-semibold">{{ payment.shopName }} · {{ payment.requestedPlanName }}</p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt class="text-fg-muted">{{ t('billing.terms') }}</dt><dd>{{ payment.requestedPlanSlug }} · {{ payment.privateOfferId || t('billing.offerIdentityUnavailable') }}</dd></div>
                <div><dt class="text-fg-muted">{{ t('billing.interval') }}</dt><dd>{{ payment.billingInterval }}</dd></div>
                <div><dt class="text-fg-muted">{{ t('billing.listPrice') }}</dt><dd>{{ amount(payment.listPriceAmount, payment.currency) }}</dd></div>
                <div><dt class="text-fg-muted">{{ t('billing.effectivePrice') }}</dt><dd>{{ amount(payment.effectivePriceAmount, payment.currency) }} · {{ payment.priceSource }}</dd></div>
                <div><dt class="text-fg-muted">{{ t('billing.paidAmount') }}</dt><dd>{{ amount(payment.paidAmount, payment.currency) }}</dd></div>
                <div><dt class="text-fg-muted">{{ t('billing.transferReference') }}</dt><dd>{{ payment.transferReference }} · {{ payment.transferDate }}</dd></div>
              </dl>
              <div><h3 class="font-semibold">{{ t('billing.limits') }}</h3><p v-if="!payment.resourceLimits">{{ t('billing.missingTerms') }}</p><dl v-else class="text-sm"><div v-for="(limit, resource) in payment.resourceLimits" :key="resource"><dt>{{ resource }}</dt><dd>{{ limit === null ? t('billing.unlimited') : limit }}</dd></div></dl></div>
              <div><h3 class="font-semibold">{{ t('billing.blockers') }}</h3><p v-if="!payment.usageBlockers.length">{{ t('billing.noBlockers') }}</p><ul v-else><li v-for="blocker in payment.usageBlockers" :key="blocker.resource">{{ blocker.resource }}: {{ blocker.usage }} / {{ blocker.limit }}</li></ul></div>
              <div><h3 class="font-semibold">{{ t('billing.evidence') }}</h3><p v-if="payment.evidence === null">{{ t('billing.evidenceUnavailable') }}</p><p v-else-if="!payment.evidence.length">{{ t('billing.noEvidence') }}</p><div v-for="file in payment.evidence || []" :key="file.id" class="space-y-2"><p>{{ file.originalFileName }} · {{ file.mimeType }} · {{ file.sizeBytes }} {{ t('billing.bytes') }}</p><p class="text-xs break-all">SHA-256: {{ file.sha256 }}</p><BsButton :disabled="evidencePending" @click="billing.openEvidence(file.id)">{{ t('billing.openEvidence') }}</BsButton><a v-if="evidence?.id === file.id" :href="evidence.signedUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="block underline">{{ t('billing.evidenceLink') }}</a></div><p v-if="evidenceError" role="alert">{{ t('billing.evidenceError') }}</p></div>
              <fieldset :disabled="!!reviewCommand || !['submitted', 'under_review'].includes(payment.status)" class="space-y-4 border-0 p-0 m-0">
                <BsField for="billing-action" :label="t('billing.action')" required><BsSelect id="billing-action" v-model="reviewDraft.action" :label="t('billing.action')" :options="[{ label: t('billing.markReview'), value: 'mark_under_review', disabled: payment.status !== 'submitted' }, { label: t('billing.reject'), value: 'reject' }, { label: t('billing.approve'), value: 'approve', disabled: approvalBlocked(payment) }]" option-label="label" option-value="value" option-disabled="disabled" /></BsField>
                <p v-if="approvalBlocked(payment)" role="status">{{ t('billing.approvalBlocked') }}</p>
                <BsField for="billing-reason" :label="t('billing.reason')" required><BsTextarea id="billing-reason" v-model="reviewDraft.reason" :maxlength="1000" /></BsField>
                <template v-if="reviewDraft.action === 'approve'">
                  <BsField for="billing-verified" :label="t('billing.externalVerification')" required><BsSelect id="billing-verified" :model-value="reviewDraft.externallyVerified ? 1 : 0" :label="t('billing.externalVerification')" :options="[{ label: t('billing.unverified'), value: 0 }, { label: t('billing.verified'), value: 1 }]" option-label="label" option-value="value" @update:model-value="reviewDraft.externallyVerified = $event === 1" /></BsField>
                  <BsField for="billing-amount" :label="t('billing.receivedAmount')" required><BsInput id="billing-amount" v-model="reviewDraft.receivedAmount" inputmode="decimal" dir="ltr" /></BsField>
                  <BsField for="billing-reference" :label="t('billing.receivedReference')" required><BsInput id="billing-reference" v-model="reviewDraft.receivedReference" :maxlength="200" /></BsField>
                  <BsField for="billing-date" :label="t('billing.receivedDate')" required><BsInput id="billing-date" v-model="reviewDraft.receivedDate" type="date" dir="ltr" /></BsField>
                  <BsField for="billing-override" :label="t('billing.overrideReason')"><BsTextarea id="billing-override" v-model="reviewDraft.amountOverrideReason" :maxlength="1000" /></BsField>
                </template>
              </fieldset>
            </div>
          </BsRecordActionDialog>
        </div>
        <BsStack v-if="selection.item?.module === 'activity'" data-activity>
          <BsText size="sm" tone="muted">{{ t('activity.partial') }}</BsText>
          <BsForm layout="grid" :columns="3" @submit="activity.apply()">
            <BsField v-for="key in filterKeys" :key="key" :for="`activity-${key}`" :label="t(`activity.${key}`)">
              <BsInput :id="`activity-${key}`" v-model="activityQuery[key]" :maxlength="200" :placeholder="key === 'from' || key === 'to' ? '2026-01-01T00:00:00Z' : undefined" />
            </BsField>
            <BsButton type="submit" :disabled="activityStatus === 'loading'">{{ t('activity.filter') }}</BsButton>
          </BsForm>
          <BsStateSurface v-if="activityStatus !== 'success'" :state="activityStatus" :title="t(`activity.${activityStatus}`)" :action-label="activityStatus === 'error' ? t('activity.retry') : undefined" @action="activity.load()" />
          <BsDataTable v-if="activityStatus === 'success'" :value="activityRows" :columns="activityColumns" :label="t('activity.title')" lazy paginator :rows="activityQuery.pageSize" :first="(activityQuery.page - 1) * activityQuery.pageSize" :total-records="activityTotal" :query-adapter="activity.queryAdapter" :sort-order="activityQuery.order === 'asc' ? 1 : -1" sort-field="occurredAt" :capabilities="{}" density="compact" :scroll-label="t('activity.title')">
            <template v-for="column in activityColumns" :key="column.field" #[`cell-${column.field}`]="{ row }"><BsText :dir="column.field === 'requestId' || column.field === 'correlationId' ? 'ltr' : undefined">{{ row[column.field] || '—' }}</BsText></template>
          </BsDataTable>
          <BsStateSurface v-if="remoteFailed" state="error" :title="t('activity.remoteError')" />
          <BsInline v-for="source in activitySources" :key="`${source.bindingId}:${source.stream}`" data-activity-source>
            <BsText as="span" size="sm">{{ source.suit }} · {{ source.environment }} · {{ source.stream }}</BsText>
            <BsText as="span" size="sm">{{ t('activity.observed') }}: {{ source.lastObservedAt || t('activity.never') }}</BsText>
            <BsText as="span" size="sm" v-if="source.lastFailedAt">{{ t('activity.failed') }}: {{ source.lastFailedAt }}</BsText>
            <BsButton :pending="retrieving" :disabled="retrieving" @click="activity.retrieve(source)">{{ t('activity.retrieve') }} {{ source.nextPage }}</BsButton>
          </BsInline>
        </BsStack>
        <BsStack v-if="selection.item?.module === 'manual-transfer'" gap="lg" data-transfer>
          <BsText size="sm" tone="muted">{{ t('transfer.manual') }}</BsText>
          <BsStateSurface :state="transferStatus === 'configured' ? 'success' : transferStatus === 'loading' ? 'loading' : transferStatus === 'error' ? 'error' : transferStatus === 'denied' ? 'denied' : 'empty'" :title="t(`transfer.${transferStatus}`)" :action-label="transferStatus === 'error' || transferStatus === 'denied' ? t('registry.retry') : undefined" @action="transfer.load()" />
          <BsStack v-if="transferStatus === 'configured' && configuration" data-transfer-preview gap="sm">
            <BsText emphasis="semibold">{{ configuration.recipientAlias }}</BsText>
            <BsText wrap="preserve">{{ configuration.recipientDetails }}</BsText>
            <BsText wrap="preserve">{{ configuration.instructions[locale === 'ar' ? 'ar' : 'en'] }}</BsText>
            <BsLink v-if="configuration.paymentLink" :to="configuration.paymentLink" external target="_blank" rel="noopener noreferrer" underline="always">{{ t('transfer.link') }}</BsLink>
            <BsImage v-if="configuration.qr.assetUrl" :src="configuration.qr.assetUrl" :alt="configuration.qr.alt[locale === 'ar' ? 'ar' : 'en']" :width="192" fit="contain" loading="lazy" referrerpolicy="no-referrer" />
            <BsText v-if="configuration.qr.assetUrl" size="sm">{{ t('transfer.qrAsset') }}: {{ configuration.qr.assetUrl }} — {{ configuration.qr.alt[locale === 'ar' ? 'ar' : 'en'] }}</BsText>
          </BsStack>
          <BsButton v-if="['configured', 'empty', 'disabled', 'incomplete'].includes(transferStatus)" @click="transfer.edit()">{{ t('transfer.edit') }}</BsButton>
          <BsRecordActionDialog v-model:visible="transferVisible" :title="t('transfer.edit')" :pending="transferPending" :dirty="transferDirty" :error="transferError" :submit-label="command ? t('transfer.retrySave') : t('transfer.save')" @submit="transfer.save()">
            <BsFieldGroup :disabled="!!command">
              <BsField for="transfer-enabled" :label="t('transfer.enabled')" required>
                <BsSelect id="transfer-enabled" :label="t('transfer.enabled')" :model-value="draft.enabled === null ? null : draft.enabled ? 1 : 0" :options="[{ label: t('transfer.on'), value: 1 }, { label: t('transfer.off'), value: 0 }]" option-label="label" option-value="value" @update:model-value="draft.enabled = $event === null ? null : $event === 1" />
              </BsField>
              <BsField for="transfer-alias" :label="t('transfer.alias')"><BsInput id="transfer-alias" v-model="draft.recipientAlias" :maxlength="4000" /></BsField>
              <BsField for="transfer-details" :label="t('transfer.details')"><BsTextarea id="transfer-details" v-model="draft.recipientDetails" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="lang" :for="`transfer-instructions-${lang}`" :label="t(`transfer.instructions${lang}`)">
                <BsTextarea :id="`transfer-instructions-${lang}`" v-model="draft.instructions[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" />
              </BsField>
              <BsField for="transfer-link" :label="t('transfer.link')"><BsInput id="transfer-link" v-model="draft.paymentLink" dir="ltr" :maxlength="4000" /></BsField>
              <BsField for="transfer-qr" :label="t('transfer.qrAsset')"><BsInput id="transfer-qr" v-model="draft.qr.assetUrl" dir="ltr" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="`alt-${lang}`" :for="`transfer-alt-${lang}`" :label="t(`transfer.alt${lang}`)"><BsInput :id="`transfer-alt-${lang}`" v-model="draft.qr.alt[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" /></BsField>
              <BsField for="transfer-reason" :label="t('transfer.reason')" required><BsTextarea id="transfer-reason" v-model="reason" required :minlength="8" :maxlength="1000" /></BsField>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
        <BsStack v-if="selection.item?.module === 'custom-offers'" gap="lg" data-offers>
          <BsStateSurface v-if="!issuanceAvailable" state="empty" :title="t('offers.issuanceBlocked')" :description="t('offers.manual')" />
          <BsStateSurface v-if="offerStatus !== 'success'" :state="offerStatus" :title="t(`offers.${offerStatus}`)" :action-label="['error', 'denied'].includes(offerStatus) ? t('registry.retry') : undefined" @action="offers.load()" />
          <BsDataTable v-if="['success', 'empty'].includes(offerStatus)" :value="offerVersions" :columns="offerColumns" :label="t('offers.title')" :capabilities="{ insert: true, edit: true, void: true }" :action-labels="{ insert: t('offers.create'), edit: t('offers.amend'), void: t('offers.revoke') }" :can-row-action="(action, row) => action !== 'void' || ['saved', 'issued'].includes(row.state)" @create="offers.edit()" @edit="offers.edit($event as unknown as OfferVersion)" @void="offers.revoke($event as unknown as OfferVersion)">
            <template #cell-state="{ row }">{{ t(`offers.${row.state}`) }}</template>
            <template #cell-delivery="{ row }">
              <BsButton v-if="row.state === 'saved' && issuanceAvailable" @click="offers.issue(row)">{{ t('offers.issue') }}</BsButton>
              <BsButton v-if="row.state === 'issued' && row.customerLink" variant="text" @click="offers.viewLink(row)">{{ t('offers.viewLink') }}</BsButton>
            </template>
          </BsDataTable>
          <BsField v-if="customerLink" for="offer-customer-link" :label="t('offers.customerLink')"><BsInput id="offer-customer-link" :model-value="customerLink" type="password" readonly autocomplete="off" /><BsButton @click="offers.copyLink()">{{ t('offers.copyLink') }}</BsButton></BsField>
          <BsRecordActionDialog v-model:visible="offerVisible" :title="revokeId ? t('offers.revoke') : issueId ? t('offers.issue') : t('offers.create')" :pending="offerPending" :dirty="offerDirty" :error="offerError" :submit-label="offerRequest ? t('transfer.retrySave') : revokeId ? t('offers.revoke') : issueId ? t('offers.issue') : t('offers.save')" @submit="offers.save()">
            <BsFieldGroup :disabled="!!offerRequest">
              <template v-if="!revokeId && !issueId">
                <BsField v-for="field in offerFields" :key="field" :for="`offer-${field}`" :label="t(`offers.${field}`)" :required="field !== 'templateReference'">
                  <BsInput :id="`offer-${field}`" v-model="offerDraft[field]" :required="field !== 'templateReference'" :maxlength="field === 'displayName' ? 80 : 500" />
                </BsField>
                <BsField v-for="field in (['resourceLimits', 'entitlements'] as const)" :key="field" :for="`offer-${field}`" :label="t(`offers.${field}`)" required><BsTextarea :id="`offer-${field}`" v-model="offerDraft[field]" required dir="ltr" :maxlength="8192" /></BsField>
              </template>
              <BsField for="offer-reason" :label="t('transfer.reason')" required><BsTextarea id="offer-reason" v-model="offerReason" required :minlength="8" :maxlength="1000" /></BsField>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
        <BsStateSurface v-if="selection.item?.module === 'capabilities'" state="empty" data-registry-pending :title="t('registry.pending')" />
      </BsContentSection>
      <BsButton :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsContentSection>
  </BsRouteLayout>
  <BsAuthLayout v-else :product-name="t('product.name')" :home-label="t('product.name')" :title="t('product.name')" :description="t('auth.description')">
    <template #logo="{ tone }"><BsProductLogo :name="t('product.name')" :tone="tone" /></template>
    <BsAuthForm v-if="state === 'signed-out'" :title="t('auth.signIn')" :description="t('auth.description')" :pending="pending" :error="actionError ? t('auth.signInError') : null" :submit-label="t('auth.signIn')" :pending-label="t('auth.pending')" @submit="submit">
      <BsField for="admin-email" :label="t('auth.email')" required>
        <BsInput id="admin-email" v-model="email" type="email" autocomplete="username" required />
      </BsField>
      <BsField for="admin-password" :label="t('auth.password')" required>
        <BsInput id="admin-password" v-model="password" type="password" autocomplete="current-password" required />
      </BsField>
    </BsAuthForm>
    <BsStack v-else gap="lg">
      <BsStateSurface :state="state" :title="t(`auth.${state}`)" :description="state === 'denied' ? t('auth.deniedDescription') : undefined" :action-label="state === 'loading' ? undefined : t('auth.retry')" @action="recheck" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="signOut">{{ t('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="t('auth.actionError')" />
    </BsStack>
  </BsAuthLayout>
</template>
