<script setup lang="ts">
import Column from 'primevue/column'
import type { BsDataTableQueryAdapter } from '@building-suit/ux'
import type { BsControlPlaneView, TransferConfiguration, ActivityQuery, OfferDraft, ReviewDraft } from '../types/controlPlanePresentation'
const props = defineProps<BsControlPlaneView & { copy: Record<string, string>; locale: string }>()
const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
const draft = defineModel<TransferConfiguration>('draft', { required: true })
const reason = defineModel<string>('reason', { required: true })
const transferVisible = defineModel<boolean>('transferVisible', { required: true })
const activityQuery = defineModel<ActivityQuery>('activityQuery', { required: true })
const offerDraft = defineModel<OfferDraft>('offerDraft', { required: true })
const offerReason = defineModel<string>('offerReason', { required: true })
const offerVisible = defineModel<boolean>('offerVisible', { required: true })
const billingFilter = defineModel<string>('billingFilter', { required: true })
const billingPage = defineModel<number>('billingPage', { required: true })
const reviewDraft = defineModel<ReviewDraft>('reviewDraft', { required: true })
const billingVisible = defineModel<boolean>('billingVisible', { required: true })
const emit = defineEmits<{ signIn: []; signOut: []; retry: []; refreshRegistry: []; reloadBilling: []; reviewPayment: [id: string]; savePayment: []; openEvidence: [id: string]; applyActivity: []; reloadActivity: []; retrieveActivity: [bindingId: string, stream: 'platform' | 'billing' | 'plan']; activityPage: [page: number, pageSize: number]; activitySort: [order: 'asc' | 'desc']; reloadTransfer: []; editTransfer: []; saveTransfer: []; reloadOffers: []; editOffer: [id?: string]; revokeOffer: [id: string]; issueOffer: [id: string]; viewOfferLink: [id: string]; copyOfferLink: []; saveOffer: [] }>()
const text = (key: string) => props.copy[key] || ''
const paymentStatuses = ['submitted', 'under_review', 'approved', 'rejected'] as const
const filterKeys = ['suit', 'environment', 'action', 'actor', 'target', 'from', 'to', 'requestId', 'correlationId'] as const
const offerFields = ['recipientUserId', 'companyId', 'basePlanId', 'templateReference', 'displayName', 'priceAmount', 'currency', 'billingInterval', 'expiresAt'] as const
const activityColumns = computed(() => (['source', 'suit', 'environment', 'actor', 'action', 'target', 'status', 'reason', 'requestId', 'correlationId', 'occurredAt'] as const).map(field => ({ key: field, field, header: text(`activity.${field}`), sortable: field === 'occurredAt' })))
const offerColumns = computed(() => [...(['displayName', 'version', 'priceAmount', 'currency', 'billingInterval', 'expiresAt', 'state'] as const).map(field => ({ key: field, field, header: text(`offers.${field}`) })), { key: 'delivery', header: text('offers.delivery') }])
const activityAdapter: BsDataTableQueryAdapter = { page: event => emit('activityPage', event.page + 1, event.rows), sort: event => emit('activitySort', event.sortOrder === 1 ? 'asc' : 'desc') }
const amount = (value: number, currency: string) => new Intl.NumberFormat(props.locale, { style: 'currency', currency }).format(value)
</script>


<template>
  <BsRouteLayout v-if="state === 'success'" name="default">
    <BsContentSection :title="text('welcome')" :description="text('description')" padding="lg">
      <BsStateSurface state="success" :title="text('auth.authorized')" />
      <BsStateSurface v-if="registryState !== 'success'" :state="registryState" :title="text(`registry.${registryState}`)" :action-label="registryState === 'loading' ? undefined : text('registry.retry')" @action="emit('refreshRegistry')" />
      <BsContentSection v-else :title="heading" :description="description">
        <div v-if="module === 'payment-review'" class="space-y-4 min-w-0" data-payment-review>
          <p class="text-sm text-fg-muted">{{ text('billing.manual') }}</p>
          <BsField for="billing-filter" :label="text('billing.status')" class="max-w-xs">
            <BsSelect id="billing-filter" v-model="billingFilter" :label="text('billing.status')" :options="[{ label: text('billing.all'), value: '' }, ...paymentStatuses.map(value => ({ label: text(`billing.${value}`), value }))]" option-label="label" option-value="value" @update:model-value="billingPage = 1" />
          </BsField>
          <BsStateSurface v-if="billingStatus !== 'success'" :state="billingStatus" :title="text(`billing.${billingStatus}`)" :action-label="billingStatus === 'error' || billingStatus === 'denied' ? text('billing.reload') : undefined" @action="emit('reloadBilling')" />
          <BsDataTable v-if="queue" :value="queue.items" :label="text('billing.queue')" lazy paginator :page-size="25" :total-records="queue.total" :first="(billingPage - 1) * 25" row-key="id" :capabilities="{ edit: billingStatus === 'success' }" :loading="billingStatus === 'loading'" :action-labels="{ edit: text('billing.review') }" @edit="row => emit('reviewPayment', row.id)" @page="billingPage = $event.page + 1">
            <Column field="shopName" :header="text('billing.shop')" />
            <Column field="requestedPlanName" :header="text('billing.terms')" />
            <Column field="status" :header="text('billing.status')"><template #body="{ data }">{{ text(`billing.${data.status}`) }}</template></Column>
            <Column field="effectivePriceAmount" :header="text('billing.effectivePrice')"><template #body="{ data }">{{ amount(data.effectivePriceAmount, data.currency) }}</template></Column>
            <Column field="transferReference" :header="text('billing.transferReference')" />
          </BsDataTable>
          <BsButton v-if="reviewCommand && !billingVisible" @click="billingVisible = true">{{ text('billing.retry') }}</BsButton>
          <div v-if="receipt" role="status" class="space-y-2 break-all" data-payment-receipt>
            <p class="font-semibold">{{ text('billing.confirmed') }} · {{ text(`billing.${receipt.status}`) }} <span v-if="receipt.replayed">· {{ text('billing.replayed') }}</span></p>
            <p>{{ text('billing.request') }}: {{ receipt.requestId }} · {{ text('billing.correlation') }}: {{ receipt.correlationId }}</p>
            <p>{{ text('billing.audit') }}: {{ receipt.targetAuditId }} · {{ text('billing.resultVersion') }}: {{ receipt.targetResultVersion }}</p>
            <p v-if="receipt.subscriptionId">{{ text('billing.subscription') }}: {{ receipt.subscriptionId }} · {{ text('billing.periodEnd') }}: {{ receipt.periodEnd }}</p>
            <p v-if="receipt.status === 'approved'">{{ text('billing.commercialPeriod') }}: {{ receipt.commercialPeriodId || text('billing.unavailable') }}</p>
          </div>
          <BsRecordActionDialog v-model:visible="billingVisible" :title="text('billing.review')" :submit-disabled="!reviewCommand && (!payment || !['submitted', 'under_review'].includes(payment.status))" :pending="billingPending" :dirty="billingDirty" :error="billingError" :submit-label="reviewCommand ? text('billing.retry') : text('billing.submit')" @submit="emit('savePayment')">
            <div v-if="payment" class="space-y-4 min-w-0 break-words" data-payment-detail>
              <p class="font-semibold">{{ payment.shopName }} · {{ payment.requestedPlanName }}</p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt class="text-fg-muted">{{ text('billing.terms') }}</dt><dd>{{ payment.requestedPlanSlug }} · {{ payment.privateOfferId || text('billing.offerIdentityUnavailable') }}</dd></div>
                <div><dt class="text-fg-muted">{{ text('billing.interval') }}</dt><dd>{{ payment.billingInterval }}</dd></div>
                <div><dt class="text-fg-muted">{{ text('billing.listPrice') }}</dt><dd>{{ amount(payment.listPriceAmount, payment.currency) }}</dd></div>
                <div><dt class="text-fg-muted">{{ text('billing.effectivePrice') }}</dt><dd>{{ amount(payment.effectivePriceAmount, payment.currency) }} · {{ payment.priceSource }}</dd></div>
                <div><dt class="text-fg-muted">{{ text('billing.paidAmount') }}</dt><dd>{{ amount(payment.paidAmount, payment.currency) }}</dd></div>
                <div><dt class="text-fg-muted">{{ text('billing.transferReference') }}</dt><dd>{{ payment.transferReference }} · {{ payment.transferDate }}</dd></div>
              </dl>
              <div><h3 class="font-semibold">{{ text('billing.limits') }}</h3><p v-if="!payment.resourceLimits">{{ text('billing.missingTerms') }}</p><dl v-else class="text-sm"><div v-for="(limit, resource) in payment.resourceLimits" :key="resource"><dt>{{ resource }}</dt><dd>{{ limit === null ? text('billing.unlimited') : limit }}</dd></div></dl></div>
              <div><h3 class="font-semibold">{{ text('billing.blockers') }}</h3><p v-if="!payment.usageBlockers.length">{{ text('billing.noBlockers') }}</p><ul v-else><li v-for="blocker in payment.usageBlockers" :key="blocker.resource">{{ blocker.resource }}: {{ blocker.usage }} / {{ blocker.limit }}</li></ul></div>
              <div><h3 class="font-semibold">{{ text('billing.evidence') }}</h3><p v-if="payment.evidence === null">{{ text('billing.evidenceUnavailable') }}</p><p v-else-if="!payment.evidence.length">{{ text('billing.noEvidence') }}</p><div v-for="file in payment.evidence || []" :key="file.id" class="space-y-2"><p>{{ file.originalFileName }} · {{ file.mimeType }} · {{ file.sizeBytes }} {{ text('billing.bytes') }}</p><p class="text-xs break-all">SHA-256: {{ file.sha256 }}</p><BsButton :disabled="evidencePending" @click="emit('openEvidence', file.id)">{{ text('billing.openEvidence') }}</BsButton><a v-if="evidence?.id === file.id" :href="evidence.signedUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="block underline">{{ text('billing.evidenceLink') }}</a></div><p v-if="evidenceError" role="alert">{{ text('billing.evidenceError') }}</p></div>
              <fieldset :disabled="!!reviewCommand || !['submitted', 'under_review'].includes(payment.status)" class="space-y-4 border-0 p-0 m-0">
                <BsField for="billing-action" :label="text('billing.action')" required><BsSelect id="billing-action" v-model="reviewDraft.action" :label="text('billing.action')" :options="[{ label: text('billing.markReview'), value: 'mark_under_review', disabled: payment.status !== 'submitted' }, { label: text('billing.reject'), value: 'reject' }, { label: text('billing.approve'), value: 'approve', disabled: approvalDisabled }]" option-label="label" option-value="value" option-disabled="disabled" /></BsField>
                <p v-if="approvalDisabled" role="status">{{ text('billing.approvalBlocked') }}</p>
                <BsField for="billing-reason" :label="text('billing.reason')" required><BsTextarea id="billing-reason" v-model="reviewDraft.reason" :maxlength="1000" /></BsField>
                <template v-if="reviewDraft.action === 'approve'">
                  <BsField for="billing-verified" :label="text('billing.externalVerification')" required><BsSelect id="billing-verified" :model-value="reviewDraft.externallyVerified ? 1 : 0" :label="text('billing.externalVerification')" :options="[{ label: text('billing.unverified'), value: 0 }, { label: text('billing.verified'), value: 1 }]" option-label="label" option-value="value" @update:model-value="reviewDraft.externallyVerified = $event === 1" /></BsField>
                  <BsField for="billing-amount" :label="text('billing.receivedAmount')" required><BsInput id="billing-amount" v-model="reviewDraft.receivedAmount" inputmode="decimal" dir="ltr" /></BsField>
                  <BsField for="billing-reference" :label="text('billing.receivedReference')" required><BsInput id="billing-reference" v-model="reviewDraft.receivedReference" :maxlength="200" /></BsField>
                  <BsField for="billing-date" :label="text('billing.receivedDate')" required><BsInput id="billing-date" v-model="reviewDraft.receivedDate" type="date" dir="ltr" /></BsField>
                  <BsField for="billing-override" :label="text('billing.overrideReason')"><BsTextarea id="billing-override" v-model="reviewDraft.amountOverrideReason" :maxlength="1000" /></BsField>
                </template>
              </fieldset>
            </div>
          </BsRecordActionDialog>
        </div>
        <BsStack v-if="module === 'activity'" data-activity>
          <BsText size="sm" tone="muted">{{ text('activity.partial') }}</BsText>
          <BsForm layout="grid" :columns="3" @submit="emit('applyActivity')">
            <BsField v-for="key in filterKeys" :key="key" :for="`activity-${key}`" :label="text(`activity.${key}`)">
              <BsInput :id="`activity-${key}`" v-model="activityQuery[key]" :maxlength="200" :placeholder="key === 'from' || key === 'to' ? '2026-01-01T00:00:00Z' : undefined" />
            </BsField>
            <BsButton type="submit" :disabled="activityStatus === 'loading'">{{ text('activity.filter') }}</BsButton>
          </BsForm>
          <BsStateSurface v-if="activityStatus !== 'success'" :state="activityStatus" :title="text(`activity.${activityStatus}`)" :action-label="activityStatus === 'error' ? text('activity.retry') : undefined" @action="emit('reloadActivity')" />
          <BsDataTable v-if="activityStatus === 'success'" :value="activityRows" :columns="activityColumns" :label="text('activity.title')" lazy paginator :page-size="activityQuery.pageSize" :first="(activityQuery.page - 1) * activityQuery.pageSize" :total-records="activityTotal" :query-adapter="activityAdapter" :sort-order="activityQuery.order === 'asc' ? 1 : -1" sort-field="occurredAt" :capabilities="{}" density="compact" :scroll-label="text('activity.title')">
            <template v-for="column in activityColumns" :key="column.field" #[`cell-${column.field}`]="{ row }"><BsText :dir="column.field === 'requestId' || column.field === 'correlationId' ? 'ltr' : undefined">{{ row[column.field] || '—' }}</BsText></template>
          </BsDataTable>
          <BsStateSurface v-if="remoteFailed" state="error" :title="text('activity.remoteError')" />
          <BsInline v-for="source in activitySources" :key="`${source.bindingId}:${source.stream}`" data-activity-source>
            <BsText as="span" size="sm">{{ source.suit }} · {{ source.environment }} · {{ source.stream }}</BsText>
            <BsText as="span" size="sm">{{ text('activity.observed') }}: {{ source.lastObservedAt || text('activity.never') }}</BsText>
            <BsText as="span" size="sm" v-if="source.lastFailedAt">{{ text('activity.failed') }}: {{ source.lastFailedAt }}</BsText>
            <BsButton :pending="retrieving" :disabled="retrieving" @click="emit('retrieveActivity', source.bindingId, source.stream)">{{ text('activity.retrieve') }} {{ source.nextPage }}</BsButton>
          </BsInline>
        </BsStack>
        <BsStack v-if="module === 'manual-transfer'" gap="lg" data-transfer>
          <BsText size="sm" tone="muted">{{ text('transfer.manual') }}</BsText>
          <BsStateSurface :state="transferStatus === 'configured' ? 'success' : transferStatus === 'loading' ? 'loading' : transferStatus === 'error' ? 'error' : transferStatus === 'denied' ? 'denied' : 'empty'" :title="text(`transfer.${transferStatus}`)" :action-label="transferStatus === 'error' || transferStatus === 'denied' ? text('registry.retry') : undefined" @action="emit('reloadTransfer')" />
          <BsStack v-if="transferStatus === 'configured' && configuration" data-transfer-preview gap="sm">
            <BsText emphasis="semibold">{{ configuration.recipientAlias }}</BsText>
            <BsText wrap="preserve">{{ configuration.recipientDetails }}</BsText>
            <BsText wrap="preserve">{{ configuration.instructions[locale === 'ar' ? 'ar' : 'en'] }}</BsText>
            <BsLink v-if="configuration.paymentLink" :to="configuration.paymentLink" external target="_blank" rel="noopener noreferrer" underline="always">{{ text('transfer.link') }}</BsLink>
            <BsImage v-if="configuration.qr.assetUrl" :src="configuration.qr.assetUrl" :alt="configuration.qr.alt[locale === 'ar' ? 'ar' : 'en']" :width="192" fit="contain" loading="lazy" referrerpolicy="no-referrer" />
            <BsText v-if="configuration.qr.assetUrl" size="sm">{{ text('transfer.qrAsset') }}: {{ configuration.qr.assetUrl }} — {{ configuration.qr.alt[locale === 'ar' ? 'ar' : 'en'] }}</BsText>
          </BsStack>
          <BsButton v-if="['configured', 'empty', 'disabled', 'incomplete'].includes(transferStatus)" @click="emit('editTransfer')">{{ text('transfer.edit') }}</BsButton>
          <BsRecordActionDialog v-model:visible="transferVisible" :title="text('transfer.edit')" :pending="transferPending" :dirty="transferDirty" :error="transferError" :submit-label="command ? text('transfer.retrySave') : text('transfer.save')" @submit="emit('saveTransfer')">
            <BsFieldGroup :disabled="!!command">
              <BsField for="transfer-enabled" :label="text('transfer.enabled')" required>
                <BsSelect id="transfer-enabled" :label="text('transfer.enabled')" :model-value="draft.enabled === null ? null : draft.enabled ? 1 : 0" :options="[{ label: text('transfer.on'), value: 1 }, { label: text('transfer.off'), value: 0 }]" option-label="label" option-value="value" @update:model-value="draft.enabled = $event === null ? null : $event === 1" />
              </BsField>
              <BsField for="transfer-alias" :label="text('transfer.alias')"><BsInput id="transfer-alias" v-model="draft.recipientAlias" :maxlength="4000" /></BsField>
              <BsField for="transfer-details" :label="text('transfer.details')"><BsTextarea id="transfer-details" v-model="draft.recipientDetails" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="lang" :for="`transfer-instructions-${lang}`" :label="text(`transfer.instructions${lang}`)">
                <BsTextarea :id="`transfer-instructions-${lang}`" v-model="draft.instructions[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" />
              </BsField>
              <BsField for="transfer-link" :label="text('transfer.link')"><BsInput id="transfer-link" v-model="draft.paymentLink" dir="ltr" :maxlength="4000" /></BsField>
              <BsField for="transfer-qr" :label="text('transfer.qrAsset')"><BsInput id="transfer-qr" v-model="draft.qr.assetUrl" dir="ltr" :maxlength="4000" /></BsField>
              <BsField v-for="lang in (['en', 'ar'] as const)" :key="`alt-${lang}`" :for="`transfer-alt-${lang}`" :label="text(`transfer.alt${lang}`)"><BsInput :id="`transfer-alt-${lang}`" v-model="draft.qr.alt[lang]" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :maxlength="4000" /></BsField>
              <BsField for="transfer-reason" :label="text('transfer.reason')" required><BsTextarea id="transfer-reason" v-model="reason" required :minlength="8" :maxlength="1000" /></BsField>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
        <BsStack v-if="module === 'custom-offers'" gap="lg" data-offers>
          <BsStateSurface v-if="!issuanceAvailable" state="empty" :title="text('offers.issuanceBlocked')" :description="text('offers.manual')" />
          <BsStateSurface v-if="offerStatus !== 'success'" :state="offerStatus" :title="text(`offers.${offerStatus}`)" :action-label="['error', 'denied'].includes(offerStatus) ? text('registry.retry') : undefined" @action="emit('reloadOffers')" />
          <BsDataTable v-if="['success', 'empty'].includes(offerStatus)" :value="offerVersions" :columns="offerColumns" :label="text('offers.title')" :capabilities="{ insert: true, edit: true, void: true }" :action-labels="{ insert: text('offers.create'), edit: text('offers.amend'), void: text('offers.revoke') }" :can-row-action="(action, row) => action !== 'void' || ['saved', 'issued'].includes(row.state)" @create="emit('editOffer')" @edit="emit('editOffer', $event.id)" @void="emit('revokeOffer', $event.id)">
            <template #cell-state="{ row }">{{ text(`offers.${row.state}`) }}</template>
            <template #cell-delivery="{ row }">
              <BsButton v-if="row.state === 'saved' && issuanceAvailable" @click="emit('issueOffer', row.id)">{{ text('offers.issue') }}</BsButton>
              <BsButton v-if="row.state === 'issued' && row.customerLink" variant="text" @click="emit('viewOfferLink', row.id)">{{ text('offers.viewLink') }}</BsButton>
            </template>
          </BsDataTable>
          <BsField v-if="customerLink" for="offer-customer-link" :label="text('offers.customerLink')"><BsInput id="offer-customer-link" :model-value="customerLink" type="password" readonly autocomplete="off" /><BsButton @click="emit('copyOfferLink')">{{ text('offers.copyLink') }}</BsButton></BsField>
          <BsRecordActionDialog v-model:visible="offerVisible" :title="revokeId ? text('offers.revoke') : issueId ? text('offers.issue') : text('offers.create')" :pending="offerPending" :dirty="offerDirty" :error="offerError" :submit-label="offerRequest ? text('transfer.retrySave') : revokeId ? text('offers.revoke') : issueId ? text('offers.issue') : text('offers.save')" @submit="emit('saveOffer')">
            <BsFieldGroup :disabled="!!offerRequest">
              <template v-if="!revokeId && !issueId">
                <BsField v-for="field in offerFields" :key="field" :for="`offer-${field}`" :label="text(`offers.${field}`)" :required="field !== 'templateReference'">
                  <BsInput :id="`offer-${field}`" v-model="offerDraft[field]" :required="field !== 'templateReference'" :maxlength="field === 'displayName' ? 80 : 500" />
                </BsField>
                <BsField v-for="field in (['resourceLimits', 'entitlements'] as const)" :key="field" :for="`offer-${field}`" :label="text(`offers.${field}`)" required><BsTextarea :id="`offer-${field}`" v-model="offerDraft[field]" required dir="ltr" :maxlength="8192" /></BsField>
              </template>
              <BsField for="offer-reason" :label="text('transfer.reason')" required><BsTextarea id="offer-reason" v-model="offerReason" required :minlength="8" :maxlength="1000" /></BsField>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
        <BsStateSurface v-if="module === 'capabilities'" state="empty" data-registry-pending :title="text('registry.pending')" />
      </BsContentSection>
      <BsButton :pending="pending" @click="emit('signOut')">{{ text('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="text('auth.actionError')" />
    </BsContentSection>
  </BsRouteLayout>
  <BsAuthLayout v-else :product-name="text('product.name')" :home-label="text('product.name')" :title="text('product.name')" :description="text('auth.description')">
    <template #logo="{ tone }"><BsProductLogo :name="text('product.name')" :tone="tone" /></template>
    <BsAuthForm v-if="state === 'signed-out'" :title="text('auth.signIn')" :description="text('auth.description')" :pending="pending" :error="actionError ? text('auth.signInError') : null" :submit-label="text('auth.signIn')" :pending-label="text('auth.pending')" @submit="emit('signIn')">
      <BsField for="admin-email" :label="text('auth.email')" required>
        <BsInput id="admin-email" v-model="email" type="email" autocomplete="username" required />
      </BsField>
      <BsField for="admin-password" :label="text('auth.password')" required>
        <BsInput id="admin-password" v-model="password" type="password" autocomplete="current-password" required />
      </BsField>
    </BsAuthForm>
    <BsStack v-else gap="lg">
      <BsStateSurface :state="state" :title="text(`auth.${state}`)" :description="state === 'denied' ? text('auth.deniedDescription') : undefined" :action-label="state === 'loading' ? undefined : text('auth.retry')" @action="emit('retry')" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="emit('signOut')">{{ text('auth.signOut') }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="text('auth.actionError')" />
    </BsStack>
  </BsAuthLayout>
</template>
