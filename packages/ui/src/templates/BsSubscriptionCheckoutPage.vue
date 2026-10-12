<script setup lang="ts">
import type { BsBillingCopy, BsBillingView, BsBillingForm, BsManualPaymentView, BsPlanImpactView } from '../types/billingPresentation'
import type { BsCheckoutWorkspace, BsWorkspaceCreationForm, BsWorkspaceCreationView } from '../types/workspaceCreationPresentation'
defineProps<{ copy: BsBillingCopy; view: BsBillingView; manual: BsManualPaymentView; impact: BsPlanImpactView; workspace: BsCheckoutWorkspace; creation: BsWorkspaceCreationView; gate: { loading: boolean; visible: boolean; eyebrow: string; title: string; description: string; features: string[]; processing: boolean; processingLabel: string; retry: string; failed: string } }>()
const form = defineModel<BsBillingForm>('form', { required: true })
const creationForm = defineModel<BsWorkspaceCreationForm>('creationForm', { required: true })
const emit = defineEmits<{ signOut: []; workspace: [id: string]; createWorkspace: []; closeCreation: []; submitCreation: []; checkAgain: []; usageRetry: []; pricingRetry: []; interval: [value: string]; plan: [id: string]; manualPlan: [id: string]; requests: []; manualClose: []; manualRefresh: []; manualSelect: [id: string]; manualFile: [event: Event]; manualSubmit: []; manualCancel: []; manualDownload: [id: string]; openSubscription: []; impactClose: [] }>()
</script>
<template>
  <BsWorkspaceShell :product-name="workspace.productName" :groups="[]" :labels="workspace.labels" :logo="{ kind: 'product', assetPrefix: workspace.assetPrefix }" :account="{ email: workspace.email, label: workspace.accountLabel, signOut: workspace.signOut }" :workspace="workspace.selector" @sign-out="emit('signOut')" @workspace="emit('workspace', $event)" @create-workspace="emit('createWorkspace')">
    <BsStateSurface v-if="gate.loading" state="loading" :title="copy.loading"/>
    <BsStack v-else-if="gate.visible" gap="lg"><BsText size="sm" emphasis="semibold">{{ gate.eyebrow }}</BsText><BsPageHeader :title="gate.title" :subtitle="gate.description"/><BsList marker="none"><BsListItem v-for="feature in gate.features" :key="feature"><BsIcon name="check" :size="18"/>{{ feature }}</BsListItem></BsList><BsPanel v-if="gate.processing" role="status" padding="md"><BsText emphasis="semibold">{{ gate.processingLabel }}</BsText><BsButton variant="link" :disabled="gate.loading" @click="emit('checkAgain')">{{ gate.retry }}</BsButton></BsPanel><BsText v-else-if="gate.failed" role="alert">{{ gate.failed }}</BsText>
      <BsBillingPage v-model:form="form" :copy="copy" :view="view" :manual="manual" :impact="impact" :show-header="false" @usage-retry="emit('usageRetry')" @pricing-retry="emit('pricingRetry')" @interval="emit('interval', $event)" @plan="emit('plan', $event)" @manual-plan="emit('manualPlan', $event)" @requests="emit('requests')" @manual-close="emit('manualClose')" @manual-refresh="emit('manualRefresh')" @manual-select="emit('manualSelect', $event)" @manual-file="emit('manualFile', $event)" @manual-submit="emit('manualSubmit')" @manual-cancel="emit('manualCancel')" @manual-download="emit('manualDownload', $event)" @open-subscription="emit('openSubscription')" @impact-close="emit('impactClose')"/>
    </BsStack>
    <BsWorkspaceCreationDialog v-model:form="creationForm" :view="creation" @close="emit('closeCreation')" @submit="emit('submitCreation')"/>
  </BsWorkspaceShell>
</template>
