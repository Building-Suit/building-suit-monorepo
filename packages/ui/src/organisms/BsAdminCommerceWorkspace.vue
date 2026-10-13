<script setup lang="ts">
import type { BsAdminCommerceCopy, BsAdminCommerceView, BsAdminPlanCopy, BsAdminPlanForms, BsAdminSupportForm, BsAdminReceiptReviewForm, BsAdminPriceForm, BsAdminPaymentConfigurationForm } from '../types/platformAdministrationPresentation'
defineProps<{ copy: BsAdminCommerceCopy; view: BsAdminCommerceView; planCopy: BsAdminPlanCopy }>()
const catalogTerms = defineModel<BsAdminPlanForms['terms']>('catalogTerms', { required: true })
const catalogAvailability = defineModel<BsAdminPlanForms['availability']>('catalogAvailability', { required: true })
const catalogChange = defineModel<BsAdminPlanForms['change']>('catalogChange', { required: true })
const catalogPrice = defineModel<BsAdminPlanForms['price']>('catalogPrice', { required: true })
const tenantTerms = defineModel<BsAdminPlanForms['terms']>('tenantTerms', { required: true })
const tenantAvailability = defineModel<BsAdminPlanForms['availability']>('tenantAvailability', { required: true })
const tenantChange = defineModel<BsAdminPlanForms['change']>('tenantChange', { required: true })
const tenantPrice = defineModel<BsAdminPlanForms['price']>('tenantPrice', { required: true })
const support = defineModel<BsAdminSupportForm>('support', { required: true })
const receipt = defineModel<BsAdminReceiptReviewForm>('receipt', { required: true })
const price = defineModel<BsAdminPriceForm>('price', { required: true })
const configuration = defineModel<BsAdminPaymentConfigurationForm>('configuration', { required: true })
const emit = defineEmits<{
  select: [value: BsAdminCommerceView['selected']]; search: [value: string]; status: [value: string]; retry: [key: 'session' | 'overview' | 'tenants' | 'catalog' | 'audit' | 'billing' | 'billingAudit' | 'configuration' | 'detail' | 'subscription']; page: [key: 'tenants' | 'audit' | 'billing' | 'billingAudit', event: { page: number }]; openTenant: [id: string]; closeTenant: []; billingStatus: [value: string]
  plan: [scope: 'catalog' | 'tenant', action: 'terms' | 'availability' | 'change' | 'override' | 'renew' | 'suspend' | 'removePrice' | 'close' | 'publishTerms' | 'saveAvailability' | 'saveChange' | 'savePrice', id?: string]
  review: [id: string, action: 'mark_under_review' | 'approve' | 'reject']; price: [id: string]; support: [key: string]; configure: []; closeDialog: [key: 'support' | 'receipt' | 'price' | 'configuration']; submitSupport: []; submitReceipt: []; submitPrice: []; submitConfiguration: []
}>()
</script>
<template>
  <BsStack>
    <BsText v-if="view.role" role="status">{{ view.role }}</BsText><BsSectionSkeleton v-if="view.loading" :aria-label="copy.loading" variant="cards"/>
    <BsStateSurface v-else-if="view.error" state="error" :title="copy.loadFailed" :action-label="copy.retry" @action="emit('retry', 'session')" />
    <BsStack v-else-if="view.denied"><BsStateSurface state="denied" :title="copy.denied" :description="copy.accessHint" :action-label="copy.retry" @action="emit('retry', 'session')"/></BsStack>
    <template v-else>
      <BsInline role="group" :aria-label="copy.overview"><BsButton v-for="tab in (['overview', 'plans', 'billing', 'audit'] as const)" :key="tab" variant="chip" :aria-pressed="view.selected === tab" @click="emit('select', tab)">{{ tab === 'billing' ? copy.billingQueue : copy[tab] }}</BsButton></BsInline>
      <template v-if="view.selected === 'overview'">
        <BsText v-if="view.overviewError" role="alert">{{ view.overviewError }} <BsButton variant="link" @click="emit('retry', 'overview')">{{ copy.retry }}</BsButton></BsText>
        <BsGrid :aria-busy="view.overviewPending" :columns="2"><BsKpiCard v-for="metric in view.metrics" :key="metric.label" :title="metric.label">{{ metric.value }}</BsKpiCard></BsGrid>
        <BsPanel padding="md"><BsStack><BsInput :model-value="view.search" type="search" :placeholder="copy.search" :aria-label="copy.search" @update:model-value="emit('search', String($event ?? ''))"/><BsSelect :model-value="view.status" :label="copy.status" :options="view.statusChoices" option-label="label" option-value="value" @update:model-value="emit('status', String($event))"/></BsStack>
          <BsDataTable :value="view.tenants.rows" :loading="view.tenants.loading" :error="view.tenants.error" :label="copy.tenants" data-key="id" lazy paginator :rows="20" :first="view.tenants.first" :total-records="view.tenants.total" :always-show-paginator="false" :columns="[{ key: 'name', header: copy.tenant }, { key: 'owner', header: copy.owner }, { key: 'status', header: copy.access }, { key: 'plan', field: 'plan', header: copy.plan }, { key: 'members', field: 'members', header: copy.members }, { key: 'open', header: '' }]" @page="emit('page', 'tenants', $event)" @retry="emit('retry', 'tenants')"><template #cell-name="{ row }"><BsText as="p" emphasis="semibold">{{ row.name }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.id }}</BsText></template><template #cell-owner="{ row }"><BsText as="p">{{ row.owner }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.email }}</BsText></template><template #cell-status="{ row }"><BsStatusBadge :status="row.status"/></template><template #cell-open="{ row }"><BsButton variant="link" @click="emit('openTenant', row.id)">{{ copy.open }}</BsButton></template><template #empty>{{ copy.noRows }}</template></BsDataTable>
        </BsPanel><BsPanel padding="md"><BsHeading :level="2">{{ copy.recentEvents }}</BsHeading><BsAdminAuditTable :title="copy.recentEvents" :copy="copy" :view="view.recent" :paginated="false" :show-actor="false"/></BsPanel>
      </template>
      <template v-else-if="view.selected === 'plans'">
        <BsPanel padding="md"><BsHeading :level="2">{{ planCopy.catalog }}</BsHeading><BsText size="sm" tone="muted">{{ planCopy.catalogHelp }}</BsText><BsText v-if="!view.canMutate" size="sm" emphasis="semibold">{{ planCopy.observer }}</BsText>
          <BsDataTable :value="view.plans.rows" :loading="view.plans.loading" :error="view.plans.error" :label="planCopy.catalog" data-key="id" :columns="[{ key: 'name', header: planCopy.plan }, { key: 'state', header: planCopy.state }, { key: 'price', field: 'price', header: planCopy.price }, { key: 'limits', header: planCopy.limits }, { key: 'version', header: planCopy.version }, { key: 'subscriptions', field: 'subscriptions', header: planCopy.subscriptions }, { key: 'actions', header: planCopy.actions, hidden: !view.canMutate }]" @retry="emit('retry', 'catalog')"><template #cell-name="{ row }"><BsText as="p" emphasis="semibold">{{ row.name }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.slug }}</BsText></template><template #cell-state="{ row }"><BsText as="p">{{ row.state }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.availability }}</BsText></template><template #cell-limits="{ row }"><BsList><BsListItem v-for="limit in row.limits" :key="limit.id">{{ limit.label }}: {{ limit.value }}</BsListItem></BsList></template><template #cell-version="{ row }"><BsText as="p">{{ row.version }}</BsText><BsText v-if="row.next" as="p" size="xs" tone="warning" emphasis="semibold">{{ row.next }}</BsText></template><template #cell-actions="{ row }"><BsInline><BsButton @click="emit('plan', 'catalog', 'terms', row.id)">{{ planCopy.editTerms }}</BsButton><BsButton @click="emit('plan', 'catalog', 'availability', row.id)">{{ planCopy.availability }}</BsButton></BsInline></template><template #empty>{{ planCopy.noPlans }}</template></BsDataTable>
        </BsPanel>
      </template>
      <BsPanel v-else-if="view.selected === 'audit'" padding="md"><BsAdminAuditTable :title="copy.audit" :copy="copy" :view="view.audit" @page="emit('page', 'audit', $event)" @retry="emit('retry', 'audit')"/></BsPanel>
      <template v-else>
        <BsPanel padding="md"><BsHeading :level="2">{{ copy.configuration }}</BsHeading><BsText size="sm" tone="muted">{{ copy.configurationHelp }}</BsText><BsText v-if="view.configuration.loadError" role="alert">{{ view.configuration.loadError }} <BsButton @click="emit('retry', 'configuration')">{{ copy.retry }}</BsButton></BsText><BsButton v-else :disabled="!view.canMutate" @click="emit('configure')">{{ copy.save }}</BsButton></BsPanel>
        <BsPanel padding="md"><BsInline><BsHeading :level="2">{{ copy.billingQueue }}</BsHeading><BsSelect :model-value="view.billing.status" :label="copy.status" :options="view.billing.statusChoices" option-label="label" option-value="value" @update:model-value="emit('billingStatus', String($event))"/></BsInline>
          <BsDataTable density="compact" :value="view.billing.rows" :loading="view.billing.loading" :error="view.billing.error" :label="copy.billingQueue" data-key="id" lazy paginator :rows="25" :first="view.billing.first" :total-records="view.billing.total" :always-show-paginator="false" :columns="[{ key: 'tenant', header: copy.tenant, width: 'md' }, { key: 'terms', header: copy.requestedPlan, width: 'lg' }, { key: 'payment', header: copy.paid, width: 'sm' }, { key: 'review', header: copy.review, width: 'lg', hidden: !view.canMutate }]" @page="emit('page', 'billing', $event)" @retry="emit('retry', 'billing')">
            <template #cell-tenant="{ row }">
              <BsStack gap="xs">
                <BsText emphasis="semibold">{{ row.tenant }}</BsText>
                <BsStatusBadge :status="row.status" :label="view.billing.statusChoices.find(option => option.value === row.status)?.label" />
                <BsText size="xs" tone="muted">{{ copy.date }}: {{ row.date }}</BsText>
              </BsStack>
            </template>
            <template #cell-terms="{ row }">
              <BsStack gap="xs">
                <BsText emphasis="semibold">{{ row.requestedPlan }}</BsText>
                <BsText size="xs" tone="muted">{{ copy.currentPlan }}: {{ row.currentPlan }}</BsText>
                <BsText size="sm">{{ copy.listPrice }}: {{ row.listPrice }}</BsText>
                <BsInline gap="xs" wrap><BsText size="sm" emphasis="semibold">{{ copy.effectivePrice }}: {{ row.effectivePrice }}</BsText><BsText v-if="row.negotiated" size="xs" emphasis="semibold">{{ copy.negotiated }}</BsText></BsInline>
                <BsText size="xs" :tone="row.approveDisabled ? 'warning' : 'muted'">{{ copy.blockers }}: {{ row.blockers }}</BsText>
              </BsStack>
            </template>
            <template #cell-payment="{ row }">
              <BsStack gap="xs">
                <BsText emphasis="semibold">{{ row.paid }}</BsText>
                <BsText size="xs" tone="muted">{{ copy.reference }}: {{ row.reference }}</BsText>
              </BsStack>
            </template>
            <template #cell-review="{ row }">
              <BsStack gap="xs">
                <template v-if="row.canReview">
                  <BsButton v-if="row.canStart" variant="secondary" @click="emit('review', row.id, 'mark_under_review')">{{ copy.startReview }}</BsButton>
                  <BsButton :disabled="row.approveDisabled" @click="emit('review', row.id, 'approve')">{{ copy.approve }}</BsButton>
                  <BsButton variant="secondary" @click="emit('review', row.id, 'reject')">{{ copy.reject }}</BsButton>
                </template>
                <BsButton variant="link" @click="emit('price', row.id)">{{ copy.overridePrice }}</BsButton>
              </BsStack>
            </template>
            <template #empty>{{ copy.emptyBilling }}</template>
          </BsDataTable>
        </BsPanel><BsPanel padding="md"><BsHeading :level="2">{{ copy.billingQueue }} · {{ copy.audit }}</BsHeading><BsAdminAuditTable :title="copy.billingQueue + ' ' + copy.audit" :copy="copy" :view="view.billingAudit" @page="emit('page', 'billingAudit', $event)" @retry="emit('retry', 'billingAudit')"/></BsPanel>
      </template>
    </template>
    <BsAdminPlanDialogs v-model:terms="catalogTerms" v-model:availability="catalogAvailability" v-model:change="catalogChange" v-model:price="catalogPrice" :copy="planCopy" :view="view.plans.dialog" @close="emit('plan', 'catalog', 'close')" @publish-terms="emit('plan', 'catalog', 'publishTerms')" @availability="emit('plan', 'catalog', 'saveAvailability')" @change="emit('plan', 'catalog', 'saveChange')" @renew="emit('plan', 'catalog', 'renew')" @suspend="emit('plan', 'catalog', 'suspend')" @price="emit('plan', 'catalog', 'savePrice')" @remove-price="emit('plan', 'catalog', 'removePrice')"/>
    <BsDialog :visible="view.detail.visible" :title="view.detail.title" size="lg" :pending="view.detail.pending" @update:visible="value => { if (!value) emit('closeTenant') }">
      <BsSectionSkeleton v-if="view.detail.pending" :aria-label="copy.loading" :rows="3" />
      <BsText v-else-if="view.detail.error" role="alert">{{ view.detail.error }} <BsButton variant="link" @click="emit('retry', 'detail')">{{ copy.retry }}</BsButton></BsText>
      <BsStack v-else-if="view.detail.available">
        <BsGrid :columns="4"><BsKpiCard v-for="metric in view.detail.metrics" :key="metric.label" :title="metric.label"><BsStatusBadge v-if="metric.status" :status="metric.status"/><template v-else>{{ metric.value }}</template></BsKpiCard></BsGrid>
        <BsBox as="section"><BsHeading :level="3">{{ copy.usage }}</BsHeading><BsText size="sm" tone="muted">{{ view.detail.trial }}</BsText><BsText size="sm" tone="muted">{{ view.detail.usage }}</BsText><BsCodeBlock>{{ view.detail.limits }}</BsCodeBlock></BsBox>
        <BsText v-if="view.detail.subscriptionError" role="alert">{{ view.detail.subscriptionError }} <BsButton @click="emit('retry', 'subscription')">{{ planCopy.retry }}</BsButton></BsText><BsSkeleton v-else-if="view.detail.subscriptionPending"/>
        <template v-else-if="view.detail.subscriptionAvailable"><BsGrid :columns="4"><BsKpiCard v-for="metric in view.detail.subscriptionMetrics" :key="metric.label" :title="metric.label"><BsStatusBadge v-if="metric.status" :status="metric.status"/><template v-else>{{ metric.value }}</template></BsKpiCard></BsGrid><BsBox><BsHeading :level="4">{{ planCopy.usage }}</BsHeading><BsGrid :columns="2"><BsBox v-for="item in view.detail.resources" :key="item.id"><BsText emphasis="semibold">{{ item.label }}</BsText><BsText>{{ item.value }}</BsText></BsBox></BsGrid></BsBox><BsBox padding="md"><BsHeading :level="4">{{ planCopy.pendingChange }}</BsHeading><BsText size="sm">{{ view.detail.pendingChange }}</BsText></BsBox><BsInline v-if="view.canMutate"><BsButton @click="emit('plan', 'tenant', 'change')">{{ planCopy.changePlan }}</BsButton><BsButton @click="emit('plan', 'tenant', 'renew')">{{ planCopy.renew }}</BsButton><BsButton @click="emit('plan', 'tenant', 'override')">{{ planCopy.setPrice }}</BsButton><BsButton v-if="view.detail.canRemovePrice" @click="emit('plan', 'tenant', 'removePrice')">{{ planCopy.removePrice }}</BsButton><BsButton @click="emit('plan', 'tenant', 'suspend')">{{ planCopy.suspend }}</BsButton></BsInline></template>
        <BsBox v-if="view.canMutate" as="section"><BsHeading :level="3">{{ copy.controls }}</BsHeading><BsInline><BsButton v-for="action in view.detail.controls" :key="action.value" @click="emit('support', action.value)">{{ action.label }}</BsButton></BsInline></BsBox>
        <BsBox as="section"><BsHeading :level="3">{{ copy.billingHistory }}</BsHeading><BsDataTable :value="view.detail.billing" data-key="id" :label="copy.billingHistory" :columns="[{ key: 'action', field: 'action', header: copy.action }, { key: 'status', header: copy.status }, { key: 'reference', field: 'reference', header: copy.billingReference }, { key: 'occurred', field: 'occurred', header: copy.occurred }]"><template #cell-status="{ row }"><BsStatusBadge :status="row.status"/></template><template #empty>{{ copy.emptyBilling }}</template></BsDataTable></BsBox>
        <BsBox as="section"><BsHeading :level="3">{{ copy.sensitive }}</BsHeading><BsDataTable :value="view.detail.sensitive" data-key="id" :label="copy.sensitive" :columns="[{ key: 'status', field: 'status', header: copy.status }, { key: 'action', field: 'action', header: copy.action }, { key: 'reason', field: 'reason', header: copy.reason }, { key: 'occurred', field: 'occurred', header: copy.occurred }]"><template #empty>{{ copy.emptySensitive }}</template></BsDataTable></BsBox>
        <BsBox as="section"><BsHeading :level="3">{{ copy.notes }}</BsHeading><BsList v-if="view.detail.notes.length"><BsListItem v-for="note in view.detail.notes" :key="note.id"><BsText as="p">{{ note.note }}</BsText><BsText as="p" size="xs" tone="muted">{{ note.detail }}</BsText></BsListItem></BsList><BsText v-else size="sm" tone="muted">{{ copy.emptyNotes }}</BsText></BsBox>
      </BsStack>
    </BsDialog>
    <BsAdminPlanDialogs v-model:terms="tenantTerms" v-model:availability="tenantAvailability" v-model:change="tenantChange" v-model:price="tenantPrice" :copy="planCopy" :view="view.tenantPlanDialog" @close="emit('plan', 'tenant', 'close')" @publish-terms="emit('plan', 'tenant', 'publishTerms')" @availability="emit('plan', 'tenant', 'saveAvailability')" @change="emit('plan', 'tenant', 'saveChange')" @renew="emit('plan', 'tenant', 'renew')" @suspend="emit('plan', 'tenant', 'suspend')" @price="emit('plan', 'tenant', 'savePrice')" @remove-price="emit('plan', 'tenant', 'removePrice')"/>
    <BsAdminCommerceDialogs v-model:support="support" v-model:receipt="receipt" v-model:price="price" v-model:configuration="configuration" :copy="copy" :view="view" @close="emit('closeDialog', $event)" @support="emit('submitSupport')" @receipt="emit('submitReceipt')" @price="emit('submitPrice')" @configuration="emit('submitConfiguration')"/>
  </BsStack>
</template>
